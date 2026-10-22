import { spikeDir, standIn, tileAt, tileKey } from "./level";
import { addStreak, burst, ensureAsh, ensureMotes, ensureSnow, updateParticles } from "./particles";
import {
  HIT,
  TILE,
  type Crumble,
  type FallingSpike,
  type GameState,
  type Input,
  type Level,
  type Mover,
  type MoverDef,
  type Player,
} from "./types";

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
  // Between a normal jump (-860) and a pad (-1250). A full orb rises about 5.3 tiles.
  // Letting go of jump does not shrink it. The cube has to be touching the orb.
  orbVelocity: -1050,
  respawnDelay: 0.4,
  spikeScale: 0.4,
  // Shared by every beam. Off first, so a respawn starts safe. 0.7s is about 6 tiles of running.
  laserOff: 0.7,
  laserOn: 1.1,
  // The bright core. Narrower than a tile, so grazing the glow at the edge is not a hit.
  laserThick: 18,
  // A crumble cracks halfway, then stops being solid. Stepping off resets the timer.
  crumbleCrack: 0.2,
  crumbleBreak: 0.4,
  // A saw's hitbox is a centered square half a tile wide, smaller than the drawn blade.
  sawHit: 20,
  // The green warning starts this long before a laser turns on or a saw reaches the cube.
  warnAhead: 0.25,
};

export function createGame(level: Level, reducedMotion: boolean): GameState {
  const state: GameState = {
    level,
    player: blankPlayer(),
    phase: "play",
    pauseReason: null,
    checkpoint: { ...level.start },
    practice: false,
    practicePoints: [],
    attempts: 1,
    camera: { x: 0, y: 0 },
    cameraReady: false,
    shake: 0,
    time: 0,
    deadTimer: 0,
    particles: [],
    collected: new Set(),
    padLock: false,
    orbLock: false,
    laserClock: 0,
    fallingSpikes: [],
    crumbles: [],
    crumbleAt: new Map(),
    movers: [],
    reducedMotion,
    viewW: 800,
    viewH: 450,
    dpr: 1,
    difficulty: "normal",
    onInfo: () => {},
    onWin: () => {},
    onAttempt: () => {},
  };
  collectHazards(state);
  respawn(state, false);
  return state;
}

/** Where a death or an R restart puts the cube. Practice checkpoints win while that mode is on. */
export function spawnAt(state: GameState): { x: number; y: number } {
  if (state.practice && state.practicePoints.length > 0) {
    return state.practicePoints[state.practicePoints.length - 1];
  }
  return state.checkpoint;
}

/** Put the cube back on the current checkpoint. Passing true uses up an attempt. */
export function respawn(state: GameState, countAttempt: boolean): void {
  if (countAttempt) {
    state.attempts += 1;
    state.onAttempt();
  }
  const p = state.player;
  const spawn = spawnAt(state);
  p.x = spawn.x;
  p.y = spawn.y;
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
  state.orbLock = false;
  state.laserClock = 0;
  resetHazards(state);
}

/** Back to the start of the course, including attempts and collected blocks. */
export function resetRun(state: GameState): void {
  state.attempts = 1;
  state.checkpoint = { ...state.level.start };
  state.practicePoints.length = 0;
  state.collected.clear();
  state.particles.length = 0;
  state.shake = 0;
  state.cameraReady = false;
  respawn(state, false);
}

export function step(state: GameState, input: Input, dt: number): void {
  // A dialog or a too-small window ignores R, so that key can't cancel the pause.
  const blockRestart =
    state.phase === "won" ||
    (state.phase === "paused" && (state.pauseReason === "dialog" || state.pauseReason === "layout"));
  if (input.restart && !blockRestart) {
    input.restart = false;
    respawn(state, true);
  } else {
    input.restart = false;
  }

  if (input.pausePressed) {
    input.pausePressed = false;
    // Esc only toggles a menu pause. It can't cancel a dialog or a too-small window.
    if (state.phase === "play") {
      state.phase = "paused";
      state.pauseReason = "menu";
    } else if (state.phase === "paused" && state.pauseReason === "menu") {
      state.phase = "play";
      state.pauseReason = null;
    }
  }

  // Z and X are edges, like jump. Always clear them, or a press during a
  // dialog would place a checkpoint the moment the dialog closes.
  if (input.placeCheckpoint) {
    input.placeCheckpoint = false;
    if (state.practice && state.phase === "play") {
      state.practicePoints.push({ x: state.player.x, y: state.player.y });
    }
  }
  if (input.removeCheckpoint) {
    input.removeCheckpoint = false;
    if (state.practice && state.phase === "play") state.practicePoints.pop();
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
    finishFrame(state, dt);
    return;
  }
  if (state.phase === "won") {
    input.jumpPressed = false;
    finishFrame(state, dt);
    return;
  }

  const p = state.player;
  const wasGrounded = p.grounded;
  // Captured before the buffer code clears it. An orb uses this edge, not "jump is held".
  const jumpEdge = input.jumpPressed;

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

  // Platforms move first. If the cube was standing on one, it is carried
  // along before its own step, so it does not slip off.
  updateMovers(state, dt);
  carryMovers(state, wasGrounded);

  // Advance before the hit test, so the beam the cube touches is the one it sees.
  state.laserClock += dt;

  moveX(state, dt);
  moveY(state, dt);
  updateCrumbles(state, dt);
  updateSpikes(state, dt);

  if (Math.abs(p.vx) > 40) p.facing = p.vx > 0 ? 1 : -1;
  if (p.grounded) p.rot = snapRightAngle(p.rot);
  else p.rot += p.facing * ((PHYSICS.rotateSpeed * Math.PI) / 180) * dt;

  // The feet have to leave the map. Checking the top of the cube instead
  // lets you sink a full body-height into a pit before the attempt ends.
  const worldBottom = state.level.height * TILE;
  if (
    p.y + p.h > worldBottom ||
    touchingSpike(state.level, p) ||
    touchingFallingSpike(state) ||
    touchingLaser(state) ||
    touchingSaw(state)
  ) {
    die(state);
    finishFrame(state, dt);
    return;
  }

  touchMarkers(state, jumpEdge);
  finishFrame(state, dt);
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
  const hits = [...overlapping(state, p, "full"), ...overlappingPlatforms(state, p)];
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

  const floors = [...overlapping(state, p, "full"), ...overlappingPlatforms(state, p)];
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
    for (const tile of overlapping(state, p, "oneway")) {
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

function overlapping(state: GameState, p: Player, kind: "full" | "oneway"): Box[] {
  const level = state.level;
  const c0 = Math.floor(p.x / TILE);
  const c1 = Math.floor((p.x + p.w - 0.001) / TILE);
  const r0 = Math.floor(p.y / TILE);
  const r1 = Math.floor((p.y + p.h - 0.001) / TILE);
  const hits: Box[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = tileAt(level, c, r);
      if (kind === "full" && isSolid(state, c, r, ch)) hits.push({ x: c * TILE, y: r * TILE, ch });
      if (kind === "oneway" && ch === "=") hits.push({ x: c * TILE, y: r * TILE, ch });
    }
  }
  return hits;
}

function overlappingPlatforms(state: GameState, p: Player): Box[] {
  const hits: Box[] = [];
  const right = p.x + p.w;
  const bottom = p.y + p.h;
  for (const mover of state.movers) {
    if (mover.kind !== "platform") continue;
    // Standing exactly on the top is not an overlap. Gravity sinks the cube
    // a fraction of a pixel, and that is what counts as a landing.
    if (right <= mover.x + 0.001 || p.x >= mover.x + TILE - 0.001) continue;
    if (bottom <= mover.y + 0.001 || p.y >= mover.y + TILE - 0.001) continue;
    hits.push({ x: mover.x, y: mover.y, ch: "#" });
  }
  return hits;
}

function makeMover(def: MoverDef): Mover {
  const x = def.c * TILE;
  const y = def.r * TILE;
  return {
    kind: def.kind,
    axis: def.axis,
    originX: x,
    originY: y,
    distance: def.tiles * TILE,
    period: def.seconds,
    clock: 0,
    x,
    y,
    prevX: x,
    prevY: y,
  };
}

// 0 at the start, 1 at the far end, 0 again when the round trip finishes.
function shuttle(clock: number, period: number): number {
  const t = (clock % period) / period;
  if (t < 0.5) return t * 2;
  return 2 - t * 2;
}

/** Top-left of a mover's tile at any point on its clock. */
function moverAt(mover: Mover, clock: number): { x: number; y: number } {
  const off = shuttle(clock, mover.period) * mover.distance;
  if (mover.axis === "x") return { x: mover.originX + off, y: mover.originY };
  return { x: mover.originX, y: mover.originY + off };
}

function updateMovers(state: GameState, dt: number): void {
  for (const mover of state.movers) {
    mover.prevX = mover.x;
    mover.prevY = mover.y;
    mover.clock += dt;
    const at = moverAt(mover, mover.clock);
    mover.x = at.x;
    mover.y = at.y;
  }
}

function sawTouches(p: Player, x: number, y: number, grow: number): boolean {
  const size = PHYSICS.sawHit + grow * 2;
  const sx = x + (TILE - size) / 2;
  const sy = y + (TILE - size) / 2;
  return p.x < sx + size && p.x + p.w > sx && p.y < sy + size && p.y + p.h > sy;
}

function touchingSaw(state: GameState): boolean {
  for (const mover of state.movers) {
    if (mover.kind === "saw" && sawTouches(state.player, mover.x, mover.y, 0)) return true;
  }
  return false;
}

/**
 * True for the quarter second before a laser near the cube turns on, or before
 * a saw reaches the cube where it stands. The Final Battle flashes green for it.
 * `reach` is how far from the cube (in pixels) a beam still counts as near.
 */
export function warningActive(state: GameState, reach: number): boolean {
  if (state.phase !== "play") return false;
  const p = state.player;
  const ahead = PHYSICS.warnAhead;

  const period = PHYSICS.laserOff + PHYSICS.laserOn;
  const phase = state.laserClock % period;
  if (phase < PHYSICS.laserOff && phase >= PHYSICS.laserOff - ahead) {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    for (const beam of state.level.lasers) {
      const x0 = beam.c * TILE;
      const y0 = beam.r * TILE;
      const x1 = x0 + (beam.axis === "x" ? beam.length : 1) * TILE;
      const y1 = y0 + (beam.axis === "y" ? beam.length : 1) * TILE;
      const dx = Math.max(x0 - cx, 0, cx - x1);
      const dy = Math.max(y0 - cy, 0, cy - y1);
      if (dx * dx + dy * dy <= reach * reach) return true;
    }
  }

  for (const mover of state.movers) {
    if (mover.kind !== "saw") continue;
    // Not already touching. Touching within the next quarter second, with some room to spare.
    for (let t = ahead / 4; t <= ahead + 0.001; t += ahead / 4) {
      const at = moverAt(mover, mover.clock + t);
      if (sawTouches(p, at.x, at.y, 8)) return true;
    }
  }
  return false;
}

// Carry only when the cube's center is on the platform. Touching the side
// while you are still standing on normal ground does not drag you off.
function carryMovers(state: GameState, wasGrounded: boolean): void {
  if (!wasGrounded) return;
  const p = state.player;
  const mid = p.x + p.w / 2;
  const feet = p.y + p.h;
  for (const mover of state.movers) {
    if (mover.kind !== "platform") continue;
    if (Math.abs(feet - mover.prevY) > 2) continue;
    if (mid < mover.prevX || mid > mover.prevX + TILE) continue;
    p.x += mover.x - mover.prevX;
    // A jump already left the platform. Keep the sideways carry, not the vertical one.
    if (p.grounded) p.y += mover.y - mover.prevY;
    return;
  }
}

/** `#` and ice are always solid. A crumble is solid only while it is still firm. */
function isSolid(state: GameState, c: number, r: number, ch: string): boolean {
  if (ch === "#" || ch === "~") return true;
  if (ch !== "x") return false;
  const block = state.crumbleAt.get(tileKey(c, r));
  return block !== undefined && block.phase === "firm";
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

function touchMarkers(state: GameState, jumpEdge: boolean): void {
  const p = state.player;
  const c0 = Math.floor(p.x / TILE);
  const c1 = Math.floor((p.x + p.w - 0.001) / TILE);
  const r0 = Math.floor(p.y / TILE);
  const r1 = Math.floor((p.y + p.h - 0.001) / TILE);

  let launched = false;
  let inOrb = false;
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
      // The ring does nothing unless jump was pressed while overlapping it.
      // `jumpEdge` is this frame's press. The buffer also counts a press that
      // landed a few frames early. Leaving the ring clears the lock.
      if (ch === "o") {
        inOrb = true;
        if (!state.orbLock && (jumpEdge || p.jumpBuffer > 0)) {
          p.vy = PHYSICS.orbVelocity;
          p.grounded = false;
          p.cutJump = true;
          p.jumpBuffer = 0;
          p.coyote = 0;
          state.orbLock = true;
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
        burst(state.particles, p.x + p.w / 2, p.y + p.h / 2, state.reducedMotion, state.level.finale ? "finale" : "win");
        state.onWin();
      }
    }
  }

  if (!launched) state.padLock = false;
  if (!inOrb) state.orbLock = false;
}

/** True while the shared clock is in the on half. Respawn sets the clock back to 0 (off). */
export function laserActive(clock: number): boolean {
  const period = PHYSICS.laserOff + PHYSICS.laserOn;
  return clock % period >= PHYSICS.laserOff;
}

function touchingLaser(state: GameState): boolean {
  if (!laserActive(state.laserClock)) return false;
  const p = state.player;
  const thick = PHYSICS.laserThick;
  for (const beam of state.level.lasers) {
    const vertical = beam.axis === "y";
    const x = vertical ? beam.c * TILE + (TILE - thick) / 2 : beam.c * TILE;
    const y = vertical ? beam.r * TILE : beam.r * TILE + (TILE - thick) / 2;
    const w = vertical ? thick : beam.length * TILE;
    const h = vertical ? beam.length * TILE : thick;
    if (p.x < x + w && p.x + p.w > x && p.y < y + h && p.y + p.h > y) return true;
  }
  return false;
}

function collectHazards(state: GameState): void {
  const spikes: FallingSpike[] = [];
  const crumbles: Crumble[] = [];
  const crumbleAt = new Map<string, Crumble>();
  const { rows, width, height } = state.level;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const ch = rows[r][c];
      if (ch === "!") spikes.push({ c, r, y: r * TILE, vy: 0, phase: "wait" });
      if (ch === "x") {
        const block: Crumble = { c, r, y: r * TILE, vy: 0, stood: 0, phase: "firm" };
        crumbles.push(block);
        crumbleAt.set(tileKey(c, r), block);
      }
    }
  }
  state.fallingSpikes = spikes;
  state.crumbles = crumbles;
  state.crumbleAt = crumbleAt;
  state.movers = state.level.movers.map(makeMover);
}

function resetHazards(state: GameState): void {
  for (const spike of state.fallingSpikes) {
    spike.y = spike.r * TILE;
    spike.vy = 0;
    spike.phase = "wait";
  }
  for (const block of state.crumbles) {
    block.y = block.r * TILE;
    block.vy = 0;
    block.stood = 0;
    block.phase = "firm";
  }
  for (const mover of state.movers) {
    mover.clock = 0;
    mover.x = mover.originX;
    mover.y = mover.originY;
    mover.prevX = mover.x;
    mover.prevY = mover.y;
  }
}

// The timer counts only while the cube is standing on that tile.
// Leaving the tile puts it back, so a short step does not add up.
function updateCrumbles(state: GameState, dt: number): void {
  const p = state.player;
  let footC = -1;
  let footR = -1;
  if (p.grounded) {
    footC = Math.floor((p.x + p.w / 2) / TILE);
    footR = Math.floor((p.y + p.h + 0.05) / TILE);
  }

  for (const block of state.crumbles) {
    if (block.phase === "gone") continue;
    if (block.phase === "fall") {
      block.vy = Math.min(block.vy + PHYSICS.gravity * dt, PHYSICS.maxFall);
      block.y += block.vy * dt;
      if (block.y > state.level.height * TILE) block.phase = "gone";
      continue;
    }
    if (footC === block.c && footR === block.r) {
      block.stood += dt;
      if (block.stood >= PHYSICS.crumbleBreak) {
        block.phase = "fall";
        block.vy = 0;
      }
    } else {
      block.stood = 0;
    }
  }
}

// A falling spike lets go when the cube's hitbox overlaps its column.
// It uses the same gravity as the cube, then stays where it lands.
function updateSpikes(state: GameState, dt: number): void {
  const p = state.player;
  for (const spike of state.fallingSpikes) {
    if (spike.phase === "wait") {
      const left = spike.c * TILE;
      if (p.x < left + TILE && p.x + p.w > left) {
        spike.phase = "fall";
        spike.vy = 0;
      }
    }
    if (spike.phase !== "fall") continue;

    spike.vy = Math.min(spike.vy + PHYSICS.gravity * dt, PHYSICS.maxFall);
    const oldBottom = spike.y + TILE;
    const nextY = spike.y + spike.vy * dt;
    const newBottom = nextY + TILE;
    const landed = landingTop(state, spike.c, oldBottom, newBottom);
    if (landed !== null) {
      spike.y = landed - TILE;
      spike.vy = 0;
      spike.phase = "rest";
      continue;
    }
    spike.y = nextY;
    if (spike.y > state.level.height * TILE) {
      spike.vy = 0;
      spike.phase = "rest";
    }
  }
}

/** Top of the first solid cell the spike's bottom crosses, or null. */
function landingTop(state: GameState, c: number, oldBottom: number, newBottom: number): number | null {
  const r0 = Math.floor(oldBottom / TILE);
  const r1 = Math.floor((newBottom - 0.001) / TILE);
  for (let r = r0; r <= r1; r++) {
    const ch = tileAt(state.level, c, r);
    const solid = ch === "#" || ch === "~" || ch === "=" || isSolid(state, c, r, ch);
    if (!solid) continue;
    const top = r * TILE;
    if (oldBottom <= top + 0.01 && newBottom >= top) return top;
  }
  return null;
}

function touchingFallingSpike(state: GameState): boolean {
  const p = state.player;
  const size = TILE * PHYSICS.spikeScale;
  const inset = (TILE - size) / 2;
  for (const spike of state.fallingSpikes) {
    if (spike.y > state.level.height * TILE) continue;
    const sx = spike.c * TILE + inset;
    const sy = spike.y + inset;
    if (p.x < sx + size && p.x + p.w > sx && p.y < sy + size && p.y + p.h > sy) return true;
  }
  return false;
}

function finishFrame(state: GameState, dt: number): void {
  updateCamera(state, dt);
  const field = {
    x: state.camera.x,
    y: state.camera.y,
    w: state.viewW,
    h: state.viewH,
    reduced: state.reducedMotion,
  };
  if (state.level.theme === "ice") ensureSnow(state.particles, field.x, field.y, field.w, field.h, field.reduced);
  if (state.level.theme === "mist") ensureMotes(state.particles, field.x, field.y, field.w, field.h, field.reduced);
  if (state.level.theme === "dusk") ensureAsh(state.particles, field.x, field.y, field.w, field.h, field.reduced);
  // Squares left behind the cube while it is moving fast. Neon levels only.
  if (state.level.theme === "neon" && state.phase === "play" && !state.reducedMotion) {
    const p = state.player;
    addStreak(state.particles, p.x + p.w / 2, p.y + p.h / 2, p.vx, p.vy);
  }
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
