// The three weapons and the orbital blades. Scatter sprays pellets, Lance
// pierces a line, Mortar lobs shells that burst. Switching is instant, so the
// right weapon for the moment is always one key away.
import { spawnBurst, spawnTrail } from './particles.js';

export const WEAPON_KEYS = ['scatter', 'lance', 'mortar'];
export const WEAPONS = {
  scatter: {
    name: 'Scatter',
    damage: 8,
    rate: 0.21,
    speed: 560,
    range: 460,
    pellets: 5,
    spread: 0.46,
    radius: 4,
    color: '#ffd166',
    hint: 'Spray of embers — best up close',
  },
  lance: {
    name: 'Lance',
    damage: 36,
    rate: 0.48,
    speed: 950,
    range: 900,
    pellets: 1,
    spread: 0,
    radius: 5,
    color: '#7fe7c4',
    hint: 'Piercing bolt — lines enemies up',
  },
  mortar: {
    name: 'Mortar',
    damage: 26,
    rate: 0.68,
    speed: 430,
    range: 520,
    pellets: 1,
    spread: 0,
    radius: 7,
    aoe: 95,
    color: '#ff8a5c',
    hint: 'Bursting shells — clears clusters',
  },
};

export function fireWeapon(state, weaponKey, aimX, aimY) {
  const player = state.player;
  const def = WEAPONS[weaponKey];
  const base = Math.atan2(aimY - player.y, aimX - player.x);
  const count = def.pellets + (player.extraProjectiles || 0);
  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * def.spread * 2;
    const angle = base + offset + state.rng.range(-0.015, 0.015);
    const speed = def.speed * player.bulletSpeedMul;
    state.bullets.push({
      x: player.x + Math.cos(angle) * 20,
      y: player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: def.damage * player.damageMul,
      pierce: (weaponKey === 'lance' ? 99 : 0) + (player.pierce || 0),
      bounce: player.bounce || 0,
      crit: player.crit || 0,
      life: def.range / speed,
      kind: weaponKey,
      radius: def.radius,
      aoe: def.aoe || 0,
      color: def.color,
      hitSet: new Set(),
    });
  }
  state.stats.shots += count;
  player.fireT = def.rate / player.fireRateMul;
  player.muzzle = 0.06;
  if (state.audio) state.audio.shoot(weaponKey);
  spawnTrail(state, player.x + Math.cos(base) * 22, player.y + Math.sin(base) * 22, def.color, 4);
}

// Blades orbit the player and shred whatever they touch. Each blade remembers
// which enemies it recently hit so one pass deals one wound per enemy.
export function updateOrbitals(state, dt) {
  const player = state.player;
  const n = player.orbitals || 0;
  if (n === 0) return;
  player.orbitAngle = (player.orbitAngle || 0) + dt * 2.4;
  const radius = 74;
  for (let i = 0; i < n; i += 1) {
    const a = player.orbitAngle + (i / n) * Math.PI * 2;
    const bx = player.x + Math.cos(a) * radius;
    const by = player.y + Math.sin(a) * radius;
    if (state.rng.chance(0.3)) spawnTrail(state, bx, by, '#ffd166', 2);
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const key = `${i}:${enemy.id}`;
      if (player.orbitHits.has(key)) continue;
      const d = Math.hypot(enemy.x - bx, enemy.y - by);
      if (d < enemy.radius + 12) {
        player.orbitHits.add(key);
        state.orbitHitTimers.push({ key, t: 0.35 });
        state.damageEnemy(enemy, 14 * player.damageMul, Math.cos(a) * 120, Math.sin(a) * 120);
      }
    }
  }
  for (let i = state.orbitHitTimers.length - 1; i >= 0; i -= 1) {
    const t = state.orbitHitTimers[i];
    t.t -= dt;
    if (t.t <= 0) {
      player.orbitHits.delete(t.key);
      state.orbitHitTimers.splice(i, 1);
    }
  }
}

export function spawnMuzzleFlash(state, x, y, color) {
  spawnBurst(state, x, y, 3, color, 120, 0.18, 2);
}
