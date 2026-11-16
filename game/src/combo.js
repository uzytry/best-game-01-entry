// The kill combo and the overdrive meter. Kills inside the window raise the
// combo and the score multiplier; kills also charge the nova. Both decay or
// reset on their own rules, and both are shown in the HUD.
import { COMBO, OVERDRIVE_NEED } from './config.js';

export function createCombo() {
  return { count: 0, timer: 0, mult: 1, best: 0 };
}

export function registerKill(state, enemy) {
  const combo = state.combo;
  combo.count += 1;
  combo.timer = COMBO.window;
  combo.mult = Math.min(COMBO.multCap, 1 + combo.count * COMBO.multPerKill);
  if (combo.count > combo.best) combo.best = combo.count;
  const charge = (enemy.elite ? 5 : enemy.boss ? 20 : 1) * (state.player.overdriveMul || 1);
  state.overdrive = Math.min(OVERDRIVE_NEED, state.overdrive + charge);
}

export function updateCombo(state, dt) {
  const combo = state.combo;
  if (combo.timer > 0) {
    combo.timer -= dt;
    if (combo.timer <= 0) {
      combo.count = 0;
      combo.mult = 1;
    }
  }
}

export function overdriveReady(state) {
  return state.overdrive >= OVERDRIVE_NEED;
}

export function spendOverdrive(state) {
  state.overdrive = 0;
}
