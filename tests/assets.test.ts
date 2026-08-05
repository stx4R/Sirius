// P3-A: the art pipeline. These check the things a screenshot cannot — that the
// chip colours still match GDD 3-1, that the palette stays inside its budget, and
// that the ten special chips really are composed rather than drawn.

import { describe, expect, it } from 'vitest'
import { basicChip, constellationIcon, drifterChip, specialChip } from '../src/assets/compose'
import type { PixelMap } from '../src/assets/compose'
import { AXIS_COLOURS, CHIP_COLOURS, PALETTE } from '../src/assets/palette'
import { CONSTELLATION_GLYPHS, DISC, SPRITE_SIZE, SUIT_GLYPHS } from '../src/assets/pixels'
import type { Mask } from '../src/assets/pixels'
import { CONSTELLATION_RULES, SPECIAL_SUIT_PAIRS } from '../src/core/config'
import { SUIT_ORDER } from '../src/core/types'
import type { ConstellationId } from '../src/core/types'

const PALETTE_LIMIT = 32

/** GDD 3-1, quoted here so a change to config or palette has to be deliberate. */
const GDD_CHIP_HEX = {
  GAC: '#7FD44C',
  IMA: '#3F8FE0',
  GIN: '#E0453F',
  MIM: '#9A4FD4',
  ACR: '#2B2B38',
} as const

const filled = (sprite: PixelMap): string[] =>
  sprite.flatMap((row, r) => row.flatMap((cell, c) => (cell === null ? [] : [`${r},${c}`])))

const countOf = (m: Mask): number => m.flat().filter(Boolean).length

const ALL_IDS = Object.keys(CONSTELLATION_RULES) as ConstellationId[]

describe('palette', () => {
  it('keeps the five chip colours at their GDD 3-1 values', () => {
    for (const suit of SUIT_ORDER) {
      expect(CHIP_COLOURS[suit].base).toBe(GDD_CHIP_HEX[suit])
    }
  })

  it('stays within the 32-colour budget with no colour spent twice', () => {
    const values = Object.values(PALETTE)

    expect(values.length).toBeLessThanOrEqual(PALETTE_LIMIT)
    expect(new Set(values).size).toBe(values.length)
  })

  it('reserves the five companion tier frames for P4 (GDD 11-7)', () => {
    const tiers = Object.keys(PALETTE).filter((name) => name.startsWith('tier'))

    expect(tiers).toHaveLength(5)
  })

  it('gives Acrux its contrast on the edge rather than in a shade (GDD 11-7)', () => {
    // A shade of #2B2B38 would vanish on the void, so the third slot buys a rim.
    expect(CHIP_COLOURS.ACR.edge).toBe(PALETTE.acruxEdge)
    expect(CHIP_COLOURS.ACR.symbol).not.toBe(CHIP_COLOURS.ACR.base)
  })
})

describe('suit glyphs', () => {
  it('are five distinguishable symbols on a 16×16 grid', () => {
    const shapes = SUIT_ORDER.map((suit) => JSON.stringify(SUIT_GLYPHS[suit]))

    expect(new Set(shapes).size).toBe(SUIT_ORDER.length)
    for (const suit of SUIT_ORDER) {
      expect(SUIT_GLYPHS[suit]).toHaveLength(SPRITE_SIZE)
      expect(SUIT_GLYPHS[suit][0]).toHaveLength(SPRITE_SIZE)
      expect(countOf(SUIT_GLYPHS[suit])).toBeGreaterThan(0)
    }
  })

  it('leaves ink on both halves so a composed chip reads on either side', () => {
    for (const suit of SUIT_ORDER) {
      const left = SUIT_GLYPHS[suit].map((row) => row.slice(0, SPRITE_SIZE / 2))
      const right = SUIT_GLYPHS[suit].map((row) => row.slice(SPRITE_SIZE / 2))

      expect(countOf(left)).toBeGreaterThan(0)
      expect(countOf(right)).toBeGreaterThan(0)
    }
  })
})

describe('basic chips', () => {
  it('fill exactly the disc, edge included', () => {
    for (const suit of SUIT_ORDER) {
      expect(filled(basicChip(suit)).sort()).toEqual(filled(discAsSprite()).sort())
    }
  })

  function discAsSprite(): PixelMap {
    return DISC.map((row) => row.map((on) => (on ? '#' : null)))
  }
})

describe('special chips (GDD 3-2)', () => {
  it('are all ten pairs, composed from the five basics with nothing hand-drawn', () => {
    expect(SPECIAL_SUIT_PAIRS).toHaveLength(10)

    for (const [left, right] of SPECIAL_SUIT_PAIRS) {
      const composed = specialChip(left, right)
      const a = basicChip(left)
      const b = basicChip(right)

      for (let row = 0; row < SPRITE_SIZE; row++) {
        expect(composed[row].slice(0, SPRITE_SIZE / 2)).toEqual(a[row].slice(0, SPRITE_SIZE / 2))
        expect(composed[row].slice(SPRITE_SIZE / 2)).toEqual(b[row].slice(SPRITE_SIZE / 2))
      }
    }
  })

  it('produces ten visibly different chips', () => {
    const sprites = SPECIAL_SUIT_PAIRS.map(([l, r]) => JSON.stringify(specialChip(l, r)))

    expect(new Set(sprites).size).toBe(SPECIAL_SUIT_PAIRS.length)
  })
})

describe('drifter chip (GDD 11-6)', () => {
  it('has a silhouette no suit chip shares', () => {
    const drifter = filled(drifterChip()).sort()

    for (const suit of SUIT_ORDER) {
      expect(drifter).not.toEqual(filled(basicChip(suit)).sort())
    }
  })

  it('carries no suit symbol — only suit bases, refracted', () => {
    const symbols = new Set(SUIT_ORDER.map((suit) => CHIP_COLOURS[suit].symbol))
    const used = new Set(drifterChip().flat().filter((cell): cell is string => cell !== null))

    for (const symbol of symbols) expect(used.has(symbol)).toBe(false)
    expect(used.has(PALETTE.starWhite)).toBe(true)
  })
})

describe('constellation icons (GDD 11-5)', () => {
  it('draws one for every constellation, joined into a star chart', () => {
    expect(ALL_IDS).toHaveLength(12)

    for (const id of ALL_IDS) {
      const icon = constellationIcon(id)

      expect(icon).toHaveLength(SPRITE_SIZE)
      expect(filled(icon).length).toBeGreaterThan(0)
      // Every pattern but the global one is a shape, so it has joins to draw.
      const joined = countOf(CONSTELLATION_GLYPHS[id].lines) > 0
      expect(joined).toBe(CONSTELLATION_RULES[id].axis !== 'global')
    }
  })

  it('colours each axis family apart', () => {
    const hueOf = (id: ConstellationId) => AXIS_COLOURS[CONSTELLATION_RULES[id].axis]

    expect(hueOf('aries')).toBe(hueOf('sagittarius'))
    expect(hueOf('libra')).toBe(hueOf('leo'))
    expect(hueOf('gemini')).toBe(hueOf('scorpio'))

    const families = [hueOf('aries'), hueOf('libra'), hueOf('gemini'), hueOf('aquarius'), hueOf('cancer')]
    expect(new Set(families).size).toBe(5)
  })

  it('burns brighter as the run gets longer, within one family', () => {
    // GDD 11-5: inside a family the grade reads from star count and glow.
    const glow = (id: ConstellationId) => countOf(CONSTELLATION_GLYPHS[id].glow)
    const stars = (id: ConstellationId) => countOf(CONSTELLATION_GLYPHS[id].stars)

    for (const family of [
      ['aries', 'capricorn', 'sagittarius'],
      ['libra', 'pisces', 'leo'],
      ['gemini', 'taurus', 'scorpio'],
    ] as const) {
      const [three, four, five] = family
      expect(stars(three)).toBeLessThan(stars(four))
      expect(stars(four)).toBeLessThan(stars(five))
      expect(glow(three)).toBeLessThan(glow(four))
      expect(glow(four)).toBeLessThan(glow(five))
    }
  })

  it('keeps the join visible under the corona, at every grade', () => {
    // The corona of a long run covers the gaps between its stars, so if it were
    // painted last the line would disappear exactly where it does the most work.
    for (const id of ['aries', 'capricorn', 'sagittarius'] as const) {
      const used = new Set(
        constellationIcon(id)
          .flat()
          .filter((cell): cell is string => cell !== null),
      )

      expect(used.has(AXIS_COLOURS.vertical)).toBe(true)
      expect(used.has(PALETTE.starDim)).toBe(true)
    }
    expect(
      new Set(
        constellationIcon('sagittarius')
          .flat()
          .filter((cell): cell is string => cell !== null),
      ).has(PALETTE.textDim),
    ).toBe(true)
  })
})
