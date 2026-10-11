import type {
  Award,
  EducationItem,
  ExperienceGroup,
  ExperienceItem,
  FeaturedItem,
  Project,
  SkillGroup,
} from "../data/types";
import type { Course } from "./levels";
import type { ContentRef } from "./types";

// The portfolio words live in src/data and are also shown on the classic page.
// play.astro copies them into a JSON blob in the page (the tag #game-content).
// This file reads that blob and builds the dialog. It does not keep a second copy.
//
// Text is set with textContent, not innerHTML. The words are data, not markup,
// so a quote or a "<" in a sentence cannot change the page.

export interface GameContact {
  email: string;
  github: string;
  githubLabel: string;
  linkedin: string;
  linkedinLabel: string;
  resumeHref: string;
}

/** Same fields the classic page renders, plus contact links with the base path already applied. */
export interface GameContent {
  about: { paragraphs: string[] };
  featured: FeaturedItem[];
  projects: Project[];
  experience: ExperienceGroup[];
  awards: Award[];
  skills: SkillGroup[];
  education: EducationItem[];
  contact: GameContact;
}

export function readContent(): GameContent {
  const node = document.querySelector("#game-content");
  if (!node?.textContent) {
    throw new Error("Play page is missing #game-content.");
  }
  return JSON.parse(node.textContent) as GameContent;
}

/** Fill the dialog title and body for one info block. */
export function fillPanel(
  title: HTMLElement,
  body: HTMLElement,
  content: GameContent,
  ref: ContentRef,
): void {
  body.replaceChildren();
  title.replaceChildren();

  switch (ref.kind) {
    case "about":
      title.textContent = "About";
      for (const paragraph of content.about.paragraphs) addText(body, "p", paragraph);
      return;
    case "featured":
      fillFeatured(title, body, content.featured[ref.index], ref.index);
      return;
    case "project":
      fillProject(title, body, content.projects[ref.index], ref.index);
      return;
    case "experience":
      fillExperience(title, body, content.experience[ref.group], ref.group, ref.index);
      return;
    case "service":
      fillService(title, body, content.experience);
      return;
    case "awards":
      fillAwards(title, body, content.awards, ref.start, ref.count);
      return;
    case "skills":
      title.textContent = "Skills";
      for (const group of content.skills) {
        addText(body, "h3", group.name);
        addList(body, group.skills);
      }
      return;
    case "education":
      title.textContent = "Education";
      for (const item of content.education) fillSchool(body, item);
      return;
    case "contact":
      title.textContent = "Contact";
      fillContact(body, content.contact);
      return;
    default: {
      // If a new kind is added to ContentRef and not handled here, TypeScript
      // reports an error on the next line instead of failing silently.
      const leftover: never = ref;
      title.textContent = "Missing panel";
      addText(body, "p", `This info block has an unknown kind (${JSON.stringify(leftover)}).`);
    }
  }
}

/** Music Credits: one row per level, from the same list the level select uses. */
export function fillCredits(title: HTMLElement, body: HTMLElement, courses: Course[]): void {
  body.replaceChildren();
  title.textContent = "Music Credits";
  const list = document.createElement("ul");
  list.className = "credits";
  for (const course of courses) {
    const li = document.createElement("li");
    const song = document.createElement("span");
    song.className = "label";
    song.textContent = course.song;
    const by = document.createElement("span");
    by.textContent = `${course.artist} · ${course.title}`;
    li.append(song, by);
    addLink(li, course.songUrl, "Source", true);
    list.append(li);
  }
  body.append(list);
  addText(body, "p", "All songs belong to their artists.", "dates");
}

function fillFeatured(title: HTMLElement, body: HTMLElement, item: FeaturedItem | undefined, index: number): void {
  if (!item) {
    missing(title, body, `There is no featured item ${index}.`);
    return;
  }
  title.textContent = "Featured";
  const heading = document.createElement("h3");
  if (item.href) addLink(heading, item.href, item.title, true);
  else heading.textContent = item.title;
  body.append(heading);
  addText(body, "p", item.blurb);
}

function fillProject(title: HTMLElement, body: HTMLElement, project: Project | undefined, index: number): void {
  if (!project) {
    missing(title, body, `There is no project ${index}.`);
    return;
  }
  title.textContent = project.title;
  addText(body, "p", project.dates, "dates");
  addText(body, "p", project.summary);
  addList(body, project.bullets, "bullets");
  addList(body, project.tags, "tags");
  if (project.links.length > 0) {
    const row = document.createElement("p");
    row.className = "links";
    for (const link of project.links) addLink(row, link.href, link.label, true);
    body.append(row);
  }
}

function fillExperience(
  title: HTMLElement,
  body: HTMLElement,
  group: ExperienceGroup | undefined,
  groupIndex: number,
  index: number,
): void {
  const item: ExperienceItem | undefined = group?.items[index];
  if (!group || !item) {
    missing(title, body, `There is no experience item ${index} in group ${groupIndex}.`);
    return;
  }
  title.textContent = item.role;
  addText(body, "p", item.dates, "dates");
  const org = addText(body, "p", "", "org");
  if (item.href) addLink(org, item.href, item.org, true);
  else org.textContent = item.org;
  addList(body, item.bullets, "bullets");
}

function fillService(title: HTMLElement, body: HTMLElement, groups: ExperienceGroup[]): void {
  title.textContent = "Service";
  const notes = groups.map((group) => group.footnote).filter((note): note is string => Boolean(note));
  if (notes.length === 0) {
    addText(body, "p", "No service line is written yet.");
    return;
  }
  for (const note of notes) addText(body, "p", note);
}

function fillAwards(title: HTMLElement, body: HTMLElement, awards: Award[], start: number, count: number): void {
  title.textContent = "Awards";
  const slice = awards.slice(start, start + count);
  if (slice.length === 0) {
    addText(body, "p", "No awards in this panel.");
    return;
  }
  const list = document.createElement("ul");
  list.className = "awards";
  for (const award of slice) {
    const li = document.createElement("li");
    const date = document.createElement("span");
    date.className = "date";
    date.textContent = award.date;
    const rest = document.createElement("span");
    rest.textContent = award.detail ? `${award.title} — ${award.detail}` : award.title;
    li.append(date, rest);
    list.append(li);
  }
  body.append(list);
}

function fillSchool(body: HTMLElement, item: EducationItem): void {
  const block = document.createElement("article");
  addText(block, "h3", item.school);
  addText(block, "p", item.dates, "dates");
  const line = [item.degree, item.location].filter(Boolean).join(" · ");
  if (line) addText(block, "p", line);
  if (item.details) addText(block, "p", item.details, "dates");
  body.append(block);
}

function fillContact(body: HTMLElement, contact: GameContact): void {
  const list = document.createElement("ul");
  list.className = "contact";
  addContactRow(list, "Email", contact.email, `mailto:${contact.email}`, false);
  addContactRow(list, "GitHub", contact.githubLabel, contact.github, true);
  addContactRow(list, "LinkedIn", contact.linkedinLabel, contact.linkedin, true);
  addContactRow(list, "Resume", "PDF", contact.resumeHref, true);
  body.append(list);
}

function addContactRow(list: HTMLElement, label: string, value: string, href: string, external: boolean): void {
  const li = document.createElement("li");
  const name = document.createElement("span");
  name.className = "label";
  name.textContent = label;
  li.append(name);
  addLink(li, href, value, external);
  list.append(li);
}

function missing(title: HTMLElement, body: HTMLElement, message: string): void {
  title.textContent = "Missing panel";
  addText(body, "p", message);
}

function addText(parent: HTMLElement, tag: string, text: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

function addList(parent: HTMLElement, items: string[], className?: string): void {
  const list = document.createElement("ul");
  if (className) list.className = className;
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    list.append(li);
  }
  parent.append(list);
}

function addLink(parent: HTMLElement, href: string, label: string, external: boolean): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.textContent = label;
  if (external) {
    anchor.target = "_blank";
    anchor.rel = "noopener";
  }
  parent.append(anchor);
}
