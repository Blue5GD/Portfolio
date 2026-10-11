// Shapes for all site content. Think of these like C++ structs:
// every data file must match its type, or `astro check` reports an error.
// The `?` after a field name means that field is optional.

export interface Link {
  label: string;
  href: string;
}

export interface Identity {
  name: string;
  brand: string;
  tagline: string;
  email: string;
  github: string;
  linkedin: string;
  /** File name inside public/. Prefix with import.meta.env.BASE_URL when linking. */
  resumeFile: string;
}

export interface About {
  paragraphs: string[];
}

export interface FeaturedItem {
  title: string;
  blurb: string;
  href?: string;
}

/** GD difficulty labels, used by the game's level select. */
export type Difficulty =
  | "Easy"
  | "Normal"
  | "Hard"
  | "Harder"
  | "Insane"
  | "Demon"
  | "Hard Demon"
  | "Extreme Demon";

export interface Project {
  title: string;
  dates: string;
  summary: string;
  bullets: string[];
  tags: string[];
  links: Link[];
}

export interface ExperienceItem {
  role: string;
  org: string;
  dates: string;
  bullets: string[];
  href?: string;
}

export interface ExperienceGroup {
  heading: string;
  items: ExperienceItem[];
  /** One compact line shown after the items (used for service hours). */
  footnote?: string;
}

export interface Award {
  /** Shown as "May 2026". Month is a 3-letter abbreviation. */
  date: string;
  title: string;
  detail?: string;
}

export interface SkillGroup {
  name: string;
  skills: string[];
}

export interface EducationItem {
  school: string;
  location: string;
  degree?: string;
  dates: string;
  details?: string;
}
