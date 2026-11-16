// Seeded random numbers (mulberry32). Every roll in the game — spawns, drops,
// draft offers, particle spray — goes through one of these, so the same seed
// always plays the same game and the screenshots are reproducible.
export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(array) {
      return array[Math.floor(this.next() * array.length)];
    },
    chance(p) {
      return this.next() < p;
    },
    // Angle in [0, 2π).
    angle() {
      return this.next() * Math.PI * 2;
    },
  };
}
