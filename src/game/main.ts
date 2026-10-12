import { createMusic } from "./audio";
import { keyboardGameAvailable, watchKeyboardGame } from "./device";
import { difficultyLabel, faceUrl } from "./faces";
import { attachInput } from "./input";
import { parseLevel } from "./level";
import { courses } from "./levels";
import { startLoop } from "./loop";
import { fillCredits, fillPanel, readContent } from "./panels";
import { createGame, step } from "./physics";
import { render } from "./render";
import { getTheme } from "./themes";
import {
  loadMuted,
  loadProgress,
  loadVolume,
  markCleared,
  saveMuted,
  saveProgress,
  saveVolume,
  type Progress,
} from "./storage";
import type { ContentRef, GameState } from "./types";

// Front door for /play.
//
// The page opens on a level select. Picking a course builds a GameState and
// starts the loop. Beating or skipping a course writes `b5gd:progress`.
//
//   input.ts      which keys are held, plus the M key
//   loop.ts       steady 1/120s physics steps, drawn every frame
//   physics.ts    running, jumping, and tile collision
//   level.ts      turns the ASCII map into cells physics can look up
//   levels.ts     the six courses; First Level through Last Hope have maps
//   panels.ts     turns an info block into the dialog, using src/data
//   audio.ts      one looping song per level
//   storage.ts    saved unlocks, clears, attempts, mute, and volume
//   faces.ts      difficulty faces on the cards and the pause screen
//   render.ts     draws the map, the cube, and the progress bar

export function mountGame(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d", { alpha: false });
  const select = document.querySelector<HTMLElement>("#level-select");
  const cards = document.querySelector<HTMLElement>("#level-cards");
  const attemptTotal = document.querySelector<HTMLElement>("#attempt-total");
  const stage = document.querySelector<HTMLElement>("#stage");
  const levelTitle = document.querySelector<HTMLElement>("#level-title");
  const notice = document.querySelector<HTMLDialogElement>("#notice");
  const noticeTitle = document.querySelector<HTMLElement>("#notice-title");
  const noticeBody = document.querySelector<HTMLElement>("#notice-body");
  const noticeOk = document.querySelector<HTMLButtonElement>("#notice-ok");
  const noticeCancel = document.querySelector<HTMLButtonElement>("#notice-cancel");
  const pauseBtn = document.querySelector<HTMLButtonElement>("#pause-btn");
  const practiceBtn = document.querySelector<HTMLButtonElement>("#practice-btn");
  const skipBtn = document.querySelector<HTMLButtonElement>("#skip-btn");
  const resetBtn = document.querySelector<HTMLButtonElement>("#reset-progress");
  const creditsBtn = document.querySelector<HTMLButtonElement>("#credits-btn");
  const status = document.querySelector<HTMLElement>("#game-status");
  const help = document.querySelector<HTMLElement>("#game-help");
  const muteButtons = [
    ...document.querySelectorAll<HTMLButtonElement>("[data-mute]"),
  ];
  const volumeInputs = [
    ...document.querySelectorAll<HTMLInputElement>("[data-volume]"),
  ];
  const content = readContent();

  if (
    !ctx ||
    !select ||
    !cards ||
    !attemptTotal ||
    !stage ||
    !levelTitle ||
    !notice ||
    !noticeTitle ||
    !noticeBody ||
    !noticeOk ||
    !noticeCancel ||
    !pauseBtn ||
    !practiceBtn ||
    !skipBtn ||
    !resetBtn ||
    !creditsBtn ||
    !status ||
    !help ||
    muteButtons.length === 0 ||
    volumeInputs.length === 0
  ) {
    throw new Error("Play page is missing the level select, canvas, or dialog.");
  }

  const context: CanvasRenderingContext2D = ctx;
  const levelList: HTMLElement = select;
  const cardList: HTMLElement = cards;
  const attempts: HTMLElement = attemptTotal;
  const stageEl: HTMLElement = stage;
  const titleEl: HTMLElement = levelTitle;
  const dialog: HTMLDialogElement = notice;
  const dialogTitle: HTMLElement = noticeTitle;
  const dialogBody: HTMLElement = noticeBody;
  const dialogOk: HTMLButtonElement = noticeOk;
  const dialogCancel: HTMLButtonElement = noticeCancel;
  const pause: HTMLButtonElement = pauseBtn;
  const practice: HTMLButtonElement = practiceBtn;
  const live: HTMLElement = status;
  const helpEl: HTMLElement = help;

  let playing = false;
  let currentIndex = -1;
  let state: GameState | null = null;
  let stopLoop: (() => void) | null = null;
  let progress: Progress = loadProgress(courses.length);
  let muted = loadMuted();
  let volume = loadVolume();
  const music = createMusic(
    courses.map((course) => course.audio),
    muted,
    volume,
  );

  const { input, detach } = attachInput(() => dialog.open || !playing, toggleMute);

  // "any" means Esc and the button both continue (info panels).
  // "ok" means only the confirm button continues (reset progress).
  let closeMode: "any" | "ok" = "any";
  let closeAction: "ok" | "cancel" = "cancel";
  let afterClose: (() => void) | null = null;

  dialogOk.addEventListener("click", () => {
    closeAction = "ok";
    dialog.close();
  });
  dialogCancel.addEventListener("click", () => {
    closeAction = "cancel";
    dialog.close();
  });

  function onDialogKey(event: KeyboardEvent) {
    if (event.key === "Enter") {
      if (event.target instanceof HTMLAnchorElement) return;
      // Enter on Cancel should cancel, not confirm.
      if (event.target === dialogCancel) return;
      event.preventDefault();
      closeAction = "ok";
      dialog.close();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeAction = "cancel";
      dialog.close();
    }
  }
  dialog.addEventListener("keydown", onDialogKey);
  dialog.addEventListener("close", () => {
    // Escape closes the dialog on its own. Don't let that same press pause the game.
    input.pausePressed = false;
    const fn = afterClose;
    afterClose = null;
    const action = closeAction;
    closeAction = "cancel";
    dialogCancel.hidden = true;
    if (closeMode === "ok" && action !== "ok") return;
    fn?.();
    if (playing && !dialog.open) canvas.focus();
  });

  function openDialog(okLabel: string, after: () => void, mode: "any" | "ok" = "any") {
    dialogOk.textContent = okLabel;
    dialogCancel.hidden = mode !== "ok";
    closeMode = mode;
    closeAction = "cancel";
    afterClose = after;
    if (!dialog.open) dialog.showModal();
    if (mode === "ok") dialogCancel.focus();
    else dialogOk.focus();
  }

  function openRefs(refs: ContentRef[], done: () => void, lastLabel: string) {
    let i = 0;
    function next() {
      if (i >= refs.length) {
        done();
        return;
      }
      const ref = refs[i];
      i += 1;
      fillPanel(dialogTitle, dialogBody, content, ref);
      openDialog(i >= refs.length ? lastLabel : "Continue", next);
    }
    if (refs.length === 0) done();
    else next();
  }

  function toggleMute() {
    muted = !muted;
    saveMuted(muted);
    music.setMuted(muted);
    syncMute();
  }

  function syncMute() {
    const label = muted ? "Unmute" : "Mute";
    for (const button of muteButtons) {
      button.textContent = label;
      button.setAttribute("aria-pressed", muted ? "true" : "false");
      button.setAttribute("aria-label", muted ? "Unmute. Music is remembered off." : "Mute. Music is remembered on.");
    }
  }

  function syncVolume(except?: HTMLInputElement) {
    const percent = String(Math.round(volume * 100));
    for (const input of volumeInputs) {
      if (input === except) continue;
      input.value = percent;
    }
  }

  function onVolumeInput(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const percent = Number(input.value);
    if (!Number.isFinite(percent)) return;
    volume = Math.min(1, Math.max(0, percent / 100));
    saveVolume(volume);
    music.setVolume(volume);
    syncVolume(input);
  }

  function renderCards() {
    cardList.replaceChildren();
    courses.forEach((course, index) => {
      const locked = index >= progress.unlocked;
      const cleared = progress.cleared.includes(index);
      const playable = Boolean(course.level);
      const card = document.createElement("article");
      card.className = "card";
      card.dataset.state = locked ? "locked" : cleared ? "cleared" : "open";
      if (locked) card.setAttribute("aria-disabled", "true");

      const face = document.createElement("img");
      face.className = "face";
      face.src = faceUrl(course.difficulty);
      face.alt = "";
      face.setAttribute("aria-hidden", "true");

      const title = document.createElement("h2");
      title.textContent = course.title;
      const diff = document.createElement("p");
      diff.className = "diff";
      diff.textContent = difficultyLabel(course.difficulty);
      const song = document.createElement("p");
      song.className = "song";
      song.textContent = `${course.song} — ${course.artist}`;
      const section = document.createElement("p");
      section.className = "section";
      section.textContent = course.section;
      const badge = document.createElement("p");
      badge.className = "badge";
      const readyLabel = keyboardGameAvailable() ? "Ready" : "Keyboard only";
      badge.textContent = locked ? "Locked" : cleared ? "Cleared" : playable ? readyLabel : "Unlocked";

      card.append(face, title, diff, song, section, badge);

      if (!locked) {
        const actions = document.createElement("div");
        actions.className = "card-actions";
        if (playable && !keyboardGameAvailable()) {
          const needsKeys = document.createElement("p");
          needsKeys.className = "section";
          needsKeys.textContent = "Needs a keyboard";
          actions.append(needsKeys);
        } else if (playable) {
          const play = document.createElement("button");
          play.type = "button";
          play.className = "gd-btn";
          play.textContent = "Play";
          play.addEventListener("click", () => startLevel(index));
          actions.append(play);
        } else {
          const soon = document.createElement("button");
          soon.type = "button";
          soon.className = "gd-btn gd-btn--alt";
          soon.textContent = "Not yet";
          soon.addEventListener("click", () => {
            dialogTitle.textContent = course.title;
            dialogBody.replaceChildren();
            const note = document.createElement("p");
            note.textContent = "This course is unlocked, but it is not ready to play yet.";
            dialogBody.append(note);
            openDialog("Back", () => {});
          });
          actions.append(soon);
        }
        if (playable && cleared && course.level) {
          const read = document.createElement("button");
          read.type = "button";
          read.className = "gd-btn gd-btn--alt";
          read.textContent = "Read";
          read.addEventListener("click", () => openRefs(course.level?.panels ?? [], () => {}, "Done"));
          actions.append(read);
        }
        card.append(actions);
      }

      cardList.append(card);
    });
    attempts.textContent = `Total attempts: ${progress.attempts}`;
  }

  function clearEdges() {
    input.jumpPressed = false;
    input.restart = false;
    input.pausePressed = false;
    input.placeCheckpoint = false;
    input.removeCheckpoint = false;
  }

  function startLevel(index: number) {
    const course = courses[index];
    if (!course || index >= progress.unlocked || dialog.open) return;
    if (!course.level || !keyboardGameAvailable()) return;

    if (stopLoop) {
      stopLoop();
      stopLoop = null;
    }

    const level = parseLevel(course.level);
    canvas.style.background = getTheme(level.theme).sky[0];
    const next = createGame(level, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    next.difficulty = course.difficulty;
    next.onAttempt = () => {
      progress.attempts += 1;
      saveProgress(progress);
    };
    next.onInfo = (infoIndex) => {
      next.phase = "paused";
      next.pauseReason = "dialog";
      const ref = next.level.panels[infoIndex];
      if (ref) fillPanel(dialogTitle, dialogBody, content, ref);
      else {
        dialogTitle.textContent = "Missing panel";
        dialogBody.replaceChildren();
        const note = document.createElement("p");
        note.textContent = "This info block is not linked to a section.";
        dialogBody.append(note);
      }
      openDialog("Continue", () => {
        if (next.phase === "paused") {
          next.phase = "play";
          next.pauseReason = null;
        }
      });
    };
    next.onWin = () => {
      // The clear panel stays on this song. showSelect() stops it when they leave.
      markCleared(progress, index, courses.length);
      saveProgress(progress);
      const following = courses[index + 1];
      if (next.level.finale) {
        fillPanel(dialogTitle, dialogBody, content, { kind: "contact" });
        dialogTitle.textContent = "Level Complete!";
        const runNote = document.createElement("p");
        runNote.textContent = `${course.title} took ${next.attempts} attempts this run.`;
        const totalNote = document.createElement("p");
        totalNote.textContent = `Total attempts across every level: ${progress.attempts}.`;
        dialogBody.prepend(runNote, totalNote);
        openDialog("Level select", () => showSelect());
        return;
      }
      dialogTitle.textContent = `${course.title} clear`;
      dialogBody.replaceChildren();
      const note = document.createElement("p");
      note.textContent = `Attempts this run: ${next.attempts}.`;
      dialogBody.append(note);
      if (following) {
        const unlocked = document.createElement("p");
        unlocked.textContent = `${following.title} is unlocked.`;
        dialogBody.append(unlocked);
      }
      openDialog("Level select", () => showSelect());
    };

    state = next;
    currentIndex = index;
    progress.attempts += 1;
    saveProgress(progress);
    clearEdges();

    titleEl.textContent = course.title;
    canvas.setAttribute(
      "aria-label",
      `${course.title}, ${difficultyLabel(course.difficulty)}. Arrow keys or W A S D to move and jump. R restarts. Escape pauses.`,
    );
    levelList.hidden = true;
    stageEl.hidden = false;
    playing = true;
    fit();
    canvas.focus();
    // This runs inside the Play click, which is what lets the browser start sound.
    music.start(index);

    stopLoop = startLoop(
      (dt) => {
        if (state) step(state, input, dt);
      },
      () => {
        if (!state) return;
        // Crashes, info panels, and the clear panel keep the song going.
        // The pause menu is the one that waits.
        const hearing =
          state.phase === "play" ||
          state.phase === "dead" ||
          state.phase === "won" ||
          (state.phase === "paused" && state.pauseReason === "dialog");
        music.setActive(hearing);
        render(context, state);
        syncStatus();
      },
    );
  }

  function showSelect() {
    playing = false;
    currentIndex = -1;
    music.stop();
    if (stopLoop) {
      stopLoop();
      stopLoop = null;
    }
    stageEl.hidden = true;
    levelList.hidden = false;
    renderCards();
  }

  function skipLevel() {
    if (!state || currentIndex < 0 || dialog.open) return;
    const course = courses[currentIndex];
    if (!course?.level) return;
    state.phase = "paused";
    state.pauseReason = "dialog";
    markCleared(progress, currentIndex, courses.length);
    saveProgress(progress);
    openRefs(course.level.panels, () => showSelect(), "Level select");
  }

  pause.addEventListener("click", () => {
    if (!state || dialog.open || state.phase === "won" || state.phase === "dead") return;
    input.pausePressed = true;
    // Focus would stay on this button, and keys are ignored while a button is focused.
    canvas.focus();
  });
  practice.addEventListener("click", () => {
    if (!state || dialog.open || state.phase === "won") return;
    state.practice = !state.practice;
    canvas.focus();
  });
  skipBtn.addEventListener("click", skipLevel);
  for (const button of muteButtons) button.addEventListener("click", toggleMute);
  for (const input of volumeInputs) input.addEventListener("input", onVolumeInput);
  creditsBtn.addEventListener("click", () => {
    if (dialog.open) return;
    fillCredits(dialogTitle, dialogBody, courses);
    openDialog("Back", () => {});
  });
  resetBtn.addEventListener("click", () => {
    if (dialog.open) return;
    dialogTitle.textContent = "Reset progress?";
    dialogBody.replaceChildren();
    const note = document.createElement("p");
    note.textContent = "This locks every level after First Level and sets the attempt count back to zero.";
    dialogBody.append(note);
    openDialog(
      "Reset",
      () => {
        progress = { unlocked: 1, cleared: [], attempts: 0 };
        saveProgress(progress);
        renderCards();
      },
      "ok",
    );
  });

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMotion = () => {
    if (state) state.reducedMotion = motion.matches;
  };
  motion.addEventListener("change", onMotion);

  // Leaving a keyboard layout (a phone rotation, or a window dragged narrow)
  // drops back to the level select. The note there explains why Play is gone.
  const stopKeyboardWatch = watchKeyboardGame(() => {
    if (!keyboardGameAvailable() && playing) showSelect();
    renderCards();
  });

  function fit() {
    if (!state) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    state.viewW = Math.max(1, rect.width);
    state.viewH = Math.max(1, rect.height);
    state.dpr = dpr;
    const w = Math.floor(state.viewW * dpr);
    const h = Math.floor(state.viewH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  const observer = new ResizeObserver(fit);
  observer.observe(canvas);

  let lastStatus = "";
  function syncStatus() {
    if (!state) return;
    const paused = state.phase === "paused" && state.pauseReason === "menu";
    const label = paused ? "Resume" : "Pause";
    if (pause.textContent !== label) pause.textContent = label;
    pause.setAttribute("aria-pressed", paused ? "true" : "false");

    const practicing = state.practice;
    practice.textContent = practicing ? "Practice on" : "Practice";
    practice.setAttribute("aria-pressed", practicing ? "true" : "false");
    const helpText = practicing
      ? "Practice is on. Z places a checkpoint. X removes the last one. R restarts there."
      : "Arrows or WASD, hold jump. R restarts. Esc pauses. M mutes. The slider sets volume.";
    if (helpEl.textContent !== helpText) helpEl.textContent = helpText;

    let message = `Attempt ${state.attempts}.`;
    if (practicing) message = `Practice mode. ${state.practicePoints.length} placed. ${message}`;
    if (state.phase === "dead") message = `Crashed. ${message}`;
    else if (paused) message = `Paused. ${difficultyLabel(state.difficulty)}.`;
    else if (state.phase === "won") message = `${state.level.title} clear. Attempts this run: ${state.attempts}.`;
    if (message !== lastStatus) {
      live.textContent = message;
      lastStatus = message;
    }
  }

  syncMute();
  syncVolume();
  renderCards();

  function cleanup() {
    if (stopLoop) stopLoop();
    music.destroy();
    detach();
    observer.disconnect();
    motion.removeEventListener("change", onMotion);
    stopKeyboardWatch();
    dialog.removeEventListener("keydown", onDialogKey);
  }

  window.addEventListener("pagehide", cleanup, { once: true });
  return cleanup;
}
