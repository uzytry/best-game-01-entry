// The world: one state object, one fixed step, and the wiring that lets the
// modules talk to each other without import cycles (damage, hurt, XP, nova,
// boss hooks all hang off `state`, assigned here). The step returns an event
// bitmask the main loop turns into screen changes and announcements.
import { BOSS_WAVE_FINAL, OVERDRIVE_NEED, STEP, WAVES_TOTAL, xpNeed } from './config.js';
import { createPlayer, gainXp, hurtPlayer, updatePlayer } from './player.js';
import { createHeart, damageHeart, updateHeart } from './heart.js';
import { createCombo, spendOverdrive, updateCombo } from './combo.js';
import { damageEnemy, updateEnemies } from './enemies.js';
import { updateBoss } from './bosses.js';
import { updateBullets, updateEnemyBullets } from './bullets.js';
import { updateParticles, spawnBurst, spawnRing } from './particles.js';
import { clearAllEnemies, updatePickups } from './pickups.js';
import { startWave, updateWaves } from './waves.js';
import { updateGeysers } from './hazards.js';
import { applyBoon, rollDraft } from './upgrades.js';

export const EV_HIT = 1;
export const EV_OVER = 2;
export const EV_WIN = 4;
export const EV_LEVEL = 8;
export const EV_WAVE = 16;
export const EV_NOVA = 32;
export const EV_BOSS = 64;

export function createWorld(rng) {
  const state = {
    rng,
    audio: null,
    time: 0,
    wave: 0,
    waveTime: 0,
    waveState: 'intro',
    waveBanner: 0,
    waveBonus: 0,
    bossIntro: 0,
    bossPhaseFlash: 0,
    phase: 'title',
    score: 0,
    kills: 0,
    level: 1,
    xp: 0,
    pendingLevels: 0,
    draft: null,
    boons: [],
    takenOnce: new Set(),
    player: createPlayer(),
    heart: createHeart(),
    heartRegenMul: 1,
    heartArmor: 0,
    heartAlarm: 0,
    heartDead: false,
    enemies: [],
    bullets: [],
    ebullets: [],
    particles: [],
    floaters: [],
    rings: [],
    pickups: [],
    geysers: [],
    spawnQueue: [],
    spawnT: 0,
    spawnInterval: 1,
    eliteChance: 0,
    boss: null,
    bossSpawned: false,
    bossTimer: 0,
    objective: null,
    objectiveDone: false,
    stormT: 0,
    geyserT: 2,
    combo: createCombo(),
    overdrive: 0,
    magnetT: 0,
    slowT: 0,
    enemySlowMul: 1,
    orbitHitTimers: [],
    shake: 0,
    hitStop: 0,
    cause: null,
    prevDash: false,
    prevNova: false,
    stats: { shots: 0, hits: 0, damageDealt: 0, damageTaken: 0, dashes: 0, novas: 0, pickups: 0 },
  };

  // Cross-module calls, wired here so no module imports another's internals.
  state.damageEnemy = (enemy, amount, kx, ky, crit) => damageEnemy(state, enemy, amount, kx, ky, crit);
  state.hurtPlayer = (amount, x, y) => hurtPlayer(state, amount, x, y);
  state.gainXp = (amount) => gainXp(state, amount);
  state.damageHeart = (amount) => damageHeart(state, amount * (1 - (state.heartArmor || 0)));
  state.updateBoss = (boss, dt) => updateBoss(state, boss, dt);
  state.onBossDeath = (boss) => onBossDeath(state, boss);
  state.fireNova = (free) => fireNova(state, free);

  function onBossDeath(stateInner, boss) {
    if (boss.kind === 'king') {
      // The final boss falls: the remaining swarm burns away and the run is won.
      clearAllEnemies(stateInner, 99999);
      stateInner.phase = 'win';
      stateInner.score += Math.round(stateInner.heart.hp) * 10 + 1000;
    } else {
      stateInner.boss = null;
      stateInner.waveState = 'clear';
      stateInner.waveTime = 0;
      stateInner.score += 100 * stateInner.wave;
      stateInner.waveBonus = 100 * stateInner.wave;
      if (stateInner.audio) stateInner.audio.waveClear();
    }
  }

  function fireNova(stateInner, free) {
    if (!free && stateInner.overdrive < OVERDRIVE_NEED) return false;
    if (!free) spendOverdrive(stateInner);
    stateInner.stats.novas += 1;
    stateInner.shake = Math.max(stateInner.shake, 12);
    stateInner.hitStop = Math.max(stateInner.hitStop, 0.06);
    spawnRing(stateInner, stateInner.player.x, stateInner.player.y, '#ffd166', 280);
    spawnBurst(stateInner, stateInner.player.x, stateInner.player.y, 30, '#ffd166', 420, 0.6, 4);
    if (stateInner.audio) stateInner.audio.nova();
    for (const enemy of stateInner.enemies) {
      if (enemy.dead) continue;
      const d = Math.hypot(enemy.x - stateInner.player.x, enemy.y - stateInner.player.y);
      if (d < 280 + enemy.radius) {
        const nx = (enemy.x - stateInner.player.x) / (d || 1);
        const ny = (enemy.y - stateInner.player.y) / (d || 1);
        damageEnemy(stateInner, enemy, 130, nx * 500, ny * 500);
      }
    }
    stateInner.ebullets.length = 0;
    stateInner.player.invulnT = Math.max(stateInner.player.invulnT, 0.6);
    return true;
  }

  function reset() {
    const fresh = createWorld(rng).state;
    // Keep the audio handle and the RNG across resets.
    fresh.audio = state.audio;
    fresh.rng = state.rng;
    Object.keys(state).forEach((k) => delete state[k]);
    Object.assign(state, fresh);
    state.damageEnemy = (enemy, amount, kx, ky, crit) => damageEnemy(state, enemy, amount, kx, ky, crit);
    state.hurtPlayer = (amount, x, y) => hurtPlayer(state, amount, x, y);
    state.gainXp = (amount) => gainXp(state, amount);
    state.damageHeart = (amount) => damageHeart(state, amount * (1 - (state.heartArmor || 0)));
    state.updateBoss = (boss, dt) => updateBoss(state, boss, dt);
    state.onBossDeath = (boss) => onBossDeath(state, boss);
    state.fireNova = (free) => fireNova(state, free);
    startWave(state, 1);
  }

  function applyDraft(index) {
    if (!state.draft) return;
    const boon = state.draft.choices[index];
    if (!boon) return;
    applyBoon(state, boon);
    state.pendingLevels -= 1;
    if (state.pendingLevels > 0) {
      state.draft = { choices: rollDraft(state.rng, state.takenOnce) };
    } else {
      state.draft = null;
      state.phase = 'play';
    }
    if (state.audio) state.audio.levelup();
  }

  function step(input, dt) {
    let events = 0;
    if (state.phase !== 'play') return events;
    if (state.hitStop > 0) {
      state.hitStop -= dt;
      return events;
    }
    state.time += dt;
    state.enemySpeedMul = (state.slowT > 0 ? 0.5 : 1) * (state.enemySlowMul || 1);
    const hpBefore = state.player.hp;
    const heartBefore = state.heart.hp;
    updatePlayer(state, input, dt);
    updateEnemies(state, dt);
    updateBullets(state, dt);
    updateEnemyBullets(state, dt);
    updatePickups(state, dt);
    updateGeysers(state, dt);
    updateWaves(state, dt);
    updateHeart(state, dt);
    updateCombo(state, dt);
    updateParticles(state, dt);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.waveBanner > 0) state.waveBanner -= dt;
    if (state.bossIntro > 0) state.bossIntro -= dt;
    if (state.bossPhaseFlash > 0) state.bossPhaseFlash -= dt;
    if (state.player.hp < hpBefore || state.heart.hp < heartBefore) events |= EV_HIT;
    // Death and victory.
    if (state.player.dead || state.heartDead) {
      state.phase = 'over';
      state.cause = state.player.dead ? 'slain' : 'heart';
      return events | EV_OVER;
    }
    if (state.phase === 'win') return events | EV_WIN;
    // Level-up opens the draft.
    if (state.pendingLevels > 0 && !state.draft) {
      state.draft = { choices: rollDraft(state.rng, state.takenOnce) };
      state.phase = 'draft';
      return events | EV_LEVEL;
    }
    return events;
  }

  return { state, reset, step, applyDraft };
}

export { xpNeed, STEP, WAVES_TOTAL, BOSS_WAVE_FINAL };
