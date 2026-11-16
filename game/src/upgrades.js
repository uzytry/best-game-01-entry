// The boon pool: 20 upgrades in three rarities, drafted one of three on every
// level-up. Commons tune the Warden, rares add systems (orbitals, pierce,
// bounce, slows), epics change the run. Once-only boons leave the pool after
// they are taken.
export const BOONS = [
  { id: 'boots', name: 'Swift Boots', rarity: 'common', desc: '+12% move speed', apply: (s) => { s.player.speedMul += 0.12; } },
  { id: 'vitality', name: 'Vitality', rarity: 'common', desc: '+25 max HP, heal 25', apply: (s) => { s.player.maxHp += 25; s.player.hp = Math.min(s.player.maxHp, s.player.hp + 25); } },
  { id: 'embers', name: 'Ember Rounds', rarity: 'common', desc: '+15% weapon damage', apply: (s) => { s.player.damageMul += 0.15; } },
  { id: 'rapid', name: 'Rapid Chamber', rarity: 'common', desc: '+12% fire rate', apply: (s) => { s.player.fireRateMul += 0.12; } },
  { id: 'barrel', name: 'Long Barrel', rarity: 'common', desc: '+15% bullet speed', apply: (s) => { s.player.bulletSpeedMul += 0.15; } },
  { id: 'hide', name: 'Thick Hide', rarity: 'common', desc: 'Take 10% less damage', apply: (s) => { s.player.armor = Math.min(0.5, (s.player.armor || 0) + 0.1); } },
  { id: 'magnet', name: 'Magnet Coil', rarity: 'common', desc: '+60% pickup radius', apply: (s) => { s.player.magnetR += 70; } },
  { id: 'dash', name: 'Quick Dash', rarity: 'common', desc: '-25% dash cooldown', apply: (s) => { s.player.dashCdMul = Math.max(0.4, (s.player.dashCdMul || 1) - 0.25); } },
  { id: 'blades', name: 'Twin Blades', rarity: 'rare', desc: '+1 orbital blade', apply: (s) => { s.player.orbitals = Math.min(5, (s.player.orbitals || 0) + 1); } },
  { id: 'pierce', name: 'Piercing Rounds', rarity: 'rare', desc: 'Bullets pierce +1 enemy', apply: (s) => { s.player.pierce = (s.player.pierce || 0) + 1; } },
  { id: 'ricochet', name: 'Ricochet', rarity: 'rare', desc: 'Bullets bounce to 1 more enemy', apply: (s) => { s.player.bounce = (s.player.bounce || 0) + 1; } },
  { id: 'wind', name: 'Second Wind', rarity: 'rare', desc: 'Revive once at 50% HP', once: true, apply: (s) => { s.player.revive = true; } },
  { id: 'mend', name: 'Heart Mend', rarity: 'rare', desc: 'Heart +40 max HP, heal 40', apply: (s) => { s.heart.maxHp += 40; s.heart.hp = Math.min(s.heart.maxHp, s.heart.hp + 40); } },
  { id: 'core', name: 'Overdrive Core', rarity: 'rare', desc: 'Nova charges 50% faster', apply: (s) => { s.player.overdriveMul = (s.player.overdriveMul || 1) + 0.5; } },
  { id: 'frost', name: 'Frost Rounds', rarity: 'rare', desc: 'Hits slow enemies briefly', apply: (s) => { s.player.slowOnHit = true; } },
  { id: 'lens', name: 'Crit Lens', rarity: 'rare', desc: '+15% crit chance (2x damage)', apply: (s) => { s.player.crit = Math.min(0.6, (s.player.crit || 0) + 0.15); } },
  { id: 'phoenix', name: 'Phoenix Heart', rarity: 'epic', desc: 'Revive at full HP + nova', once: true, apply: (s) => { s.player.phoenix = true; } },
  { id: 'triplet', name: 'Triplet', rarity: 'epic', desc: 'Fire +1 projectile', apply: (s) => { s.player.extraProjectiles = (s.player.extraProjectiles || 0) + 1; } },
  { id: 'dilation', name: 'Time Dilation', rarity: 'epic', desc: 'All enemies 12% slower', apply: (s) => { s.enemySlowMul = (s.enemySlowMul || 1) * 0.88; } },
  { id: 'bond', name: 'Forge Bond', rarity: 'epic', desc: 'Heart regen x2, Heart takes 25% less', once: true, apply: (s) => { s.heartRegenMul = (s.heartRegenMul || 1) * 2; s.heartArmor = 0.25; } },
];

const RARITY_WEIGHT = { common: 60, rare: 30, epic: 10 };

export function rollDraft(rng, takenOnce) {
  const pool = BOONS.filter((b) => !(b.once && takenOnce.has(b.id)));
  const picks = [];
  const used = new Set();
  while (picks.length < 3 && used.size < pool.length) {
    let total = 0;
    for (const b of pool) {
      if (!used.has(b.id)) total += RARITY_WEIGHT[b.rarity];
    }
    let roll = rng.next() * total;
    for (const b of pool) {
      if (used.has(b.id)) continue;
      roll -= RARITY_WEIGHT[b.rarity];
      if (roll <= 0) {
        used.add(b.id);
        picks.push(b);
        break;
      }
    }
  }
  return picks;
}

export function applyBoon(state, boon) {
  boon.apply(state);
  state.boons.push(boon);
  if (boon.once) state.takenOnce.add(boon.id);
}
