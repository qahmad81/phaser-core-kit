/**
 * Create a deterministic pseudo-random number generator using a seed.
 * Implements the mulberry32 algorithm. Each invocation of the returned
 * function returns a floating point number in the range [0,1).
 *
 * @param {number} seed Seed value for the PRNG.
 * @returns {() => number} Function that returns a pseudo-random number.
 */
export function createRng(seed = Date.now()) {
  // Ensure seed is a 32‑bit integer
  let t = Math.imul(seed, 0x6d2b79f5) | 0;
  return function rng() {
    // Force to 32 bit integer arithmetic
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}