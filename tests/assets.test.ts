// P3-A: the art pipeline. These check the things a screenshot cannot — that the
// chip colours still match GDD 3-1, that the palette stays inside its budget,
// that the ten special chips really are composed rather than drawn, and that the
// chip's layers are symmetric enough for the seam to be invisible.

import { describe, expect, it } from 'vitest'
import { basicChip, constellationCard, drifterChip, specialChip } from '../src/assets/compose'
import type { PixelMap } from '../src/assets/compose'
import { AXIS_COLOURS, CHIP_COLOURS, PALETTE, luma } from '../src/assets/palette'
import {
  CARD_FRAME,
  CARD_HEIGHT,
  CARD_WIDTH,
  CHIP_SIZE,
  CONSTELLATION_CHARTS,
  CROWN_GLYPH,
  GLYPH_SIZE,
  GRID_CELLS,
  SUIT_GLYPHS,
  chipLayerAt,
  scoringCells,
} from '../src/assets/pixels'
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

const countOf = (m: Mask): number => m.flat().filter(Boolean).length

const coloursIn = (sprite: PixelMap): Set<string> =>
  new Set(sprite.flat().filter((cell): cell is string => cell !== null))

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
    expect(Object.keys(PALETTE).filter((name) => name.startsWith('tier'))).toHaveLength(5)
  })

  it('gives Acrux its contrast on the edge rather than in a shade (GDD 11-7)', () => {
    // A shade of #2B2B38 would vanish on the void, so the third slot buys a rim.
    expect(CHIP_COLOURS.ACR.edge).toBe(PALETTE.acruxEdge)
    expect(CHIP_COLOURS.ACR.symbol).not.toBe(CHIP_COLOURS.ACR.base)
  })
})

describe('suit glyphs', () => {
  it('are five distinguishable 16×16 symbols, still (GDD 11-4)', () => {
    // The chip grew to 32×32 by placing these in the middle, not by redrawing them.
    const shapes = SUIT_ORDER.map((suit) => JSON.stringify(SUIT_GLYPHS[suit]))
    expect(new Set(shapes).size).toBe(SUIT_ORDER.length)

    for (const suit of SUIT_ORDER) {
      expect(SUIT_GLYPHS[suit]).toHaveLength(GLYPH_SIZE)
      expect(SUIT_GLYPHS[suit][0]).toHaveLength(GLYPH_SIZE)
      expect(countOf(SUIT_GLYPHS[suit])).toBeGreaterThan(0)
    }
  })

  it('leaves ink on both halves so a composed chip reads on either side', () => {
    for (const suit of SUIT_ORDER) {
      const left = SUIT_GLYPHS[suit].map((row) => row.slice(0, GLYPH_SIZE / 2))
      const right = SUIT_GLYPHS[suit].map((row) => row.slice(GLYPH_SIZE / 2))

      expect(countOf(left)).toBeGreaterThan(0)
      expect(countOf(right)).toBeGreaterThan(0)
    }
  })
})

describe('chip geometry (GDD 11-4)', () => {
  it('mirrors every layer about the seam, so a halved chip has no visible break', () => {
    for (let row = 0; row < CHIP_SIZE; row++) {
      for (let col = 0; col < CHIP_SIZE; col++) {
        expect(chipLayerAt(row, col)).toBe(chipLayerAt(row, CHIP_SIZE - 1 - col))
      }
    }
  })

  it('carries all four layers plus six notches', () => {
    const layers = new Set<string>()
    let notchRuns = 0
    // Counting notch arcs along the outermost ring gives the notch count directly.
    for (let row = 0; row < CHIP_SIZE; row++) {
      for (let col = 0; col < CHIP_SIZE; col++) layers.add(chipLayerAt(row, col))
    }

    const ringCells: boolean[] = []
    const centre = (CHIP_SIZE - 1) / 2
    for (let step = 0; step < 360; step++) {
      const angle = (step * Math.PI) / 180
      const row = Math.round(centre + Math.sin(angle) * 13)
      const col = Math.round(centre + Math.cos(angle) * 13)
      ringCells.push(chipLayerAt(row, col) === 'notch')
    }
    for (let i = 0; i < ringCells.length; i++) {
      if (ringCells[i] && !ringCells[(i - 1 + ringCells.length) % ringCells.length]) notchRuns++
    }

    expect(layers).toContain('rim')
    expect(layers).toContain('notch')
    expect(layers).toContain('ring')
    expect(layers).toContain('dot')
    expect(notchRuns).toBe(6)
  })

  it('renders a 32×32 chip that shows every layer colour', () => {
    for (const suit of SUIT_ORDER) {
      const chip = basicChip(suit)
      expect(chip).toHaveLength(CHIP_SIZE)
      expect(chip[0]).toHaveLength(CHIP_SIZE)

      const used = coloursIn(chip)
      expect(used.has(CHIP_COLOURS[suit].base)).toBe(true)
      expect(used.has(CHIP_COLOURS[suit].edge)).toBe(true)
      expect(used.has(CHIP_COLOURS[suit].symbol)).toBe(true)
    }
  })
})

describe('special chips (GDD 3-2)', () => {
  it('are all ten pairs, composed from the five basics with nothing hand-drawn', () => {
    expect(SPECIAL_SUIT_PAIRS).toHaveLength(10)

    for (const [left, right] of SPECIAL_SUIT_PAIRS) {
      const composed = specialChip(left, right)
      const a = basicChip(left)
      const b = basicChip(right)

      for (let row = 0; row < CHIP_SIZE; row++) {
        expect(composed[row].slice(0, CHIP_SIZE / 2)).toEqual(a[row].slice(0, CHIP_SIZE / 2))
        expect(composed[row].slice(CHIP_SIZE / 2)).toEqual(b[row].slice(CHIP_SIZE / 2))
      }
    }
  })

  it('keeps the ring and notches continuous across the seam', () => {
    // Both halves are mirror images, so the two columns either side of the cut
    // must belong to the same layer or the join would show as a step.
    const composed = specialChip('GAC', 'ACR')
    for (let row = 0; row < CHIP_SIZE; row++) {
      const leftOfSeam = chipLayerAt(row, CHIP_SIZE / 2 - 1)
      const rightOfSeam = chipLayerAt(row, CHIP_SIZE / 2)
      expect(leftOfSeam).toBe(rightOfSeam)
      expect(composed[row][CHIP_SIZE / 2 - 1] === null).toBe(composed[row][CHIP_SIZE / 2] === null)
    }
  })

  it('produces ten visibly different chips', () => {
    const sprites = SPECIAL_SUIT_PAIRS.map(([l, r]) => JSON.stringify(specialChip(l, r)))
    expect(new Set(sprites).size).toBe(SPECIAL_SUIT_PAIRS.length)
  })
})

describe('drifter chip (GDD 11-6)', () => {
  it('is the same chip as any other, not an oddity', () => {
    const shapeOf = (sprite: PixelMap) =>
      JSON.stringify(sprite.map((row) => row.map((cell) => cell !== null)))

    // It belongs on the board as a chip; what sets it apart is colour and mark.
    expect(shapeOf(drifterChip())).toBe(shapeOf(basicChip('GAC')))
  })

  it('wears the crown, and none of the five suit symbols', () => {
    const drifter = drifterChip()
    const centre = (sprite: PixelMap) =>
      JSON.stringify(
        Array.from({ length: GLYPH_SIZE }, (_, row) =>
          Array.from(
            { length: GLYPH_SIZE },
            (_, col) => sprite[row + (CHIP_SIZE - GLYPH_SIZE) / 2][col + (CHIP_SIZE - GLYPH_SIZE) / 2],
          ),
        ),
      )

    for (const suit of SUIT_ORDER) expect(centre(drifter)).not.toBe(centre(basicChip(suit)))
    expect(countOf(CROWN_GLYPH)).toBeGreaterThan(0)
    expect(CROWN_GLYPH).toHaveLength(GLYPH_SIZE)
  })

  it('carries a rainbow field, so it reads as no single suit', () => {
    const rows = drifterChip().map((row) => row[CHIP_SIZE / 2])
    const distinct = new Set(rows.filter((cell): cell is string => cell !== null))

    // A suit chip has a handful of colours down its middle; a gradient has many.
    expect(distinct.size).toBeGreaterThan(
      new Set(basicChip('GAC').map((row) => row[CHIP_SIZE / 2])).size,
    )
  })
})

describe('constellation cards (GDD 11-5)', () => {
  it('draws a 32×48 card for every constellation', () => {
    expect(ALL_IDS).toHaveLength(12)

    for (const id of ALL_IDS) {
      const card = constellationCard(id)
      expect(card).toHaveLength(CARD_HEIGHT)
      expect(card[0]).toHaveLength(CARD_WIDTH)
    }
  })

  it('carries a 2px frame with dropped corners', () => {
    for (const id of ALL_IDS) {
      const card = constellationCard(id)

      expect(card[0][CARD_WIDTH / 2]).not.toBeNull()
      expect(card[CARD_FRAME - 1][CARD_WIDTH / 2]).not.toBeNull()
      // Corners are dropped, which is what rounds the card at this size.
      expect(card[0][0]).toBeNull()
      expect(card[CARD_HEIGHT - 1][CARD_WIDTH - 1]).toBeNull()
    }
  })

  it('never lets the frame out-shine the chart (GDD 11-5)', () => {
    // The subject is the figure. If a frame star burns brighter than the stars
    // inside, the eye goes to the border and the card stops being readable.
    for (const id of ALL_IDS) {
      const card = constellationCard(id)
      const chart = CONSTELLATION_CHARTS[id]
      const chartMean =
        chart.stars.reduce(
          (total, entry) => total + luma(entry.mag === 2 ? PALETTE.starGlow : PALETTE.starWhite),
          0,
        ) / chart.stars.length

      let brightestFrame = 0
      for (let row = 0; row < CARD_HEIGHT; row++) {
        for (let col = 0; col < CARD_WIDTH; col++) {
          const inFrame =
            row < CARD_FRAME ||
            col < CARD_FRAME ||
            row >= CARD_HEIGHT - CARD_FRAME ||
            col >= CARD_WIDTH - CARD_FRAME
          const cell = card[row][col]
          if (inFrame && cell !== null) brightestFrame = Math.max(brightestFrame, luma(cell))
        }
      }

      expect(brightestFrame).toBeLessThan(chartMean)
    }
  })

  it('lays the 5×5 board under the chart, lighting only what scores', () => {
    for (const id of ALL_IDS) {
      const rule = CONSTELLATION_RULES[id]
      const cells = scoringCells(id)

      if (rule.axis === 'global') expect(cells).toHaveLength(GRID_CELLS * GRID_CELLS)
      else if (rule.length !== null) expect(cells).toHaveLength(rule.length)

      for (const [row, col] of cells) {
        expect(row).toBeGreaterThanOrEqual(0)
        expect(row).toBeLessThan(GRID_CELLS)
        expect(col).toBeGreaterThanOrEqual(0)
        expect(col).toBeLessThan(GRID_CELLS)
      }
    }

    // A run of 3 down the middle column, which is what aries scores.
    expect(scoringCells('aries')).toEqual([
      [1, 2],
      [2, 2],
      [3, 2],
    ])
    expect(scoringCells('libra')).toEqual([
      [2, 1],
      [2, 2],
      [2, 3],
    ])
  })

  it('keeps the board quieter than the figure drawn on it', () => {
    // Grid tones are mixed toward the card's background, so every one of them
    // has to sit below the dimmest thing the chart itself draws.
    for (const id of ALL_IDS) {
      const card = constellationCard(id)
      const chartArea = card
        .slice(CARD_FRAME, CARD_HEIGHT - CARD_FRAME)
        .map((row) => row.slice(CARD_FRAME, CARD_WIDTH - CARD_FRAME))
      const board = coloursIn(chartArea).values()

      for (const colour of board) {
        const isChart =
          colour === PALETTE.starWhite || colour === PALETTE.starGlow || colour === PALETTE.starLink
        if (!isChart && colour !== PALETTE.panelEdge) {
          expect(luma(colour)).toBeLessThan(luma(PALETTE.starLink))
        }
      }
    }
  })

  it('gives every axis family its own frame colour', () => {
    const hueOf = (id: ConstellationId) => AXIS_COLOURS[CONSTELLATION_RULES[id].axis]

    expect(hueOf('aries')).toBe(hueOf('sagittarius'))
    expect(hueOf('libra')).toBe(hueOf('leo'))
    expect(hueOf('gemini')).toBe(hueOf('scorpio'))
    expect(hueOf('aquarius')).toBe(hueOf('virgo'))

    const families = [hueOf('aries'), hueOf('libra'), hueOf('gemini'), hueOf('virgo'), hueOf('cancer')]
    expect(new Set(families).size).toBe(5)
  })

  it('draws a real figure: stars joined into a chart, in blue-white', () => {
    for (const id of ALL_IDS) {
      const chart = CONSTELLATION_CHARTS[id]
      expect(chart.stars.length).toBeGreaterThanOrEqual(4)
      expect(chart.links.length).toBeGreaterThanOrEqual(3)

      for (const [from, to] of chart.links) {
        expect(chart.stars[from]).toBeDefined()
        expect(chart.stars[to]).toBeDefined()
      }
      const used = coloursIn(constellationCard(id))
      expect(used.has(PALETTE.starLink)).toBe(true)
      expect(used.has(PALETTE.starWhite) || used.has(PALETTE.starGlow)).toBe(true)
    }
  })

  it('keeps every star inside the frame', () => {
    for (const id of ALL_IDS) {
      for (const { x, y } of CONSTELLATION_CHARTS[id].stars) {
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(CARD_WIDTH - 6)
        expect(y).toBeLessThan(CARD_HEIGHT - 8)
      }
    }
  })
})
