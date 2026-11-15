// LUMEN DRIFT — every tuning number lives here, so the rest of the game reads like
// a description of the rules instead of a pile of magic constants. The arena is a fixed
// logical field (1280x720) that the canvas scales to fit the window, so the game plays
// identically at any window size and every screenshot is the same frame.

export const STEP = 1 / 60;
export const FIELD = { width: 1280, height: 720 };

export const BEST_KEY = 'lumendrift.best';
export const BEST_WAVE_KEY = 'lumendrift.bestwave';
export const WINS_KEY = 'lumendrift.wins';
export const MUTED_KEY = 'lumendrift.muted';

// The Keeper: a mote of living light. Speed in px/s, damage per bolt, fire interval in s.
export const PLAYER = {
  radius: 14,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.2,
  bulletSpeed: 640,
  bulletDamage: 12,
  bulletLife: 0.85,
  bulletRadius: 5,
  magnetRadius: 90,
  dashSpeed: 780,
  dashTime: 0.16,
  dashCooldown: 2.4,
  hurtInvulnerable: 0.6,
  hurtKnockback: 260,
};

// One kind of gloom-spawn. hp and damage scale with the wave (see scaleForWave);
// score is the base kill score before the combo multiplier.
export const ENEMY_KINDS = {
  wisp: {
    name: 'Gloomwisp', radius: 13, speed: 78, hp: 22, damage: 10, score: 10, orbs: 1,
    color: '#8f7bff', core: '#c9bfff',
  },
  darter: {
    name: 'Darter', radius: 12, speed: 120, hp: 18, damage: 12, score: 15, orbs: 1,
    color: '#ff7ad9', core: '#ffc2ec',
  },
  spitter: {
    name: 'Spite', radius: 16, speed: 62, hp: 40, damage: 8, score: 25, orbs: 2,
    color: '#7dffb0', core: '#d2ffe2',
  },
  brute: {
    name: 'Hulk', radius: 26, speed: 46, hp: 130, damage: 22, score: 50, orbs: 4,
    color: '#ffb14d', core: '#ffe1b0',
  },
  splitter: {
    name: 'Mote-mother', radius: 19, speed: 66, hp: 60, damage: 14, score: 40, orbs: 3,
    color: '#4dd8ff', core: '#c2f1ff',
  },
};

export const ELITE = {
  hpScale: 1.9, sizeScale: 1.35, scoreScale: 3, orbsBonus: 3, fromWave: 4, chance: 0.12,
};

// The Gloom Herald, the wave-10 boss. Two phases: below half health it fires faster,
// summons darters instead of wisps, and charges the player.
export const BOSS = {
  name: 'The Gloom Herald',
  radius: 52, speed: 52, hp: 2600, damage: 25, score: 1000, orbs: 20,
  color: '#ff5d73', core: '#ffd0d8',
  radialInterval: 4.0, radialCount: 12, radialSpeed: 170,
  spreadInterval: 2.6, spreadCount: 5, spreadSpeed: 240,
  summonInterval: 8.0, summonCount: 3,
  chargeInterval: 7.0, chargeSpeed: 420, chargeTime: 0.7,
};

export const ENEMY_BULLET = { radius: 6, life: 5 };

// How much of the arena's edge the spawn points keep clear of the player.
export const SPAWN_CLEAR = 260;
// The most enemies alive at once; the director holds the rest in its queue.
export const MAX_ALIVE = 42;

// A wave is a list of spawn groups plus the pacing between individual spawns.
export const WAVES = [
  { groups: [{ kind: 'wisp', count: 10 }], interval: 1.15 },
  { groups: [{ kind: 'wisp', count: 12 }, { kind: 'darter', count: 4 }], interval: 1.05 },
  { groups: [{ kind: 'wisp', count: 10 }, { kind: 'darter', count: 6 }, { kind: 'spitter', count: 3 }], interval: 0.95 },
  { groups: [{ kind: 'wisp', count: 12 }, { kind: 'darter', count: 6 }, { kind: 'spitter', count: 4 }, { kind: 'brute', count: 2 }], interval: 0.9 },
  { groups: [{ kind: 'wisp', count: 14 }, { kind: 'darter', count: 6 }, { kind: 'spitter', count: 5 }, { kind: 'brute', count: 2 }, { kind: 'splitter', count: 2 }], interval: 0.85 },
  { groups: [{ kind: 'wisp', count: 16 }, { kind: 'darter', count: 8 }, { kind: 'spitter', count: 6 }, { kind: 'brute', count: 3 }, { kind: 'splitter', count: 2 }], interval: 0.8 },
  { groups: [{ kind: 'wisp', count: 18 }, { kind: 'darter', count: 8 }, { kind: 'spitter', count: 6 }, { kind: 'brute', count: 4 }, { kind: 'splitter', count: 3 }], interval: 0.75 },
  { groups: [{ kind: 'wisp', count: 20 }, { kind: 'darter', count: 10 }, { kind: 'spitter', count: 8 }, { kind: 'brute', count: 4 }, { kind: 'splitter', count: 4 }], interval: 0.7 },
  { groups: [{ kind: 'wisp', count: 22 }, { kind: 'darter', count: 10 }, { kind: 'spitter', count: 8 }, { kind: 'brute', count: 5 }, { kind: 'splitter', count: 4 }], interval: 0.65 },
  { groups: [], interval: 1, boss: true },
];

export const WAVE_COUNT = WAVES.length;
export const WAVE_BREATHER = 2.2;
export const WAVE_CLEAR_BONUS = 100;

// XP: orbs are worth 1 each; the bar grows a little every level.
export function xpForLevel(level) {
  return 12 + (level - 1) * 7;
}

// Enemy stat scaling per wave (wave is 1-based).
export function scaleForWave(wave) {
  return {
    hp: 1 + 0.13 * (wave - 1),
    speed: Math.min(1.35, 1 + 0.02 * (wave - 1)),
    damage: 1 + 0.07 * (wave - 1),
  };
}

// Combo: kills chained within the window raise the score multiplier, one step at a time.
export const COMBO_WINDOW = 3;
export const COMBO_MAX = 5;

// Gloom pools left by a dying splitter: damage per second while the Keeper stands in one.
export const POOL = { radius: 54, ttl: 4, dps: 14 };

// Hearts: a small chance from any kill, guaranteed from elites and the boss.
export const HEART_DROP_CHANCE = 0.03;
export const HEART_HEAL = 25;

// The palette: deep indigo night, warm lantern gold for the player, cold hues for the gloom.
export const COLORS = {
  skyTop: '#0a0a24',
  skyBottom: '#141036',
  player: '#ffd97a',
  playerCore: '#fff6d8',
  bullet: '#ffe9a8',
  orb: '#9be8ff',
  heart: '#ff8fa3',
  text: '#f2ecff',
  dim: '#a49fd0',
  gold: '#ffd97a',
  danger: '#ff5d73',
};
