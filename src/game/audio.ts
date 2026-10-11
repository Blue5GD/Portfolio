// One looping song per level, played with plain <audio> elements.
//
// main.ts only says three things: which level is on (`start`), whether the
// cube is actually being played right now (`setActive`), and whether the
// speaker is muted (`setMuted`). This file turns those into play() and pause()
// calls, and only when the answer changes, not on every frame.
//
// Deaths keep `active` true, so the song never restarts when you crash.
// A pause or an open panel sets it false, and the song waits where it was.
//
// Browsers refuse to start sound until the visitor clicks or presses a key.
// If play() is refused, we try again on the next click or key press.
// If a file is missing or will not decode, that track is skipped quietly
// and the game keeps running without it.

const VOLUME = 0.6;

export interface Music {
  /** Start this level's song from the beginning. Stops any other song. */
  start(index: number): void;
  /** Stop and rewind. Used on level clear, on leaving to the level select, and on page exit. */
  stop(): void;
  /** True while the cube is being played (not paused, no panel open). */
  setActive(active: boolean): void;
  setMuted(muted: boolean): void;
  destroy(): void;
}

export function createMusic(files: string[], startMuted: boolean): Music {
  const base = import.meta.env.BASE_URL;
  const tracks: (HTMLAudioElement | null)[] = files.map(() => null);
  const broken = new Set<number>();
  let current = -1;
  let active = false;
  let muted = startMuted;
  /** play() was refused for lack of a click or key press. */
  let waitingForGesture = false;

  function track(index: number): HTMLAudioElement | null {
    if (broken.has(index) || !files[index]) return null;
    let el = tracks[index];
    if (!el) {
      // preload "none": nothing downloads until the level is actually entered.
      el = new Audio();
      el.preload = "none";
      el.loop = true;
      el.volume = VOLUME;
      el.addEventListener("error", () => markBroken(index));
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

  function shouldPlay(): boolean {
    return current >= 0 && active && !muted && !document.hidden;
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
    if (current >= 0) {
      const el = tracks[current];
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    }
    current = -1;
    active = false;
  }

  window.addEventListener("pointerdown", onGesture, true);
  window.addEventListener("keydown", onGesture, true);
  document.addEventListener("visibilitychange", apply);
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
    destroy() {
      stop();
      window.removeEventListener("pointerdown", onGesture, true);
      window.removeEventListener("keydown", onGesture, true);
      document.removeEventListener("visibilitychange", apply);
      window.removeEventListener("pagehide", stop);
    },
  };
}
