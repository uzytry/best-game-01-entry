// Boons: the draft the Keeper is offered on every level-up. Each boon stacks to a
// cap; the draft shows three different boons that still have room, and when every
// boon is maxed the draft offers Radiance instead (a heal and a score gift).
// apply() mutates the player's derived stats, so the world never has to know the
// boons' details — it just reads player.stats.

export const BOONS = [
  {
    id: 'twin', name: 'Twin Flames', max: 3, icon: '✦',
    blurb: '+1 bolt per volley',
    detail: 'Your lantern splits its light: every shot fires an extra bolt.',
    apply(stats) { stats.projectiles += 1; },
  },
  {
    id: 'pierce', name: 'Piercing Light', max: 3, icon: '➶',
    blurb: 'Bolts pierce +1 enemy',
    detail: 'Bolts pass through one more gloom-spawn before fading.',
    apply(stats) { stats.pierce += 1; },
  },
  {
    id: 'rapid', name: 'Rapid Pulse', max: 5, icon: '≋',
    blurb: '+18% fire rate',
    detail: 'The lantern pulses faster, loosing bolts in a quicker rhythm.',
    apply(stats) { stats.fireInterval *= 0.85; },
  },
  {
    id: 'heavy', name: 'Heavy Light', max: 5, icon: '☀',
    blurb: '+25% bolt damage',
    detail: 'Each bolt carries more of the dawn: it hits a quarter harder.',
    apply(stats) { stats.damage *= 1.25; },
  },
  {
    id: 'swift', name: 'Swift Current', max: 3, icon: '➤',
    blurb: '+12% move speed',
    detail: 'You ride the light current: quicker feet, easier escapes.',
    apply(stats) { stats.speed *= 1.12; },
  },
  {
    id: 'heart', name: 'Bright Heart', max: 3, icon: '♥',
    blurb: '+25 max health, heal 25',
    detail: 'Your heart burns brighter: more health, and a little mended now.',
    apply(stats, player) {
      stats.maxHp += 25;
      player.hp = Math.min(stats.maxHp, player.hp + 25);
    },
  },
  {
    id: 'magnet', name: 'Star Magnet', max: 3, icon: '◎',
    blurb: '+60% pickup radius',
    detail: 'Starlight bends toward you from much further away.',
    apply(stats) { stats.magnetRadius *= 1.6; },
  },
  {
    id: 'orbit', name: 'Orbiting Sparks', max: 3, icon: '◌',
    blurb: '+1 orbiting spark',
    detail: 'A spark circles you, searing whatever it touches.',
    apply(stats) { stats.orbiters += 1; },
  },
  {
    id: 'nova', name: 'Nova Burst', max: 3, icon: '✧',
    blurb: 'A nova every 6s, stronger',
    detail: 'Every few seconds your light bursts outward, burning all nearby gloom.',
    apply(stats) { stats.novaLevel += 1; },
  },
  {
    id: 'reach', name: 'Long Reach', max: 3, icon: '↔',
    blurb: '+20% bolt range and speed',
    detail: 'Bolts fly further and faster before they fade.',
    apply(stats) { stats.bulletLife *= 1.2; stats.bulletSpeed *= 1.12; },
  },
  {
    id: 'dash', name: 'Swift Dash', max: 2, icon: '»',
    blurb: 'Dash recharges 30% faster',
    detail: 'Your dash comes back sooner, for more escapes and more dives.',
    apply(stats) { stats.dashCooldown *= 0.7; },
  },
  {
    id: 'wind', name: 'Second Wind', max: 1, icon: '✚',
    blurb: 'Revive once at half health',
    detail: 'The dawn refuses to let you go: once, death returns you at half health.',
    apply(stats) { stats.secondWind = true; },
  },
];

export const RADIANCE = {
  id: 'radiance', name: 'Radiance', max: 99, icon: '✺',
  blurb: 'Heal 50 and +500 score',
  detail: 'Every boon is mastered; the light itself rewards you instead.',
  apply(stats, player) {
    player.hp = Math.min(stats.maxHp, player.hp + 50);
  },
};

// The player's derived stats: the base numbers from config, mutated by boons.
export function baseStats() {
  return {
    projectiles: 1,
    pierce: 0,
    fireInterval: 0.2,
    damage: 12,
    speed: 265,
    maxHp: 100,
    magnetRadius: 90,
    orbiters: 0,
    novaLevel: 0,
    bulletLife: 0.85,
    bulletSpeed: 640,
    dashCooldown: 2.4,
    secondWind: false,
  };
}

// Three different boons with room left, drawn with the run's own random source.
export function drawDraft(random, levels) {
  const available = BOONS.filter((boon) => (levels[boon.id] ?? 0) < boon.max);
  if (available.length === 0) return [RADIANCE, RADIANCE, RADIANCE];
  const pool = [...available];
  const draft = [];
  while (draft.length < 3 && pool.length > 0) {
    const index = Math.floor(random.next() * pool.length);
    draft.push(pool.splice(index, 1)[0]);
  }
  while (draft.length < 3) draft.push(RADIANCE);
  return draft;
}

export function applyBoon(boon, stats, player) {
  boon.apply(stats, player);
}
