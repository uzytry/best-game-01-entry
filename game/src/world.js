// The world: everything that lives in the arena and how it interacts. One fixed
// step advances the Keeper, the wave director, the enemies, the bullets, the
// pickups and the particles, resolves every collision, and reports what happened
// as an event bitmask the game loop reacts to (a draft to open, a wave cleared,
// the run won or lost). The world never draws and never reads input directly —
// it is given the input state each step, which is also what lets the screenshot
// scenes and the playtest bot drive it.

import { COMBO_MAX, COMBO_WINDOW, FIELD, HEART_DROP_CHANCE, HEART_HEAL, PLAYER, POOL, WAVE_CLEAR_BONUS, WAVE_COUNT } from './config.js';
import { createPlayer } from './player.js';
import { createEnemies } from './enemies.js';
import { createBullets, circlesHit } from './bullets.js';
import { createPickups } from './pickups.js';
import { createParticles } from './particles.js';
import { createWaves } from './waves.js';
import { applyBoon, BOONS, drawDraft } from './upgrades.js';

export const EVENT_LEVEL_UP = 1;
export const EVENT_WAVE_CLEAR = 2;
export const EVENT_GAME_OVER = 4;
export const EVENT_VICTORY = 8;
export const EVENT_BOSS = 16;
export const EVENT_HURT = 32;
export const EVENT_REVIVED = 64;

const NOVA_RADIUS = 170;

export function createWorld(random) {
  const player = createPlayer();
  const enemies = createEnemies(random);
  const bullets = createBullets();
  const pickups = createPickups(random);
  const particles = createParticles(random);
  const waves = createWaves(random);
  const spawnQueue = [];

  const world = {
    player,
    enemies,
    bullets,
    pickups,
    particles,
    waves,
    pools: [],
    wave: 1,
    score: 0,
    kills: 0,
    shotsFired: 0,
    shotsHit: 0,
    combo: 0,
    comboTimer: 0,
    time: 0,
    phase: 'fighting', // 'fighting' | 'breather' | 'won' | 'lost'
    banner: '',
    bannerTimer: 0,
    hurtFlash: 0,
    draftChoices: [],
    draftPending: 0,
    boonLevels: {},
    boss: null,

    get comboMultiplier() {
      return Math.min(COMBO_MAX, 1 + Math.floor(this.combo / 3));
    },

    reset() {
      player.reset();
      enemies.clear();
      bullets.clear();
      pickups.clear();
      particles.clear();
      this.pools.length = 0;
      this.wave = 1;
      this.score = 0;
      this.kills = 0;
      this.shotsFired = 0;
      this.shotsHit = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.time = 0;
      this.phase = 'fighting';
      this.banner = 'WAVE 1';
      this.bannerTimer = 2;
      this.hurtFlash = 0;
      this.draftChoices = [];
      this.draftPending = 0;
      this.boonLevels = {};
      this.boss = null;
      waves.startWave(1);
    },

    // Staging for the screenshot scenes: a fresh run at a chosen wave with a
    // chosen loadout, as if a Keeper had fought its way there. The fight that
    // follows is played for real by the autopilot.
    stageForShot(wave, boonIds, score, kills, time) {
      this.reset();
      for (const id of boonIds) {
        const boon = BOONS.find((item) => item.id === id);
        if (!boon) continue;
        applyBoon(boon, player.stats, player);
        this.boonLevels[id] = (this.boonLevels[id] ?? 0) + 1;
      }
      player.hp = player.stats.maxHp;
      player.level = 1 + boonIds.length;
      this.score = score;
      this.kills = kills;
      this.time = time;
      this.wave = wave;
      this.phase = 'fighting';
      this.banner = wave === WAVE_COUNT ? 'THE GLOOM HERALD' : `WAVE ${wave}`;
      this.bannerTimer = 2;
      waves.startWave(wave);
    },

    beginDraft() {
      this.draftChoices = drawDraft(random, this.boonLevels);
    },

    chooseDraft(index) {
      const boon = this.draftChoices[index];
      if (!boon) return;
      applyBoon(boon, player.stats, player);
      if (boon.id === 'radiance') this.score += 500;
      else this.boonLevels[boon.id] = (this.boonLevels[boon.id] ?? 0) + 1;
      this.draftPending -= 1;
      if (this.draftPending > 0) this.beginDraft();
      else this.draftChoices = [];
    },

    damageEnemy(enemy, amount, knockX = 0, knockY = 0) {
      enemy.hp -= amount;
      enemy.flash = 0.08;
      enemy.kx += knockX;
      enemy.ky += knockY;
      particles.sparks(enemy.x, enemy.y, enemy.core, 3);
      particles.text(enemy.x, enemy.y - enemy.radius - 6, Math.round(amount), '#ffe9a8', 13);
    },

    killEnemy(enemy) {
      // A bolt still in flight may strike an enemy the nova already felled;
      // the kill is only counted once, when it leaves the list.
      if (!enemies.list.includes(enemy)) return;
      enemies.remove(enemy);
      this.kills += 1;
      this.combo += 1;
      this.comboTimer = COMBO_WINDOW;
      const gained = enemy.score * this.comboMultiplier;
      this.score += gained;
      particles.text(enemy.x, enemy.y - enemy.radius - 18, `+${gained}`, '#ffd97a', 15);
      particles.burst(enemy.x, enemy.y, enemy.color, enemy.boss ? 60 : enemy.elite ? 26 : 14, enemy.boss ? 320 : 200);
      particles.ring(enemy.x, enemy.y, enemy.color, enemy.radius * 2.4);
      if (enemy.boss) particles.shake(10, 0.5);
      else if (enemy.elite) particles.shake(4, 0.2);
      for (let i = 0; i < enemy.orbs; i += 1) pickups.dropOrb(enemy.x, enemy.y);
      if (enemy.boss || enemy.elite) pickups.dropHeart(enemy.x, enemy.y);
      else if (random.chance(HEART_DROP_CHANCE)) pickups.dropHeart(enemy.x, enemy.y);
      if (enemy.kind === 'splitter') {
        // A dying Mote-mother bursts into wisps and leaves a gloom pool behind.
        for (let i = 0; i < 3; i += 1) {
          const angle = (i * Math.PI * 2) / 3;
          spawnQueue.push({ kind: 'wisp', x: enemy.x + Math.cos(angle) * 20, y: enemy.y + Math.sin(angle) * 20 });
        }
        this.pools.push({ x: enemy.x, y: enemy.y, radius: POOL.radius, ttl: POOL.ttl });
      }
    },

    hurtPlayer(amount, fromX, fromY, audio) {
      const result = player.hurt(amount);
      if (result === false) return 0;
      this.hurtFlash = 0.35;
      this.combo = 0;
      this.comboTimer = 0;
      const dx = player.x - fromX;
      const dy = player.y - fromY;
      const distance = Math.hypot(dx, dy) || 1;
      player.x += (dx / distance) * 18;
      player.y += (dy / distance) * 18;
      particles.burst(player.x, player.y, '#ff5d73', 16, 220);
      particles.shake(7, 0.3);
      if (audio) audio.hurt();
      if (result === 'revived') {
        particles.ring(player.x, player.y, '#ffd97a', 160);
        return EVENT_REVIVED;
      }
      return EVENT_HURT;
    },

    // One fixed step. `input` is { direction, aim, firing, dash }.
    step(dt, input, audio) {
      let events = 0;
      this.time += dt;
      if (this.bannerTimer > 0) this.bannerTimer -= dt;
      if (this.hurtFlash > 0) this.hurtFlash -= dt;
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
      }

      // The Keeper moves, dashes, aims and fires.
      const dashed = player.move(dt, input.direction, input.aim, input.dash);
      if (dashed) {
        particles.ring(player.x, player.y, '#9be8ff', 44);
        if (audio) audio.dash();
      }
      const angles = player.fire(dt, input.firing);
      for (const angle of angles) {
        this.shotsFired += 1;
        bullets.firePlayer(
          player.x + Math.cos(angle) * (player.radius + 4),
          player.y + Math.sin(angle) * (player.radius + 4),
          angle, player.stats.bulletSpeed, player.stats.damage,
          player.stats.bulletLife, PLAYER.bulletRadius, player.stats.pierce,
        );
      }
      if (angles.length > 0 && audio) audio.shoot();

      // Nova: a burst of light around the Keeper.
      if (player.tickNova(dt)) {
        const radius = NOVA_RADIUS + player.stats.novaLevel * 30;
        const damage = 30 + player.stats.novaLevel * 25;
        particles.ring(player.x, player.y, '#ffd97a', radius);
        particles.shake(4, 0.2);
        if (audio) audio.nova();
        for (const enemy of [...enemies.list]) {
          if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < radius + enemy.radius) {
            this.damageEnemy(enemy, damage);
            if (enemy.hp <= 0) this.killEnemy(enemy);
          }
        }
      }

      // Orbiting sparks sear what they touch (each enemy at most every 0.35 s).
      for (const spark of player.orbiterPositions()) {
        for (const enemy of [...enemies.list]) {
          if (enemy.sparkCooldown > 0) continue;
          if (circlesHit(spark.x, spark.y, 14, enemy.x, enemy.y, enemy.radius)) {
            enemy.sparkCooldown = 0.35;
            this.damageEnemy(enemy, 10 + player.stats.damage * 0.5);
            if (enemy.hp <= 0) this.killEnemy(enemy);
          }
        }
      }

      // The director: spawns, the boss, the breather between waves.
      if (this.phase === 'fighting') {
        const spawn = waves.update(dt, this.wave, enemies.list.length);
        if (spawn === 'boss') {
          this.boss = enemies.spawnBoss(this.wave);
          this.banner = 'THE GLOOM HERALD';
          this.bannerTimer = 2.5;
          events |= EVENT_BOSS;
        } else if (spawn) {
          enemies.spawnAtEdge(spawn, this.wave, player);
        }
      } else if (this.phase === 'breather') {
        waves.update(dt, this.wave, 0);
        if (waves.breatherLeft <= 0) {
          this.wave += 1;
          this.phase = 'fighting';
          this.banner = this.wave === WAVE_COUNT ? 'THE GLOOM HERALD' : `WAVE ${this.wave}`;
          this.bannerTimer = 2;
          waves.startWave(this.wave);
          if (audio) audio.waveStart();
        }
      }

      enemies.update(dt, player, bullets, spawnQueue);
      while (spawnQueue.length > 0) {
        const queued = spawnQueue.shift();
        enemies.spawnAt(queued.kind, this.wave, queued.x, queued.y);
      }

      // Soft separation so the horde does not collapse into one stack.
      const list = enemies.list;
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i];
          const b = list[j];
          if (a.boss || b.boss) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy);
          const min = a.radius + b.radius;
          if (distance > 0 && distance < min) {
            const push = ((min - distance) / 2) * 0.5;
            const ux = dx / distance;
            const uy = dy / distance;
            a.x -= ux * push;
            a.y -= uy * push;
            b.x += ux * push;
            b.y += uy * push;
          }
        }
      }

      bullets.update(dt, FIELD);

      // Bolts against the gloom.
      for (const bullet of [...bullets.player]) {
        let consumed = false;
        for (const enemy of [...enemies.list]) {
          if (bullet.hit.has(enemy)) continue;
          if (circlesHit(bullet.x, bullet.y, bullet.radius, enemy.x, enemy.y, enemy.radius)) {
            this.shotsHit += 1;
            bullet.hit.add(enemy);
            const kx = (bullet.vx / PLAYER.bulletSpeed) * 160;
            const ky = (bullet.vy / PLAYER.bulletSpeed) * 160;
            this.damageEnemy(enemy, bullet.damage, kx, ky);
            if (audio) audio.enemyHit();
            if (enemy.hp <= 0) {
              if (audio) audio.enemyDie();
              const wasBoss = enemy.boss;
              this.killEnemy(enemy);
              if (wasBoss) {
                this.boss = null;
                this.phase = 'won';
                // The remaining gloom dissolves in the dawn: a last burst each,
                // no score — the victory is the Herald's fall, not the mop-up.
                for (const leftover of [...enemies.list]) {
                  particles.burst(leftover.x, leftover.y, leftover.color, 12, 200);
                  enemies.remove(leftover);
                }
                bullets.clear();
                events |= EVENT_VICTORY;
              }
            }
            if (bullet.pierce > 0) {
              bullet.pierce -= 1;
            } else {
              consumed = true;
              break;
            }
          }
        }
        if (consumed) {
          const index = bullets.player.indexOf(bullet);
          if (index !== -1) bullets.player.splice(index, 1);
        }
      }

      // Enemy orbs against the Keeper.
      for (const bullet of [...bullets.enemy]) {
        if (circlesHit(bullet.x, bullet.y, bullet.radius, player.x, player.y, player.radius)) {
          const index = bullets.enemy.indexOf(bullet);
          if (index !== -1) bullets.enemy.splice(index, 1);
          events |= this.hurtPlayer(bullet.damage, bullet.x, bullet.y, audio);
        }
      }

      // Contact with the gloom.
      for (const enemy of [...enemies.list]) {
        if (circlesHit(enemy.x, enemy.y, enemy.radius, player.x, player.y, player.radius)) {
          events |= this.hurtPlayer(enemy.damage, enemy.x, enemy.y, audio);
          // The enemy recoils a little so one touch is not a dozen.
          enemy.x -= (player.x - enemy.x) * 0.1;
          enemy.y -= (player.y - enemy.y) * 0.1;
        }
      }

      // Gloom pools burn while the Keeper stands in them.
      for (let i = this.pools.length - 1; i >= 0; i -= 1) {
        const pool = this.pools[i];
        pool.ttl -= dt;
        if (pool.ttl <= 0) {
          this.pools.splice(i, 1);
          continue;
        }
        if (Math.hypot(player.x - pool.x, player.y - pool.y) < pool.radius && player.invulnerable <= 0) {
          player.hp -= POOL.dps * dt;
          this.hurtFlash = Math.max(this.hurtFlash, 0.15);
          if (player.hp <= 0 && player.stats.secondWind && !player.secondWindUsed) {
            player.secondWindUsed = true;
            player.hp = Math.floor(player.stats.maxHp / 2);
            player.invulnerable = 2;
            events |= EVENT_REVIVED;
          }
        }
      }

      // Pickups: starlight orbs and hearts.
      pickups.update(dt, player, player.stats.magnetRadius);
      for (let i = pickups.orbs.length - 1; i >= 0; i -= 1) {
        const orb = pickups.orbs[i];
        if (circlesHit(orb.x, orb.y, 8, player.x, player.y, player.radius + 6)) {
          pickups.orbs.splice(i, 1);
          const gained = player.gainXp(orb.value);
          if (gained > 0) {
            this.draftPending += gained;
            events |= EVENT_LEVEL_UP;
          }
          particles.sparks(player.x, player.y, '#9be8ff', 2);
          if (audio) audio.pickup(this.combo);
        }
      }
      for (let i = pickups.hearts.length - 1; i >= 0; i -= 1) {
        const heart = pickups.hearts[i];
        if (circlesHit(heart.x, heart.y, 10, player.x, player.y, player.radius + 6)) {
          pickups.hearts.splice(i, 1);
          player.heal(HEART_HEAL);
          particles.text(player.x, player.y - 24, `+${HEART_HEAL}`, '#ff8fa3', 16);
          particles.ring(player.x, player.y, '#ff8fa3', 50);
        }
      }

      particles.update(dt);

      // The wave is cleared when the queue is spent, nothing is left alive and
      // no splitter's children are still waiting to hatch.
      if (this.phase === 'fighting' && waves.cleared && enemies.list.length === 0 && spawnQueue.length === 0 && this.wave < WAVE_COUNT) {
        this.score += WAVE_CLEAR_BONUS * this.wave;
        this.phase = 'breather';
        this.banner = `WAVE ${this.wave} CLEARED  +${WAVE_CLEAR_BONUS * this.wave}`;
        this.bannerTimer = 2;
        waves.startBreather();
        events |= EVENT_WAVE_CLEAR;
      }

      if (player.dead && this.phase !== 'won') {
        this.phase = 'lost';
        particles.burst(player.x, player.y, '#ffd97a', 60, 320);
        events |= EVENT_GAME_OVER;
      }

      return events;
    },
  };

  return world;
}
