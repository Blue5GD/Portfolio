import type { ExperienceGroup } from "./types";

// "At Yale" comes before "High School". Items in each group are newest first.
export const experience: ExperienceGroup[] = [
  {
    heading: "At Yale",
    items: [
      {
        role: "Developer",
        org: "CourseTable, Y/CS",
        dates: "Fall 2026 – Present",
        bullets: [
          "Building Yale's course exploration platform, which brings together course info, student evaluations, and demand statistics.",
        ],
        href: "https://coursetable.com",
      },
      {
        role: "Participant",
        org: "Y/CS Catalyst",
        dates: "Fall 2026",
        bullets: [
          "Designed and built this portfolio: an Astro site with a hand-written Canvas platformer.",
        ],
      },
    ],
  },
  {
    heading: "High School",
    items: [
      {
        role: "President and Founder",
        org: "Science Olympiad",
        dates: "Sep 2025 – Feb 2026",
        bullets: [
          "Founded the school's first full team (15 members) and managed a $1,500 prep budget.",
          "Team placed 3rd overall at the inaugural Tulane University Science Olympiad.",
        ],
      },
      {
        role: "Competition Prep Lead",
        org: "Mu Alpha Theta",
        dates: "Aug 2023 – May 2026",
        bullets: [
          "Raised $2,000 to send the chapter to its first state convention since 2013.",
          "Led review sessions and annotated 40+ practice exams.",
        ],
      },
      {
        role: "President",
        org: "Chess Club",
        dates: "Aug 2022 – May 2026",
        bullets: [
          "Doubled membership from 15 to 30 and cut fees from $150 to $5 by restructuring into a student-led club.",
          "Built a CustomTkinter app to run in-club tournaments.",
        ],
      },
    ],
    footnote:
      "Service: 100+ hrs National Honor Society (incl. middle school math tutoring) · 50+ hrs Key Club · 30+ hrs Jefferson Federation of Teachers, organizing ~25 volunteers to pack 10,000+ school supply bags.",
  },
];
