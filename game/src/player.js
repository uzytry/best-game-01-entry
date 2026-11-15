// The Keeper: the mote of light the player steers. It owns movement, the dash,
// aiming and firing, the orbiting sparks, the nova timer and the experience bar.
// The world drives it with input each step and reads its stats for the HUD.

import { FIELD, PLAYER, xpForLevel } from './config.js';
import { baseStats } from './upgrades.js';
import { clampToField } from './bullets.js';

export function createPlayer() {
  const stats = baseStats();
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    stats,
    level: 1,
    xp: 0,
    aimAngle: -Math.PI / 2,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldownLeft: 0,
    dashDirection: { x: 0, y: -1 },
    invulnerable: 0,
    novaTimer: 6,
    orbiterAngle: 0,
    secondWindUsed: false,
    moving: false,

    reset() {
      const fresh = baseStats();
      for (const key of Object.keys(fresh)) this.stats[key] = fresh[key];
      this.x = FIELD.width / 2;
      this.y = FIELD.height / 2;
      this.hp = this.stats.maxHp;
      this.level = 1;
      this.xp = 0;
      this.aimAngle = -Math.PI / 2;
      this.fireTimer = 0;
      this.dashTimer = 0;
      this.dashCooldownLeft = 0;
      this.invulnerable = 0;
      this.novaTimer = 6;
      this.orbiterAngle = 0;
      this.secondWindUsed = false;
      this.moving = false;
    },

    xpNeeded() {
      return xpForLevel(this.level);
    },

    // Gain experience; returns how many levels were gained (usually 0 or 1).
    gainXp(amount) {
      this.xp += amount;
      let gained = 0;
      while (this.xp >= this.xpNeeded()) {
        this.xp -= this.xpNeeded();
        this.level += 1;
        gained += 1;
      }
      return gained;
    },

    // The positions of the orbiting sparks, equally spaced on a ring around the Keeper.
    orbiterPositions() {
      const positions = [];
      const ring = this.radius + 26;
      for (let i = 0; i < this.stats.orbiters; i += 1) {
        const angle = this.orbiterAngle + (i * Math.PI * 2) / this.stats.orbiters;
        positions.push({ x: this.x + Math.cos(angle) * ring, y: this.y + Math.sin(angle) * ring });
      }
      return positions;
    },

    // Move, dash and aim. Returns true when the dash was just triggered.
    move(dt, direction, aim, wantDash) {
      this.moving = direction.x !== 0 || direction.y !== 0;
      this.aimAngle = Math.atan2(aim.y - this.y, aim.x - this.x);
      if (this.dashCooldownLeft > 0) this.dashCooldownLeft -= dt;
      if (this.invulnerable > 0) this.invulnerable -= dt;
      this.orbiterAngle += dt * 3.2;

      let dashed = false;
      if (wantDash && this.dashCooldownLeft <= 0 && this.dashTimer <= 0) {
        this.dashTimer = PLAYER.dashTime;
        this.dashCooldownLeft = this.stats.dashCooldown;
        // Dash where the Keeper is moving, or where it aims when standing still.
        this.dashDirection = this.moving ? direction : { x: Math.cos(this.aimAngle), y: Math.sin(this.aimAngle) };
        this.invulnerable = Math.max(this.invulnerable, PLAYER.dashTime + 0.08);
        dashed = true;
      }
      if (this.dashTimer > 0) {
        this.dashTimer -= dt;
        this.x += this.dashDirection.x * PLAYER.dashSpeed * dt;
        this.y += this.dashDirection.y * PLAYER.dashSpeed * dt;
      } else {
        this.x += direction.x * this.stats.speed * dt;
        this.y += direction.y * this.stats.speed * dt;
      }
      clampToField(this, FIELD, this.radius);
      return dashed;
    },

    // Fire a volley when the trigger is held and the interval has passed.
    // Returns the bolt angles to spawn, or an empty list.
    fire(dt, firing) {
      this.fireTimer -= dt;
      if (!firing || this.fireTimer > 0) return [];
      this.fireTimer = this.stats.fireInterval;
      const count = this.stats.projectiles;
      const spread = 0.11; // radians between neighbouring bolts
      const angles = [];
      for (let i = 0; i < count; i += 1) {
        angles.push(this.aimAngle + (i - (count - 1) / 2) * spread);
      }
      return angles;
    },

    // The nova countdown. Returns true on the step the nova fires.
    tickNova(dt) {
      if (this.stats.novaLevel === 0) return false;
      this.novaTimer -= dt;
      if (this.novaTimer <= 0) {
        this.novaTimer = 6;
        return true;
      }
      return false;
    },

    // Take a hit. Returns false when the hit was ignored (invulnerable or dashing).
    // Second Wind revives the Keeper once instead of letting it fall.
    hurt(amount) {
      if (this.invulnerable > 0) return false;
      this.hp -= amount;
      this.invulnerable = PLAYER.hurtInvulnerable;
      if (this.hp <= 0 && this.stats.secondWind && !this.secondWindUsed) {
        this.secondWindUsed = true;
        this.hp = Math.floor(this.stats.maxHp / 2);
        this.invulnerable = 2;
        return 'revived';
      }
      return true;
    },

    heal(amount) {
      this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    },

    get dead() {
      return this.hp <= 0;
    },
  };
}
