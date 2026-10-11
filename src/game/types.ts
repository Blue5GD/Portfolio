// Shared shapes for the platformer. Numbers are pixels, seconds, or
// pixels per second. The cube's picture can spin; the hitbox never does.
// A spinning hitbox would snag on every corner, so collision stays a square.

/** Width and height of one cell in an ASCII level. */
export const TILE = 40;

/** Width and height of the cube's collision box. A little smaller than a tile. */
export const HIT = 36;

export interface Sign {
  /** Column in the ASCII map. */
  c: number;
  /** Row in the ASCII map. Row 0 is the top. */
  r: number;
  text: string;
}

/**
 * Which portfolio entry an `I` block opens.
 * Indexes point into the lists in `src/data` (0 is the first item).
 * `experience.group` is 0 for "At Yale" and 1 for "High School".
 * `awards` is a slice: `start` is the first award, `count` is how many.
 */
export type ContentRef =
  | { kind: "about" }
  | { kind: "featured"; index: number }
  | { kind: "project"; index: number }
  | { kind: "experience"; group: number; index: number }
  | { kind: "service" }
  | { kind: "awards"; start: number; count: number }
  | { kind: "skills" }
  | { kind: "education" }
  | { kind: "contact" };

/** A level after the ASCII map has been checked. */
export interface Level {
  id: string;
  title: string;
  width: number;
  height: number;
  /** Each string is one row. Every row has the same length. */
  rows: string[];
  /** Top-left of the cube's hitbox where `P` stood. */
  start: { x: number; y: number };
  /** One entry per `I` tile, in reading order (left to right, top to bottom). */
  panels: ContentRef[];
  signs: Sign[];
  /** Map key "col,row" to an index in `panels`. */
  infoAt: Map<string, number>;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  /** +1 faces right, -1 faces left. The cube rolls this way in the air. */
  facing: 1 | -1;
  /** Radians. Positive is clockwise, which is how canvas rotates. */
  rot: number;
  grounded: boolean;
  onIce: boolean;
  /** Seconds you can still jump after walking off a ledge. */
  coyote: number;
  /** Seconds we remember an early jump press. */
  jumpBuffer: number;
  /** True after a short hop has already cut this jump, so we only cut once. */
  cutJump: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  max: number;
  rot: number;
  vr: number;
  color: string;
}

/** Keys the physics step reads. `input.ts` fills this in from the keyboard. */
export interface Input {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  /** True for one step after the jump key goes down. Physics clears it. */
  jumpPressed: boolean;
  restart: boolean;
  pausePressed: boolean;
}

/** Face drawn on the level card and the pause screen. Order is easiest to hardest. */
export type DifficultyId = "normal" | "hard" | "harder" | "insane" | "hard-demon" | "extreme-demon";

export type Phase = "play" | "paused" | "dead" | "won";

export interface GameState {
  level: Level;
  player: Player;
  phase: Phase;
  /** "menu" is Esc. "dialog" is an info box. Win is its own phase. */
  pauseReason: "menu" | "dialog" | null;
  checkpoint: { x: number; y: number };
  attempts: number;
  camera: { x: number; y: number };
  cameraReady: boolean;
  /** Pixels of screen shake left. Counts down to 0. */
  shake: number;
  time: number;
  deadTimer: number;
  particles: Particle[];
  collected: Set<string>;
  /** Stops a jump pad from firing again until the cube leaves it. */
  padLock: boolean;
  reducedMotion: boolean;
  viewW: number;
  viewH: number;
  dpr: number;
  /** Which face the pause screen draws. Set from the course, not the ASCII map. */
  difficulty: DifficultyId;
  /** Called with the index of the `I` tile the cube just touched. */
  onInfo: (index: number) => void;
  onWin: () => void;
  /** Called when a death spends an attempt, so the page can save it. */
  onAttempt: () => void;
}
