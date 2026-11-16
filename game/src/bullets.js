// Projectiles: the player's bullets (with pierce, bounce and crit) and the
// enemies' shots. Aimed shots from an enemy hunting the Heart can wound it;
// area barrages (boss spirals and radial bursts) only threaten the player, so
// the Heart is a melee-and-marksman objective, not a bullet sponge.
import { WORLD } from './config.js';
import { spawnBurst, spawnRing } from './particles.js';

function explodeShell(state, bullet) {
  spawnBurst(state, bullet.x, bullet.y, 14, '#ff8a5c', 260, 0.5, 3.5);
  spawnRing(state, bullet.x, bullet.y, '#ff8a5c', bullet.aoe);
  if (state.audio) state.audio.explode(false);
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const d = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
    if (d < bullet.aoe + enemy.radius) {
      const falloff = 1 - (d / (bullet.aoe + enemy.radius)) * 0.5;
      state.damageEnemy(enemy, bullet.damage * falloff, (enemy.x - bullet.x) * 2, (enemy.y - bullet.y) * 2);
    }
  }
}

export function updateBullets(state, dt) {
  const bullets = state.bullets;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.x > WORLD.w || b.y < 0 || b.y > WORLD.h;
    if (!dead) {
      for (const enemy of state.enemies) {
        if (enemy.dead || b.hitSet.has(enemy.id)) continue;
        const d = Math.hypot(enemy.x - b.x, enemy.y - b.y);
        if (d >= enemy.radius + b.radius) continue;
        b.hitSet.add(enemy.id);
        const crit = state.rng.next() < b.crit;
        const damage = b.damage * (crit ? 2 : 1);
        const kb = 140 / Math.max(1, enemy.mass || 1);
        const nx = (enemy.x - b.x) / (d || 1);
        const ny = (enemy.y - b.y) / (d || 1);
        state.damageEnemy(enemy, damage, nx * kb, ny * kb, crit);
        state.stats.hits += 1;
        if (state.audio) state.audio.hit();
        if (b.aoe) {
          explodeShell(state, b);
          dead = true;
          break;
        }
        if (b.pierce > 0) {
          b.pierce -= 1;
        } else if (b.bounce > 0) {
          b.bounce -= 1;
          // Ricochet toward the nearest other enemy, or reverse.
          let best = null;
          let bestD = 420;
          for (const other of state.enemies) {
            if (other.dead || other.id === enemy.id || b.hitSet.has(other.id)) continue;
            const od = Math.hypot(other.x - b.x, other.y - b.y);
            if (od < bestD) {
              bestD = od;
              best = other;
            }
          }
          const speed = Math.hypot(b.vx, b.vy);
          if (best) {
            const a = Math.atan2(best.y - b.y, best.x - b.x);
            b.vx = Math.cos(a) * speed;
            b.vy = Math.sin(a) * speed;
          } else {
            b.vx = -b.vx;
            b.vy = -b.vy;
          }
        } else {
          dead = true;
          break;
        }
      }
    }
    if (dead) {
      if (b.aoe && b.life <= 0) explodeShell(state, b);
      else if (!b.aoe) spawnBurst(state, b.x, b.y, 2, b.color, 90, 0.2, 2);
      bullets.splice(i, 1);
    }
  }
}

export function updateEnemyBullets(state, dt) {
  const player = state.player;
  const shots = state.ebullets;
  for (let i = shots.length - 1; i >= 0; i -= 1) {
    const s = shots[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    let dead = s.life <= 0 || s.x < -20 || s.x > WORLD.w + 20 || s.y < -20 || s.y > WORLD.h + 20;
    if (!dead) {
      const dp = Math.hypot(player.x - s.x, player.y - s.y);
      if (dp < player.radius + s.radius) {
        state.hurtPlayer(s.damage, s.x, s.y);
        dead = true;
      } else if (s.hurtsHeart) {
        const dh = Math.hypot(state.heart.x - s.x, state.heart.y - s.y);
        if (dh < state.heart.radius + s.radius) {
          if (state.damageHeart(s.damage)) state.heartDead = true;
          if (state.audio) state.audio.heartHit();
          spawnBurst(state, s.x, s.y, 6, '#ff8a3c', 160, 0.4, 3);
          dead = true;
        }
      }
    }
    if (dead) shots.splice(i, 1);
  }
}
