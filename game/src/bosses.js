// The two bosses. The Ash Tyrant (wave 6) charges and bursts; the Hollow King
// (wave 12) fights in three phases — spiral barrages, aimed fans, then an
// enraged storm — and killing him wins the run.
import { WORLD } from './config.js';
import { spawnBurst, spawnRing } from './particles.js';
import { spawnEnemy } from './enemies.js';

export function spawnBoss(state, kind) {
  const defs = {
    tyrant: { hp: 950, speed: 62, radius: 34, damage: 22, color: '#ff6b6b', name: 'ASH TYRANT' },
    king: { hp: 2600, speed: 55, radius: 42, damage: 26, color: '#c792ff', name: 'THE HOLLOW KING' },
  };
  const def = defs[kind];
  const boss = {
    id: 9000 + state.wave,
    kind,
    x: WORLD.w / 2,
    y: 130,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    hp: def.hp,
    maxHp: def.hp,
    speed: def.speed,
    radius: def.radius,
    damage: def.damage,
    mass: 10,
    color: def.color,
    shape: 'boss',
    elite: false,
    boss: true,
    bossName: def.name,
    target: 'player',
    t: 0,
    attackT: 2,
    fireT: 1.5,
    spawnT: 0,
    flash: 0,
    slowT: 0,
    dead: false,
    orbitDir: 1,
    charge: null,
    children: 0,
    phase: 1,
    spiralA: 0,
    enraged: false,
  };
  state.enemies.push(boss);
  state.boss = boss;
  if (state.audio) state.audio.roar();
  spawnRing(state, boss.x, boss.y, def.color, 200);
  return boss;
}

function radialBurst(state, boss, count, speed, damage) {
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + boss.t;
    state.ebullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      damage,
      radius: 6,
      life: 5,
      color: boss.color,
    });
  }
}

function aimedFan(state, boss, count, spread, speed, damage) {
  const base = Math.atan2(state.player.y - boss.y, state.player.x - boss.x);
  for (let i = 0; i < count; i += 1) {
    const a = base + (i / (count - 1) - 0.5) * spread;
    state.ebullets.push({
      x: boss.x,
      y: boss.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      damage,
      radius: 6,
      life: 5,
      color: boss.color,
    });
  }
}

function summon(state, boss, kind, n) {
  for (let i = 0; i < n; i += 1) {
    const a = state.rng.angle();
    spawnEnemy(state, kind, boss.x + Math.cos(a) * 70, boss.y + Math.sin(a) * 70);
  }
  spawnBurst(state, boss.x, boss.y, 12, boss.color, 200, 0.5, 3);
}

export function updateBoss(state, boss, dt) {
  const player = state.player;
  const hpFrac = boss.hp / boss.maxHp;
  // Phase shifts for the King.
  if (boss.kind === 'king') {
    const phase = hpFrac > 0.66 ? 1 : hpFrac > 0.33 ? 2 : 3;
    if (phase !== boss.phase) {
      boss.phase = phase;
      boss.enraged = phase === 3;
      state.bossPhaseFlash = 1.2;
      radialBurst(state, boss, 16, 180, 10);
      if (state.audio) state.audio.roar();
    }
  }
  const global = state.enemySpeedMul || 1;
  const speed = boss.speed * (boss.enraged ? 1.5 : 1) * global;
  // Drift toward the player, never too close to the Heart.
  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const d = Math.hypot(dx, dy) || 1;
  const want = d > 240 ? 1 : -0.4;
  boss.vx = (dx / d) * speed * want;
  boss.vy = (dy / d) * speed * want;
  boss.fireT -= dt;
  boss.spawnT -= dt;
  if (boss.kind === 'tyrant') {
    if (boss.fireT <= 0) {
      boss.fireT = 2.6;
      if (state.rng.chance(0.5)) radialBurst(state, boss, 12, 200, 10);
      else aimedFan(state, boss, 5, 0.7, 280, 10);
    }
    if (boss.spawnT <= 0) {
      boss.spawnT = 7;
      summon(state, boss, 'emberling', 3);
    }
    // Tyrant charge: telegraph, then a heavy dash.
    if (!boss.charge && d < 320 && boss.attackT <= 0) {
      boss.charge = { t: 0.7, angle: Math.atan2(dy, dx) };
    } else if (boss.charge && boss.charge.t > 0) {
      boss.charge.t -= dt;
      boss.vx *= 0.5;
      boss.vy *= 0.5;
      if (boss.charge.t <= 0) {
        boss.vx = Math.cos(boss.charge.angle) * 520;
        boss.vy = Math.sin(boss.charge.angle) * 520;
        boss.charge.t = -0.5;
      }
    } else if (boss.charge && boss.charge.t < 0) {
      boss.charge.t -= dt;
      if (boss.charge.t < -0.5) {
        boss.charge = null;
        boss.attackT = 2.4;
      }
    }
  } else {
    // Hollow King: spiral barrage every tick of fireT, fans and summons by phase.
    if (boss.fireT <= 0) {
      boss.fireT = boss.phase === 3 ? 0.32 : 0.5;
      boss.spiralA += boss.phase === 3 ? 0.55 : 0.42;
      for (let i = 0; i < (boss.phase === 1 ? 2 : 3); i += 1) {
        const a = boss.spiralA + (i / 3) * Math.PI * 2;
        state.ebullets.push({
          x: boss.x,
          y: boss.y,
          vx: Math.cos(a) * 170,
          vy: Math.sin(a) * 170,
          damage: 9,
          radius: 5,
          life: 6,
          color: boss.color,
        });
      }
    }
    if (boss.phase >= 2 && boss.attackT <= 0) {
      boss.attackT = 3.2;
      aimedFan(state, boss, 7, 0.9, 300, 10);
    }
    if (boss.spawnT <= 0) {
      boss.spawnT = boss.phase === 3 ? 6 : 9;
      summon(state, boss, boss.phase === 3 ? 'spitter' : 'wisp', boss.phase === 3 ? 3 : 2);
    }
  }
}
