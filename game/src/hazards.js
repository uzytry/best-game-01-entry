// Ember geysers: the arena itself fights back. A glowing ring telegraphs the
// spot for just under a second, then fire erupts — it scorches the player and
// any enemy standing in it, so a careful Warden lures the swarm through them.
import { addFloater, spawnBurst, spawnRing } from './particles.js';

export const GEYSER_RADIUS = 70;
const TELEGRAPH = 0.9;
const ERUPT = 0.45;

export function spawnGeyser(state, x, y) {
  state.geysers.push({ x, y, t: 0, phase: 'warn', hitSet: new Set() });
  spawnRing(state, x, y, '#ff8a5c', GEYSER_RADIUS, TELEGRAPH);
}

export function updateGeysers(state, dt) {
  for (let i = state.geysers.length - 1; i >= 0; i -= 1) {
    const g = state.geysers[i];
    g.t += dt;
    if (g.phase === 'warn' && g.t >= TELEGRAPH) {
      g.phase = 'erupt';
      g.t = 0;
      spawnBurst(state, g.x, g.y, 22, '#ff8a5c', 320, 0.6, 4);
      spawnBurst(state, g.x, g.y, 10, '#ffd166', 200, 0.5, 3);
      spawnRing(state, g.x, g.y, '#ffd166', GEYSER_RADIUS + 30);
      if (state.audio) state.audio.explode(false);
    }
    if (g.phase === 'erupt') {
      const player = state.player;
      if (!g.hitSet.has('player') && Math.hypot(player.x - g.x, player.y - g.y) < GEYSER_RADIUS) {
        g.hitSet.add('player');
        state.hurtPlayer(18, g.x, g.y);
        addFloater(state, player.x, player.y - 24, 'SCORCHED!', '#ff8a5c');
      }
      for (const enemy of state.enemies) {
        if (enemy.dead || g.hitSet.has(enemy.id)) continue;
        if (Math.hypot(enemy.x - g.x, enemy.y - g.y) < GEYSER_RADIUS + enemy.radius) {
          g.hitSet.add(enemy.id);
          state.damageEnemy(enemy, 45, 0, 0);
        }
      }
      if (g.t >= ERUPT) state.geysers.splice(i, 1);
    }
  }
}
