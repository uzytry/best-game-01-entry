// Drops: XP embers (the level fuel), health, shield, magnet, bomb and slow.
// Embers drift toward the player inside the magnet radius; everything else is
// picked up on touch.
import { addFloater, spawnBurst, spawnRing } from './particles.js';

export function dropPickup(state, x, y, kind, value = 1) {
  state.pickups.push({
    x,
    y,
    vx: state.rng.range(-40, 40),
    vy: state.rng.range(-40, 40),
    kind,
    value,
    life: kind === 'xp' ? 25 : 12,
    bob: state.rng.range(0, Math.PI * 2),
  });
}

export function dropLoot(state, enemy) {
  // Every kill drops XP; elites and bosses drop more, plus a chance of a bonus.
  const xp = enemy.boss ? 8 : enemy.elite ? 3 : 1;
  dropPickup(state, enemy.x, enemy.y, 'xp', xp);
  if (enemy.elite && state.rng.chance(0.5)) {
    dropPickup(state, enemy.x, enemy.y, 'health', 20);
  }
  if (enemy.boss) {
    dropPickup(state, enemy.x - 20, enemy.y, 'health', 30);
    dropPickup(state, enemy.x + 20, enemy.y, 'shield', 1);
  }
  if (!enemy.boss && !enemy.elite && state.rng.chance(0.012)) {
    dropPickup(state, enemy.x, enemy.y, state.rng.pick(['magnet', 'bomb', 'slow']), 1);
  }
}

function applyPickup(state, p) {
  const player = state.player;
  if (p.kind === 'xp') {
    state.gainXp(p.value);
  } else if (p.kind === 'health') {
    player.hp = Math.min(player.maxHp, player.hp + p.value);
    addFloater(state, player.x, player.y - 24, `+${p.value} HP`, '#7fe7c4');
  } else if (p.kind === 'shield') {
    player.shield = Math.min(50, (player.shield || 0) + 30);
    addFloater(state, player.x, player.y - 24, 'SHIELD +30', '#6fd3ff');
  } else if (p.kind === 'magnet') {
    state.magnetT = 6;
    addFloater(state, player.x, player.y - 24, 'MAGNET!', '#ffd166');
  } else if (p.kind === 'bomb') {
    state.fireNova(true);
    addFloater(state, player.x, player.y - 24, 'EMBER BOMB!', '#ff8a5c', true);
  } else if (p.kind === 'slow') {
    state.slowT = 5;
    addFloater(state, player.x, player.y - 24, 'TIME SLOWS', '#c792ff');
  }
  state.stats.pickups += 1;
  if (state.audio) state.audio.pickup();
  spawnBurst(state, p.x, p.y, 5, '#7fe7c4', 120, 0.3, 2.5);
}

export function updatePickups(state, dt) {
  const player = state.player;
  const magnetR = state.magnetT > 0 ? 420 : player.magnetR;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const p = state.pickups[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.pickups.splice(i, 1);
      continue;
    }
    p.bob += dt * 4;
    p.vx *= 0.92;
    p.vy *= 0.92;
    const dx = player.x - p.x;
    const dy = player.y - p.y;
    const d = Math.hypot(dx, dy);
    if (p.kind === 'xp' && d < magnetR && d > 1) {
      const pull = 900 * (1 - d / (magnetR + 60));
      p.vx += (dx / d) * pull * dt * 4;
      p.vy += (dy / d) * pull * dt * 4;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (d < player.radius + 12) {
      applyPickup(state, p);
      state.pickups.splice(i, 1);
    }
  }
  if (state.magnetT > 0) state.magnetT -= dt;
  if (state.slowT > 0) state.slowT -= dt;
}

export function clearAllEnemies(state, damage) {
  spawnRing(state, state.player.x, state.player.y, '#ffd166', 420);
  for (const enemy of state.enemies) {
    if (!enemy.dead) state.damageEnemy(enemy, damage, 0, 0);
  }
  state.ebullets.length = 0;
}
