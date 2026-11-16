// Particles, shockwave rings and floating combat text (damage numbers, pickup
// callouts). All motion is seeded through the world's RNG, so a staged scene
// paints identically every time.
export function spawnBurst(state, x, y, count, color, speed = 220, life = 0.55, size = 3) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.angle();
    const v = state.rng.range(speed * 0.3, speed);
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: state.rng.range(life * 0.5, life),
      maxLife: life,
      size: state.rng.range(size * 0.5, size * 1.4),
      color,
      drag: 3.2,
      glow: true,
    });
  }
}

export function spawnTrail(state, x, y, color, size = 2.5) {
  state.particles.push({
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0.22,
    maxLife: 0.22,
    size,
    color,
    drag: 0,
    glow: true,
  });
}

export function spawnRing(state, x, y, color, maxRadius, life = 0.45) {
  state.rings.push({ x, y, radius: 8, maxRadius, life, maxLife: life, color });
}

export function addFloater(state, x, y, text, color, big = false) {
  state.floaters.push({ x, y, vy: -46, life: 0.9, maxLife: 0.9, text, color, big });
}

export function updateParticles(state, dt) {
  const parts = state.particles;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      parts.splice(i, 1);
      continue;
    }
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d;
    p.vy *= d;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  const rings = state.rings;
  for (let i = rings.length - 1; i >= 0; i -= 1) {
    const r = rings[i];
    r.life -= dt;
    if (r.life <= 0) {
      rings.splice(i, 1);
      continue;
    }
    const t = 1 - r.life / r.maxLife;
    r.radius = 8 + (r.maxRadius - 8) * (1 - (1 - t) * (1 - t));
  }
  const floats = state.floaters;
  for (let i = floats.length - 1; i >= 0; i -= 1) {
    const f = floats[i];
    f.life -= dt;
    if (f.life <= 0) {
      floats.splice(i, 1);
      continue;
    }
    f.y += f.vy * dt;
    f.vy *= 0.96;
  }
  if (parts.length > 420) parts.splice(0, parts.length - 420);
  if (floats.length > 60) floats.splice(0, floats.length - 60);
}
