import { drawCube } from "./drawCube";
import { difficultyLabel, drawFace } from "./faces";
import { spikeDir, tileAt, type SpikeDir } from "./level";
import { laserActive, PHYSICS, spawnAt, warningActive } from "./physics";
import { getTheme, shadeTheme, type Theme } from "./themes";
import { TILE, type GameState } from "./types";

// Draw one frame. The camera is just a shift: world position minus camera
// position is where that point lands on the canvas. HUD text is drawn after
// the shift is undone, so it stays glued to the screen.

const SHARDS = [
  { x: 40, y: 20, w: 200 },
  { x: 640, y: 70, w: 150 },
  { x: 1280, y: 0, w: 230 },
  { x: 1960, y: 90, w: 170 },
  { x: 2600, y: 10, w: 210 },
  { x: 3300, y: 60, w: 160 },
];

// The sky gradient only changes when the viewport or the three sky colors
// change, so keep the most recent one instead of building it every frame.
// The context is part of the key in case the canvas is replaced.
let skyCache: {
  ctx: CanvasRenderingContext2D;
  viewW: number;
  viewH: number;
  colors: [string, string, string];
  gradient: CanvasGradient;
} | null = null;

// shadeTheme() mixes about twenty colors with string parses. Last Hope's
// colors change smoothly with progress, so quantize to 1% steps and keep the
// most recent result. Other themes return their base theme unchanged.
let shadeCache: { base: Theme; step: number; theme: Theme } | null = null;

// The red accent pass uses the same six overrides every frame. They only
// depend on the level theme, so keep the most recent glow theme.
let redGlowCache: { base: Theme; theme: Theme } | null = null;

// The Final Battle's light is a radial gradient that only depends on the
// light radius and DPR. Render it once into an offscreen canvas and blit it
// each frame; the four rectangles outside it use the same edge color.
type LightMask = {
  canvas: HTMLCanvasElement;
  radius: number;
  dpr: number;
  size: number;
};
let lightMaskCache: LightMask | null = null;

const LIGHT_EDGE = "rgba(1, 1, 4, 0.985)";

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { viewW, viewH, dpr } = state;
  if (viewW < 2 || viewH < 2) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);

  const base = getTheme(state.level.theme);
  const progress = courseProgress(state);
  const theme = shadeThemeCached(base, progress);
  ctx.fillStyle = skyGradient(ctx, viewW, viewH, theme.sky);
  ctx.fillRect(0, 0, viewW, viewH);

  const shake = state.reducedMotion ? 0 : state.shake;
  const sx = Math.sin(state.time * 55) * shake;
  const sy = Math.cos(state.time * 47) * shake;

  ctx.save();
  ctx.translate(-state.camera.x * 0.3 + sx * 0.4, -state.camera.y * 0.15);
  ctx.fillStyle = theme.shard;
  // Last Hope is long enough that one set of shards would stop halfway.
  const shardSpan = 3800;
  const shardCopies =
    base.darkness > 0 ? Math.max(1, Math.ceil((state.level.width * TILE) / shardSpan)) : 1;
  for (let copy = 0; copy < shardCopies; copy++) {
    for (const shard of SHARDS) {
      const x = shard.x + copy * shardSpan;
      ctx.beginPath();
      ctx.moveTo(x, shard.y);
      ctx.lineTo(x + shard.w * 0.15, shard.y + shard.w);
      ctx.lineTo(x - shard.w * 0.7, shard.y + shard.w * 0.85);
      ctx.fill();
    }
  }
  ctx.restore();

  // Last Hope and The Final Battle draw the cube again after their dark overlay.
  const overlay = base.darkness > 0 || base.light > 0;
  ctx.save();
  ctx.translate(sx - state.camera.x, sy - state.camera.y);
  drawWorld(ctx, state, theme);
  if (base.light <= 0) drawParticles(ctx, state);
  if (!overlay) {
    if (state.phase !== "dead") {
      const p = state.player;
      // Drawn a little bigger than the 36px hitbox so the face reads on screen.
      drawCube(ctx, p.x + p.w / 2, p.y + p.h / 2, 40, p.rot);
    }
    drawAttempt(ctx, state);
  }
  ctx.restore();

  if (base.light > 0) drawLight(ctx, state, theme, sx, sy);

  if (base.darkness > 0) {
    ctx.fillStyle = `rgba(5, 2, 10, ${progress * base.darkness})`;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.save();
    ctx.translate(sx - state.camera.x, sy - state.camera.y);
    // Past the red mark, hazards and the floor edge are drawn again on top
    // of the dark so the last third can still be read.
    if (progress >= base.redAt) {
      drawRedAccents(ctx, state);
      drawParticles(ctx, state);
    }
    if (state.phase !== "dead") {
      const p = state.player;
      drawCube(ctx, p.x + p.w / 2, p.y + p.h / 2, 40, p.rot);
    }
    drawAttempt(ctx, state);
    ctx.restore();
  }

  if (theme.fog) drawFog(ctx, state);

  ctx.save();
  ctx.translate(sx - state.camera.x, sy - state.camera.y);
  drawPracticeFlags(ctx, state);
  ctx.restore();

  drawHud(ctx, state);
  // The too-small pause has an HTML prompt, so don't also draw "Paused" here.
  if (state.phase === "paused" && state.pauseReason === "menu") drawPaused(ctx, state);
}

/** 0 at the left edge of the level, 1 at the right edge. */
function courseProgress(state: GameState): number {
  const span = state.level.width * TILE;
  if (span <= 0) return 0;
  const x = state.player.x + state.player.w / 2;
  return Math.min(1, Math.max(0, x / span));
}

function skyGradient(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  colors: [string, string, string],
): CanvasGradient {
  const cached = skyCache;
  if (
    cached &&
    cached.ctx === ctx &&
    cached.viewW === viewW &&
    cached.viewH === viewH &&
    cached.colors[0] === colors[0] &&
    cached.colors[1] === colors[1] &&
    cached.colors[2] === colors[2]
  ) {
    return cached.gradient;
  }
  const gradient = ctx.createLinearGradient(0, 0, viewW, viewH);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.55, colors[1]);
  gradient.addColorStop(1, colors[2]);
  skyCache = { ctx, viewW, viewH, colors: [colors[0], colors[1], colors[2]], gradient };
  return gradient;
}

// Last Hope's shadeTheme() is the only one that changes with progress. Round
// progress to 1% buckets so the colors still step smoothly, but shadeTheme()
// runs at most 101 times per course instead of every frame.
function shadeThemeCached(base: Theme, progress: number): Theme {
  if (base.darkness <= 0) return base;
  const step = Math.round(progress * 100);
  const cached = shadeCache;
  if (cached && cached.base === base && cached.step === step) return cached.theme;
  const theme = shadeTheme(base, step / 100);
  shadeCache = { base, step, theme };
  return theme;
}

// drawRedAccents() uses the same overrides every frame. Keep the most recent
// one; a level theme change replaces it.
function redGlowTheme(base: Theme): Theme {
  const cached = redGlowCache;
  if (cached && cached.base === base) return cached.theme;
  const theme: Theme = {
    ...base,
    spike: "#2a0810",
    spikeEdge: "#ff5a72",
    block: "#1a0a10",
    blockEdge: "#ff5a72",
    oneWay: "#ff8fa3",
    oneWayEdge: "#ff5a72",
  };
  redGlowCache = { base, theme };
  return theme;
}

// Bright red copies of the hazards and a thin line on top of the floor.
// Drawn after the dark overlay, only in the last third of Last Hope.
function drawRedAccents(ctx: CanvasRenderingContext2D, state: GameState): void {
  const level = state.level;
  const cam = state.camera;
  const glow = redGlowTheme(getTheme(level.theme));
  const c0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const c1 = Math.min(level.width - 1, Math.ceil((cam.x + state.viewW) / TILE) + 1);
  const r0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const r1 = Math.min(level.height - 1, Math.ceil((cam.y + state.viewH) / TILE) + 1);

  // Batch the repeated shapes. Last Hope has hundreds of visible tiles, and
  // one fill/stroke per style is much cheaper than one per tile.
  const linePath = new Path2D();
  const oneWayPath = new Path2D();
  const spikePath = new Path2D();

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = tileAt(level, c, r);
      const x = c * TILE;
      const y = r * TILE;
      if (ch === "#" || ch === "~") {
        linePath.moveTo(x + 2, y + 1.5);
        linePath.lineTo(x + TILE - 2, y + 1.5);
      } else if (ch === "=") addOneWayPath(oneWayPath, x, y);
      else if (ch === "C") drawCheckpoint(ctx, x, y, isActiveCheckpoint(state, c, r));
      else if (ch === "I") drawInfo(ctx, x, y, state.collected.has(`${c},${r}`));
      else if (ch === "J") drawPad(ctx, x, y, state);
      else if (ch === "o") drawOrb(ctx, x, y, state);
      else if (ch === "O") drawPortal(ctx, x, y, state);
      else {
        const dir = spikeDir(ch);
        if (dir) addSpikePath(spikePath, x, y, dir);
      }
    }
  }

  ctx.save();
  ctx.strokeStyle = "rgba(255, 70, 96, 0.9)";
  ctx.lineWidth = 2;
  ctx.stroke(linePath);
  ctx.fillStyle = glow.oneWay;
  ctx.fill(oneWayPath);
  ctx.strokeStyle = glow.oneWayEdge;
  ctx.stroke(oneWayPath);
  ctx.fillStyle = glow.spike;
  ctx.fill(spikePath);
  ctx.strokeStyle = glow.spikeEdge;
  ctx.stroke(spikePath);
  ctx.restore();

  for (const block of state.crumbles) {
    if (block.phase === "gone") continue;
    if (block.c < c0 || block.c > c1) continue;
    drawCrumble(ctx, block.c * TILE, block.y, block.phase === "firm" && block.stood >= PHYSICS.crumbleCrack, glow);
  }
  for (const mover of state.movers) drawPlatform(ctx, mover.x, mover.y, glow);
  drawLasers(ctx, state);
  for (const spike of state.fallingSpikes) {
    if (spike.y > level.height * TILE) continue;
    drawSpike(ctx, spike.c * TILE, spike.y, "down", glow);
  }
}

// Build (or reuse) the pre-rendered light mask. The color stops match the old
// full-screen radial gradient: transparent inside half the radius, then
// darker toward 1.05 radii.
function getLightMask(radius: number, dpr: number): LightMask | null {
  const cached = lightMaskCache;
  if (cached && cached.radius === radius && cached.dpr === dpr) return cached;

  const size = Math.max(1, radius * 2.1);
  const pixels = Math.max(1, Math.ceil(size * dpr));
  const canvas = document.createElement("canvas");
  canvas.width = pixels;
  canvas.height = pixels;
  const mask = canvas.getContext("2d");
  if (!mask) return null;

  // Draw at device resolution so the mask can be blitted 1:1 even when the
  // main context has a fractional DPR.
  mask.scale(pixels / size, pixels / size);
  const center = size / 2;
  const gradient = mask.createRadialGradient(
    center,
    center,
    radius * 0.5,
    center,
    center,
    radius * 1.05,
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.3)");
  gradient.addColorStop(1, LIGHT_EDGE);
  mask.fillStyle = gradient;
  mask.fillRect(0, 0, size, size);

  lightMaskCache = { canvas, radius, dpr, size };
  return lightMaskCache;
}

// Fill the screen outside the pre-rendered mask with its edge color, then draw
// the mask over the light's square. Everything is done in device pixels so the
// mask and the four rectangles share exact boundaries; one pixel of overlap
// hides any seam from fractional camera positions. Clamping to the canvas
// bounds also handles viewports smaller than the mask.
function drawLightMask(
  ctx: CanvasRenderingContext2D,
  mask: LightMask,
  lx: number,
  ly: number,
  dpr: number,
): void {
  const half = mask.size / 2;
  const left = Math.round((lx - half) * dpr);
  const top = Math.round((ly - half) * dpr);
  const right = left + mask.canvas.width;
  const bottom = top + mask.canvas.height;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const x0 = Math.max(0, Math.min(width, left + 1));
  const x1 = Math.max(x0, Math.min(width, right - 1));
  const y0 = Math.max(0, Math.min(height, top + 1));
  const y1 = Math.max(y0, Math.min(height, bottom - 1));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = LIGHT_EDGE;
  if (y0 > 0) ctx.fillRect(0, 0, width, y0);
  if (y1 < height) ctx.fillRect(0, y1, width, height - y1);
  const bandH = y1 - y0;
  if (x0 > 0) ctx.fillRect(0, y0, x0, bandH);
  if (x1 < width) ctx.fillRect(x1, y0, width - x1, bandH);
  // Whole device pixels keep drawImage a straight copy, so the mask's soft
  // edge does not get resampled every frame.
  ctx.drawImage(mask.canvas, left, top);
  ctx.restore();
}

// The Final Battle. Everything already drawn is covered by black, except a
// circle around the cube. Then the things that glow are drawn on top:
// spears (spikes), lit lasers, and markers fade out with distance, so they
// show a little past the light. Blocks, pits, and saws do not glow.
function drawLight(ctx: CanvasRenderingContext2D, state: GameState, theme: Theme, sx: number, sy: number): void {
  const { viewW, viewH, camera: cam, level } = state;
  const p = state.player;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const radius = theme.light;

  const lx = cx - cam.x + sx;
  const ly = cy - cam.y + sy;
  const mask = getLightMask(radius, state.dpr);
  if (mask) {
    drawLightMask(ctx, mask, lx, ly, state.dpr);
  } else {
    // If an offscreen canvas could not be created, keep the old per-frame
    // gradient rather than leaving the screen unshaded.
    const shade = ctx.createRadialGradient(lx, ly, radius * 0.5, lx, ly, radius * 1.05);
    shade.addColorStop(0, "rgba(0, 0, 0, 0)");
    shade.addColorStop(0.5, "rgba(0, 0, 0, 0.3)");
    shade.addColorStop(1, LIGHT_EDGE);
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  ctx.save();
  ctx.translate(sx - cam.x, sy - cam.y);
  // Full brightness inside the light, then gone by 1.9 radii.
  const glow = (x: number, y: number) => {
    const d = Math.hypot(x + TILE / 2 - cx, y + TILE / 2 - cy);
    return d <= radius ? 1 : Math.max(0, 1 - (d - radius) / (radius * 0.9));
  };

  const c0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const c1 = Math.min(level.width - 1, Math.ceil((cam.x + viewW) / TILE) + 1);
  const r0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const r1 = Math.min(level.height - 1, Math.ceil((cam.y + viewH) / TILE) + 1);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = tileAt(level, c, r);
      const x = c * TILE;
      const y = r * TILE;
      const dir = spikeDir(ch);
      const isMarker = ch === "C" || ch === "I" || ch === "J" || ch === "o" || ch === "O";
      if (!dir && !isMarker) continue;
      const alpha = glow(x, y);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      if (dir) drawSpear(ctx, x, y, dir, theme);
      else if (ch === "C") drawCheckpoint(ctx, x, y, isActiveCheckpoint(state, c, r));
      else if (ch === "I") drawInfo(ctx, x, y, state.collected.has(`${c},${r}`));
      else if (ch === "J") drawPad(ctx, x, y, state);
      else if (ch === "o") drawOrb(ctx, x, y, state);
      else drawPortal(ctx, x, y, state);
    }
  }
  for (const spike of state.fallingSpikes) {
    if (spike.y > level.height * TILE) continue;
    const alpha = glow(spike.c * TILE, spike.y);
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    drawSpear(ctx, spike.c * TILE, spike.y, "down", theme);
  }
  ctx.globalAlpha = 1;
  if (laserActive(state.laserClock)) drawLasers(ctx, state);

  drawParticles(ctx, state);
  if (state.phase !== "dead") drawCube(ctx, cx, cy, 40, p.rot);
  drawAttempt(ctx, state);
  ctx.restore();

  if (warningActive(state, radius * 1.5)) {
    ctx.save();
    ctx.fillStyle = "rgba(60, 255, 120, 0.14)";
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.strokeStyle = "rgba(60, 255, 120, 0.8)";
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, viewW - 10, viewH - 10);
    ctx.restore();
  }
}

// A spear: a thin shaft from the base, then a sharp head at the point.
// Drawn pointing up, then turned. The hitbox is the same small box as any spike.
function drawSpear(ctx: CanvasRenderingContext2D, x: number, y: number, dir: SpikeDir, theme: Theme): void {
  const turn = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir];
  ctx.save();
  ctx.translate(x + TILE / 2, y + TILE / 2);
  ctx.rotate(turn);
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(-3, 19);
    ctx.lineTo(-3, -2);
    ctx.lineTo(-11, -2);
    ctx.lineTo(0, -19);
    ctx.lineTo(11, -2);
    ctx.lineTo(3, -2);
    ctx.lineTo(3, 19);
    ctx.closePath();
  };
  outline();
  ctx.strokeStyle = "rgba(95, 227, 255, 0.25)";
  ctx.lineWidth = 9;
  ctx.lineJoin = "round";
  ctx.stroke();
  outline();
  ctx.fillStyle = theme.spike;
  ctx.fill();
  ctx.strokeStyle = theme.spikeEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// A round blade with teeth. It spins faster than the cube can roll.
function drawSaw(ctx: CanvasRenderingContext2D, x: number, y: number, state: GameState): void {
  const spin = state.reducedMotion ? 0 : state.time * 9;
  const teeth = 10;
  ctx.save();
  ctx.translate(x + TILE / 2, y + TILE / 2);
  ctx.rotate(spin);
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i / (teeth * 2)) * Math.PI * 2;
    const rad = i % 2 === 0 ? 21 : 15;
    ctx.lineTo(Math.cos(angle) * rad, Math.sin(angle) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = "#c9d6e3";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fillStyle = "#3a1018";
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ff4d6a";
  ctx.fill();
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, state: GameState, theme: Theme): void {
  const level = state.level;
  const cam = state.camera;
  // Paint pits and the area under the ground a solid dark color. Block tiles
  // are drawn on top, so only empty ground cells stay dark.
  ctx.fillStyle = theme.pit;
  ctx.fillRect(0, (level.height - 1) * TILE, level.width * TILE, TILE + 600);

  const c0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const c1 = Math.min(level.width - 1, Math.ceil((cam.x + state.viewW) / TILE) + 1);
  const r0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const r1 = Math.min(level.height - 1, Math.ceil((cam.y + state.viewH) / TILE) + 1);

  // Most of the visible world is one of a few repeated shapes. Build one path
  // per style and fill/stroke it once, instead of issuing a fill and a stroke
  // for every tile. Markers stay individual because they animate or change.
  const blockPath = new Path2D();
  const icePath = new Path2D();
  const highlightPath = new Path2D();
  const oneWayPath = new Path2D();
  const spikePath = new Path2D();
  const iciclePath = new Path2D();
  const icicleShinePath = new Path2D();

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = tileAt(level, c, r);
      const x = c * TILE;
      const y = r * TILE;
      // Falling spikes and crumbles are drawn from their live state, below.
      // Laser cells are drawn as whole beams, also below.
      if (ch === "!" || ch === "x" || ch === "|" || ch === "-") continue;
      if (ch === "#") {
        addBlockPath(blockPath, x, y);
        if (theme.icicles) addBlockHighlight(highlightPath, x, y, 16);
      } else if (ch === "~") {
        addBlockPath(icePath, x, y);
        addBlockHighlight(highlightPath, x, y, 22);
      } else if (ch === "=") addOneWayPath(oneWayPath, x, y);
      else if (ch === "C") drawCheckpoint(ctx, x, y, isActiveCheckpoint(state, c, r));
      else if (ch === "I") drawInfo(ctx, x, y, state.collected.has(`${c},${r}`));
      else if (ch === "J") drawPad(ctx, x, y, state);
      else if (ch === "o") drawOrb(ctx, x, y, state);
      else if (ch === "O") drawPortal(ctx, x, y, state);
      else if (theme.light <= 0) {
        // In the dark, spikes are drawn as glowing spears after the overlay (see drawLight).
        const dir = spikeDir(ch);
        if (dir === "down" && theme.icicles) addIciclePath(iciclePath, icicleShinePath, x, y);
        else if (dir) addSpikePath(spikePath, x, y, dir);
      }
    }
  }

  ctx.fillStyle = theme.block;
  ctx.fill(blockPath);
  ctx.strokeStyle = theme.blockEdge;
  ctx.lineWidth = 2;
  ctx.stroke(blockPath);

  ctx.fillStyle = theme.ice;
  ctx.fill(icePath);
  ctx.strokeStyle = theme.iceEdge;
  ctx.stroke(icePath);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.stroke(highlightPath);

  ctx.fillStyle = theme.oneWay;
  ctx.fill(oneWayPath);
  ctx.strokeStyle = theme.oneWayEdge;
  ctx.stroke(oneWayPath);

  ctx.fillStyle = theme.spike;
  ctx.fill(spikePath);
  ctx.strokeStyle = theme.spikeEdge;
  ctx.stroke(spikePath);

  ctx.fillStyle = theme.spike;
  ctx.fill(iciclePath);
  ctx.strokeStyle = theme.spikeEdge;
  ctx.stroke(iciclePath);
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fill(icicleShinePath);

  for (const block of state.crumbles) {
    if (block.phase === "gone") continue;
    drawCrumble(ctx, block.c * TILE, block.y, block.phase === "firm" && block.stood >= PHYSICS.crumbleCrack, theme);
  }
  for (const mover of state.movers) {
    if (mover.kind === "saw") drawSaw(ctx, mover.x, mover.y, state);
    else drawPlatform(ctx, mover.x, mover.y, theme);
  }
  drawLasers(ctx, state);

  for (const spike of state.fallingSpikes) {
    if (theme.light > 0 || spike.y > level.height * TILE) continue;
    if (theme.icicles) drawIcicle(ctx, spike.c * TILE, spike.y, theme);
    else drawSpike(ctx, spike.c * TILE, spike.y, "down", theme);
  }
  drawSigns(ctx, state);
}

function drawSigns(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.font = "15px Inter, system-ui, sans-serif";
  for (const sign of state.level.signs) {
    const x = sign.c * TILE + TILE / 2;
    const y = sign.r * TILE;
    outlined(ctx, sign.text, x, y, "#eaf6ff");
  }
  ctx.textBaseline = "alphabetic";
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, slippery: boolean, theme: Theme): void {
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, TILE - 2, TILE - 2, 3);
  ctx.fillStyle = slippery ? theme.ice : theme.block;
  ctx.strokeStyle = slippery ? theme.iceEdge : theme.blockEdge;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  if (slippery || theme.icicles) {
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 11);
    ctx.lineTo(x + (slippery ? 22 : 16), y + 11);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.stroke();
  }
}

function addBlockPath(path: Path2D, x: number, y: number): void {
  path.roundRect(x + 1, y + 1, TILE - 2, TILE - 2, 3);
}

function addBlockHighlight(path: Path2D, x: number, y: number, length: number): void {
  path.moveTo(x + 8, y + 11);
  path.lineTo(x + length, y + 11);
}

function addOneWayPath(path: Path2D, x: number, y: number): void {
  path.rect(x + 2, y, TILE - 4, 8);
}

function addSpikePath(path: Path2D, x: number, y: number, dir: SpikeDir): void {
  const left = x + 2;
  const right = x + TILE - 2;
  const top = y + 2;
  const bottom = y + TILE - 2;
  const midX = x + TILE / 2;
  const midY = y + TILE / 2;
  if (dir === "up") {
    path.moveTo(left, bottom);
    path.lineTo(midX, top);
    path.lineTo(right, bottom);
  } else if (dir === "down") {
    path.moveTo(left, top);
    path.lineTo(midX, bottom);
    path.lineTo(right, top);
  } else if (dir === "left") {
    path.moveTo(right, top);
    path.lineTo(left, midY);
    path.lineTo(right, bottom);
  } else {
    path.moveTo(left, top);
    path.lineTo(right, midY);
    path.lineTo(left, bottom);
  }
  path.closePath();
}

function addIciclePath(path: Path2D, shine: Path2D, x: number, y: number): void {
  path.moveTo(x + 8, y + 2);
  path.lineTo(x + TILE - 8, y + 2);
  path.lineTo(x + TILE / 2, y + TILE - 2);
  path.closePath();
  shine.moveTo(x + 14, y + 2);
  shine.lineTo(x + 22, y + 2);
  shine.lineTo(x + 16, y + 18);
  shine.closePath();
}

function drawCrumble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cracked: boolean,
  theme: Theme,
): void {
  drawBlock(ctx, x, y, false, theme);
  // A chip in the corner, so a crumble is visible before it has started to crack.
  ctx.beginPath();
  ctx.moveTo(x + TILE - 11, y + 4);
  ctx.lineTo(x + TILE - 4, y + 4);
  ctx.lineTo(x + TILE - 4, y + 11);
  ctx.strokeStyle = theme.spikeEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  if (!cracked) return;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 12);
  ctx.lineTo(x + 18, y + 22);
  ctx.lineTo(x + 14, y + 30);
  ctx.moveTo(x + 30, y + 10);
  ctx.lineTo(x + 22, y + 24);
  ctx.strokeStyle = theme.spikeEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, theme: Theme): void {
  drawBlock(ctx, x, y, false, theme);
  // A pale bar, so a moving platform does not look like ordinary ground.
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(x + 7, y + 7, TILE - 14, 4);
}

function drawFog(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { viewW, viewH } = state;
  ctx.save();
  const drift = state.reducedMotion ? 30 : (state.time * 22) % (viewW + 280);
  for (let i = 0; i < 3; i++) {
    const x = -160 + ((drift + i * viewW * 0.42) % (viewW + 320));
    const y = viewH * (0.2 + i * 0.28);
    ctx.fillStyle = `rgba(214, 206, 232, ${0.055 + i * 0.02})`;
    ctx.beginPath();
    ctx.ellipse(x, y, viewW * 0.46, 52, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCheckpoint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  active: boolean,
  fill?: string,
): void {
  ctx.fillStyle = "#eaf6ff";
  ctx.fillRect(x + 10, y + 8, 3, TILE - 12);
  ctx.fillStyle = fill ?? (active ? "#ff9fbf" : "#6fd6ff");
  ctx.beginPath();
  ctx.moveTo(x + 13, y + 8);
  ctx.lineTo(x + 30, y + 15);
  ctx.lineTo(x + 13, y + 22);
  ctx.fill();
}

/** Green flags for checkpoints the player dropped with Z. The newest one is brighter. */
function drawPracticeFlags(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (!state.practice) return;
  const last = state.practicePoints.length - 1;
  for (let i = 0; i <= last; i++) {
    const point = state.practicePoints[i];
    const x = point.x - (TILE - state.player.w) / 2;
    const y = point.y - (TILE - state.player.h);
    drawCheckpoint(ctx, x, y, true, i === last ? "#7dff6a" : "#2f8f4e");
  }
}

function drawInfo(ctx: CanvasRenderingContext2D, x: number, y: number, collected: boolean): void {
  ctx.save();
  ctx.globalAlpha = collected ? 0.4 : 1;
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 8, TILE - 16, TILE - 16, 4);
  ctx.fillStyle = "#6fd6ff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#070a2b";
  ctx.font = "700 18px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("i", x + TILE / 2, y + TILE / 2 + 1);
  ctx.restore();
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, state: GameState): void {
  const bob = state.reducedMotion ? 0 : Math.sin(state.time * 6) * 2;
  const cx = x + TILE / 2;
  const cy = y + TILE / 2 + bob;
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#000000";
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#ff9fbf";
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#6fd6ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLasers(ctx: CanvasRenderingContext2D, state: GameState): void {
  const on = laserActive(state.laserClock);
  ctx.save();
  ctx.lineCap = "round";
  for (const beam of state.level.lasers) {
    const vertical = beam.axis === "y";
    const x0 = vertical ? beam.c * TILE + TILE / 2 : beam.c * TILE;
    const y0 = vertical ? beam.r * TILE : beam.r * TILE + TILE / 2;
    const x1 = vertical ? x0 : x0 + beam.length * TILE;
    const y1 = vertical ? y0 + beam.length * TILE : y0;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    if (on) {
      ctx.strokeStyle = "rgba(255, 79, 216, 0.55)";
      ctx.lineWidth = 16;
      ctx.stroke();
      ctx.strokeStyle = "#eaf8ff";
      ctx.lineWidth = 4;
      ctx.stroke();
    } else {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = "#6fd6ff";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]);
      if (!state.reducedMotion) ctx.lineDashOffset = -((state.time * 24) % 12);
      ctx.stroke();
      ctx.restore();
    }

    drawEmitter(ctx, x0, y0, on);
    drawEmitter(ctx, x1, y1, on);
  }
  ctx.restore();
}

function drawEmitter(ctx: CanvasRenderingContext2D, x: number, y: number, on: boolean): void {
  ctx.save();
  ctx.fillStyle = on ? "#ff4fd8" : "rgba(111, 214, 255, 0.7)";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x - 5, y - 5, 10, 10);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPad(ctx: CanvasRenderingContext2D, x: number, y: number, state: GameState): void {
  const bob = state.reducedMotion ? 0 : Math.sin(state.time * 6) * 2;
  ctx.save();
  ctx.translate(x + TILE / 2, y + TILE - 12 + bob);
  ctx.fillStyle = "#ff9fbf";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(11, 5);
  ctx.lineTo(-11, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPortal(ctx: CanvasRenderingContext2D, x: number, y: number, state: GameState): void {
  const spin = state.reducedMotion ? 0.4 : state.time * 1.6;
  ctx.save();
  ctx.translate(x + TILE / 2, y + TILE / 2);
  ctx.lineWidth = 3;
  ctx.rotate(spin);
  ctx.strokeStyle = "#6fd6ff";
  ctx.strokeRect(-11, -11, 22, 22);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = "#ff9fbf";
  ctx.strokeRect(-8, -8, 16, 16);
  ctx.restore();
}

function drawIcicle(ctx: CanvasRenderingContext2D, x: number, y: number, theme: Theme): void {
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 2);
  ctx.lineTo(x + TILE - 8, y + 2);
  ctx.lineTo(x + TILE / 2, y + TILE - 2);
  ctx.closePath();
  ctx.fillStyle = theme.spike;
  ctx.strokeStyle = theme.spikeEdge;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 14, y + 2);
  ctx.lineTo(x + 22, y + 2);
  ctx.lineTo(x + 16, y + 18);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.fill();
}

function drawSpike(ctx: CanvasRenderingContext2D, x: number, y: number, dir: SpikeDir, theme: Theme): void {
  const left = x + 2;
  const right = x + TILE - 2;
  const top = y + 2;
  const bottom = y + TILE - 2;
  const midX = x + TILE / 2;
  const midY = y + TILE / 2;
  ctx.beginPath();
  if (dir === "up") {
    ctx.moveTo(left, bottom);
    ctx.lineTo(midX, top);
    ctx.lineTo(right, bottom);
  } else if (dir === "down") {
    ctx.moveTo(left, top);
    ctx.lineTo(midX, bottom);
    ctx.lineTo(right, top);
  } else if (dir === "left") {
    ctx.moveTo(right, top);
    ctx.lineTo(left, midY);
    ctx.lineTo(right, bottom);
  } else {
    ctx.moveTo(left, top);
    ctx.lineTo(right, midY);
    ctx.lineTo(left, bottom);
  }
  ctx.closePath();
  ctx.fillStyle = theme.spike;
  ctx.strokeStyle = theme.spikeEdge;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  }
}

function drawAttempt(ctx: CanvasRenderingContext2D, state: GameState): void {
  const label = `Attempt ${state.attempts}`;
  const spawn = spawnAt(state);
  const x = spawn.x + state.player.w / 2;
  const y = spawn.y - 16;
  ctx.font = "20px 'Lilita One', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#ffffff";
  ctx.strokeText(label, x, y);
  ctx.fillText(label, x, y);
  ctx.textBaseline = "alphabetic";
}

function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const barX = 16;
  const barY = 14;
  // Leave the top-right clear for the volume slider, Mute, Skip, and Pause.
  // Narrow screens stack them, so they need less horizontal room.
  const reserve = state.viewW < 900 ? 150 : 520;
  const barW = Math.max(48, state.viewW - reserve);
  const progress = (state.player.x + state.player.w / 2) / (state.level.width * TILE);

  ctx.fillStyle = "rgba(234, 246, 255, 0.16)";
  ctx.fillRect(barX, barY, barW, 10);
  ctx.fillStyle = "#6fd6ff";
  ctx.fillRect(barX, barY, barW * Math.min(1, Math.max(0, progress)), 10);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, 10);

  ctx.font = "26px 'Lilita One', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#e6f6ff";
  ctx.strokeText(state.level.title, 16, 32);
  ctx.fillText(state.level.title, 16, 32);
  ctx.textBaseline = "alphabetic";
}

function drawPaused(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "rgba(7, 10, 43, 0.55)";
  ctx.fillRect(0, 0, state.viewW, state.viewH);
  const mid = state.viewH / 2;
  const compact = state.viewH < 460;
  drawFace(ctx, state.difficulty, state.viewW / 2, mid - (compact ? 72 : 108), compact ? 28 : 40);

  ctx.font = "64px 'Lilita One', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#e6f6ff";
  ctx.strokeText("Paused", state.viewW / 2, mid);
  ctx.fillText("Paused", state.viewW / 2, mid);
  ctx.font = "28px 'Lilita One', system-ui, sans-serif";
  ctx.lineWidth = 4;
  ctx.fillStyle = "#6fd6ff";
  const label = difficultyLabel(state.difficulty);
  ctx.strokeText(label, state.viewW / 2, mid + 44);
  ctx.fillText(label, state.viewW / 2, mid + 44);
  ctx.font = "20px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#9fb3d9";
  ctx.fillText("Esc to resume", state.viewW / 2, mid + 78);
  ctx.textBaseline = "alphabetic";
}

function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string): void {
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = fill;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function isActiveCheckpoint(state: GameState, c: number, r: number): boolean {
  const spawn = spawnAt(state);
  const x = c * TILE + (TILE - state.player.w) / 2;
  const y = r * TILE + (TILE - state.player.h);
  return Math.abs(spawn.x - x) < 1 && Math.abs(spawn.y - y) < 1;
}
