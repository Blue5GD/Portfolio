import { spikeDir, standIn, tileAt, tileKey } from "./level";
import { burst, updateParticles } from "./particles";
import { HIT, TILE, type GameState, type Input, type Level, type Player } from "./types";

// Starting numbers from the build plan. Units are pixels, seconds,
// and pixels per second. A full held jump rises about 3.5 tiles.
// Letting go immediately cuts it to a short hop of under one tile.
export const PHYSICS = {
  runSpeed: 330,
  groundAccel: 3000,
  airAccel: 2000,
  friction: 5000,
  iceScale: 0.15,
  gravity: 2600,
  jumpVelocity: -860,
  maxFall: 1400,
  shortHop: 0.45,
  coyote: 0.08,
  jumpBuffer: 0.1,
  rotateSpeed: 400,
  padVelocity: -1250,
  respawnDelay: 0.4,
  spikeScale: 0.4,
};

export function createGame(level: Level, reducedMotion: boolean): GameState {
  const state: GameState = {
    level,
    player: blankPlayer(),
    phase: "play",
    pauseReason: null,
    checkpoint: { ...level.start },
    attempts: 1,
    camera: { x: 0, y: 0 },
    cameraReady: false,
    shake: 0,
    time: 0,
    deadTimer: 0,
    particles: [],
    collected: new Set(),
    padLock: false,
    reducedMotion,
    viewW: 800,
    viewH: 450,
    dpr: 1,
    difficulty: "normal",
    onInfo: () => {},
    onWin: () => {},
    onAttempt: () => {},
  };
  respawn(state, false);
  return state;
}

/** Put the cube back on the current checkpoint. Passing true uses up an attempt. */
export function respawn(state: GameState, countAttempt: boolean): void {
  if (countAttempt) {
    state.attempts += 1;
    state.onAttempt();
  }
  const p = state.player;
  p.x = state.checkpoint.x;
  p.y = state.checkpoint.y;
  p.vx = 0;
  p.vy = 0;
  p.rot = 0;
  p.facing = 1;
  p.grounded = true;
  p.onIce = false;
  p.coyote = PHYSICS.coyote;
  p.jumpBuffer = 0;
  p.cutJump = false;
  state.phase = "play";
  state.pauseReason = null;
  state.padLock = false;
}

/** Back to the start of the course, including attempts and collected blocks. */
export function resetRun(state: GameState): void {
  state.attempts = 1;
  state.checkpoint = { ...state.level.start };
  state.collected.clear();
  state.particles.length = 0;
  state.shake = 0;
  state.cameraReady = false;
  respawn(state, false);
}

export function step(state: GameState, input: Input, dt: number): void {
  if (input.restart && !(state.phase === "paused" && state.pauseReason === "dialog") && state.phase !== "won") {
    input.restart = false;
    respawn(state, true);
  } else {
    input.restart = false;
  }

  if (input.pausePressed) {
    input.pausePressed = false;
    if (state.phase === "play") {
      state.phase = "paused";
      state.pauseReason = "menu";
    } else if (state.phase === "paused" && state.pauseReason === "menu") {
      state.phase = "play";
      state.pauseReason = null;
    }
  }

  if (state.phase === "paused") {
    input.jumpPressed = false;
    return;
  }

  state.time += dt;
  state.shake = state.shake < 0.05 ? 0 : state.shake * Math.exp(-12 * dt);
  updateParticles(state.particles, dt);

  if (state.phase === "dead") {
    input.jumpPressed = false;
    state.deadTimer -= dt;
    if (state.deadTimer <= 0) respawn(state, true);
    updateCamera(state, dt);
    return;
  }
  if (state.phase === "won") {
    input.jumpPressed = false;
    updateCamera(state, dt);
    return;
  }

  const p = state.player;
  const wasGrounded = p.grounded;

  // Coyote time: you can still jump for a few frames after leaving the ground.
  // Jump buffer: a press that landed a little early still counts when you touch down.
  if (wasGrounded) p.coyote = PHYSICS.coyote;
  else p.coyote = Math.max(0, p.coyote - dt);

  if (input.jumpPressed) {
    p.jumpBuffer = PHYSICS.jumpBuffer;
    input.jumpPressed = false;
  } else {
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  }

  const ice = wasGrounded && p.onIce;
  const accel = (wasGrounded ? PHYSICS.groundAccel : PHYSICS.airAccel) * (ice ? PHYSICS.iceScale : 1);
  const friction = PHYSICS.friction * (ice ? PHYSICS.iceScale : 1);
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  if (dir !== 0) p.vx = approach(p.vx, dir * PHYSICS.runSpeed, accel * dt);
  else if (wasGrounded) p.vx = approach(p.vx, 0, friction * dt);

  p.vy = Math.min(p.vy + PHYSICS.gravity * dt, PHYSICS.maxFall);

  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = PHYSICS.jumpVelocity;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.grounded = false;
    p.cutJump = false;
  }

  // Releasing jump early throws away most of the upward speed. Hold it for a full jump.
  if (!input.jumpHeld && p.vy < 0 && !p.cutJump) {
    p.vy *= PHYSICS.shortHop;
    p.cutJump = true;
  }

  moveX(state, dt);
  moveY(state, dt);

  if (Math.abs(p.vx) > 40) p.facing = p.vx > 0 ? 1 : -1;
  if (p.grounded) p.rot = snapRightAngle(p.rot);
  else p.rot += p.facing * ((PHYSICS.rotateSpeed * Math.PI) / 180) * dt;

  // The feet have to leave the map. Checking the top of the cube instead
  // lets you sink a full body-height into a pit before the attempt ends.
  const worldBottom = state.level.height * TILE;
  if (p.y + p.h > worldBottom || touchingSpike(state.level, p)) {
    die(state);
    updateCamera(state, dt);
    return;
  }

  touchMarkers(state);
  updateCamera(state, dt);
}

function blankPlayer(): Player {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    w: HIT,
    h: HIT,
    facing: 1,
    rot: 0,
    grounded: true,
    onIce: false,
    coyote: PHYSICS.coyote,
    jumpBuffer: 0,
    cutJump: false,
  };
}

function approach(value: number, target: number, delta: number): number {
  if (value < target) return Math.min(value + delta, target);
  return Math.max(value - delta, target);
}

function snapRightAngle(rad: number): number {
  const quarter = Math.PI / 2;
  const snapped = Math.round(rad / quarter) * quarter;
  const tau = Math.PI * 2;
  return ((snapped % tau) + tau) % tau;
}

interface Box {
  x: number;
  y: number;
  ch: string;
}

// Resolve X, then Y. Doing both at once makes the cube stick on corners.
function moveX(state: GameState, dt: number): void {
  const p = state.player;
  p.x += p.vx * dt;
  const hits = overlapping(state.level, p, "full");
  let hit = false;
  for (const tile of hits) {
    hit = true;
    if (p.vx > 0) p.x = Math.min(p.x, tile.x - p.w);
    else if (p.vx < 0) p.x = Math.max(p.x, tile.x + TILE);
    else pushOutX(p, tile.x);
  }
  if (hit) p.vx = 0;

  const maxX = state.level.width * TILE - p.w;
  if (p.x < 0) {
    p.x = 0;
    p.vx = 0;
  } else if (p.x > maxX) {
    p.x = maxX;
    p.vx = 0;
  }
}

function moveY(state: GameState, dt: number): void {
  const p = state.player;
  const prevBottom = p.y + p.h;
  p.y += p.vy * dt;
  p.grounded = false;

  const floors = overlapping(state.level, p, "full");
  let hit = false;
  for (const tile of floors) {
    hit = true;
    if (p.vy > 0) {
      p.y = Math.min(p.y, tile.y - p.h);
      p.grounded = true;
    } else if (p.vy < 0) {
      p.y = Math.max(p.y, tile.y + TILE);
    } else {
      p.y = tile.y - p.h;
      p.grounded = true;
    }
  }
  if (hit) p.vy = 0;

  // One-way tiles only catch you when you were above them and are moving down.
  // Jumping up passes straight through.
  if (p.vy >= 0) {
    for (const tile of overlapping(state.level, p, "oneway")) {
      if (prevBottom > tile.y + 1) continue;
      p.y = Math.min(p.y, tile.y - p.h);
      p.vy = 0;
      p.grounded = true;
    }
  }

  const under = tileAt(state.level, Math.floor((p.x + p.w / 2) / TILE), Math.floor((p.y + p.h + 0.05) / TILE));
  p.onIce = under === "~";
}

function pushOutX(p: Player, tileX: number): void {
  const intoLeft = p.x + p.w - tileX;
  const intoRight = tileX + TILE - p.x;
  if (intoLeft < intoRight) p.x -= intoLeft;
  else p.x += intoRight;
}

function overlapping(level: Level, p: Player, kind: "full" | "oneway"): Box[] {
  const c0 = Math.floor(p.x / TILE);
  const c1 = Math.floor((p.x + p.w - 0.001) / TILE);
  const r0 = Math.floor(p.y / TILE);
  const r1 = Math.floor((p.y + p.h - 0.001) / TILE);
  const hits: Box[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = tileAt(level, c, r);
      const solid = ch === "#" || ch === "~";
      if (kind === "full" && solid) hits.push({ x: c * TILE, y: r * TILE, ch });
      if (kind === "oneway" && ch === "=") hits.push({ x: c * TILE, y: r * TILE, ch });
    }
  }
  return hits;
}

function touchingSpike(level: Level, p: Player): boolean {
  const c0 = Math.floor(p.x / TILE);
  const c1 = Math.floor((p.x + p.w - 0.001) / TILE);
  const r0 = Math.floor(p.y / TILE);
  const r1 = Math.floor((p.y + p.h - 0.001) / TILE);
  const size = TILE * PHYSICS.spikeScale;
  const inset = (TILE - size) / 2;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!spikeDir(tileAt(level, c, r))) continue;
      const sx = c * TILE + inset;
      const sy = r * TILE + inset;
      if (p.x < sx + size && p.x + p.w > sx && p.y < sy + size && p.y + p.h > sy) return true;
    }
  }
  return false;
}

function touchMarkers(state: GameState): void {
  const p = state.player;
  const c0 = Math.floor(p.x / TILE);
  const c1 = Math.floor((p.x + p.w - 0.001) / TILE);
  const r0 = Math.floor(p.y / TILE);
  const r1 = Math.floor((p.y + p.h - 0.001) / TILE);

  let launched = false;
  let informed = false;

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = tileAt(state.level, c, r);
      if (ch === "C") state.checkpoint = standIn(c, r);
      if (ch === "J") {
        launched = true;
        if (!state.padLock) {
          p.vy = PHYSICS.padVelocity;
          p.grounded = false;
          // A pad launch is not a normal jump, so the short-hop cut must not shrink it.
          p.cutJump = true;
          state.padLock = true;
        }
      }
      if (ch === "I" && !informed) {
        const key = tileKey(c, r);
        if (!state.collected.has(key)) {
          state.collected.add(key);
          informed = true;
          const index = state.level.infoAt.get(key);
          if (index !== undefined) state.onInfo(index);
        }
      }
      if (ch === "O" && state.phase === "play") {
        state.phase = "won";
        burst(state.particles, p.x + p.w / 2, p.y + p.h / 2, state.reducedMotion, "win");
        state.onWin();
      }
    }
  }

  if (!launched) state.padLock = false;
}

function die(state: GameState): void {
  if (state.phase !== "play") return;
  const p = state.player;
  state.phase = "dead";
  state.deadTimer = PHYSICS.respawnDelay;
  state.shake = state.reducedMotion ? 0 : 6;
  burst(state.particles, p.x + p.w / 2, p.y + p.h / 2, state.reducedMotion, "death");
  p.vx = 0;
  p.vy = 0;
}

function updateCamera(state: GameState, dt: number): void {
  const p = state.player;
  const worldW = state.level.width * TILE;
  const worldH = state.level.height * TILE;
  // Sit the cube a bit left of center, and a bit below center, so more of
  // the upcoming ground is on screen. `facing` shifts that window when you turn around.
  const look = p.facing * state.viewW * 0.12;
  const targetX = clampAxis(p.x + p.w / 2 - state.viewW * 0.5 + look, worldW, state.viewW);
  const targetY = clampAxis(p.y + p.h / 2 - state.viewH * 0.62, worldH, state.viewH);

  if (!state.cameraReady) {
    state.camera.x = targetX;
    state.camera.y = targetY;
    state.cameraReady = true;
    return;
  }

  const t = 1 - Math.exp(-8 * dt);
  state.camera.x += (targetX - state.camera.x) * t;
  state.camera.y += (targetY - state.camera.y) * t;
}

function clampAxis(value: number, world: number, view: number): number {
  if (world <= view) return (world - view) / 2;
  return Math.min(Math.max(value, 0), world - view);
}
