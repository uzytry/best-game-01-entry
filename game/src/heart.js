// The Forge Heart: the second thing the player protects. It sits at the arena
// centre, pulses with the forge's light, takes damage from enemies that reach
// it, and slowly rekindles after a quiet spell. If it dies, the run ends.
import { HEART } from './config.js';

export function createHeart() {
  return { x: HEART.x, y: HEART.y, radius: HEART.radius, hp: HEART.hp, maxHp: HEART.hp, lastHit: -99, pulse: 0 };
}

export function damageHeart(state, amount) {
  const heart = state.heart;
  heart.hp = Math.max(0, heart.hp - amount);
  heart.lastHit = state.time;
  state.heartAlarm = 1.2; // HUD warning timer
  return heart.hp <= 0;
}

export function healHeart(state, amount) {
  const heart = state.heart;
  heart.hp = Math.min(heart.maxHp, heart.hp + amount);
}

export function updateHeart(state, dt) {
  const heart = state.heart;
  heart.pulse += dt;
  if (state.time - heart.lastHit > HEART.regenDelay && heart.hp > 0) {
    heart.hp = Math.min(heart.maxHp, heart.hp + HEART.regen * state.heartRegenMul * dt);
  }
  if (state.heartAlarm > 0) state.heartAlarm -= dt;
}
