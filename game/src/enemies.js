// The Ashen: eight enemy kinds, each with its own way of hunting. Most chase
// the Warden; some make for the Heart instead, so the player must watch two
// fronts at once. Elites are bigger, tougher and richer in XP.
import { WALL, WORLD } from './config.js';
import { addFloater, spawnBurst } from './particles.js';
import { dropLoot } from './pickups.js';
import { registerKill } from './combo.js';

export const ENEMY_DEFS = {
  emberling: { hp: 22, speed: 105, radius: 13, damage: 9, mass: 1, color: '#c792ff', shape: 'blob', heartBias: 0.3 },
  mini: { hp: 9, speed: 150, radius: 8, damage: 6, mass: 0.6, color: '#e0aaff', shape: 'blob', heartBias: 0.2 },
  wisp: { hp: 16, speed: 165, radius: 11, damage: 8, mass: 0.8, color: '#8ef6ff', shape: 'wisp', heartBias: 0.1 },
  spitter: { hp: 30, speed: 82, radius: 14, damage: 8, mass: 1, color: '#a4e86a', shape: 'spitter', heartBias: 0.2 },
  charger: { hp: 40, speed: 95, radius: 15, damage: 16, mass: 1.4, color: '#ff6b6b', shape: 'charger', heartBias: 0 },
  splitter: { hp: 55, speed: 70, radius: 19, damage: 12, mass: 2, color: '#ffb3c1', shape: 'splitter', heartBias: 0.15 },
  bulwark: { hp: 150, speed: 46, radius: 24, damage: 16, mass: 4.5, color: '#d8cdb4', shape: 'bulwark', heartBias: 0.35 },
  spawner: { hp: 90, speed: 0, radius: 22, damage: 0, mass: 6, color: '#ff9f1c', shape: 'spawner', heartBias: 0 },
  leech: { hp: 20, speed: 175, radius: 11, damage: 4, mass: 0.8, color: '#ff5d8f', shape: 'leech', heartBias: 1 },
};

let nextId = 1;

export function spawnEnemy(state, kind, x, y, elite = false) {
  const def = ENEMY_DEFS[kind];
  const waveScale = 1 + (state.wave - 1) * 0.16;
  const hp = Math.round(def.hp * waveScale * (elite ? 2.3 : 1));
  const enemy = {
    id: nextId,
    kind,
    x: Math.max(WALL + 10, Math.min(WORLD.w - WALL - 10, x)),
    y: Math.max(WALL + 10, Math.min(WORLD.h - WALL - 10, y)),
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    hp,
    maxHp: hp,
    speed: def.speed * (elite ? 1.05 : 1) * state.rng.range(0.92, 1.08),
    radius: def.radius * (elite ? 1.28 : 1),
    damage: Math.round(def.damage * (elite ? 1.5 : 1)),
    mass: def.mass,
    color: def.color,
    shape: def.shape,
    elite,
    boss: false,
    target: state.rng.next() < def.heartBias ? 'heart' : 'player',
    t: state.rng.range(0, 10),
    attackT: state.rng.range(0.5, 1.5),
    fireT: state.rng.range(1, 2.4),
    spawnT: 0,
    flash: 0,
    slowT: 0,
    dead: false,
    orbitDir: state.rng.chance(0.5) ? 1 : -1,
    charge: null,
    children: 0,
  };
  nextId += 1;
  state.enemies.push(enemy);
  return enemy;
}

export function spawnAtEdge(state, kind, elite = false) {
  const side = state.rng.int(0, 3);
  const m = WALL + 30;
  let x;
  let y;
  if (side === 0) {
    x = state.rng.range(m, WORLD.w - m);
    y = m;
  } else if (side === 1) {
    x = state.rng.range(m, WORLD.w - m);
    y = WORLD.h - m;
  } else if (side === 2) {
    x = m;
    y = state.rng.range(m, WORLD.h - m);
  } else {
    x = WORLD.w - m;
    y = state.rng.range(m, WORLD.h - m);
  }
  // Never spawn on top of the player.
  if (Math.hypot(x - state.player.x, y - state.player.y) < 240) {
    x = WORLD.w - x;
    y = WORLD.h - y;
  }
  return spawnEnemy(state, kind, x, y, elite);
}

// One wound: damage, knockback, hit flash, a floating number, and death.
export function damageEnemy(state, enemy, amount, kx = 0, ky = 0, crit = false) {
  if (enemy.dead) return;
  const dmg = Math.max(1, Math.round(amount));
  const hpBefore = enemy.hp;
  enemy.hp -= dmg;
  enemy.flash = 0.09;
  enemy.kx += kx / Math.max(1, enemy.mass);
  enemy.ky += ky / Math.max(1, enemy.mass);
  if (enemy.slowOnHit) enemy.slowT = Math.max(enemy.slowT, 0.8);
  // Stats count real wounds, not the kill-all's 99999.
  state.stats.damageDealt += Math.min(dmg, hpBefore);
  if (dmg < 10000) {
    addFloater(state, enemy.x + state.rng.range(-8, 8), enemy.y - enemy.radius - 6, String(dmg), crit ? '#ffd166' : '#f5e9d3', crit);
  }
  if (enemy.hp <= 0) killEnemy(state, enemy);
}

export function killEnemy(state, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  state.kills += 1;
  registerKill(state, enemy);
  const base = enemy.boss ? 500 : enemy.elite ? 50 : 10;
  state.score += Math.round(base * state.combo.mult);
  spawnBurst(state, enemy.x, enemy.y, enemy.boss ? 40 : enemy.elite ? 18 : 9, enemy.color, enemy.boss ? 380 : 240, 0.6, enemy.boss ? 5 : 3);
  if (state.audio) state.audio.explode(enemy.boss || enemy.elite);
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 2; i += 1) {
      spawnEnemy(state, 'mini', enemy.x + state.rng.range(-16, 16), enemy.y + state.rng.range(-16, 16));
    }
  }
  if (enemy.boss) state.onBossDeath(enemy);
  else dropLoot(state, enemy);
}

function targetPoint(state, enemy) {
  return enemy.target === 'heart' ? state.heart : state.player;
}

function seek(state, enemy, dt, speedMul = 1) {
  const t = targetPoint(state, enemy);
  const dx = t.x - enemy.x;
  const dy = t.y - enemy.y;
  const d = Math.hypot(dx, dy) || 1;
  const slow = enemy.slowT > 0 ? 0.55 : 1;
  const global = state.enemySpeedMul || 1;
  enemy.vx = (dx / d) * enemy.speed * speedMul * slow * global;
  enemy.vy = (dy / d) * enemy.speed * speedMul * slow * global;
}

export function updateEnemies(state, dt) {
  const player = state.player;
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    enemy.t += dt;
    if (enemy.flash > 0) enemy.flash -= dt;
    if (enemy.slowT > 0) enemy.slowT -= dt;
    enemy.attackT -= dt;
    if (enemy.boss) {
      state.updateBoss(enemy, dt);
    } else if (enemy.kind === 'spawner') {
      enemy.vx = 0;
      enemy.vy = 0;
      enemy.spawnT -= dt;
      if (enemy.spawnT <= 0 && enemy.children < 4) {
        enemy.spawnT = 4;
        enemy.children += 1;
        spawnEnemy(state, 'emberling', enemy.x + state.rng.range(-30, 30), enemy.y + state.rng.range(-30, 30));
      }
    } else if (enemy.kind === 'spitter') {
      const t = targetPoint(state, enemy);
      const d = Math.hypot(t.x - enemy.x, t.y - enemy.y);
      if (d > 300) seek(state, enemy, dt, 1);
      else if (d < 200) seek(state, enemy, dt, -0.8);
      else {
        enemy.vx *= 0.9;
        enemy.vy *= 0.9;
      }
      enemy.fireT -= dt;
      if (enemy.fireT <= 0 && d < 560) {
        enemy.fireT = 2.3;
        const a = Math.atan2(t.y - enemy.y, t.x - enemy.x);
        state.ebullets.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(a) * 230,
          vy: Math.sin(a) * 230,
          damage: enemy.damage,
          radius: 5,
          life: 4,
          color: '#a4e86a',
          hurtsHeart: enemy.target === 'heart',
        });
      }
    } else if (enemy.kind === 'wisp') {
      const t = targetPoint(state, enemy);
      const d = Math.hypot(t.x - enemy.x, t.y - enemy.y);
      const orbit = d > 150 ? 1 : -0.4;
      const a = Math.atan2(enemy.y - t.y, enemy.x - t.x) + enemy.orbitDir * dt * 1.6;
      const wantX = t.x + Math.cos(a) * 150;
      const wantY = t.y + Math.sin(a) * 150;
      const dx = wantX - enemy.x;
      const dy = wantY - enemy.y;
      const dd = Math.hypot(dx, dy) || 1;
      const global = state.enemySpeedMul || 1;
      enemy.vx = (dx / dd) * enemy.speed * orbit * global;
      enemy.vy = (dy / dd) * enemy.speed * orbit * global;
    } else if (enemy.kind === 'charger') {
      if (!enemy.charge) {
        const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        seek(state, enemy, dt, 1);
        if (d < 260 && enemy.attackT <= 0) {
          enemy.charge = { t: 0.6, angle: Math.atan2(player.y - enemy.y, player.x - enemy.x) };
        }
      } else if (enemy.charge.t > 0) {
        // Telegraph: brake and count down.
        enemy.charge.t -= dt;
        enemy.vx *= 0.8;
        enemy.vy *= 0.8;
        if (enemy.charge.t <= 0) {
          enemy.vx = Math.cos(enemy.charge.angle) * 620;
          enemy.vy = Math.sin(enemy.charge.angle) * 620;
          enemy.charge.t = -0.45;
        }
      } else {
        // Dashing: keep the velocity until the dash window ends.
        enemy.charge.t -= dt;
        if (enemy.charge.t < -0.45) {
          enemy.charge = null;
          enemy.attackT = 1.6;
        }
      }
    } else {
      // Emberling, mini, splitter, bulwark, leech: straight seek with a
      // sinusoidal strafe so the swarm never marches in lockstep.
      seek(state, enemy, dt, 1);
      const wob = Math.sin(enemy.t * 3 + enemy.id) * 20;
      const pl = Math.hypot(enemy.vx, enemy.vy) || 1;
      enemy.vx += (-enemy.vy / pl) * wob * 0.25;
      enemy.vy += (enemy.vx / pl) * wob * 0.25;
    }
    // Knockback decays; position integrates velocity + knockback.
    enemy.kx *= Math.max(0, 1 - 6 * dt);
    enemy.ky *= Math.max(0, 1 - 6 * dt);
    enemy.x += (enemy.vx + enemy.kx) * dt;
    enemy.y += (enemy.vy + enemy.ky) * dt;
    enemy.x = Math.max(WALL + enemy.radius, Math.min(WORLD.w - WALL - enemy.radius, enemy.x));
    enemy.y = Math.max(WALL + enemy.radius, Math.min(WORLD.h - WALL - enemy.radius, enemy.y));
    // Contact with the player.
    const dp = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dp < player.radius + enemy.radius && enemy.attackT <= 0 && enemy.kind !== 'spawner') {
      enemy.attackT = 0.8;
      state.hurtPlayer(enemy.damage, enemy.x, enemy.y);
    }
    // Contact with the Heart.
    const dh = Math.hypot(state.heart.x - enemy.x, state.heart.y - enemy.y);
    if (dh < state.heart.radius + enemy.radius && enemy.attackT <= 0 && enemy.target === 'heart') {
      enemy.attackT = enemy.kind === 'leech' ? 0.5 : 1.3;
      const dmg = enemy.kind === 'leech' ? 2 : enemy.damage;
      if (state.damageHeart(dmg)) state.heartDead = true;
      if (state.audio) state.audio.heartHit();
      spawnBurst(state, enemy.x, enemy.y, 4, '#ff8a3c', 140, 0.3, 2.5);
    }
  }
  // Sweep the dead.
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    if (state.enemies[i].dead) state.enemies.splice(i, 1);
  }
}
