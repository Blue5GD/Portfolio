// Browser-saved settings. They stay on this computer only.
// localStorage is a small key/value store the page can read after a refresh.
//
// "b5gd:progress" remembers which levels are unlocked, cleared, practice
// completed, or skipped.
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
  /**
   * Indexes beaten with Practice off. 0 is First Level.
   * This is the only list that means the level is cleared.
   */
  cleared: number[];
  /** Indexes whose portal was reached with Practice on. Not a clear. */
  practice: number[];
  /** Indexes the player skipped. Not a clear. */
  skipped: number[];
  /** Total attempts across every visit, including deaths. */
  attempts: number;
}

// Future idea, not built: something special when every level is in `cleared`.
// Practice completions and skips do not count. See docs/PLAN.md.

export function emptyProgress(): Progress {
  return { unlocked: 1, cleared: [], practice: [], skipped: [], attempts: 0 };
}

function blankProgress(): Progress {
  return emptyProgress();
}

export function loadProgress(levelCount: number): Progress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return blankProgress();
    const data = JSON.parse(raw) as {
      unlocked?: unknown;
      cleared?: unknown;
      practice?: unknown;
      skipped?: unknown;
      attempts?: unknown;
    };

    let unlocked = Math.floor(Number(data.unlocked));
    if (!Number.isFinite(unlocked)) unlocked = 1;
    unlocked = Math.min(levelCount, Math.max(1, unlocked));

    const cleared = readIndexes(data.cleared, levelCount);
    // A normal clear wins over an older practice or skip mark for the same level.
    const practice = readIndexes(data.practice, levelCount).filter((n) => !cleared.includes(n));
    const skipped = readIndexes(data.skipped, levelCount).filter(
      (n) => !cleared.includes(n) && !practice.includes(n),
    );
    // Any of the three marks unlocks the next level, even if `unlocked` was stale.
    // Older saves only had `cleared`, and that list included skips. Those stay
    // cleared, because a saved skip and a saved clear look the same.
    for (const n of [...cleared, ...practice, ...skipped]) {
      unlocked = Math.max(unlocked, Math.min(levelCount, n + 2));
    }

    let attempts = Math.floor(Number(data.attempts));
    if (!Number.isFinite(attempts) || attempts < 0) attempts = 0;
    return { unlocked, cleared, practice, skipped, attempts };
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

function readIndexes(value: unknown, levelCount: number): number[] {
  const out: number[] = [];
  if (!Array.isArray(value)) return out;
  for (const item of value) {
    const n = Math.floor(Number(item));
    if (n >= 0 && n < levelCount && !out.includes(n)) out.push(n);
  }
  out.sort((a, b) => a - b);
  return out;
}

function remember(list: number[], index: number): void {
  if (!list.includes(index)) {
    list.push(index);
    list.sort((a, b) => a - b);
  }
}

function forget(list: number[], index: number): void {
  const at = list.indexOf(index);
  if (at >= 0) list.splice(at, 1);
}

function unlockNext(progress: Progress, index: number, levelCount: number): void {
  progress.unlocked = Math.max(progress.unlocked, Math.min(levelCount, index + 2));
}

function validIndex(index: number, levelCount: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < levelCount;
}

/** Mark `index` cleared in normal mode and unlock the following level. */
export function markCleared(progress: Progress, index: number, levelCount: number): void {
  if (!validIndex(index, levelCount)) return;
  forget(progress.practice, index);
  forget(progress.skipped, index);
  remember(progress.cleared, index);
  unlockNext(progress, index, levelCount);
}

/**
 * The portal was reached with Practice on.
 * Unlocks the next level. Does not clear the level, and does not replace a clear.
 */
export function markPractice(progress: Progress, index: number, levelCount: number): void {
  if (!validIndex(index, levelCount)) return;
  unlockNext(progress, index, levelCount);
  if (progress.cleared.includes(index)) return;
  forget(progress.skipped, index);
  remember(progress.practice, index);
}

/**
 * The player used Skip.
 * Unlocks the next level. Does not clear the level, and does not replace a
 * clear or a practice completion.
 */
export function markSkipped(progress: Progress, index: number, levelCount: number): void {
  if (!validIndex(index, levelCount)) return;
  unlockNext(progress, index, levelCount);
  if (progress.cleared.includes(index) || progress.practice.includes(index)) return;
  remember(progress.skipped, index);
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
