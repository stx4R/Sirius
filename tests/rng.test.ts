import { describe, expect, it } from 'vitest'
import { mulberry32, shuffle } from '../src/core/rng'

describe('rng', () => {
  it('replays the same sequence for the same seed, and differs across seeds', () => {
    const take = (seed: number) => Array.from({ length: 10 }, mulberry32(seed))

    expect(take(2026)).toEqual(take(2026))
    expect(take(2026)).not.toEqual(take(2027))
    for (const value of take(2026)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('shuffles deterministically without mutating its input', () => {
    const source = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8])

    const first = shuffle(source, mulberry32(7))
    const second = shuffle(source, mulberry32(7))

    expect(first).toEqual(second)
    expect(first).not.toEqual([...source])
    expect([...first].sort((a, b) => a - b)).toEqual([...source])
    expect(source).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})
