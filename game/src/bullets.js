// Projectiles, both ways: the Keeper's bolts of light and the gloom's slow orbs.
// Each bullet carries its own pierce count (how many more enemies it may pass
// through) and the set of enemies it has already hit, so a piercing bolt never
// damages the same enemy twice.

export function createBullets() {
  const playerBullets = [];
  const enemyBullets = [];

  return {
    player: playerBullets,
    enemy: enemyBullets,
    firePlayer(x, y, angle, speed, damage, life, radius, pierce) {
      playerBullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, ttl: life, radius, damage, pierce, hit: new Set() });
    },
    fireEnemy(x, y, angle, speed, damage, life, radius) {
      enemyBullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, ttl: life, radius, damage });
    },
    update(dt, field) {
      for (let i = playerBullets.length - 1; i >= 0; i -= 1) {
        const bullet = playerBullets[i];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
        if (bullet.life <= 0 || bullet.x < -20 || bullet.x > field.width + 20 || bullet.y < -20 || bullet.y > field.height + 20) {
          playerBullets.splice(i, 1);
        }
      }
      for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
        const bullet = enemyBullets[i];
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
        if (bullet.life <= 0 || bullet.x < -20 || bullet.x > field.width + 20 || bullet.y < -20 || bullet.y > field.height + 20) {
          enemyBullets.splice(i, 1);
        }
      }
    },
    clear() {
      playerBullets.length = 0;
      enemyBullets.length = 0;
    },
  };
}

// Circle overlap, the game's only collision test.
export function circlesHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy < reach * reach;
}

export function clampToField(entity, field, margin = 0) {
  entity.x = Math.max(margin, Math.min(field.width - margin, entity.x));
  entity.y = Math.max(margin, Math.min(field.height - margin, entity.y));
}
