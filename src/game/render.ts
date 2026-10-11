import { drawCube } from "./drawCube";
import { difficultyLabel, drawFace } from "./faces";
import { spikeDir, tileAt, type SpikeDir } from "./level";
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

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { viewW, viewH, dpr } = state;
  if (viewW < 2 || viewH < 2) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, viewW, viewH);

  const sky = ctx.createLinearGradient(0, 0, viewW, viewH);
  sky.addColorStop(0, "#070a2b");
  sky.addColorStop(0.55, "#141a5c");
  sky.addColorStop(1, "#3b2394");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, viewH);

  const shake = state.reducedMotion ? 0 : state.shake;
  const sx = Math.sin(state.time * 55) * shake;
  const sy = Math.cos(state.time * 47) * shake;

  ctx.save();
  ctx.translate(-state.camera.x * 0.3 + sx * 0.4, -state.camera.y * 0.15);
  ctx.fillStyle = "rgba(111, 214, 255, 0.07)";
  for (const shard of SHARDS) {
    ctx.beginPath();
    ctx.moveTo(shard.x, shard.y);
    ctx.lineTo(shard.x + shard.w * 0.15, shard.y + shard.w);
    ctx.lineTo(shard.x - shard.w * 0.7, shard.y + shard.w * 0.85);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(sx - state.camera.x, sy - state.camera.y);
  drawWorld(ctx, state);
  drawParticles(ctx, state);
  if (state.phase !== "dead") {
    const p = state.player;
    // Drawn a little bigger than the 36px hitbox so the face reads on screen.
    drawCube(ctx, p.x + p.w / 2, p.y + p.h / 2, 40, p.rot);
  }
  drawAttempt(ctx, state);
  ctx.restore();

  drawHud(ctx, state);
  if (state.phase === "paused" && state.pauseReason === "menu") drawPaused(ctx, state);
}

function drawWorld(ctx: CanvasRenderingContext2D, state: GameState): void {
  const level = state.level;
  const cam = state.camera;
  // Paint pits and the area under the ground a solid dark color. Block tiles
  // are drawn on top, so only empty ground cells stay dark.
  ctx.fillStyle = "#05071c";
  ctx.fillRect(0, (level.height - 1) * TILE, level.width * TILE, TILE + 600);

  const c0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const c1 = Math.min(level.width - 1, Math.ceil((cam.x + state.viewW) / TILE) + 1);
  const r0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
  const r1 = Math.min(level.height - 1, Math.ceil((cam.y + state.viewH) / TILE) + 1);

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = tileAt(level, c, r);
      const x = c * TILE;
      const y = r * TILE;
      if (ch === "#" || ch === "~") drawBlock(ctx, x, y, ch === "~");
      else if (ch === "=") drawOneWay(ctx, x, y);
      else if (ch === "C") drawCheckpoint(ctx, x, y, isActiveCheckpoint(state, c, r));
      else if (ch === "I") drawInfo(ctx, x, y, state.collected.has(`${c},${r}`));
      else if (ch === "J") drawPad(ctx, x, y, state);
      else if (ch === "O") drawPortal(ctx, x, y, state);
      else {
        const dir = spikeDir(ch);
        if (dir) drawSpike(ctx, x, y, dir);
      }
    }
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.font = "15px Inter, system-ui, sans-serif";
  for (const sign of level.signs) {
    const x = sign.c * TILE + TILE / 2;
    const y = sign.r * TILE;
    outlined(ctx, sign.text, x, y, "#eaf6ff");
  }
  ctx.textBaseline = "alphabetic";
}

function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, ice: boolean): void {
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 1, TILE - 2, TILE - 2, 3);
  ctx.fillStyle = ice ? "#d7f3ff" : "#12184a";
  ctx.strokeStyle = ice ? "#ffffff" : "#6fd6ff";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  if (ice) {
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 11);
    ctx.lineTo(x + 20, y + 11);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.stroke();
  }
}

function drawOneWay(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#6fd6ff";
  ctx.fillRect(x + 2, y, TILE - 4, 8);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 2, y, TILE - 4, 8);
}

function drawCheckpoint(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean): void {
  ctx.fillStyle = "#eaf6ff";
  ctx.fillRect(x + 10, y + 8, 3, TILE - 12);
  ctx.fillStyle = active ? "#ff9fbf" : "#6fd6ff";
  ctx.beginPath();
  ctx.moveTo(x + 13, y + 8);
  ctx.lineTo(x + 30, y + 15);
  ctx.lineTo(x + 13, y + 22);
  ctx.fill();
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

function drawSpike(ctx: CanvasRenderingContext2D, x: number, y: number, dir: SpikeDir): void {
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
  ctx.fillStyle = "#0b0d26";
  ctx.strokeStyle = "#8f6bff";
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
  const x = state.checkpoint.x + state.player.w / 2;
  const y = state.checkpoint.y - 16;
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
  const reserve = state.viewW < 900 ? 150 : 410;
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
  const x = c * TILE + (TILE - state.player.w) / 2;
  const y = r * TILE + (TILE - state.player.h);
  return Math.abs(state.checkpoint.x - x) < 1 && Math.abs(state.checkpoint.y - y) < 1;
}
