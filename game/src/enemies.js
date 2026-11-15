// The gloom-spawn: five kinds with their own behaviour, plus the wave-10 boss.
// Each enemy is a plain object; update() steers it by kind, and the world reads
// the events it returns (shots are fired straight into the shared bullet pool).
// Spawns arrive at the field's edge, never near the Keeper.

import { BOSS, ELITE, ENEMY_BULLET, ENEMY_KINDS, FIELD, scaleForWave, SPAWN_CLEAR } from './config.js';

function edgePoint(random, player) {
  for (let tries = 0; tries < 12; tries += 1) {
    const side = random.int(0, 4);
    let x;
    let y;
    if (side === 0) { x = random.range(0, FIELD.width); y = -24; }
    else if (side === 1) { x = random.range(0, FIELD.width); y = FIELD.height + 24; }
    else if (side === 2) { x = -24; y = random.range(0, FIELD.height); }
    else { x = FIELD.width + 24; y = random.range(0, FIELD.height); }
    if (Math.hypot(x - player.x, y - player.y) > SPAWN_CLEAR) return { x, y };
  }
  return { x: FIELD.width / 2, y: -24 };
}

export function createEnemies(random) {
  const list = [];

  function spawn(kind, wave, elite = false) {
    const def = ENEMY_KINDS[kind];
    const scale = scaleForWave(wave);
    const hp = Math.round(def.hp * scale.hp * (elite ? ELITE.hpScale : 1));
    const radius = def.radius * (elite ? ELITE.sizeScale : 1);
    const enemy = {
      kind, boss: false, elite,
      x: 0, y: 0, radius,
      hp, maxHp: hp,
      speed: def.speed * scale.speed * (elite ? 0.95 : 1),
      damage: Math.round(def.damage * scale.damage),
      score: def.score * (elite ? ELITE.scoreScale : 1),
      orbs: def.orbs + (elite ? ELITE.orbsBonus : 0),
      color: def.color, core: def.core,
      kx: 0, ky: 0, wobble: random.next() * Math.PI * 2,
      state: 'chase', timer: 0, fireTimer: 1 + random.next(),
      lungeX: 0, lungeY: 0, flash: 0, sparkCooldown: 0,
    };
    return enemy;
  }

  function spawnBoss(wave) {
    const scale = scaleForWave(wave);
    const hp = Math.round(BOSS.hp * scale.hp);
    return {
      kind: 'boss', boss: true, elite: false,
      x: FIELD.width / 2, y: -80, radius: BOSS.radius,
      hp, maxHp: hp,
      speed: BOSS.speed, damage: BOSS.damage, score: BOSS.score, orbs: BOSS.orbs,
      color: BOSS.color, core: BOSS.core,
      kx: 0, ky: 0, wobble: 0,
      state: 'enter', timer: 0,
      radialTimer: 2.5, spreadTimer: 1.5, summonTimer: 6, chargeTimer: 5,
      lungeX: 0, lungeY: 0, flash: 0, sparkCooldown: 0,
    };
  }

  // Steer one enemy for a step. `spawn` queues a new enemy (boss summons, splitter
  // children); the world drains the queue after the update so the list never grows
  // while it is being walked.
  function steer(enemy, dt, player, bullets, spawnQueue) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const ux = dx / distance;
    const uy = dy / distance;
    enemy.wobble += dt * 3;
    if (enemy.flash > 0) enemy.flash -= dt;
    if (enemy.sparkCooldown > 0) enemy.sparkCooldown -= dt;

    const wobbleX = Math.cos(enemy.wobble) * 0.25;
    const wobbleY = Math.sin(enemy.wobble * 1.3) * 0.25;

    if (enemy.kind === 'darter') {
      enemy.timer -= dt;
      if (enemy.state === 'chase') {
        enemy.x += (ux + wobbleX * 0.4) * enemy.speed * dt;
        enemy.y += (uy + wobbleY * 0.4) * enemy.speed * dt;
        if (enemy.timer <= 0 && distance < 320) {
          enemy.state = 'windup';
          enemy.timer = 0.45;
        }
      } else if (enemy.state === 'windup') {
        enemy.flash = 0.1;
        if (enemy.timer <= 0) {
          enemy.state = 'lunge';
          enemy.timer = 0.32;
          enemy.lungeX = ux;
          enemy.lungeY = uy;
        }
      } else if (enemy.state === 'lunge') {
        enemy.x += enemy.lungeX * 520 * dt;
        enemy.y += enemy.lungeY * 520 * dt;
        if (enemy.timer <= 0) {
          enemy.state = 'recover';
          enemy.timer = 0.6;
        }
      } else if (enemy.timer <= 0) {
        enemy.state = 'chase';
        enemy.timer = 1.2 + random.next() * 1.2;
      }
    } else if (enemy.kind === 'spitter') {
      // Keep a shooting band around the Keeper: close in when far, back off when near.
      let mx = ux;
      let my = uy;
      if (distance < 210) { mx = -ux; my = -uy; }
      else if (distance < 320) { mx = -uy; my = ux; } // strafe while in range
      enemy.x += (mx + wobbleX * 0.3) * enemy.speed * dt;
      enemy.y += (my + wobbleY * 0.3) * enemy.speed * dt;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0 && distance < 520) {
        enemy.fireTimer = 2.3;
        bullets.fireEnemy(enemy.x, enemy.y, Math.atan2(dy, dx), 190, enemy.damage, ENEMY_BULLET.life, ENEMY_BULLET.radius);
      }
    } else if (enemy.kind === 'boss') {
      steerBoss(enemy, dt, player, bullets, spawnQueue, ux, uy, distance);
    } else {
      enemy.x += (ux + wobbleX * 0.35) * enemy.speed * dt;
      enemy.y += (uy + wobbleY * 0.35) * enemy.speed * dt;
    }

    // Knockback decays; brutes shrug most of it off, the boss all of it.
    const resist = enemy.kind === 'brute' ? 0.3 : enemy.boss ? 0 : 1;
    enemy.x += enemy.kx * resist * dt;
    enemy.y += enemy.ky * resist * dt;
    const decay = Math.pow(0.001, dt);
    enemy.kx *= decay;
    enemy.ky *= decay;
  }

  function steerBoss(boss, dt, player, bullets, spawnQueue, ux, uy, distance) {
    const phase2 = boss.hp < boss.maxHp / 2;
    boss.timer -= dt;
    if (boss.state === 'enter') {
      boss.y += 60 * dt;
      if (boss.y >= 120) {
        boss.state = 'fight';
        boss.timer = 0;
      }
      return;
    }
    if (boss.state === 'chargeWindup') {
      boss.flash = 0.1;
      if (boss.timer <= 0) {
        boss.state = 'charging';
        boss.timer = BOSS.chargeTime;
        boss.lungeX = ux;
        boss.lungeY = uy;
      }
      return;
    }
    if (boss.state === 'charging') {
      boss.x += boss.lungeX * BOSS.chargeSpeed * dt;
      boss.y += boss.lungeY * BOSS.chargeSpeed * dt;
      if (boss.timer <= 0) {
        boss.state = 'fight';
        boss.chargeTimer = BOSS.chargeInterval;
      }
      return;
    }

    // Drift toward the Keeper, slowly, while the attacks run on their own timers.
    boss.x += ux * boss.speed * dt;
    boss.y += uy * boss.speed * dt;
    boss.radialTimer -= dt;
    boss.spreadTimer -= dt;
    boss.summonTimer -= dt;
    boss.chargeTimer -= dt;

    if (boss.radialTimer <= 0) {
      boss.radialTimer = phase2 ? BOSS.radialInterval * 0.7 : BOSS.radialInterval;
      const offset = random.next() * Math.PI * 2;
      for (let i = 0; i < BOSS.radialCount; i += 1) {
        const angle = offset + (i * Math.PI * 2) / BOSS.radialCount;
        bullets.fireEnemy(boss.x, boss.y, angle, BOSS.radialSpeed, 10, ENEMY_BULLET.life, ENEMY_BULLET.radius);
      }
    }
    if (boss.spreadTimer <= 0) {
      boss.spreadTimer = phase2 ? BOSS.spreadInterval * 0.7 : BOSS.spreadInterval;
      const base = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (let i = 0; i < BOSS.spreadCount; i += 1) {
        const angle = base + (i - (BOSS.spreadCount - 1) / 2) * 0.16;
        bullets.fireEnemy(boss.x, boss.y, angle, BOSS.spreadSpeed, 12, ENEMY_BULLET.life, ENEMY_BULLET.radius);
      }
    }
    if (boss.summonTimer <= 0) {
      boss.summonTimer = BOSS.summonInterval;
      for (let i = 0; i < BOSS.summonCount; i += 1) {
        spawnQueue.push({ kind: phase2 ? 'darter' : 'wisp', x: boss.x, y: boss.y });
      }
    }
    if (phase2 && boss.chargeTimer <= 0 && distance > 140) {
      boss.state = 'chargeWindup';
      boss.timer = 0.6;
    }
  }

  return {
    list,
    spawnAtEdge(kind, wave, player) {
      const point = edgePoint(random, player);
      const elite = wave >= ELITE.fromWave && random.chance(ELITE.chance);
      const enemy = spawn(kind, wave, elite);
      enemy.x = point.x;
      enemy.y = point.y;
      list.push(enemy);
      return enemy;
    },
    spawnAt(kind, wave, x, y) {
      const enemy = spawn(kind, wave, false);
      enemy.x = x;
      enemy.y = y;
      list.push(enemy);
      return enemy;
    },
    spawnBoss(wave) {
      const boss = spawnBoss(wave);
      list.push(boss);
      return boss;
    },
    update(dt, player, bullets, spawnQueue) {
      for (const enemy of list) steer(enemy, dt, player, bullets, spawnQueue);
    },
    remove(enemy) {
      const index = list.indexOf(enemy);
      if (index !== -1) list.splice(index, 1);
    },
    clear() {
      list.length = 0;
    },
  };
}
