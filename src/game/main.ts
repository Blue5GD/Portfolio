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
  emptyProgress,
  loadMuted,
  loadProgress,
  loadVolume,
  markCleared,
  markPractice,
  markSkipped,
  saveMuted,
  saveProgress,
  saveVolume,
  type Progress,
} from "./storage";
import type { ContentRef, GameState } from "./types";

// Front door for /play.
//
// The page opens on a level select. Picking a course builds a GameState and
// starts the loop. A normal clear, a practice finish, or a skip writes
// `b5gd:progress`. Only a normal clear marks the level cleared.
//
//   input.ts      which keys are held, plus the M key
//   loop.ts       steady 1/120s physics steps, drawn every frame
//   physics.ts    running, jumping, and tile collision
//   level.ts      turns the ASCII map into cells physics can look up
//   levels.ts     the six courses; First Level through Last Hope have maps
//   panels.ts     turns an info block into the dialog, using src/data
//   audio.ts      one looping song per level
//   storage.ts    saved unlocks, clears, practice, skips, attempts, mute, and volume
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
  const layoutPause = document.querySelector<HTMLElement>("#layout-pause");
  const layoutLeave = document.querySelector<HTMLButtonElement>("#layout-leave");
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
    !layoutPause ||
    !layoutLeave ||
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
  const layoutEl: HTMLElement = layoutPause;
  const layoutLeaveBtn: HTMLButtonElement = layoutLeave;

  let playing = false;
  // True while the too-small prompt is up. Separate from pauseReason so a menu or dialog pause can stay.
  let layoutPromptOpen = false;
  let currentIndex = -1;
  let state: GameState | null = null;
  let stopLoop: (() => void) | null = null;
  let lastPausedKey: string | null = null;
  let lastStatus = "";
  let progress: Progress = loadProgress(courses.length);
  let muted = loadMuted();
  let volume = loadVolume();
  const music = createMusic(
    courses.map((course) => course.audio),
    muted,
    volume,
  );

  // Keys are ignored while the too-small prompt is up, same as while a dialog is open.
  const { input, detach } = attachInput(
    () => dialog.open || !playing || layoutPromptOpen,
    toggleMute,
  );

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
    if (closeMode === "ok" && action !== "ok") {
      // A cancelled confirm can land while the window is narrow. Pause instead of running.
      syncLayoutPause();
      return;
    }
    fn?.();
    // Closing a panel while the window is still narrow should pause, not run.
    syncLayoutPause();
    if (playing && !dialog.open && !layoutPromptOpen) canvas.focus();
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

  /** Clear beats practice, and practice beats skip. Null means not finished yet. */
  function levelMark(index: number): "cleared" | "practice" | "skipped" | null {
    if (progress.cleared.includes(index)) return "cleared";
    if (progress.practice.includes(index)) return "practice";
    if (progress.skipped.includes(index)) return "skipped";
    return null;
  }

  function renderCards() {
    cardList.replaceChildren();
    courses.forEach((course, index) => {
      const locked = index >= progress.unlocked;
      const mark = levelMark(index);
      const playable = Boolean(course.level);
      const card = document.createElement("article");
      card.className = "card";
      card.dataset.state = locked ? "locked" : mark ?? "open";
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
      const markLabel =
        mark === "cleared" ? "Cleared" : mark === "practice" ? "Practice completed" : mark === "skipped" ? "Skipped" : null;
      badge.textContent = locked ? "Locked" : markLabel ? markLabel : playable ? readyLabel : "Unlocked";

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
        if (playable && mark && course.level) {
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
      // Practice is checked at the portal. Turning it off before the end is a normal clear.
      const practicing = next.practice;
      const alreadyCleared = progress.cleared.includes(index);
      if (practicing) markPractice(progress, index, courses.length);
      else markCleared(progress, index, courses.length);
      saveProgress(progress);
      const following = courses[index + 1];
      if (next.level.finale) {
        fillPanel(dialogTitle, dialogBody, content, { kind: "contact" });
        dialogTitle.textContent = practicing ? "Practice completed" : "Level Complete!";
        const runNote = document.createElement("p");
        runNote.textContent = `${course.title} took ${next.attempts} attempts this run.`;
        const totalNote = document.createElement("p");
        totalNote.textContent = `Total attempts across every level: ${progress.attempts}.`;
        const modeNote = document.createElement("p");
        if (practicing && alreadyCleared) {
          modeNote.textContent = "Practice mode is on. The clear on this level stays.";
        } else if (practicing) {
          modeNote.textContent = "Practice mode does not clear the level. Beat it with Practice off to clear it.";
        }
        dialogBody.prepend(runNote, totalNote);
        if (practicing) dialogBody.prepend(modeNote);
        openDialog("Level select", () => showSelect());
        return;
      }
      dialogTitle.textContent = practicing ? "Practice completed" : `${course.title} clear`;
      dialogBody.replaceChildren();
      const note = document.createElement("p");
      note.textContent = `Attempts this run: ${next.attempts}.`;
      dialogBody.append(note);
      if (practicing) {
        const modeNote = document.createElement("p");
        modeNote.textContent = alreadyCleared
          ? "Practice mode is on. The clear on this level stays."
          : "Practice mode does not clear the level. Beat it with Practice off to clear it.";
        dialogBody.append(modeNote);
      }
      if (following) {
        const unlocked = document.createElement("p");
        unlocked.textContent = `${following.title} is unlocked.`;
        dialogBody.append(unlocked);
      }
      openDialog("Level select", () => showSelect());
    };

    layoutPromptOpen = false;
    layoutEl.hidden = true;
    state = next;
    lastPausedKey = null;
    lastStatus = "";
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
        if (!state) return;
        if (layoutPromptOpen) {
          // Esc, R, jump, and practice keys must not land while this prompt is up.
          clearEdges();
          if (state.phase === "play") {
            state.phase = "paused";
            state.pauseReason = "layout";
          }
          // Death and the win panel stay as they are, but they don't advance.
          if (state.phase !== "paused") return;
        }
        step(state, input, dt);
      },
      () => {
        if (!state) return;
        // Crashes, info panels, and the clear panel keep the song going.
        // The pause menu and a too-small window are what make it wait.
        const hearing =
          !layoutPromptOpen &&
          (state.phase === "play" ||
            state.phase === "dead" ||
            state.phase === "won" ||
            (state.phase === "paused" && state.pauseReason === "dialog"));
        music.setActive(hearing);
        // A paused frame draws the same picture every time. Keep the first one
        // and skip the rest until something visible changes. A null key means
        // play, dead, or won, which always draw.
        const pausedKey =
          state.phase === "paused"
            ? [
                state.phase,
                state.pauseReason,
                state.practice,
                state.practicePoints.length,
                state.attempts,
                state.viewW,
                state.viewH,
                state.dpr,
                layoutPromptOpen,
              ].join("|")
            : null;
        if (pausedKey === null || pausedKey !== lastPausedKey) {
          render(context, state);
          lastPausedKey = pausedKey;
        }
        syncStatus();
      },
    );
  }

  // Cover the canvas until the window can show the keyboard layout again.
  // A menu or dialog pause is left alone; this only takes over a running level.
  function holdForLayout() {
    if (!state || !playing) return;
    const first = !layoutPromptOpen;
    layoutPromptOpen = true;
    layoutEl.hidden = false;
    clearEdges();
    if (state.phase === "play") {
      state.phase = "paused";
      state.pauseReason = "layout";
    }
    if (!first) return;
    // Same wait as the pause menu. A dialog pause was still playing the song.
    // Don't move focus onto Level select: Space is jump, and a focused button would treat it as a click.
    music.setActive(false);
  }

  // resume is false when they leave on purpose. A menu or dialog pause stays either way.
  function dismissLayoutPrompt(resume: boolean) {
    if (!layoutPromptOpen) return;
    layoutPromptOpen = false;
    layoutEl.hidden = true;
    if (!state) return;
    const fromLayout = state.pauseReason === "layout";
    if (fromLayout) {
      state.pauseReason = null;
      if (resume) {
        state.phase = "play";
        // The song was waiting only because of this prompt.
        music.setActive(true);
        if (!dialog.open) canvas.focus();
      }
      return;
    }
    if (!resume || state.pauseReason === "menu") return;
    if (
      state.phase === "play" ||
      state.phase === "dead" ||
      state.phase === "won" ||
      state.pauseReason === "dialog"
    ) {
      // A dialog, a crash, or the win panel had the song. This prompt was the only reason it waited.
      music.setActive(true);
    }
  }

  function syncLayoutPause() {
    // Level select has no run to pause. A narrow window only hides Play there.
    if (!playing || !state) {
      if (layoutPromptOpen) dismissLayoutPrompt(false);
      return;
    }
    if (!keyboardGameAvailable()) {
      holdForLayout();
      return;
    }
    if (layoutPromptOpen) dismissLayoutPrompt(true);
  }

  function showSelect() {
    dismissLayoutPrompt(false);
    layoutEl.hidden = true;
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
    if (!state || currentIndex < 0 || dialog.open || layoutPromptOpen) return;
    const course = courses[currentIndex];
    if (!course?.level) return;
    state.phase = "paused";
    state.pauseReason = "dialog";
    markSkipped(progress, currentIndex, courses.length);
    saveProgress(progress);
    const mark = levelMark(currentIndex);
    const following = courses[currentIndex + 1];
    dialogTitle.textContent = "Skipped";
    dialogBody.replaceChildren();
    const note = document.createElement("p");
    if (mark === "cleared") {
      note.textContent = "This level stays cleared. The panels are next.";
    } else if (mark === "practice") {
      note.textContent = "This level stays practice completed. Skipping does not clear it. The panels are next.";
    } else if (following) {
      note.textContent = `Marked skipped. ${following.title} is unlocked. Skipping does not clear the level. The panels are next.`;
    } else {
      note.textContent = "Marked skipped. Skipping does not clear the level. The panels are next.";
    }
    dialogBody.append(note);
    openDialog("Continue", () => openRefs(course.level?.panels ?? [], () => showSelect(), "Level select"));
  }

  layoutLeaveBtn.addEventListener("click", () => showSelect());
  pause.addEventListener("click", () => {
    if (!state || dialog.open || layoutPromptOpen || state.phase === "won" || state.phase === "dead") return;
    input.pausePressed = true;
    // Focus would stay on this button, and keys are ignored while a button is focused.
    canvas.focus();
  });
  practice.addEventListener("click", () => {
    if (!state || dialog.open || layoutPromptOpen || state.phase === "won") return;
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
        progress = emptyProgress();
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

  // A narrow window or a coarse pointer used to leave the level. Keep the run and wait.
  // On the level select this still only refreshes the cards, so Play hides there.
  const stopKeyboardWatch = watchKeyboardGame(() => {
    syncLayoutPause();
    renderCards();
  });

  // A Retina or 4K screen can ask for a much larger backing store than this
  // flat art needs. Capping the ratio and the total pixels keeps those visitors
  // smooth without changing the canvas's CSS size.
  const MAX_DPR = 1.5;
  const MAX_PIXELS = 2_500_000;

  function fit() {
    if (!state) return;
    const rect = canvas.getBoundingClientRect();
    const viewW = Math.max(1, rect.width);
    const viewH = Math.max(1, rect.height);
    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    if (viewW * viewH * dpr * dpr > MAX_PIXELS) {
      dpr = Math.sqrt(MAX_PIXELS / (viewW * viewH));
    }
    state.viewW = viewW;
    state.viewH = viewH;
    state.dpr = dpr;
    const w = Math.max(1, Math.floor(viewW * dpr));
    const h = Math.max(1, Math.floor(viewH * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  const observer = new ResizeObserver(fit);
  observer.observe(canvas);

  function syncStatus() {
    if (!state) return;
    const menuPaused = state.phase === "paused" && state.pauseReason === "menu";
    const label = menuPaused ? "Resume" : "Pause";
    const pauseAria = menuPaused ? "true" : "false";
    if (pause.textContent !== label) pause.textContent = label;
    if (pause.getAttribute("aria-pressed") !== pauseAria) pause.setAttribute("aria-pressed", pauseAria);

    const practicing = state.practice;
    const practiceLabel = practicing ? "Practice on" : "Practice";
    const practiceAria = practicing ? "true" : "false";
    if (practice.textContent !== practiceLabel) practice.textContent = practiceLabel;
    if (practice.getAttribute("aria-pressed") !== practiceAria) practice.setAttribute("aria-pressed", practiceAria);
    const helpText = practicing
      ? "Practice is on. Z places a checkpoint. X removes the last one. R restarts there."
      : "Arrows or WASD, hold jump. R restarts. Esc pauses. M mutes. The slider sets volume.";
    if (helpEl.textContent !== helpText) helpEl.textContent = helpText;

    let message = `Attempt ${state.attempts}.`;
    if (practicing) message = `Practice mode. ${state.practicePoints.length} placed. ${message}`;
    if (layoutPromptOpen) message = "Window is too small. Make it wider to resume.";
    else if (state.phase === "dead") message = `Crashed. ${message}`;
    else if (menuPaused) message = `Paused. ${difficultyLabel(state.difficulty)}.`;
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
