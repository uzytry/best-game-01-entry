// The shot-mode pilot: perfect information, perfect aim, and a danger field
// for movement. It plays the real rules — no cheats — so a staged victory is
// a victory the game genuinely allows. It also answers drafts by value.
import { WALL, WORLD } from './config.js';

const DIRS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 0.707, y: 0.707 },
  { x: -0.707, y: 0.707 },
  { x: 0.707, y: -0.707 },
  { x: -0.707, y: -0.707 },
];

const TARGET_VALUE = {
  king: 100,
  tyrant: 100,
  spawner: 60,
  spitter: 40,
  leech: 35,
  charger: 30,
  bulwark: 40,
  splitter: 20,
  wisp: 15,
  emberling: 10,
  mini: 5,
};

function pickTarget(state) {
  let best = null;
  let bestScore = -Infinity;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - state.player.x, e.y - state.player.y);
    const value = (TARGET_VALUE[e.kind] || 10) + (e.elite ? 15 : 0);
    let score = value * 10 - d;
    // Intercept anything closing on the Heart: a bulwark halfway there is
    // already the most dangerous thing in the arena. When the Heart is below
    // half, an attacker at its door outranks even the boss.
    if (e.target === 'heart') {
      const dh = Math.hypot(e.x - state.heart.x, e.y - state.heart.y);
      if (dh < 400) score += (400 - dh) * 1.5;
      if (state.heart.hp < state.heart.maxHp * 0.5 && dh < 250) score += 800;
    }
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

function dangerAt(state, x, y) {
  let danger = 0;
  const player = state.player;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    const near = Math.max(1, d - e.radius);
    let w = 900 / (near * near);
    if (e.kind === 'charger' && e.charge && e.charge.t > 0) w *= 4;
    if (e.boss) w *= 1.5;
    danger += w;
  }
  for (const s of state.ebullets) {
    const d = Math.hypot(s.x - x, s.y - y);
    danger += 500 / Math.max(1, d * d);
  }
  for (const g of state.geysers) {
    if (g.phase !== 'warn') continue;
    const d = Math.hypot(g.x - x, g.y - y);
    if (d < 110) danger += 3;
  }
  // Walls: stay out of the corners.
  const mx = Math.min(x - WALL, WORLD.w - WALL - x, y - WALL, WORLD.h - WALL - y);
  if (mx < 60) danger += (60 - mx) * 0.05;
  // The Heart is a no-go zone unless defending it.
  const dh = Math.hypot(state.heart.x - x, state.heart.y - y);
  if (dh < 70) danger += 0.4;
  return danger;
}

function pickMove(state) {
  const player = state.player;
  let best = DIRS[0];
  let bestScore = Infinity;
  for (const dir of DIRS) {
    const nx = player.x + dir.x * 60;
    const ny = player.y + dir.y * 60;
    let score = dangerAt(state, nx, ny);
    // Chase XP when the way is safe, and health when hurt. The XP pull is
    // strong: standing still in a corner starves the run of levels.
    for (const p of state.pickups) {
      const d = Math.hypot(p.x - nx, p.y - ny);
      if (p.kind === 'xp' && d < 280) score -= (280 - d) * 0.008;
      if (p.kind === 'health' && player.hp < player.maxHp * 0.55 && d < 260) score -= (260 - d) * 0.01;
      if (p.kind === 'shield' && d < 200) score -= (200 - d) * 0.004;
    }
    // A gentle pull toward the middle of the arena keeps the pilot from
    // hugging a corner for a whole wave.
    const dc = Math.hypot(nx - WORLD.w / 2, ny - WORLD.h / 2);
    score += dc * 0.0004;
    // Defend the Heart: when a heart-bound enemy is closing in, or the Heart
    // is already hurt, drift toward the attackers so the shots can reach them.
    const heartThreat = state.enemies.some((e) => !e.dead && e.target === 'heart'
      && Math.hypot(e.x - state.heart.x, e.y - state.heart.y) < 350);
    if (heartThreat || state.heart.hp < state.heart.maxHp * 0.6) {
      for (const e of state.enemies) {
        if (e.dead || e.target !== 'heart') continue;
        const d = Math.hypot(e.x - nx, e.y - ny);
        score -= Math.max(0, 350 - d) * 0.006;
      }
    }
    // Prefer movement over standing still when danger is near.
    if (dir.x === 0 && dir.y === 0) score += 0.15;
    if (score < bestScore) {
      bestScore = score;
      best = dir;
    }
  }
  return best;
}

function shouldDash(state) {
  const player = state.player;
  if (player.dashCd > 0) return false;
  let near = 0;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < 105) near += 1;
    if (e.kind === 'charger' && e.charge && e.charge.t > 0 && e.charge.t < 0.35 && d < 220) return true;
    if (e.boss && e.charge && e.charge.t > 0 && e.charge.t < 0.35 && d < 260) return true;
  }
  return near >= 3;
}

function shouldNova(state) {
  if (state.overdrive < 40) return false;
  const player = state.player;
  let near = 0;
  let nearWide = 0;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < 260) near += 1;
    if (d < 320) nearWide += 1;
  }
  if (state.boss && !state.boss.dead && Math.hypot(state.boss.x - player.x, state.boss.y - player.y) < 300) return true;
  if (near >= 6) return true;
  // Don't sit on a full meter: four enemies in range is enough.
  if (nearWide >= 4) return true;
  return false;
}

function pickWeapon(state, target) {
  const player = state.player;
  if (!target) return 0;
  // Mortar for clusters and bosses; lance for lines; scatter otherwise.
  let cluster = 0;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - target.x, e.y - target.y) < 130) cluster += 1;
  }
  if (target.boss || cluster >= 4) return player.weapon === 'mortar' ? 0 : 3;
  const a = Math.atan2(target.y - player.y, target.x - player.x);
  let lined = 0;
  for (const e of state.enemies) {
    if (e.dead || e === target) continue;
    const ea = Math.atan2(e.y - player.y, e.x - player.x);
    let diff = Math.abs(ea - a);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 0.12) lined += 1;
  }
  if (lined >= 2) return player.weapon === 'lance' ? 0 : 2;
  return player.weapon === 'scatter' ? 0 : 1;
}

const BOON_VALUE = {
  blades: 95, triplet: 92, phoenix: 90, bond: 88, dilation: 85, embers: 70, rapid: 68,
  vitality: 60, pierce: 62, ricochet: 60, lens: 58, frost: 55, wind: 65, mend: 55,
  core: 52, magnet: 40, boots: 42, barrel: 45, hide: 48, dash: 38,
};

export function draftValue(state, boon) {
  let v = BOON_VALUE[boon.id] || 40;
  if (boon.id === 'vitality' && state.player.hp < state.player.maxHp * 0.5) v += 30;
  if (boon.id === 'mend' && state.heart.hp < state.heart.maxHp * 0.5) v += 40;
  if (boon.id === 'blades' && (state.player.orbitals || 0) >= 3) v -= 40;
  if (boon.rarity === 'epic') v += 8;
  if (boon.rarity === 'rare') v += 4;
  return v;
}

export function decide(state) {
  const target = pickTarget(state);
  let aim = { x: state.player.x, y: state.player.y - 100 };
  if (target) {
    // Lead the target by its velocity over the bullet's flight time.
    const dist = Math.hypot(target.x - state.player.x, target.y - state.player.y);
    const flight = dist / 600;
    aim = { x: target.x + target.vx * flight, y: target.y + target.vy * flight };
  }
  const move = pickMove(state);
  let draftPick = -1;
  if (state.draft) {
    let bestV = -Infinity;
    state.draft.choices.forEach((b, i) => {
      const v = draftValue(state, b);
      if (v > bestV) {
        bestV = v;
        draftPick = i;
      }
    });
  }
  return {
    move,
    aim,
    dash: shouldDash(state),
    nova: shouldNova(state),
    weapon: pickWeapon(state, target),
    cycle: false,
    draftPick,
  };
}
