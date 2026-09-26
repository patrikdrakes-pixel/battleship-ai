export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/** Deterministic, seedable PRNG (mulberry32). */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    nextInt(maxExclusive: number): number {
      if (maxExclusive <= 0) throw new Error('maxExclusive must be positive');
      return Math.floor(next() * maxExclusive) % maxExclusive;
    },
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Derives an independent stream from a base seed, so callers stay pure. */
export function deriveSeed(seed: number, step: number): number {
  return (Math.imul(seed ^ (step + 1), 0x9e3779b1) ^ (step << 16)) >>> 0;
}
