// Seeded randomness. Math.random() is never called anywhere in the codebase
// so that the Monte Carlo simulator and the tests both reproduce (CLAUDE.md §8).

export type Rng = () => number

const UINT32 = 0x100000000

/** mulberry32 — 32-bit state, no dependencies, good enough for balance simulation. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / UINT32
  }
}

/** Fisher-Yates. Returns a new array; the input is left untouched. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const swap = out[i]
    out[i] = out[j]
    out[j] = swap
  }
  return out
}

/** `count` distinct items drawn uniformly without replacement. */
export function sample<T>(items: readonly T[], count: number, rng: Rng): T[] {
  return shuffle(items, rng).slice(0, count)
}
