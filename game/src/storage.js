// The few numbers the game keeps between visits: best score, best wave, wins and
// the mute setting. Everything is wrapped so a browser with storage off (a private
// window) just plays without remembering, instead of throwing.

import { BEST_KEY, BEST_WAVE_KEY, MUTED_KEY, WINS_KEY } from './config.js';

function readInt(key) {
  try {
    const value = Number.parseInt(window.localStorage.getItem(key) ?? '0', 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function writeInt(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage off: the value lasts this visit only.
  }
}

export function readRecords() {
  return {
    best: readInt(BEST_KEY),
    bestWave: readInt(BEST_WAVE_KEY),
    wins: readInt(WINS_KEY),
    muted: readInt(MUTED_KEY) === 1,
  };
}

export function saveBest(score) {
  writeInt(BEST_KEY, score);
}

export function saveBestWave(wave) {
  writeInt(BEST_WAVE_KEY, wave);
}

export function saveWins(wins) {
  writeInt(WINS_KEY, wins);
}

export function saveMuted(muted) {
  writeInt(MUTED_KEY, muted ? 1 : 0);
}
