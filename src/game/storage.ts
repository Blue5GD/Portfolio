// Browser-saved settings. They stay on this computer only.
// localStorage is a small key/value store the page can read after a refresh.
//
// "b5gd:progress" remembers how far the game has been cleared.
// "b5gd:muted" remembers the speaker button, so a muted visitor stays muted
// after a refresh.
// "b5gd:volume" remembers the volume slider, from 0 (silent) to 1 (full).
// A missing or broken value falls back to 0.6.

const PROGRESS_KEY = "b5gd:progress";
const MUTE_KEY = "b5gd:muted";
const VOLUME_KEY = "b5gd:volume";
const DEFAULT_VOLUME = 0.6;

export interface Progress {
  /** How many levels from the start can be entered. 1 means only First Level. */
  unlocked: number;
  /** Indexes that were beaten or skipped. 0 is First Level. */
  cleared: number[];
  /** Total attempts across every visit, including deaths. */
  attempts: number;
}

function blankProgress(): Progress {
  return { unlocked: 1, cleared: [], attempts: 0 };
}

export function loadProgress(levelCount: number): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return blankProgress();
    const data = JSON.parse(raw) as { unlocked?: unknown; cleared?: unknown; attempts?: unknown };

    let unlocked = Math.floor(Number(data.unlocked));
    if (!Number.isFinite(unlocked)) unlocked = 1;
    unlocked = Math.min(levelCount, Math.max(1, unlocked));

    const cleared: number[] = [];
    if (Array.isArray(data.cleared)) {
      for (const item of data.cleared) {
        const n = Math.floor(Number(item));
        if (n >= 0 && n < levelCount && !cleared.includes(n)) cleared.push(n);
      }
    }
    cleared.sort((a, b) => a - b);
    // Beating a level always unlocks the next one, even if `unlocked` was stale.
    for (const n of cleared) unlocked = Math.max(unlocked, Math.min(levelCount, n + 2));

    let attempts = Math.floor(Number(data.attempts));
    if (!Number.isFinite(attempts) || attempts < 0) attempts = 0;
    return { unlocked, cleared, attempts };
  } catch {
    // Private browsing can throw. Start fresh instead of breaking the page.
    return blankProgress();
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Same as load: a full or blocked store should not stop the game.
  }
}

/** Mark `index` cleared and unlock the following level. */
export function markCleared(progress: Progress, index: number, levelCount: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= levelCount) return;
  if (!progress.cleared.includes(index)) {
    progress.cleared.push(index);
    progress.cleared.sort((a, b) => a - b);
  }
  progress.unlocked = Math.max(progress.unlocked, Math.min(levelCount, index + 2));
}

export function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Ignore. The button still toggles for this visit.
  }
}

export function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return DEFAULT_VOLUME;
    const value = Number(raw);
    if (!Number.isFinite(value)) return DEFAULT_VOLUME;
    return Math.min(1, Math.max(0, value));
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function saveVolume(volume: number): void {
  const value = Math.min(1, Math.max(0, volume));
  try {
    localStorage.setItem(VOLUME_KEY, String(value));
  } catch {
    // Ignore. The slider still changes the loudness for this visit.
  }
}
