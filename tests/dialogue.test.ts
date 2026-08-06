import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../src/core/rng'
import { ORION_LINES, lineFor } from '../src/ui/dialogue'
import type { Beat } from '../src/ui/dialogue'

const BEATS = Object.keys(ORION_LINES) as Beat[]

describe("ORION's lines", () => {
  // A booth run is 40 turns (GDD 4-2). One line per beat would be forty
  // repetitions of it, which is the reason the picker exists at all.
  it('gives every beat something to vary between', () => {
    for (const beat of BEATS) {
      expect(ORION_LINES[beat].length).toBeGreaterThan(1)
      expect(new Set(ORION_LINES[beat]).size).toBe(ORION_LINES[beat].length)
    }
  })

  it('only ever speaks a line from its own bank', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 200; i++) {
      const beat = BEATS[i % BEATS.length]
      expect(ORION_LINES[beat]).toContain(lineFor(beat, rng))
    }
  })

  // CLAUDE.md §8: the picker is handed a generator instead of calling
  // Math.random(), so a seed replays a run's dialogue along with its deck.
  it('replays the same lines for the same seed', () => {
    const run = (seed: number) => {
      const rng = mulberry32(seed)
      return BEATS.flatMap((beat) => [lineFor(beat, rng), lineFor(beat, rng)])
    }

    expect(run(4242)).toEqual(run(4242))
  })

  it('does not collapse to one line as the generator advances', () => {
    const rng = mulberry32(7)
    const drawn = new Set(Array.from({ length: 40 }, () => lineFor('turnStart', rng)))

    expect(drawn.size).toBeGreaterThan(1)
  })
})
