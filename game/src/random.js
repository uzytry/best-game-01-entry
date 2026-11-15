// A small seeded generator (mulberry32) so a run can be replayed exactly: the
// screenshot scenes and the playtest bot both run on a fixed seed, and a ?seed=N in
// the address bar fixes the falling pattern for a real game too.

export function createRandom(seed) {
  let state = seed >>> 0;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    // An integer in [min, max).
    int(min, max) {
      return min + Math.floor(this.next() * (max - min));
    },
    // A float in [min, max).
    range(min, max) {
      return min + this.next() * (max - min);
    },
    // true with probability p.
    chance(p) {
      return this.next() < p;
    },
    // One element of a non-empty array.
    pick(array) {
      return array[Math.floor(this.next() * array.length)];
    },
  };
}
