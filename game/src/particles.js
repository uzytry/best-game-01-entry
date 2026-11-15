// Juice: sparks, rings, floating numbers and screen shake. Particles are pooled
// (a fixed array with a live count) so a busy fight never allocates per frame.
// Floating texts are the damage numbers and the "+1" pickups the player reads.
// The randomness comes from the run's own seeded generator, so a seeded run
// replays byte for byte — the screenshot scenes depend on it.

const MAX_PARTICLES = 420;

export function createParticles(random) {
  const roll = random ? () => random.next() : Math.random;
  const pool = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    pool.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, ttl: 1, size: 2, color: '#fff', drag: 0.9, gravity: 0 });
  }
  let cursor = 0;
  const texts = [];
  const rings = [];
  let shakeTime = 0;
  let shakeStrength = 0;

  function spawn(x, y, vx, vy, ttl, size, color, drag = 0.9) {
    const particle = pool[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    particle.alive = true;
    particle.x = x;
    particle.y = y;
    particle.vx = vx;
    particle.vy = vy;
    particle.life = 0;
    particle.ttl = ttl;
    particle.size = size;
    particle.color = color;
    particle.drag = drag;
  }

  return {
    burst(x, y, color, count, speed = 180) {
      for (let i = 0; i < count; i += 1) {
        const angle = roll() * Math.PI * 2;
        const power = speed * (0.3 + roll() * 0.7);
        spawn(x, y, Math.cos(angle) * power, Math.sin(angle) * power, 0.35 + roll() * 0.4, 1.5 + roll() * 2.5, color);
      }
    },
    sparks(x, y, color, count = 6) {
      this.burst(x, y, color, count, 120);
    },
    ring(x, y, color, maxRadius = 90) {
      rings.push({ x, y, color, radius: 6, maxRadius, life: 0, ttl: 0.45 });
    },
    text(x, y, value, color = '#fff', size = 15) {
      if (texts.length > 40) texts.shift();
      texts.push({ x, y, value: String(value), color, size, life: 0, ttl: 0.9 });
    },
    shake(strength, duration = 0.25) {
      shakeStrength = Math.max(shakeStrength, strength);
      shakeTime = Math.max(shakeTime, duration);
    },
    update(dt) {
      for (const particle of pool) {
        if (!particle.alive) continue;
        particle.life += dt;
        if (particle.life >= particle.ttl) {
          particle.alive = false;
          continue;
        }
        const drag = Math.pow(particle.drag, dt * 60);
        particle.vx *= drag;
        particle.vy *= drag;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        texts[i].life += dt;
        texts[i].y -= 34 * dt;
        if (texts[i].life >= texts[i].ttl) texts.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        rings[i].life += dt;
        rings[i].radius = 6 + (rings[i].maxRadius - 6) * (rings[i].life / rings[i].ttl);
        if (rings[i].life >= rings[i].ttl) rings.splice(i, 1);
      }
      if (shakeTime > 0) {
        shakeTime -= dt;
        if (shakeTime <= 0) shakeStrength = 0;
      }
    },
    // The current shake offset; the renderer translates by it before drawing the world.
    offset() {
      if (shakeTime <= 0) return { x: 0, y: 0 };
      const decay = shakeTime / 0.25;
      return {
        x: (roll() * 2 - 1) * shakeStrength * decay,
        y: (roll() * 2 - 1) * shakeStrength * decay,
      };
    },
    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const particle of pool) {
        if (!particle.alive) continue;
        const fade = 1 - particle.life / particle.ttl;
        ctx.globalAlpha = fade;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * (0.5 + fade * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      for (const ring of rings) {
        const fade = 1 - ring.life / ring.ttl;
        ctx.globalAlpha = fade * 0.8;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.textAlign = 'center';
      for (const item of texts) {
        const fade = 1 - item.life / item.ttl;
        ctx.globalAlpha = Math.min(1, fade * 2);
        ctx.font = `700 ${item.size}px system-ui, sans-serif`;
        ctx.fillStyle = item.color;
        ctx.fillText(item.value, item.x, item.y);
      }
      ctx.restore();
    },
    clear() {
      for (const particle of pool) particle.alive = false;
      texts.length = 0;
      rings.length = 0;
      shakeTime = 0;
      shakeStrength = 0;
    },
  };
}
