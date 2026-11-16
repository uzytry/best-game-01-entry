// Best-run records in localStorage: score, wave, wins and kills. All access is
// guarded — private windows and disabled storage just mean the records last
// this visit only.
const KEY = 'emberfall.best.v1';

export function readBest() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { score: 0, wave: 0, wins: 0, kills: 0 };
    const parsed = JSON.parse(raw);
    return {
      score: Number(parsed.score) || 0,
      wave: Number(parsed.wave) || 0,
      wins: Number(parsed.wins) || 0,
      kills: Number(parsed.kills) || 0,
    };
  } catch {
    return { score: 0, wave: 0, wins: 0, kills: 0 };
  }
}

export function saveBest(best) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    // Storage unavailable: ignore.
  }
}

export function readMuted() {
  try {
    return window.localStorage.getItem('emberfall.muted.v1') === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted) {
  try {
    window.localStorage.setItem('emberfall.muted.v1', muted ? '1' : '0');
  } catch {
    // Ignore.
  }
}
