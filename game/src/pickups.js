// Starlight orbs (experience) and hearts (healing). Orbs drift where they fall, then
// fly to the Keeper when it comes within magnet range; hearts sit still and wait.
// A pickup is collected by the world when it touches the Keeper's ring.

export function createPickups(random) {
  const orbs = [];
  const hearts = [];

  return {
    orbs,
    hearts,
    dropOrb(x, y, value = 1) {
      const angle = random.next() * Math.PI * 2;
      const speed = 40 + random.next() * 60;
      orbs.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, value, age: 0 });
    },
    dropHeart(x, y) {
      hearts.push({ x, y, age: 0 });
    },
    update(dt, player, magnetRadius) {
      for (const orb of orbs) {
        orb.age += dt;
        const dx = player.x - orb.x;
        const dy = player.y - orb.y;
        const distance = Math.hypot(dx, dy);
        if (distance < magnetRadius) {
          // Pulled in, faster the closer it gets; the scatter velocity fades out.
          const pull = 620 * (1 - distance / (magnetRadius + 40));
          orb.vx += (dx / (distance || 1)) * pull * dt * 4;
          orb.vy += (dy / (distance || 1)) * pull * dt * 4;
        }
        const drag = Math.pow(0.86, dt * 60);
        orb.vx *= drag;
        orb.vy *= drag;
        orb.x += orb.vx * dt;
        orb.y += orb.vy * dt;
      }
      for (const heart of hearts) heart.age += dt;
    },
    clear() {
      orbs.length = 0;
      hearts.length = 0;
    },
  };
}
