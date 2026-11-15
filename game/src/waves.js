// The wave director: it turns a wave's composition into a timed queue of spawns,
// holds the queue when the field is crowded, and reports when the wave is cleared
// (queue empty and nothing left alive). Wave 10 is the boss alone; the Herald
// summons its own minions, so the director stays out of its way.

import { MAX_ALIVE, WAVE_BREATHER, WAVE_COUNT, WAVES } from './config.js';

export function createWaves(random) {
  let queue = [];
  let spawnTimer = 0;
  let breather = 0;
  let bossSpawned = false;

  function buildQueue(wave) {
    const def = WAVES[wave - 1];
    const entries = [];
    for (const group of def.groups) {
      for (let i = 0; i < group.count; i += 1) entries.push(group.kind);
    }
    // Shuffle so the kinds arrive mixed, not in blocks.
    for (let i = entries.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random.next() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    return entries;
  }

  return {
    startWave(wave) {
      queue = buildQueue(wave);
      spawnTimer = 0.4;
      bossSpawned = false;
      breather = 0;
    },
    // Advance the director one step. Returns 'boss' when the Herald should spawn,
    // a kind string when an enemy should spawn, or null.
    update(dt, wave, aliveCount) {
      if (breather > 0) {
        breather -= dt;
        return null;
      }
      const def = WAVES[wave - 1];
      if (def.boss) {
        if (!bossSpawned) {
          bossSpawned = true;
          return 'boss';
        }
        return null;
      }
      if (queue.length === 0 || aliveCount >= MAX_ALIVE) return null;
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = def.interval;
        return queue.shift();
      }
      return null;
    },
    startBreather() {
      breather = WAVE_BREATHER;
    },
    get breatherLeft() {
      return Math.max(0, breather);
    },
    get remaining() {
      return queue.length;
    },
    get cleared() {
      return queue.length === 0;
    },
    get waveCount() {
      return WAVE_COUNT;
    },
  };
}
