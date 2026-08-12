import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../src/core/rng'
import { NEBULA_LINES, ORION_LINES, lineFor, shopLineFor } from '../src/ui/dialogue'
import type { Beat, ShopBeat } from '../src/ui/dialogue'

const BEATS = Object.keys(ORION_LINES) as Beat[]
const SHOP_BEATS = Object.keys(NEBULA_LINES) as ShopBeat[]

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

describe("иєвυℓα's lines", () => {
  it('answers every beat the shop can reach, with something to vary between', () => {
    const beats: ShopBeat[] = ['enter', 'gift', 'bought', 'reroll', 'broke', 'locked', 'leave']

    expect(SHOP_BEATS.sort()).toEqual([...beats].sort())
    for (const beat of beats) {
      expect(NEBULA_LINES[beat].length).toBeGreaterThan(1)
      expect(new Set(NEBULA_LINES[beat]).size).toBe(NEBULA_LINES[beat].length)
    }
  })

  // BOOTH-7. The drifter is handed over rather than sold (GDD 13-4), and this
  // beat fires exactly once in a run — so whichever line comes up is the only
  // explanation of the chip the player will ever get. Every one of them has to
  // say what it does, which by GDD 3-3 is: it is judged by the suits beside it.
  it('says what the drifter does in every line that gives it away', () => {
    for (const line of NEBULA_LINES.gift) {
      // Named as well as explained: a line that describes the chip without saying
      // which of the six on screen it is describes nothing. It is also what
      // `npm run shot` reads to prove the beat fired at all, since no other line
      // in her bank says the word.
      expect(line, line).toContain('떠돌이')
      expect(line, line).toContain('문양')
      // Her bubble is 256×104 (GDD 11-10) at the 14px face, which is ~16 glyphs a
      // line and four lines of room. 40 characters is three of them with slack;
      // a longer line is one the box clips, and a clipped explanation of the only
      // chip nobody bought reads as no explanation at all.
      expect(line.length, line).toBeLessThanOrEqual(40)
    }
  })

  // GDD 7-1-b keeps the companion shelf stocked and shut, and a slot that simply
  // ignores a click reads as a broken button rather than as a locked one.
  it('has something to say about the companions it will not sell', () => {
    expect(NEBULA_LINES.locked.length).toBeGreaterThan(1)
  })

  it('only ever speaks a line from its own bank', () => {
    const rng = mulberry32(31)
    for (let i = 0; i < 200; i++) {
      const beat = SHOP_BEATS[i % SHOP_BEATS.length]
      expect(NEBULA_LINES[beat]).toContain(shopLineFor(beat, rng))
    }
  })

  // CLAUDE.md §8, and the reason her generator is offset from ORION's: two
  // streams seeded off one run must not turn out to be the same stream.
  it('replays for a seed without echoing ORION', () => {
    const hers = (seed: number) => {
      const rng = mulberry32(seed)
      return SHOP_BEATS.map((beat) => shopLineFor(beat, rng))
    }

    expect(hers(4242)).toEqual(hers(4242))
    expect(hers(4242)).not.toEqual(hers(99))
  })
})
