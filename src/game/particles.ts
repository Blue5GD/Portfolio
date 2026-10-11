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
    });
  }
}

export function updateParticles(particles: Particle[], dt: number): void {
  let write = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.vy = Math.min(p.vy + 1600 * dt, 900);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.life -= dt;
    if (p.life > 0) particles[write++] = p;
  }
  particles.length = write;
}
