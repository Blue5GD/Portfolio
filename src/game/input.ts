import type { Input } from "./types";

const JUMP = new Set(["ArrowUp", "KeyW", "Space"]);
const LEFT = new Set(["ArrowLeft", "KeyA"]);
const RIGHT = new Set(["ArrowRight", "KeyD"]);

function isGameKey(code: string): boolean {
  return JUMP.has(code) || LEFT.has(code) || RIGHT.has(code) || code === "KeyR" || code === "Escape" || code === "KeyP";
}

/**
 * Listen for movement keys on the window, so the cube responds even when
 * the canvas itself is not focused. Edges (jump, restart, pause) stay true
 * until physics reads them, because a key can go down and up between frames.
 */
export function attachInput(blocked: () => boolean, onMute: () => void): { input: Input; detach: () => void } {
  const down = new Set<string>();
  const input: Input = {
    left: false,
    right: false,
    jumpHeld: false,
    jumpPressed: false,
    restart: false,
    pausePressed: false,
    placeCheckpoint: false,
    removeCheckpoint: false,
  };

  function sync() {
    input.left = down.has("ArrowLeft") || down.has("KeyA");
    input.right = down.has("ArrowRight") || down.has("KeyD");
    input.jumpHeld = down.has("ArrowUp") || down.has("KeyW") || down.has("Space");
  }

  function clear() {
    down.clear();
    sync();
  }

  function onDown(e: KeyboardEvent) {
    // Mute is allowed while a dialog is open and while a button is focused.
    if (e.code === "KeyM" && !e.repeat) {
      onMute();
      return;
    }
    const onButton = e.target instanceof HTMLButtonElement;
    // Held arrows would otherwise scroll the page.
    if (isGameKey(e.code) && !onButton && !blocked()) e.preventDefault();
    if (e.repeat || onButton || blocked()) return;

    if (e.code === "KeyZ") {
      input.placeCheckpoint = true;
      return;
    }
    if (e.code === "KeyX") {
      input.removeCheckpoint = true;
      return;
    }

    down.add(e.code);
    sync();
    if (JUMP.has(e.code)) input.jumpPressed = true;
    if (e.code === "KeyR") input.restart = true;
    if (e.code === "Escape" || e.code === "KeyP") input.pausePressed = true;
  }

  function onUp(e: KeyboardEvent) {
    down.delete(e.code);
    sync();
  }

  function onHide() {
    if (document.hidden) clear();
  }

  // Capture phase runs before a dialog's Escape closes it. If we listened
  // on the way back up, the dialog would already be gone and Escape would
  // also pause the game.
  window.addEventListener("keydown", onDown, true);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", onHide);

  return {
    input,
    detach() {
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onHide);
      clear();
    },
  };
}
