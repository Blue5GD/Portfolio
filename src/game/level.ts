import { HIT, TILE, type ContentRef, type Laser, type Level, type MoverDef, type Sign, type ThemeId } from "./types";

// The map is an ASCII grid, like a USACO grid problem: rows[r][c] is the
// tile at column c, row r. Row 0 is the top. Physics never searches the
// whole string; it only looks at the few cells the cube currently touches.

export interface LevelDef {
  id: string;
  title: string;
  rows: string[];
  /** One entry per `I` tile, in reading order. `panels.ts` turns these into dialogs. */
  panels: ContentRef[];
  signs?: Sign[];
  /** Omitted courses use the bright First Level palette. */
  theme?: ThemeId;
  /** Moving platforms. They are not letters in `rows`. */
  movers?: MoverDef[];
}

// `!` is a falling spike. `x` is a crumble block.
// Both stay in the grid as their starting cell. physics.ts keeps the extra
// state (a spike that is dropping, a block that has given way) and puts it
// back when the cube respawns.
// `o` is a jump orb. `|` and `-` are laser cells. A straight run of the same
// laser character is one beam. physics.ts keeps the shared on/off clock.
const KNOWN = new Set([".", "#", "^", "v", "<", ">", "P", "C", "I", "O", "J", "=", "~", "!", "x", "o", "|", "-"]);

export type SpikeDir = "up" | "down" | "left" | "right";

export function tileAt(level: Level, c: number, r: number): string {
  if (c < 0 || r < 0 || c >= level.width || r >= level.height) return ".";
  return level.rows[r][c];
}

export function tileKey(c: number, r: number): string {
  return `${c},${r}`;
}

/** Top-left of a hitbox standing in this cell (feet on the bottom edge). */
export function standIn(c: number, r: number): { x: number; y: number } {
  return {
    x: c * TILE + (TILE - HIT) / 2,
    y: r * TILE + (TILE - HIT),
  };
}

export function spikeDir(ch: string): SpikeDir | null {
  if (ch === "^") return "up";
  if (ch === "v") return "down";
  if (ch === "<") return "left";
  if (ch === ">") return "right";
  return null;
}

export function parseLevel(def: LevelDef): Level {
  if (def.rows.length === 0) {
    throw new Error(`Level ${def.id} has no rows.`);
  }

  const height = def.rows.length;
  const width = def.rows[0].length;
  const infoAt = new Map<string, number>();
  let starts = 0;
  let infoCount = 0;

  for (let r = 0; r < height; r++) {
    const row = def.rows[r];
    if (row.length !== width) {
      throw new Error(
        `Level ${def.id} row ${r} is ${row.length} tiles wide, but row 0 is ${width}. Every row must match.`,
      );
    }
    for (let c = 0; c < width; c++) {
      const ch = row[c];
      if (!KNOWN.has(ch)) {
        throw new Error(`Level ${def.id} has unknown tile "${ch}" at column ${c}, row ${r}.`);
      }
      if (ch === "P") starts += 1;
      if (ch === "I") {
        infoAt.set(tileKey(c, r), infoCount);
        infoCount += 1;
      }
    }
  }

  if (starts !== 1) {
    throw new Error(`Level ${def.id} should have exactly one P (player start), found ${starts}.`);
  }
  if (infoCount !== def.panels.length) {
    throw new Error(
      `Level ${def.id} has ${infoCount} info tiles (I) but ${def.panels.length} panels. Those counts must match.`,
    );
  }

  let start = { x: 0, y: 0 };
  for (let r = 0; r < height; r++) {
    const c = def.rows[r].indexOf("P");
    if (c !== -1) start = standIn(c, r);
  }

  return {
    id: def.id,
    title: def.title,
    theme: def.theme ?? "bright",
    width,
    height,
    rows: def.rows,
    start,
    panels: def.panels,
    signs: def.signs ?? [],
    infoAt,
    movers: checkMovers(def, width, height),
    lasers: findLasers(def.rows),
  };
}

// Walk each row for `-` and each column for `|`. One run is one beam, so a
// stack of horizontal beams blinks together but is still drawn as separate lines.
function findLasers(rows: string[]): Laser[] {
  const height = rows.length;
  const width = rows[0].length;
  const lasers: Laser[] = [];

  for (let r = 0; r < height; r++) {
    let c = 0;
    while (c < width) {
      if (rows[r][c] !== "-") {
        c += 1;
        continue;
      }
      const start = c;
      while (c < width && rows[r][c] === "-") c += 1;
      lasers.push({ axis: "x", c: start, r, length: c - start });
    }
  }

  for (let c = 0; c < width; c++) {
    let r = 0;
    while (r < height) {
      if (rows[r][c] !== "|") {
        r += 1;
        continue;
      }
      const start = r;
      while (r < height && rows[r][c] === "|") r += 1;
      lasers.push({ axis: "y", c, r: start, length: r - start });
    }
  }

  return lasers;
}

// The platform's path has to be empty tiles. A block on that path would
// sit inside the platform, and the cube could get stuck between them.
function checkMovers(def: LevelDef, width: number, height: number): MoverDef[] {
  const movers = def.movers ?? [];
  for (const mover of movers) {
    if (mover.kind !== "platform") {
      throw new Error(`Level ${def.id} has a mover that is not a platform.`);
    }
    if (mover.axis !== "x" && mover.axis !== "y") {
      throw new Error(`Level ${def.id} has a platform with a bad axis.`);
    }
    if (!(mover.tiles > 0) || !(mover.seconds > 0)) {
      throw new Error(`Level ${def.id} has a platform with no distance or no time.`);
    }
    const steps = Math.round(mover.tiles);
    for (let i = 0; i <= steps; i++) {
      const c = mover.axis === "x" ? mover.c + i : mover.c;
      const r = mover.axis === "y" ? mover.r + i : mover.r;
      if (c < 0 || r < 0 || c >= width || r >= height) {
        throw new Error(`Level ${def.id} platform path leaves the map at column ${c}, row ${r}.`);
      }
      const ch = def.rows[r][c];
      if (ch !== ".") {
        throw new Error(
          `Level ${def.id} platform path hits "${ch}" at column ${c}, row ${r}. That cell has to be empty.`,
        );
      }
    }
  }
  return movers;
}
