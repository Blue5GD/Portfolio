import type { LevelDef } from "./level";
import type { DifficultyId } from "./types";

// /play shows a level select built from `courses`. First Level and Lost World
// have maps. The other cards are here so unlocking them has a place to land;
// their rows get written in later.
//
// Tile key:
//   . empty    # block     ~ ice       = one-way platform
//   ^ v < > spikes (floor, ceiling, left, right)
//   P start    C checkpoint    I info block    J jump pad    O end portal
//   ! falling spike (drops when the cube enters that column)
//   x crumble (solid until you stand on it, then it falls)
//
// Row 0 is the top. Every row in a level is the same length.

export interface Course {
  id: string;
  title: string;
  difficulty: DifficultyId;
  song: string;
  artist: string;
  /** File name inside public/audio/. audio.ts adds the base path. */
  audio: string;
  /** Where the song is published. The Music Credits panel links here. */
  songUrl: string;
  /** Portfolio section named on the level card. */
  section: string;
  /** Absent until that course's map exists. The card can still unlock. */
  level?: LevelDef;
}

// First Level is a tutorial. Nothing here is a new obstacle.
// A full jump clears about five tiles, so the spike rows grow from one to
// four, and the floor between them is longer than one jump.
// Columns:
//   0 wall, 2 start, 8 About
//   16 one spike, 24-25 two, 33-35 three, 41 checkpoint, 47-50 four
//   57-59 a 3-tile gap
//   66 / 76 / 86 the three Featured items, in Featured order
//   90 checkpoint, 93-95 a step, 96-97 a dip, 98-117 a platform
//   two gates on that platform, at 101-105 and 110-114: a ceiling on row 7,
//   a spike hanging on row 8, and a floor spike right under it on row 11.
//   A tap clears the floor spike and stays under the ceiling one.
//   A full jump hits the ceiling spike. Walking hits the floor spike.
//   119 portal, 120 back wall
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
    { c: 41, r: 10, text: "Checkpoint" },
    { c: 58, r: 10, text: "Jump the gap" },
    { c: 76, r: 10, text: "Featured" },
    { c: 103, r: 7, text: "Tap jump. Don't hold." },
  ],
  rows: [
    ".........................................................................................................................",
    ".........................................................................................................................",
    ".........................................................................................................................",
    ".........................................................................................................................",
    ".........................................................................................................................",
    ".........................................................................................................................",
    ".........................................................................................................................",
    ".....................................................................................................#####....#####......",
    ".......................................................................................................v........v.......#",
    "........................................................................................................................#",
    "........................................................................................................................#",
    ".......................................................................................................^........^.......#",
    "#.P.....I.......^.......^^.......^^^.....C.....^^^^...............I.........I.........I...C..###..####################.O#",
    "#########################################################...#############################################################",
  ],
};

// Lost World. Harder than the first pass at this course: the jumps are tighter,
// and a full held jump is the wrong tool for most of it.
// A full jump still clears about five tiles, so a pit of six is not jumpable.
// Columns:
//   0 wall, 2 start, 6 Scheduler
//   11-58 ice. One spike at 20, then six more at 30, 35, 40, 45, 50, 55.
//   59-63 a 5-tile pit. 68 a spike on the landing.
//   74-82 a low one-way over safe ground. 80-88 a high one-way.
//   86-87 a wall too tall to jump from the ground.
//   89-92 a gap over floor spikes. 99-103 a wider gap. 104-107 the far ledge.
//   114 a jump pad. 115-120 a pit six tiles wide. Landing is 121-125,
//   then 126-130 is another five-tile pit.
//   136 checkpoint, 140 Flipper
//   152 a one-tile hole. The icicle above it falls into the hole.
//   Icicles at 158, 162, 166. Pit at 170-173. Icicles at 176 and 179.
//   Pit at 181-185, five tiles.
//   194 checkpoint, 198 FSRS
//   206-210 a step. 208 crumbles, and the floor under it is solid.
//   Two-tile crumble islands at 218, 225, 232, 239. Five empty tiles between them.
//   255-282 ice. Floor spikes at 262, 270, and 278.
//   Each has ceiling spikes on row 9 and blocks on row 8.
//   286 a jump pad. The ledge is on row 8 at 292, then steps down.
//   306 portal.
const lostWorld: LevelDef = {
  id: "lost-world",
  title: "Lost World",
  theme: "ice",
  panels: [
    { kind: "project", index: 0 },
    { kind: "project", index: 1 },
    { kind: "project", index: 2 },
  ],
  signs: [
    { c: 14, r: 10, text: "Ice. You slide." },
    { c: 72, r: 10, text: "One-way. You can jump up through it." },
    { c: 110, r: 10, text: "Jump pad." },
    { c: 146, r: 10, text: "Falling spike." },
    { c: 202, r: 10, text: "Crumble. It breaks if you stand on it." },
  ],
  rows: [
    ".....................................................................................................................................................................................................................................................................................................................",
    ".....................................................................................................................................................................................................................................................................................................................",
    ".....................................................................................................................................................................................................................................................................................................................",
    ".....................................................................................................................................................................................................................................................................................................................",
    ".....................................................................................................................................................................................................................................................................................................................",
    ".....................................................................................................................................................................................................................................................................................................................",
    "........................................................................................................................................................!.....!...!...!.........!..!.................................................................................................................................",
    ".....................................................................................................................................................................................................................................................................................................................",
    "#...............................................................................=========....======.....====........................................................................................................................................................#####...#####...#####...........#####............",
    "#.....................................................................................##............................................................................................................................................................................vvvvv...vvvvv...vvvvv...............###..........",
    "#.....................................................................................##..................................................................................................................................................................................................................###........",
    "#.........................................................................=========...##....................................................................................................................................................................................................................###......",
    "#.P...I.............^.........^....^....^....^....^....^............^.................##^^^^^^^^^^^^^^^...........J.....................C...I.....................................................C...I.......##x##...................................................^.......^.......^.......J...............###.O.#",
    "###########~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.....#################.......###############...#########......#####.....#####################.#################....#######.....###########################.....xx.....xx.....xx.....xx.....#########~~~~~~~~~~~~~~~~~~~~~~~~~~~~####...............#######",
  ],
};

export const courses: Course[] = [
  {
    id: "first-level",
    title: "First Level",
    difficulty: "normal",
    song: "Race Around the World",
    artist: "Waterflame",
    audio: "01-race-around-the-world.mp3",
    songUrl: "https://www.newgrounds.com/audio/listen/110798",
    section: "About + Featured",
    level: firstLevel,
  },
  {
    id: "lost-world",
    title: "Lost World",
    difficulty: "hard",
    song: "Another World",
    artist: "Razorrekker",
    audio: "02-another-world.mp3",
    songUrl: "https://www.newgrounds.com/audio/listen/659843",
    section: "Projects",
    level: lostWorld,
  },
  {
    id: "mystic-mountains",
    title: "Mystic Mountains",
    difficulty: "harder",
    song: "The Falling Mysts",
    artist: "Dimrain47",
    audio: "03-the-falling-mysts.mp3",
    songUrl: "https://www.newgrounds.com/audio/listen/508568",
    section: "Experience, High School",
  },
  {
    id: "sci-fi-showdown",
    title: "Sci-Fi Showdown",
    difficulty: "insane",
    song: "At the Speed of Light",
    artist: "Dimrain47",
    audio: "04-at-the-speed-of-light.mp3",
    songUrl: "https://www.newgrounds.com/audio/listen/467339",
    section: "Experience, At Yale",
  },
  {
    id: "last-hope",
    title: "Last Hope",
    difficulty: "hard-demon",
    song: "Figures",
    // Published on Newgrounds by Rukkus, who releases as ~NK~.
    artist: "~NK~",
    audio: "05-figures.mp3",
    songUrl: "https://www.newgrounds.com/audio/listen/541008",
    section: "Awards",
  },
  {
    id: "final-battle",
    title: "The Final Battle",
    difficulty: "extreme-demon",
    song: "Battle Against a True Hero",
    artist: "Toby Fox",
    audio: "06-battle-against-a-true-hero.mp3",
    songUrl: "https://tobyfox.bandcamp.com/album/undertale-soundtrack",
    section: "Skills, Education, Contact",
  },
];

// Practice map from before First Level. It is not on the level select.
// It still uses the original tiles: ice, pads, one-way platforms, wall spikes.
// Falling icicles and crumble blocks are in Lost World.
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
