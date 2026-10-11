import type { Project } from "./types";

// Newest first, by start date.
export const projects: Project[] = [
  {
    title: "Probabilistic Master Scheduler",
    dates: "Aug 2025 – Jan 2026",
    summary:
      "Generates feasible high school master schedules and predicts how students will actually be placed.",
    bullets: [
      "1st Place Mathematics, Louisiana Science and Engineering Fair, plus an Office of Naval Research Special Award.",
      "Evaluated on real data from 600+ students and 60+ course offerings.",
      "Combines Dirichlet-multinomial demand sampling, Dinic max-flow, and simulated annealing with Monte Carlo simulation.",
    ],
    tags: ["Python", "Monte Carlo", "Probabilistic Models", "Scheduling Algorithms"],
    links: [{ label: "GitHub", href: "https://github.com/Blue5GD/Probabilistic-Scheduler" }],
  },
  {
    title: "Flipper Zero Anki Remote",
    dates: "Jun 2025 – Dec 2025",
    summary:
      "A Flipper Zero app that turns the device into a Bluetooth keyboard for remotely controlling Anki flashcard reviews.",
    bullets: [
      "40,000+ downloads on the official Flipper App Catalog.",
      "Configurable key mappings and presets saved to the SD card.",
    ],
    tags: ["C", "Bluetooth Low Energy", "Embedded Systems"],
    links: [
      { label: "GitHub", href: "https://github.com/Blue5GD/Anki-Remote" },
      { label: "App Catalog", href: "https://lab.flipper.net/apps/anki_remote" },
    ],
  },
  {
    title: "FSRS-5 Desired Retention Adjuster",
    dates: "May 2024 – Jan 2025",
    summary:
      "Extended FSRS-5, the spaced-repetition algorithm behind Anki, to simulate slower memory decay.",
    bullets: [
      "1st Place, Mathematics and Systems Software, Greater New Orleans Science and Engineering Fair.",
      "Ran 495 experimental conditions to test whether decay changes can be approximated by adjusting desired retention.",
    ],
    tags: ["Python", "NumPy", "Matplotlib"],
    links: [{ label: "GitHub", href: "https://github.com/Blue5GD/FSRS-5-Adjuster" }],
  },
];
