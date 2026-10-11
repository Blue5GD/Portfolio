import type { DifficultyId } from "./types";
import normalUrl from "../assets/faces/normal.png";
import hardUrl from "../assets/faces/hard.png";
import harderUrl from "../assets/faces/harder.png";
import insaneUrl from "../assets/faces/insane.png";
import hardDemonUrl from "../assets/faces/hard-demon.png";
import extremeDemonUrl from "../assets/faces/extreme-demon.png";

// The pictures in src/assets/faces are the ones from docs/plan-assets,
// with the white page behind them removed. The level cards use the URL.
// The pause screen draws the same picture on the canvas.

const FACE_URL: Record<DifficultyId, string> = {
  normal: normalUrl.src,
  hard: hardUrl.src,
  harder: harderUrl.src,
  insane: insaneUrl.src,
  "hard-demon": hardDemonUrl.src,
  "extreme-demon": extremeDemonUrl.src,
};

const LABEL: Record<DifficultyId, string> = {
  normal: "Normal",
  hard: "Hard",
  harder: "Harder",
  insane: "Insane",
  "hard-demon": "Hard Demon",
  "extreme-demon": "Extreme Demon",
};

const loaded = new Map<DifficultyId, HTMLImageElement>();

function loadFace(id: DifficultyId): HTMLImageElement {
  let img = loaded.get(id);
  if (!img) {
    img = new Image();
    img.src = FACE_URL[id];
    loaded.set(id, img);
  }
  return img;
}

for (const id of Object.keys(FACE_URL) as DifficultyId[]) loadFace(id);

export function difficultyLabel(id: DifficultyId): string {
  return LABEL[id];
}

/** URL of the face picture. The level card puts this on an img. */
export function faceUrl(id: DifficultyId): string {
  return FACE_URL[id];
}

/** Draw one face centered at (cx, cy). `radius` is half of the box it fits in. */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  id: DifficultyId,
  cx: number,
  cy: number,
  radius: number,
): void {
  const img = loadFace(id);
  if (!img.complete || img.naturalWidth === 0) return;
  const box = radius * 2.6;
  const scale = Math.min(box / img.naturalWidth, box / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
}
