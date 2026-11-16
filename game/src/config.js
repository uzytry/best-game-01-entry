// EMBERFALL — tuning, palette and key bindings in one place. Every number the
// rest of the game balances against lives here, so a tweak never hides in logic.
export const STEP = 1 / 60;
export const WORLD = { w: 1280, h: 720 };
export const WALL = 26; // arena inset: walls sit this far inside the canvas edge
export const WAVES_TOTAL = 12;
export const BOSS_WAVE_MID = 6;
export const BOSS_WAVE_FINAL = 12;

export const PLAYER = {
  radius: 14,
  speed: 265,
  hp: 100,
  dashTime: 0.18,
  dashCooldown: 2.1,
  dashSpeed: 920,
  invulnAfterHit: 0.7,
  fireDelay: 0.12, // first shot after starting to hold aim
};

export const HEART = {
  x: WORLD.w / 2,
  y: WORLD.h / 2,
  radius: 26,
  hp: 150,
  regen: 2.5, // per second, only after REGEN_DELAY without damage
  regenDelay: 5,
};

// XP to go from `level` to `level + 1`.
export function xpNeed(level) {
  return 8 + level * 6;
}

export const COMBO = { window: 3.2, multPerKill: 0.08, multCap: 3 };
export const OVERDRIVE_NEED = 40;
export const NOVA = { radius: 270, damage: 130, invuln: 0.6 };

// Warm ember palette on a deep plum-charcoal night. Player and Heart read amber;
// enemies read violet, ash and bone so friend and foe never blur at a glance.
export const COLORS = {
  bg0: '#150e1a',
  bg1: '#1f1220',
  bg2: '#2a1626',
  wall: '#3d2436',
  wallGlow: '#6b3a4a',
  player: '#ffb347',
  playerCore: '#fff3c4',
  heart: '#ff8a3c',
  heartRing: '#ffd166',
  xp: '#7fe7c4',
  hp: '#ff5d73',
  shield: '#6fd3ff',
  text: '#f5e9d3',
  dim: '#b8a48e',
  gold: '#ffd166',
  epic: '#c792ff',
  rare: '#6fd3ff',
  common: '#e8dcc8',
};

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  dash: ['ShiftLeft', 'ShiftRight'],
  nova: ['KeyE', 'Space'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  restart: ['KeyR'],
  quit: ['KeyQ'],
  confirm: ['Enter', 'Space'],
  weapon1: ['Digit1'],
  weapon2: ['Digit2'],
  weapon3: ['Digit3'],
  cycle: ['KeyQ'],
};
