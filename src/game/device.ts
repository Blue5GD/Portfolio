/** True when the window is wide enough for the HUD and the primary pointer is a mouse or trackpad. */
const KEYBOARD_GAME = "(min-width: 768px) and (pointer: fine)";

/**
 * The platformer is keyboard-only. Phones, tablets, and narrow windows fail this
 * check. On-screen buttons are a possible later addition, not part of the site now.
 */
export function keyboardGameAvailable(): boolean {
  return window.matchMedia(KEYBOARD_GAME).matches;
}

/** Fires when the window crosses into or out of the keyboard layout. */
export function watchKeyboardGame(onChange: () => void): () => void {
  const query = window.matchMedia(KEYBOARD_GAME);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
