import type { Particle } from "./types";

const COLORS = ["#ffffff", "#75bcff", "#6fd6ff", "#3a5976", "#ff9fbf"];

/** Squares that fly out when the cube crashes, or when it clears the course. */
export function burst(
  particles: Particle[],
  x: number,
  y: number,
  reduced: boolean,
  style: "death" | "win",
): void {
  const count = reduced ? 8 : style === "win" ? 28 : 18;
  const life = style === "win" ? 0.8 : 0.5;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = reduced ? 40 : 80 + Math.random() * (style === "win" ? 260 : 200);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (style === "win" ? 180 : 80),
      size: 4 + Math.random() * 6,
      life,
      max: life,
      rot: Math.random() * Math.PI,
      vr: reduced ? 0 : (Math.random() - 0.5) * 10,
      color: COLORS[i % COLORS.length],
      mode: "burst",
      drift: 0,
    });
  }
}

const SNOW = ["#ffffff", "#eef8ff", "#d5f0ff"];

/** Keep a field of slow flakes over the camera. Extra flakes are not added. */
export function ensureSnow(
  particles: Particle[],
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
  reduced: boolean,
): void {
  const cap = reduced ? 12 : 36;
  let count = 0;
  for (const p of particles) if (p.mode === "snow") count += 1;

  while (count < cap) {
    particles.push({
      x: camX + Math.random() * viewW,
      y: camY - 10 + Math.random() * (viewH + 20),
      vx: 0,
      vy: reduced ? 16 : 22 + Math.random() * 18,
      size: 2 + Math.random() * 2,
      life: 1,
      max: 1,
      rot: Math.random() * Math.PI * 2,
      vr: 0,
      color: SNOW[count % SNOW.length],
      mode: "snow",
      drift: reduced ? 0 : 16,
    });
    count += 1;
  }

  const bottom = camY + viewH + 24;
  const top = camY - 16;
  const left = camX - 30;
  const right = camX + viewW + 30;
  for (const p of particles) {
    if (p.mode !== "snow") continue;
    // Flakes live in world space, so a moving camera would leave them behind.
    if (p.y <= bottom && p.x >= left && p.x <= right) continue;
    p.y = top + Math.random() * 20;
    p.x = camX + Math.random() * viewW;
  }
}

const MOTES = ["rgba(255, 255, 255, 0.85)", "rgba(214, 204, 255, 0.8)", "rgba(255, 244, 214, 0.75)"];

/** Slow lights for the mist theme. Same idea as the snow: a fixed field over the camera. */
export function ensureMotes(
  particles: Particle[],
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
  reduced: boolean,
): void {
  const cap = reduced ? 8 : 26;
  let count = 0;
  for (const p of particles) if (p.mode === "mote") count += 1;

  while (count < cap) {
    particles.push({
      x: camX + Math.random() * viewW,
      y: camY - 10 + Math.random() * (viewH + 20),
      vx: 0,
      vy: reduced ? 10 : 14 + Math.random() * 12,
      size: 2 + Math.random() * 2.5,
      life: 1,
      max: 1,
      rot: Math.random() * Math.PI * 2,
      vr: 0,
      color: MOTES[count % MOTES.length],
      mode: "mote",
      drift: reduced ? 0 : 8,
    });
    count += 1;
  }

  const bottom = camY + viewH + 24;
  const top = camY - 16;
  const left = camX - 30;
  const right = camX + viewW + 30;
  for (const p of particles) {
    if (p.mode !== "mote") continue;
    if (p.y <= bottom && p.x >= left && p.x <= right) continue;
    p.y = top + Math.random() * 20;
    p.x = camX + Math.random() * viewW;
  }
}

const ASH = ["rgba(186, 170, 206, 0.55)", "rgba(255, 90, 110, 0.4)", "rgba(96, 74, 128, 0.45)"];

/** Slow dark flakes for Last Hope. Same camera field as the mist motes. */
export function ensureAsh(
  particles: Particle[],
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
  reduced: boolean,
): void {
  const cap = reduced ? 8 : 22;
  let count = 0;
  for (const p of particles) if (p.mode === "mote") count += 1;

  while (count < cap) {
    particles.push({
      x: camX + Math.random() * viewW,
      y: camY - 10 + Math.random() * (viewH + 20),
      vx: 0,
      vy: reduced ? 8 : 10 + Math.random() * 14,
      size: 2 + Math.random() * 2,
      life: 1,
      max: 1,
      rot: Math.random() * Math.PI * 2,
      vr: 0,
      color: ASH[count % ASH.length],
      mode: "mote",
      drift: reduced ? 0 : 10,
    });
    count += 1;
  }

  const bottom = camY + viewH + 24;
  const top = camY - 16;
  const left = camX - 30;
  const right = camX + viewW + 30;
  for (const p of particles) {
    if (p.mode !== "mote") continue;
    if (p.y <= bottom && p.x >= left && p.x <= right) continue;
    p.y = top + Math.random() * 20;
    p.x = camX + Math.random() * viewW;
  }
}

const STREAKS = ["#6fd6ff", "#ff4fd8", "#ffffff"];

/** A short square behind the cube. Called while the cube is moving fast. */
export function addStreak(particles: Particle[], x: number, y: number, vx: number, vy: number): void {
  const speed = Math.hypot(vx, vy);
  if (speed < 220) return;
  const life = 0.18;
  const dirX = vx / speed;
  const dirY = vy / speed;
  particles.push({
    x: x - dirX * 16 + (Math.random() - 0.5) * 6,
    y: y - dirY * 8 + (Math.random() - 0.5) * 8,
    vx: -dirX * 40,
    vy: -dirY * 20,
    size: 3 + Math.random() * 4,
    life,
    max: life,
    rot: Math.random() * Math.PI,
    vr: 0,
    color: STREAKS[particles.length % STREAKS.length],
    mode: "streak",
    drift: 0,
  });
}

export function updateParticles(particles: Particle[], dt: number): void {
  let write = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    if (p.mode === "snow" || p.mode === "mote") {
      p.y += p.vy * dt;
      p.x += Math.sin(p.y * 0.04 + p.rot) * p.drift * dt;
      particles[write++] = p;
      continue;
    }
    if (p.mode === "streak") {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life > 0) particles[write++] = p;
      continue;
    }
    p.vy = Math.min(p.vy + 1600 * dt, 900);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.life -= dt;
    if (p.life > 0) particles[write++] = p;
  }
  particles.length = write;
}
