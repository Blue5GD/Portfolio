import type { ThemeId } from "./types";

// Colors for one course. First Level uses "bright" (the site palette).
// Lost World uses "ice": pale blocks, a teal sky, and snow.
// Mystic Mountains uses "mist": violet-grey stone, drifting fog, and motes.
// Sci-Fi Showdown uses "neon": magenta edges, a cyan spike glow, and speed streaks.
// Last Hope uses "dusk": purple that fades toward black, then deep red.
// The Final Battle uses "dark": black, lit only near the cube, with cyan spears for spikes.

export interface Theme {
  id: ThemeId;
  sky: [string, string, string];
  pit: string;
  shard: string;
  block: string;
  blockEdge: string;
  ice: string;
  iceEdge: string;
  spike: string;
  spikeEdge: string;
  oneWay: string;
  oneWayEdge: string;
  /** Ceiling spikes and falling spikes are drawn as icicles. */
  icicles: boolean;
  snow: boolean;
  /** A soft veil that drifts across the screen. */
  fog: boolean;
  /** Small lights that drift downward. */
  motes: boolean;
  /** Squares that trail the cube while it runs. */
  streaks: boolean;
  /** Slow dark flakes. Last Hope uses these. */
  ash: boolean;
  /**
   * Full-screen dark overlay at the right edge of the level.
   * 0 means the course stays the same brightness the whole way.
   * Last Hope uses 0.75: the overlay is invisible at the start and
   * almost black at the portal.
   */
  darkness: number;
  /**
   * How far across the level (0 to 1) the red accents start.
   * Ignored when `darkness` is 0.
   */
  redAt: number;
  /**
   * Radius in pixels of the only lit area, a circle around the cube.
   * 0 means the whole screen is lit. The Final Battle uses about 5 tiles.
   */
  light: number;
}

const THEMES: Record<ThemeId, Theme> = {
  bright: {
    id: "bright",
    sky: ["#070a2b", "#141a5c", "#3b2394"],
    pit: "#05071c",
    shard: "rgba(111, 214, 255, 0.07)",
    block: "#12184a",
    blockEdge: "#6fd6ff",
    ice: "#d7f3ff",
    iceEdge: "#ffffff",
    spike: "#0b0d26",
    spikeEdge: "#8f6bff",
    oneWay: "#6fd6ff",
    oneWayEdge: "#000000",
    icicles: false,
    snow: false,
    fog: false,
    motes: false,
    streaks: false,
    ash: false,
    darkness: 0,
    redAt: 1,
    light: 0,
  },
  ice: {
    id: "ice",
    sky: ["#042833", "#0c4554", "#08111f"],
    pit: "#021018",
    shard: "rgba(230, 246, 255, 0.08)",
    block: "#c5e9f6",
    blockEdge: "#ffffff",
    ice: "#f7fdff",
    iceEdge: "#ffffff",
    spike: "#d7f6ff",
    spikeEdge: "#062430",
    oneWay: "#f7fdff",
    oneWayEdge: "#0b3140",
    icicles: true,
    snow: true,
    fog: false,
    motes: false,
    streaks: false,
    ash: false,
    darkness: 0,
    redAt: 1,
    light: 0,
  },
  mist: {
    id: "mist",
    sky: ["#241f3a", "#3e3a58", "#171422"],
    pit: "#0e0c16",
    shard: "rgba(210, 200, 235, 0.07)",
    block: "#3a3456",
    blockEdge: "#d9d0ee",
    ice: "#efeaff",
    iceEdge: "#ffffff",
    spike: "#16131f",
    spikeEdge: "#c9b6ff",
    oneWay: "#d9d0ee",
    oneWayEdge: "#1a1628",
    icicles: false,
    snow: false,
    fog: true,
    motes: true,
    streaks: false,
    ash: false,
    darkness: 0,
    redAt: 1,
    light: 0,
  },
  neon: {
    id: "neon",
    sky: ["#140018", "#2a0a4a", "#061428"],
    pit: "#07010f",
    shard: "rgba(255, 79, 216, 0.1)",
    block: "#140820",
    blockEdge: "#ff4fd8",
    ice: "#f7fdff",
    iceEdge: "#ffffff",
    spike: "#1a0618",
    spikeEdge: "#6fd6ff",
    oneWay: "#6fd6ff",
    oneWayEdge: "#ff4fd8",
    icicles: false,
    snow: false,
    fog: false,
    motes: false,
    streaks: true,
    ash: false,
    darkness: 0,
    redAt: 1,
    light: 0,
  },
  dusk: {
    id: "dusk",
    sky: ["#241433", "#3a2158", "#140c22"],
    pit: "#0c0814",
    shard: "rgba(140, 80, 120, 0.08)",
    block: "#2c1c44",
    blockEdge: "#c4a0e4",
    ice: "#f3e9ff",
    iceEdge: "#ffffff",
    spike: "#160a12",
    spikeEdge: "#d7b0e4",
    oneWay: "#e4c8f4",
    oneWayEdge: "#1a1024",
    icicles: false,
    snow: false,
    fog: false,
    motes: false,
    streaks: false,
    ash: true,
    darkness: 0.75,
    redAt: 0.6,
    light: 0,
  },
  dark: {
    id: "dark",
    sky: ["#020308", "#04060f", "#010104"],
    pit: "#000000",
    shard: "rgba(80, 200, 255, 0.04)",
    block: "#0a0f1e",
    blockEdge: "#3f6f9a",
    ice: "#bfe6ff",
    iceEdge: "#ffffff",
    spike: "#06223a",
    spikeEdge: "#5fe3ff",
    oneWay: "#5fe3ff",
    oneWayEdge: "#02121e",
    icicles: false,
    snow: false,
    fog: false,
    motes: false,
    streaks: false,
    ash: false,
    darkness: 0,
    redAt: 1,
    light: 200,
  },
};

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

// Reads both "#241433" and the "rgb(36 20 51)" string mixHex itself returns.
// The sky is mixed twice (toward black, then toward red). If the second mix
// treated "rgb(...)" as hex, parseInt would return NaN and the canvas gradient
// would throw, which leaves the whole level black.
function colorRgb(color: string): [number, number, number] {
  if (color.startsWith("#")) {
    const h = color.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const parts = color.match(/\d+/g);
  if (!parts || parts.length < 3) return [0, 0, 0];
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

function mixHex(from: string, to: string, t: number): string {
  const amount = clamp01(t);
  const a = colorRgb(from);
  const b = colorRgb(to);
  const n = (i: number) => Math.round(a[i] + (b[i] - a[i]) * amount);
  return `rgb(${n(0)} ${n(1)} ${n(2)})`;
}

/**
 * Last Hope gets darker as the cube moves right, and the last third shifts red.
 * Other courses get their theme back unchanged.
 * `progress` is 0 at the left edge of the level and 1 at the right edge.
 */
export function shadeTheme(theme: Theme, progress: number): Theme {
  if (theme.darkness <= 0) return theme;
  const t = clamp01(progress);
  const red = t <= theme.redAt ? 0 : (t - theme.redAt) / (1 - theme.redAt);
  return {
    ...theme,
    sky: [
      mixHex(mixHex(theme.sky[0], "#050208", t * 0.9), "#4a1020", red * 0.6),
      mixHex(mixHex(theme.sky[1], "#07040e", t * 0.92), "#3a0c18", red * 0.5),
      mixHex(mixHex(theme.sky[2], "#030206", t * 0.94), "#200610", red * 0.45),
    ],
    pit: mixHex(theme.pit, "#030208", t),
    shard: red > 0.15 ? "rgba(170, 36, 56, 0.08)" : theme.shard,
    block: mixHex(theme.block, "#07060c", t * 0.88),
    blockEdge: mixHex(theme.blockEdge, "#e23b4a", red),
    spike: mixHex(theme.spike, "#1a060c", Math.max(t * 0.45, red)),
    spikeEdge: mixHex(theme.spikeEdge, "#ff4d6a", red),
    ice: mixHex(theme.ice, "#241428", t * 0.5),
    oneWay: mixHex(theme.oneWay, "#f0a0b0", red * 0.85),
    oneWayEdge: mixHex(theme.oneWayEdge, "#ff4d6a", red),
  };
}

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}
