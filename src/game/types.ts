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

/**
 * Which palette and background a course uses. "bright" is First Level. "neon" is Sci-Fi Showdown.
 * "dusk" is Last Hope. "dark" is The Final Battle, lit only around the cube.
 */
export type ThemeId = "bright" | "ice" | "mist" | "neon" | "dusk" | "dark";

/**
 * A moving platform or a saw. Neither is a letter in the ASCII map.
 * It starts at column `c`, row `r`, travels `tiles` away, then comes back.
 * `seconds` is the full round trip. A negative `tiles` travels left (or up).
 * A platform is solid and carries the cube. A saw is not solid, and touching it kills.
 */
export interface MoverDef {
  kind: "platform" | "saw";
  c: number;
  r: number;
  axis: "x" | "y";
  tiles: number;
  seconds: number;
}

/**
 * One laser beam. A run of `|` in a column, or `-` in a row, is a single beam.
 * Every beam in the level shares one clock. See `laserActive` in physics.ts.
 */
export interface Laser {
  /** "y" runs down the column (`|`). "x" runs across the row (`-`). */
  axis: "x" | "y";
  /** Leftmost column (for "x") or the column (for "y"). */
  c: number;
  /** Top row (for "y") or the row (for "x"). */
  r: number;
  /** How many tiles the beam covers. */
  length: number;
}

/** The live platform or saw. `x` and `y` are the top-left of its tile, in pixels. */
export interface Mover {
  kind: "platform" | "saw";
  axis: "x" | "y";
  originX: number;
  originY: number;
  /** How far it travels from the start, in pixels. */
  distance: number;
  /** Full round trip, out and back, in seconds. */
  period: number;
  clock: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

/**
 * A ceiling spike that drops once the cube enters its column.
 * `y` is the top of the tile, in pixels. It starts at `r` and moves down.
 */
export interface FallingSpike {
  c: number;
  r: number;
  y: number;
  vy: number;
  /** wait: hanging. fall: dropping. rest: sitting where it landed, or gone off the map. */
  phase: "wait" | "fall" | "rest";
}

/**
 * A floor tile that holds, cracks, then falls. It is not itself deadly.
 * The hole it leaves is the hazard. `stood` is how long the cube has been on it.
 */
export interface Crumble {
  c: number;
  r: number;
  y: number;
  vy: number;
  stood: number;
  /** firm: solid. fall: breaking away. gone: empty until respawn. */
  phase: "firm" | "fall" | "gone";
}

/** A level after the ASCII map has been checked. */
export interface Level {
  id: string;
  title: string;
  theme: ThemeId;
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
  /** Moving platforms and saws. Empty for courses that do not use one. */
  movers: MoverDef[];
  /** Laser beams gathered from `|` and `-` runs. */
  lasers: Laser[];
  /** The last course. Its portal ends the game with a bigger burst and the Contact panel. */
  finale: boolean;
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
  /** Burst squares fade out. Snow and motes drift. Streaks trail the cube. */
  mode: "burst" | "snow" | "mote" | "streak";
  /** Sideways wobble for snow. Burst particles leave this at 0. */
  drift: number;
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
  /** True for one step after Z. Only used while Practice mode is on. */
  placeCheckpoint: boolean;
  /** True for one step after X. Removes the newest practice checkpoint. */
  removeCheckpoint: boolean;
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
  /**
   * Practice mode is optional. While it is on, Z pushes the cube's position
   * onto this list and X pops the last one. Deaths use the newest entry.
   * The level's own checkpoints stay in `checkpoint`.
   */
  practice: boolean;
  practicePoints: { x: number; y: number }[];
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
  /** Stops a jump orb from firing again until the cube leaves that orb. */
  orbLock: boolean;
  /**
   * Seconds since the last respawn. Every laser uses this same clock.
   * 0 is the start of the off window, so a fresh spawn is never inside a beam.
   */
  laserClock: number;
  /** `!` tiles. Reset to hanging when the cube respawns. */
  fallingSpikes: FallingSpike[];
  /** `x` tiles. Reset to firm when the cube respawns. */
  crumbles: Crumble[];
  /** Moving platforms. Clocks restart when the cube respawns. */
  movers: Mover[];
  /** "col,row" to the crumble in that cell, so collision does not scan the list. */
  crumbleAt: Map<string, Crumble>;
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
