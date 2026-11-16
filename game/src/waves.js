// The wave director: 12 waves of escalating pressure, two boss waves, and two
// objective waves (destroy the spawners; survive the storm). A wave is a spawn
// budget trickling in on a timer; it clears when the budget is spent and the
// arena is empty — or when its objective completes.
import { BOSS_WAVE_FINAL, BOSS_WAVE_MID, WAVES_TOTAL } from './config.js';
import { spawnAtEdge, spawnEnemy } from './enemies.js';
import { spawnBoss } from './bosses.js';
import { spawnGeyser } from './hazards.js';
import { healHeart } from './heart.js';
import { addFloater } from './particles.js';

const WAVE_TABLE = [
  { name: 'First Embers', budget: [['emberling', 12]], interval: 1.6 },
  { name: 'Whispers', budget: [['emberling', 12], ['wisp', 6]], interval: 1.4 },
  { name: 'Spitfire', budget: [['emberling', 10], ['wisp', 5], ['spitter', 5]], interval: 1.3 },
  { name: 'Kill the Spawners', objective: 'spawners', budget: [['spawner', 3], ['emberling', 8]], interval: 1.5 },
  { name: 'The Charge', budget: [['charger', 8], ['splitter', 5], ['emberling', 8]], interval: 1.1 },
  { name: 'ASH TYRANT', boss: 'tyrant', budget: [['emberling', 10]], interval: 2 },
  { name: 'Iron Wall', budget: [['bulwark', 5], ['spitter', 6], ['wisp', 8]], interval: 0.9 },
  { name: 'Storm Surge', objective: 'storm', budget: [['emberling', 14], ['wisp', 8], ['charger', 4]], interval: 0.85, geysers: true },
  { name: 'Leeches', budget: [['leech', 10], ['splitter', 6], ['spitter', 5]], interval: 0.85 },
  { name: 'Elite Guard', budget: [['bulwark', 4], ['charger', 6], ['spitter', 6], ['wisp', 6]], interval: 0.8, elites: 0.35 },
  { name: 'The Gauntlet', budget: [['emberling', 12], ['charger', 6], ['spitter', 6], ['bulwark', 3], ['leech', 5]], interval: 0.7, elites: 0.25 },
  { name: 'THE HOLLOW KING', boss: 'king', budget: [['wisp', 8], ['spitter', 4]], interval: 2.6 },
];

export function waveDef(wave) {
  return WAVE_TABLE[Math.min(wave, WAVES_TOTAL) - 1];
}

export function startWave(state, wave) {
  const def = waveDef(wave);
  state.wave = wave;
  state.waveTime = 0;
  state.waveState = 'intro';
  state.waveBanner = 2.2;
  // The Heart rekindles between waves: clearing a wave earns it back some
  // of the flame it spent, so a bruised run is never a doomed one.
  if (wave > 1 && state.heart.hp > 0 && state.heart.hp < state.heart.maxHp) {
    healHeart(state, 25);
    addFloater(state, state.heart.x, state.heart.y - 44, '+25 HEART', '#ffd166');
  }
  state.objective = def.objective || null;
  state.objectiveDone = false;
  state.stormT = 0;
  state.geyserT = 2;
  // Flatten the budget into a spawn queue.
  state.spawnQueue = [];
  for (const [kind, count] of def.budget) {
    for (let i = 0; i < count; i += 1) state.spawnQueue.push(kind);
  }
  // Shuffle the queue so the mix arrives varied.
  for (let i = state.spawnQueue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(state.rng.next() * (i + 1));
    [state.spawnQueue[i], state.spawnQueue[j]] = [state.spawnQueue[j], state.spawnQueue[i]];
  }
  state.spawnInterval = def.interval;
  state.spawnT = 0.8;
  state.eliteChance = def.elites || 0;
  state.bossSpawned = false;
  if (def.boss) {
    // The boss arrives after a short drumroll.
    state.bossTimer = 2.5;
  }
  if (state.audio) state.audio.setWave(wave);
}

function aliveCount(state) {
  return state.enemies.length;
}

function spawnersAlive(state) {
  return state.enemies.some((e) => e.kind === 'spawner' && !e.dead);
}

export function updateWaves(state, dt) {
  const def = waveDef(state.wave);
  state.waveTime += dt;
  if (state.waveState === 'intro') {
    if (state.waveTime > 2.2) state.waveState = 'active';
    return;
  }
  if (state.waveState === 'clear') {
    if (state.waveTime > 2.6) {
      if (state.wave >= WAVES_TOTAL) return; // victory handled by boss death
      startWave(state, state.wave + 1);
    }
    return;
  }
  // Boss entrance.
  if (def.boss && !state.bossSpawned) {
    state.bossTimer -= dt;
    if (state.bossTimer <= 0) {
      state.bossSpawned = true;
      spawnBoss(state, def.boss);
      state.bossIntro = 1.6;
    }
  }
  // Storm objective: geysers erupt on a timer.
  if (def.geysers) {
    state.geyserT -= dt;
    if (state.geyserT <= 0) {
      state.geyserT = state.rng.range(1.6, 2.6);
      spawnGeyser(state, state.rng.range(120, 1160), state.rng.range(120, 600));
    }
    if (state.waveTime > 42) {
      state.objectiveDone = true;
    }
  }
  // Spawner objective: clear when all spawners are dead.
  if (state.objective === 'spawners' && !spawnersAlive(state) && state.spawnQueue.length === 0) {
    state.objectiveDone = true;
  }
  // Trickle spawns.
  if (state.spawnQueue.length > 0) {
    state.spawnT -= dt;
    if (state.spawnT <= 0 && aliveCount(state) < 42) {
      state.spawnT = state.spawnInterval * state.rng.range(0.8, 1.2);
      const kind = state.spawnQueue.shift();
      const elite = state.rng.next() < state.eliteChance;
      if (kind === 'spawner') {
        // Spawners take fixed-ish posts away from the centre.
        const spots = [
          [180, 160],
          [1100, 160],
          [180, 560],
          [1100, 560],
        ];
        const spot = state.rng.pick(spots);
        spawnEnemy(state, kind, spot[0] + state.rng.range(-40, 40), spot[1] + state.rng.range(-40, 40), elite);
      } else {
        spawnAtEdge(state, kind, elite);
      }
    }
  }
  // Wave clear?
  const queueEmpty = state.spawnQueue.length === 0;
  const arenaEmpty = aliveCount(state) === 0;
  const objectiveMet = state.objective ? state.objectiveDone : true;
  if (def.boss) {
    // Boss waves clear when the boss dies (handled in onBossDeath).
    return;
  }
  if (queueEmpty && arenaEmpty && objectiveMet && state.waveState === 'active') {
    state.waveState = 'clear';
    state.waveTime = 0;
    state.score += 100 * state.wave;
    state.waveBonus = 100 * state.wave;
    if (state.audio) state.audio.waveClear();
  }
}
