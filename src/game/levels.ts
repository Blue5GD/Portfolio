import type { LevelDef } from "./level";
import type { DifficultyId } from "./types";

// /play shows a level select built from `courses`. Only First Level has a
// map so far. The other five cards are here so unlocking them has a place
// to land; their rows get written in later milestones.
//
// Tile key (same characters the engine already understands):
//   . empty    # block     ~ ice       = one-way platform
//   ^ v < > spikes (floor, ceiling, left, right)
//   P start    C checkpoint    I info block    J jump pad    O end portal
//
// Row 0 is the top. Every row in a level is the same length.

export interface Course {
  id: string;
  title: string;
  difficulty: DifficultyId;
  song: string;
  artist: string;
  /** Portfolio section named on the level card. */
  section: string;
  /** Absent until that course's map exists. The card can still unlock. */
  level?: LevelDef;
}

// First Level is a tutorial. Nothing here is a new obstacle.
// A full jump clears about five tiles, so each spike pair is two tiles
// and the landing between pairs is longer than one jump.
// Columns:
//   0 wall, 2 start, 8 About
//   16 one spike, 24-25 and 34-35 two-spike jumps, 39 checkpoint
//   44-46 a 3-tile gap
//   51 / 61 / 71 the three Featured items, in Featured order
//   78-80 a platform, 81-82 a hop, 83-88 a platform
//   ceiling on row 8 over that platform, spike on row 9 at column 85
//   (walking or a tap passes, a full jump hits)
//   90 portal, 91 back wall
const firstLevel: LevelDef = {
  id: "first-level",
  title: "First Level",
  panels: [
    { kind: "about" },
    { kind: "featured", index: 0 },
    { kind: "featured", index: 1 },
    { kind: "featured", index: 2 },
  ],
  signs: [
    { c: 4, r: 10, text: "Move: arrows or A D" },
    { c: 10, r: 10, text: "Jump: up, W, or space" },
    { c: 16, r: 10, text: "Jump the spike" },
    { c: 24, r: 10, text: "One jump, two spikes" },
    { c: 39, r: 10, text: "Checkpoint" },
    { c: 44, r: 10, text: "Jump the gap" },
    { c: 61, r: 10, text: "Featured" },
    { c: 78, r: 10, text: "Jump up" },
    { c: 85, r: 7, text: "Tap jump. Don't hold." },
  ],
  rows: [
    "............................................................................................",
    "............................................................................................",
    "............................................................................................",
    "............................................................................................",
    "............................................................................................",
    "............................................................................................",
    "............................................................................................",
    "............................................................................................",
    "...................................................................................######..#",
    ".....................................................................................v.....#",
    "...........................................................................................#",
    "...........................................................................................#",
    "#.P.....I.......^.......^^........^^...C...........I.........I.........I......###..######.O#",
    "############################################...#############################################",
  ],
};

export const courses: Course[] = [
  {
    id: "first-level",
    title: "First Level",
    difficulty: "normal",
    song: "Race Around the World",
    artist: "Waterflame",
    section: "About + Featured",
    level: firstLevel,
  },
  {
    id: "lost-world",
    title: "Lost World",
    difficulty: "hard",
    song: "Another World",
    artist: "Razorrekker",
    section: "Projects",
  },
  {
    id: "mystic-mountains",
    title: "Mystic Mountains",
    difficulty: "harder",
    song: "The Falling Mysts",
    artist: "Dimrain47",
    section: "Experience, High School",
  },
  {
    id: "sci-fi-showdown",
    title: "Sci-Fi Showdown",
    difficulty: "insane",
    song: "At the Speed of Light",
    artist: "Dimrain47",
    section: "Experience, At Yale",
  },
  {
    id: "last-hope",
    title: "Last Hope",
    difficulty: "hard-demon",
    song: "Figures",
    artist: "~NK~",
    section: "Awards",
  },
  {
    id: "final-battle",
    title: "The Final Battle",
    difficulty: "extreme-demon",
    song: "Battle Against a True Hero",
    artist: "Toby Fox",
    section: "Skills, Education, Contact",
  },
];

// Practice map from before First Level. It is not on the level select.
// It still uses every current tile, including ice, pads, and wall spikes,
// so those mechanics stay easy to try while the later courses are written.
export const warmup: LevelDef = {
  id: "warmup",
  title: "Warmup",
  panels: [{ kind: "about" }],
  signs: [
    { c: 2, r: 10, text: "Arrows or A/D" },
    { c: 24, r: 10, text: "Checkpoint" },
    { c: 22, r: 11, text: "Side spike" },
    { c: 40, r: 8, text: "Ceiling" },
    { c: 46, r: 11, text: "Ice" },
    { c: 61, r: 10, text: "Jump pad" },
    { c: 74, r: 9, text: "One-way" },
  ],
  rows: [
    "................................................................................................",
    "................................................................................................",
    "................................................................................................",
    "................................................................................................",
    "................................................................................................",
    "................................................................................................",
    "................................................................................................",
    "................................................................................................",
    ".................................................................##.............................",
    ".....................................vvvvvv......................##.............................",
    ".................................................................##.............................",
    ".................................................................##.......=========.............",
    "..P...I...^...........>.C...####.......................^..C..J..<##...C..............C..^....O.#",
    "###############..###########################~~~~~~~~########################.....###############",
  ],
};
