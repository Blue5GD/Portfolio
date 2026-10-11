import { HIT, TILE, type ContentRef, type Level, type Sign } from "./types";

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
}

const KNOWN = new Set([".", "#", "^", "v", "<", ">", "P", "C", "I", "O", "J", "=", "~"]);

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
    width,
    height,
    rows: def.rows,
    start,
    panels: def.panels,
    signs: def.signs ?? [],
    infoAt,
  };
}
