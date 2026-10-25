// One looping song per level, played with plain <audio> elements.
//
// main.ts says four things: which level is on (`start`), whether the song
// should be heard right now (`setActive`), whether the speaker is muted
// (`setMuted`), and how loud it is (`setVolume`). This file turns those into
// play() and pause() calls. Those run only when the answer changes, not on every frame.
//
// Deaths, info panels, and the level-clear panel keep `active` true, so the
// song never restarts for those. The pause menu sets it false, and the song
// waits where it was. Leaving for the level select calls `stop`.
//
// Browsers refuse to start sound until the visitor clicks or presses a key.
// If play() is refused, we try again on the next click or key press.
// If a file is missing or will not decode, that track is skipped quietly
// and the game keeps running without it.

export interface Music {
  /** Start this level's song from the beginning. Stops any other song. */
  start(index: number): void;
  /** Stop and rewind. Used when leaving for the level select, and on page exit. */
  stop(): void;
  /**
   * True while this level's song should be heard.
   * That includes play, death, an info panel, and the level-clear panel.
   * False for the pause menu.
   */
  setActive(active: boolean): void;
  setMuted(muted: boolean): void;
  /** Loudness from 0 (silent) to 1 (full). Does not mute or unmute. */
  setVolume(volume: number): void;
  destroy(): void;
}

export function createMusic(files: string[], startMuted: boolean, startVolume: number): Music {
  const base = import.meta.env.BASE_URL;
  const tracks: (HTMLAudioElement | null)[] = files.map(() => null);
  const broken = new Set<number>();
  let current = -1;
  let active = false;
  let muted = startMuted;
  /** play() was refused for lack of a click or key press. */
  let waitingForGesture = false;

  function clampVolume(value: number): number {
    if (!Number.isFinite(value)) return 0.6;
    return Math.min(1, Math.max(0, value));
  }

  let volume = clampVolume(startVolume);

  function track(index: number): HTMLAudioElement | null {
    if (broken.has(index) || !files[index]) return null;
    let el = tracks[index];
    if (!el) {
      // preload "none": nothing downloads until the level is actually entered.
      el = new Audio();
      el.preload = "none";
      el.loop = true;
      el.volume = volume;
      el.addEventListener("error", () => {
        // A released element has left its slot; a late error from it is not a failure.
        if (tracks[index] === el) markBroken(index);
      });
      el.src = `${base}audio/${files[index]}`;
      tracks[index] = el;
    }
    return el;
  }

  function markBroken(index: number) {
    broken.add(index);
    tracks[index]?.removeAttribute("src");
    tracks[index] = null;
  }

  // Unload a track so the browser can drop its media buffers. load() after
  // removing src is what performs the release. The file stays in the browser's
  // disk cache, so a later start() does not download it again.
  function release(index: number) {
    const el = tracks[index];
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    // Clear the slot before unloading so a late error event cannot mark it broken.
    tracks[index] = null;
    el.removeAttribute("src");
    el.load();
  }

  function shouldPlay(): boolean {
    return current >= 0 && active && !muted;
  }

  // Make the element match shouldPlay(). Safe to call as often as you like.
  function apply() {
    if (current < 0) return;
    const el = track(current);
    if (!el) return;
    if (shouldPlay()) {
      if (!el.paused) return;
      const index = current;
      el.play().catch((err: unknown) => {
        const name = err instanceof DOMException ? err.name : "";
        if (name === "NotAllowedError") waitingForGesture = true;
        // AbortError means pause() ran before play() finished. That is expected.
        else if (name !== "AbortError") markBroken(index);
      });
    } else if (!el.paused) {
      el.pause();
    }
  }

  function onGesture() {
    if (!waitingForGesture) return;
    waitingForGesture = false;
    apply();
  }

  function stop() {
    // Unload every track, not just the current one, so no song stays in memory.
    for (let i = 0; i < tracks.length; i += 1) release(i);
    current = -1;
    active = false;
  }

  // Switching tabs must not pause the song. If the browser paused the
  // element anyway, start it again when this tab is showing.
  function onVisible() {
    if (!document.hidden) apply();
  }

  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pagehide", stop);

  return {
    start(index) {
      stop();
      current = index;
      active = true;
      apply();
    },
    stop,
    setActive(next) {
      if (next === active) return;
      active = next;
      apply();
    },
    setMuted(next) {
      muted = next;
      apply();
    },
    setVolume(next) {
      volume = clampVolume(next);
      for (const el of tracks) {
        if (el) el.volume = volume;
      }
    },
    destroy() {
      stop();
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", stop);
    },
  };
}
