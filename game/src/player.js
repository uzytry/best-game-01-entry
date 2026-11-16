// The Ember Warden: movement, dash with i-frames, aim, auto-fire, weapon
// switching, shields, revives and XP. Damage comes in through hurtPlayer, which
// honours shields, armour, invulnerability and the two revive boons.
import { OVERDRIVE_NEED, PLAYER, WALL, WORLD, xpNeed } from './config.js';
import { WEAPON_KEYS, fireWeapon, updateOrbitals } from './weapons.js';
import { addFloater, spawnBurst } from './particles.js';

export function createPlayer() {
  return {
    x: WORLD.w / 2,
    y: WORLD.h / 2 + 150,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.hp,
    maxHp: PLAYER.hp,
    shield: 0,
    speedMul: 1,
    damageMul: 1,
    fireRateMul: 1,
    bulletSpeedMul: 1,
    dashCdMul: 1,
    magnetR: 110,
    armor: 0,
    pierce: 0,
    bounce: 0,
    crit: 0.05,
    orbitals: 0,
    orbitAngle: 0,
    orbitHits: new Set(),
    extraProjectiles: 0,
    slowOnHit: false,
    revive: false,
    phoenix: false,
    overdriveMul: 1,
    weapon: 'scatter',
    fireT: 0,
    dashT: 0,
    dashCd: 0,
    dashDirX: 0,
    dashDirY: -1,
    invulnT: 0,
    muzzle: 0,
    hurtFlash: 0,
    dead: false,
  };
}

export function hurtPlayer(state, amount, fromX, fromY) {
  const player = state.player;
  if (player.dead || player.invulnT > 0 || player.dashT > 0) return;
  let remaining = amount;
  if (player.shield > 0) {
    const absorbed = Math.min(player.shield, remaining);
    player.shield -= absorbed;
    remaining -= absorbed;
    addFloater(state, player.x, player.y - 26, 'SHIELD', '#6fd3ff');
  }
  if (remaining > 0) {
    remaining = Math.round(remaining * (1 - (player.armor || 0)));
    player.hp -= remaining;
    state.stats.damageTaken += remaining;
    addFloater(state, player.x, player.y - 26, `-${remaining}`, '#ff5d73', true);
  }
  player.invulnT = PLAYER.invulnAfterHit;
  player.hurtFlash = 0.25;
  state.shake = Math.max(state.shake, 7);
  state.hitStop = Math.max(state.hitStop, 0.045);
  const dx = player.x - fromX;
  const dy = player.y - fromY;
  const d = Math.hypot(dx, dy) || 1;
  player.vx += (dx / d) * 260;
  player.vy += (dy / d) * 260;
  spawnBurst(state, player.x, player.y, 10, '#ff5d73', 220, 0.4, 3);
  if (state.audio) state.audio.hurt();
  if (player.hp <= 0) {
    if (player.phoenix) {
      player.phoenix = false;
      player.hp = player.maxHp;
      player.invulnT = 2;
      addFloater(state, player.x, player.y - 40, 'PHOENIX REBIRTH!', '#ffd166', true);
      state.fireNova(true);
    } else if (player.revive) {
      player.revive = false;
      player.hp = Math.round(player.maxHp * 0.5);
      player.invulnT = 2;
      addFloater(state, player.x, player.y - 40, 'SECOND WIND!', '#7fe7c4', true);
    } else {
      player.hp = 0;
      player.dead = true;
    }
  }
}

export function gainXp(state, amount) {
  state.xp += amount;
  while (state.xp >= xpNeed(state.level)) {
    state.xp -= xpNeed(state.level);
    state.level += 1;
    state.pendingLevels += 1;
  }
}

export function updatePlayer(state, input, dt) {
  const player = state.player;
  if (player.dead) return;
  // Timers.
  if (player.invulnT > 0) player.invulnT -= dt;
  if (player.fireT > 0) player.fireT -= dt;
  if (player.dashCd > 0) player.dashCd -= dt;
  if (player.muzzle > 0) player.muzzle -= dt;
  if (player.hurtFlash > 0) player.hurtFlash -= dt;
  // Weapon switching.
  if (input.weapon >= 1 && input.weapon <= 3) {
    const key = WEAPON_KEYS[input.weapon - 1];
    if (key !== player.weapon) {
      player.weapon = key;
      player.fireT = Math.max(player.fireT, 0.12);
      if (state.audio) state.audio.click();
    }
  } else if (input.cycle) {
    const idx = WEAPON_KEYS.indexOf(player.weapon);
    player.weapon = WEAPON_KEYS[(idx + 1) % WEAPON_KEYS.length];
    player.fireT = Math.max(player.fireT, 0.12);
  }
  // Dash: edge-triggered, toward movement (or aim when standing still).
  if (input.dash && !state.prevDash && player.dashCd <= 0 && player.dashT <= 0) {
    player.dashT = PLAYER.dashTime;
    player.dashCd = PLAYER.dashCooldown * player.dashCdMul;
    const moving = Math.hypot(input.move.x, input.move.y) > 0.1;
    if (moving) {
      player.dashDirX = input.move.x;
      player.dashDirY = input.move.y;
    } else {
      const a = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
      player.dashDirX = Math.cos(a);
      player.dashDirY = Math.sin(a);
    }
    state.stats.dashes += 1;
    if (state.audio) state.audio.dash();
    spawnBurst(state, player.x, player.y, 8, '#ffd166', 160, 0.3, 2.5);
  }
  state.prevDash = input.dash;
  // Nova: edge-triggered when the meter is full.
  if (input.nova && !state.prevNova) {
    if (state.overdrive >= OVERDRIVE_NEED) state.fireNova(false);
  }
  state.prevNova = input.nova;
  // Movement: dash overrides, otherwise accelerate toward the input vector.
  if (player.dashT > 0) {
    player.dashT -= dt;
    player.vx = player.dashDirX * PLAYER.dashSpeed;
    player.vy = player.dashDirY * PLAYER.dashSpeed;
    spawnBurst(state, player.x, player.y, 1, '#ffd166', 40, 0.25, 3);
  } else {
    const speed = PLAYER.speed * player.speedMul;
    const tx = input.move.x * speed;
    const ty = input.move.y * speed;
    const k = Math.min(1, dt * 14);
    player.vx += (tx - player.vx) * k;
    player.vy += (ty - player.vy) * k;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.x = Math.max(WALL + PLAYER.radius, Math.min(WORLD.w - WALL - PLAYER.radius, player.x));
  player.y = Math.max(WALL + PLAYER.radius, Math.min(WORLD.h - WALL - PLAYER.radius, player.y));
  // Aim and auto-fire.
  player.angle = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
  if (player.fireT <= 0) {
    fireWeapon(state, player.weapon, input.aim.x, input.aim.y);
  }
  updateOrbitals(state, dt);
}
