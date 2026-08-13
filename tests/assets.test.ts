// P3-A: the art pipeline. These check the things a screenshot cannot — that the
// chip colours still match GDD 3-1, that the palette stays inside its budget,
// that the ten special chips really are composed rather than drawn, and that the
// chip's layers are symmetric enough for the seam to be invisible.

import { describe, expect, it } from 'vitest'
import {
  basicChip,
  constellationCard,
  drifterChip,
  lockIcon,
  nebulaSprite,
  orionSprite,
  pixelWordMap,
  siriusSymbol,
  specialChip,
  suitGlyph,
} from '../src/assets/compose'
import type { PixelMap } from '../src/assets/compose'
import type { NebulaLayer, OrionLayer } from '../src/assets/pixels'
import {
  AXIS_COLOURS,
  CHIP_COLOURS,
  NEBULA_INK,
  PALETTE,
  SIRIUS_INK,
  luma,
} from '../src/assets/palette'
import type { OrionMood } from '../src/assets/palette'
import {
  CARD_FRAME,
  CARD_HEIGHT,
  CARD_WIDTH,
  CHIP_SIZE,
  CONSTELLATION_CHARTS,
  CROWN_GLYPH,
  GLYPH_SIZE,
  LOCK_SIZE,
  NEBULA_FADE_TOP,
  NEBULA_HEIGHT,
  NEBULA_WIDTH,
  ORION_ARM_GAP,
  ORION_HEIGHT,
  ORION_SHOULDER_Y,
  ORION_WIDTH,
  PIXEL_GLYPHS,
  PIXEL_GLYPH_BASELINE,
  PIXEL_GLYPH_HEIGHT,
  PIXEL_GLYPH_WIDTH,
  PIXEL_WORDS,
  SIRIUS_ICON_SIZES,
  SIRIUS_SIZE,
  SUIT_GLYPHS,
  nebulaLayers,
  chipLayerAt,
  orionLayers,
  pixelWord,
  siriusLayers,
  skyOf,
} from '../src/assets/pixels'
import type { Mask } from '../src/assets/pixels'
import { MOOD_OF, ORION_LINES } from '../src/ui/dialogue'
import type { Beat } from '../src/ui/dialogue'
import { CONSTELLATION_RULES, SPECIAL_SUIT_PAIRS } from '../src/core/config'
import { mulberry32 } from '../src/core/rng'
import { createStartingLoadout, rollStock } from '../src/core/shop'
import { SUIT_ORDER } from '../src/core/types'
import type { ConstellationId, SuitId } from '../src/core/types'

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

describe('UI sprites', () => {
  it('draws a padlock small enough to badge a chip without hiding its symbol', () => {
    const lock = lockIcon()

    expect(lock).toHaveLength(LOCK_SIZE)
    expect(lock[0]).toHaveLength(LOCK_SIZE)
    // A chip is 32×32 with its symbol in the middle 16 (GDD 11-4), so a badge in
    // the corner has 8px of clear margin to sit in on each side.
    expect(LOCK_SIZE).toBeLessThan((CHIP_SIZE - GLYPH_SIZE) / 2 + GLYPH_SIZE)
    expect(coloursIn(lock)).toEqual(new Set([PALETTE.starWhite]))
  })

  it('inks a suit symbol in a colour that survives the void', () => {
    for (const suit of SUIT_ORDER) {
      const colours = coloursIn(suitGlyph(suit))

      expect(colours.size).toBe(1)
      // GDD 11-7 flags Acrux: its base is all but the background, so the symbol
      // takes the bright edge instead and stays readable on a dark panel.
      const ink = [...colours][0]
      expect(luma(ink)).toBeGreaterThan(luma(PALETTE.panel))
    }
  })
})

describe('иєвυℓα (GDD 11-9)', () => {
  it('is 60×78, the same frame ORION gets (GDD 11-4)', () => {
    const sprite = nebulaSprite()

    expect(sprite).toHaveLength(NEBULA_HEIGHT)
    expect(sprite[0]).toHaveLength(NEBULA_WIDTH)
    expect(NEBULA_HEIGHT).toBe(78)
    expect(NEBULA_WIDTH).toBe(60)
  })

  // The hood interior, graded from the eyes outward. A flat dark patch the shape
  // of a face reads as a hole punched through her, not as a face in shadow —
  // that is what the first version did, and it is why she read as a nozzle.
  it('lights the inside of the hood instead of cutting a hole in it', () => {
    const layers = nebulaLayers()
    const count = (name: NebulaLayer) => layers.flat().filter((l) => l === name).length

    // All four steps are present, so the light actually falls off rather than
    // sitting on the shade as a sticker.
    for (const step of ['hollow', 'hollowLit', 'glow', 'eye'] as const) {
      expect(count(step), step).toBeGreaterThan(0)
    }
    // Nothing inside her is the background colour. This is the rule the hole broke.
    expect(nebulaSprite().flat().filter((c) => c === PALETTE.void)).toHaveLength(0)
  })

  // GDD 11-9: a gaze needs two points and a gap. One blob is a lamp.
  it('gives her a pair of eyes, not one light', () => {
    const eyes = nebulaLayers().flatMap((row, y) =>
      row.flatMap((layer, x) => (layer === 'eye' ? [{ x, y }] : [])),
    )

    expect(eyes.length).toBeGreaterThan(4)
    const columns = eyes.map((e) => e.x)
    const left = columns.filter((x) => x < NEBULA_WIDTH / 2)
    const right = columns.filter((x) => x > NEBULA_WIDTH / 2)
    expect(left.length).toBeGreaterThan(0)
    expect(right.length).toBeGreaterThan(0)
    // A gap between them, rather than one wide band straddling the centre line.
    expect(Math.min(...right) - Math.max(...left)).toBeGreaterThan(1)
  })

  // GDD 11-9: humanoid enough to read as somebody standing there. Arms are what
  // the first version had none of, and a cone with a dome on top is a rocket.
  it('has shoulders wider than its head, and two sleeves at different heights', () => {
    const layers = nebulaLayers()
    const spanAt = (y: number) => {
      const on = layers[y].flatMap((l, x) => (l === 'outside' ? [] : [x]))
      return on.length === 0 ? 0 : Math.max(...on) - Math.min(...on) + 1
    }
    const headWidth = Math.max(...Array.from({ length: 24 }, (_, y) => spanAt(y + 4)))
    const shoulderWidth = Math.max(...Array.from({ length: 12 }, (_, y) => spanAt(y + 30)))

    expect(shoulderWidth).toBeGreaterThan(headWidth)

    const sleeveRows = layers.flatMap((row, y) => (row.includes('sleeve') ? [y] : []))
    expect(sleeveRows.length).toBeGreaterThan(10)
    // The two lobes start on different rows — matching ones would put the mirror
    // symmetry back, which is the other half of the nozzle reading.
    const sleeveTop = (side: (x: number) => boolean) =>
      layers.findIndex((row) => row.some((l, x) => l === 'sleeve' && side(x)))
    expect(sleeveTop((x) => x < NEBULA_WIDTH / 2)).not.toBe(
      sleeveTop((x) => x > NEBULA_WIDTH / 2),
    )
  })

  // GDD 11-9, and the trap that has now caught this sprite twice: below the
  // shoulders she must not be her own mirror, or the robe reads as a nozzle.
  it('is not mirror-symmetric below the shoulders', () => {
    const layers = nebulaLayers()
    let same = 0
    let compared = 0
    for (let y = 40; y < NEBULA_HEIGHT; y++) {
      for (let x = 0; x < NEBULA_WIDTH; x++) {
        compared++
        if (layers[y][x] === layers[y][NEBULA_WIDTH - 1 - x]) same++
      }
    }

    expect(same / compared).toBeLessThan(0.9)
  })

  // GDD 11-9, the fourth thing that must not come back. One bright pink all the
  // way round her broke the brightness rule outright — the outline out-shone the
  // eyes, so the look went round her edge instead of landing on her face — and
  // it closed a silhouette that is supposed to scatter, which is what made her
  // read as a sticker on the background.
  it('never lets the outline out-shine the eyes, in any mood', () => {
    const layers = nebulaLayers()
    const lumaOf = (sprite: PixelMap, name: NebulaLayer) =>
      layers.flatMap((row, y) => row.flatMap((l, x) => (l === name ? [luma(sprite[y][x]!)] : [])))

    for (const mood of ['idle', 'keen', 'dealt'] as const) {
      const rim = lumaOf(nebulaSprite(mood), 'rim')
      const eyes = lumaOf(nebulaSprite(mood), 'eye')

      expect(Math.max(...rim), mood).toBeLessThan(Math.min(...eyes))
      // And it is a falloff, not one tone held below a limit: the far end of the
      // rim *is* the veil, which is how the hem ends up with no outline at all.
      expect(Math.min(...rim), mood).toBe(luma(NEBULA_INK.veil))
      expect(Math.max(...rim) - Math.min(...rim), mood).toBeGreaterThan(20)
    }
  })

  // GDD 11-9: she does not end on a line. A hem contour, however carefully
  // computed, is still an edge — and the one she had notched up the middle,
  // which read as the gap between two legs.
  it('runs out by density below the waist rather than stopping on an edge', () => {
    const layers = nebulaLayers()
    const filled = (y: number) => layers[y].filter((l) => l !== 'outside').length

    for (let y = NEBULA_FADE_TOP + 1; y < NEBULA_HEIGHT; y++) {
      expect(filled(y), `row ${y} against row ${y - 1}`).toBeLessThanOrEqual(filled(y - 1))
    }
    // And it really runs out: a full row of cloth at the waist, nothing at all on
    // the last row, so the fall is a fade and not a flat line of one pixel.
    expect(filled(NEBULA_FADE_TOP)).toBeGreaterThan(20)
    expect(filled(NEBULA_HEIGHT - 1)).toBe(0)
  })

  // GDD 11-9: her purple must not merge with the Mimosa chips on the board.
  it('keeps the veil clear of the Mimosa chip', () => {
    expect(NEBULA_INK.veil).not.toBe(PALETTE.mimosa)
    // Separated by value, not only by hue — a dark plum against a mid purple.
    expect(luma(PALETTE.mimosa) - luma(NEBULA_INK.veil)).toBeGreaterThan(40)
    // And the diagonal-axis magenta stays reserved for the cards (GDD 11-5).
    expect(Object.values(NEBULA_INK)).not.toContain(PALETTE.nebulaMagenta)
  })

  it('answers with light rather than a face, one tone per mood', () => {
    const glows = (['idle', 'keen', 'dealt'] as const).map((mood) => {
      const sprite = nebulaSprite(mood)
      return nebulaLayers()
        .flatMap((row, y) => row.map((layer, x) => (layer === 'glow' ? sprite[y][x] : null)))
        .find((c): c is string => c !== null)!
    })

    expect(new Set(glows).size).toBe(3)
    // Interest and a closed deal read brighter than resting.
    expect(luma(glows[1])).toBeGreaterThan(luma(glows[0]))
    expect(luma(glows[2])).toBeGreaterThan(luma(glows[1]))
  })
})

// BOOTH-6c: ORION's 60×78 map (GDD 11-8). These are the three things the sprite has
// to be checked against that a screenshot cannot settle — the brightness order, that
// the anatomy is there, and that no two parts are told apart by hue alone.
describe('ORION (GDD 11-8)', () => {
  const MOODS: OrionMood[] = ['calm', 'surprised', 'pleased', 'dim']

  /** Solid columns of a row, as [start, end] runs. */
  const runsOf = (layers: readonly (readonly OrionLayer[])[], y: number): [number, number][] => {
    const out: [number, number][] = []
    let start = -1
    layers[y].forEach((layer, x) => {
      const on = layer !== 'outside'
      if (on && start < 0) start = x
      if (!on && start >= 0) {
        out.push([start, x - 1])
        start = -1
      }
    })
    if (start >= 0) out.push([start, layers[y].length - 1])
    return out
  }

  const countOfLayer = (layers: readonly (readonly OrionLayer[])[], want: OrionLayer): number =>
    layers.flat().filter((layer) => layer === want).length

  it('is 60×78, the same frame иєвυℓα gets (GDD 11-4)', () => {
    for (const mood of MOODS) {
      const sprite = orionSprite(mood)

      expect(sprite).toHaveLength(ORION_HEIGHT)
      for (const row of sprite) expect(row).toHaveLength(ORION_WIDTH)
    }
    expect(ORION_WIDTH).toBe(NEBULA_WIDTH)
    expect(ORION_HEIGHT).toBe(NEBULA_HEIGHT)
  })

  // ① Brightness order, outline included. His face is the brightest thing on him,
  // because that is where the four expressions live — the mirror of GDD 11-9, where
  // the light inside the hood is the brightest and she has no face at all.
  it('never lets the outline or a filament out-shine his face, in any mood', () => {
    for (const mood of MOODS) {
      const layers = orionLayers(mood)
      const sprite = orionSprite(mood)
      const lumaOf = (want: OrionLayer) =>
        layers.flatMap((row, y) =>
          row.flatMap((layer, x) => (layer === want ? [luma(sprite[y][x] as string)] : [])),
        )

      const skin = Math.max(...lumaOf('skin'))
      for (const part of ['rim', 'filament', 'cloud', 'cloudDeep', 'skinShade'] as const) {
        const values = lumaOf(part)
        expect(values.length, `${mood}: no ${part}`).toBeGreaterThan(0)
        expect(Math.max(...values), `${mood}: ${part} vs skin`).toBeLessThan(skin)
      }
    }
  })

  // The rim also has to *stop* being a rim. GDD 11-9's forbidden #4: one bright line
  // all the way round a silhouette reads as a sticker on the background, and the
  // ceiling alone does not buy that — the far end has to sink into the body.
  it('fades the outline into the body at the far end from his face', () => {
    const layers = orionLayers('calm')
    const sprite = orionSprite('calm')
    const rim = layers.flatMap((row, y) =>
      row.flatMap((layer, x) => (layer === 'rim' ? [{ y, luma: luma(sprite[y][x] as string) }] : [])),
    )
    const near = rim.filter((pixel) => pixel.y < ORION_HEIGHT / 3)
    const far = rim.filter((pixel) => pixel.y > (ORION_HEIGHT * 2) / 3)

    // It dims with distance from his face.
    expect(Math.max(...near.map((p) => p.luma))).toBeGreaterThan(
      Math.max(...far.map((p) => p.luma)) + 12,
    )

    // And somewhere it has stopped being an outline at all: the dimmest rim pixel is
    // the colour of the body on its own row, give or take a value. That is the half
    // of GDD 11-9's forbidden #4 a ceiling does not buy — a silhouette closed by an
    // unbroken bright line reads as a sticker however dim the line is.
    const bodyOn = (y: number) => {
      const x = layers[y].findIndex((layer) => layer === 'cloud')
      return x < 0 ? null : luma(sprite[y][x] as string)
    }
    const gaps = rim.flatMap((pixel) => {
      const body = bodyOn(pixel.y)
      return body === null ? [] : [Math.abs(pixel.luma - body)]
    })

    expect(Math.min(...gaps)).toBeLessThan(5)
  })

  // ② The anatomy. A head wider than the neck under it, a neck narrower than the
  // shoulders under that, and two arms — each standing off the body by the gap that
  // GDD 11-9's remaining-work list found is what makes an arm read at all.
  it('has a head, a neck, and two arms held off the body', () => {
    const layers = orionLayers('calm')
    const width = (y: number) => layers[y].filter((layer) => layer !== 'outside').length

    // The neck: narrower than the head above it and the shoulders below it.
    expect(width(15)).toBeGreaterThan(width(29))
    expect(width(ORION_SHOULDER_Y)).toBeGreaterThan(width(29))

    // Three runs across a row through both arms: arm, body, arm.
    const midArm = runsOf(layers, 43)
    expect(midArm, `runs at y=43: ${JSON.stringify(midArm)}`).toHaveLength(3)
    for (const [start, end] of [midArm[0], midArm[2]]) {
      expect(end - start).toBeGreaterThanOrEqual(2)
    }
    // And the gaps either side of the body are the ones that were carved for it.
    expect(midArm[1][0] - midArm[0][1] - 1).toBeGreaterThanOrEqual(ORION_ARM_GAP)
    expect(midArm[2][0] - midArm[1][1] - 1).toBeGreaterThanOrEqual(ORION_ARM_GAP)
  })

  // The arms are welded where they leave the shoulder. An arm that is a free-floating
  // blob at every row is not an arm, which is what an earlier draft produced — and
  // the row each one welds on differs, because the two sides run on different lobe
  // phases, so this asks the question per arm rather than at one chosen row.
  it('joins each arm to the body at the shoulder', () => {
    const layers = orionLayers('calm')
    const centre = Math.round((ORION_WIDTH - 1) / 2)
    const runAt = (y: number, x: number) =>
      runsOf(layers, y).find(([start, end]) => x >= start && x <= end)

    for (const [side, top] of [
      [-1, 32],
      [1, 34],
    ] as const) {
      // The row under each arm's first: the arm is at width by then and still on the
      // body. The pixel one in from its outer edge has to sit in the run the centre
      // column is in — which is to say there is no gap between them yet.
      const y = top + 1
      const runs = runsOf(layers, y)
      const outer = side < 0 ? runs[0][0] + 1 : runs[runs.length - 1][1] - 1

      expect(runAt(y, outer), `arm ${side} at y=${y}`).toEqual(runAt(y, centre))
    }
  })

  // ③ Contrast between parts, so nothing is told apart by hue alone — the case that
  // fails first for a player with colour-vision deficiency.
  it('separates every part from its neighbour by value, not only by hue', () => {
    const sprite = orionSprite('calm')
    const layers = orionLayers('calm')
    const tone = (want: OrionLayer) => {
      const found = layers.flatMap((row, y) =>
        row.flatMap((layer, x) => (layer === want ? [sprite[y][x] as string] : [])),
      )
      return luma(found[0])
    }

    // Skin against the body it stands in front of, at both ends of the gradient.
    expect(Math.abs(tone('skin') - tone('cloud'))).toBeGreaterThanOrEqual(10)
    // The jaw and arm shading against the skin it shades, and against the body.
    expect(Math.abs(tone('skin') - tone('skinShade'))).toBeGreaterThanOrEqual(10)
    expect(Math.abs(tone('skinShade') - tone('cloud'))).toBeGreaterThanOrEqual(10)
    // Gas structure against the gas around it.
    expect(Math.abs(tone('filament') - tone('cloud'))).toBeGreaterThanOrEqual(10)
    expect(Math.abs(tone('cloudDeep') - tone('cloud'))).toBeGreaterThanOrEqual(10)
  })

  // GDD 11-8: the body runs from Hα at the shoulders to the blue reflection nebula
  // at the bottom. The gradient is the whole of what makes it M42 and not a cloak.
  it('runs the body from Hα down to the reflection nebula', () => {
    const sprite = orionSprite('calm')
    const layers = orionLayers('calm')
    const cloudAt = (y: number) => {
      const x = layers[y].findIndex((layer) => layer === 'cloud')
      return x < 0 ? null : sprite[y][x] as string
    }
    const top = cloudAt(ORION_SHOULDER_Y + 6)
    const bottom = cloudAt(ORION_HEIGHT - 4)

    expect(top).not.toBeNull()
    expect(bottom).not.toBeNull()
    // Redder at the top, bluer at the bottom, measured off the channels themselves.
    const red = (hex: string) => parseInt(hex.slice(1, 3), 16)
    const blue = (hex: string) => parseInt(hex.slice(5, 7), 16)
    expect(red(top!)).toBeGreaterThan(red(bottom!))
    expect(blue(bottom!)).toBeGreaterThan(blue(top!))
  })

  // Unlike hers, his silhouette closes. GDD 11-9 makes the dissolving hem the line
  // between "person in a cloak" and "unknown thing", and he is on the other side of it.
  it('closes at the bottom instead of running out by density', () => {
    const layers = orionLayers('calm')
    const bottom = layers[ORION_HEIGHT - 1].filter((layer) => layer !== 'outside').length
    const waist = layers[56].filter((layer) => layer !== 'outside').length

    // Wider at the bottom edge than at the waist, and solid across it.
    expect(bottom).toBeGreaterThan(waist)
    expect(runsOf(layers, ORION_HEIGHT - 1)).toHaveLength(1)
  })

  // No pixel-level randomness anywhere, so a seed is not even consulted (CLAUDE.md §8).
  it('is the same sprite every time it is built', () => {
    for (const mood of MOODS) {
      expect(orionSprite(mood)).toEqual(orionSprite(mood))
    }
  })

  // GDD 11-8 asks for four, and four that look alike are one. The face is where they
  // differ, and the value shift is what carries them across a booth table.
  it('gives each of the four expressions a different face and a different value', () => {
    const faces = MOODS.map((mood) => {
      const layers = orionLayers(mood)
      return JSON.stringify([
        countOfLayer(layers, 'eye'),
        countOfLayer(layers, 'brow'),
        countOfLayer(layers, 'mouth'),
      ])
    })
    expect(new Set(faces).size).toBe(MOODS.length)

    const brightest = MOODS.map((mood) =>
      Math.max(
        ...orionSprite(mood)
          .flat()
          .filter((cell): cell is string => cell !== null)
          .map(luma),
      ),
    )
    expect(new Set(brightest).size).toBe(MOODS.length)
    // `dim` is the run ending, so it is the one that goes out.
    expect(Math.min(...brightest)).toBe(brightest[MOODS.indexOf('dim')])
  })

  // GDD 11-8 replaced '거래' with a face for the run ending, and every beat has to
  // land on one of the four — a beat with no face would render as whatever was last.
  it('gives every one of ORION`s beats one of the four faces', () => {
    for (const beat of Object.keys(ORION_LINES) as Beat[]) {
      expect(MOODS).toContain(MOOD_OF[beat])
    }
    // The two that must not be shared with anything else.
    expect(MOOD_OF.bigScore).toBe('surprised')
    expect(MOOD_OF.gameOver).toBe('dim')
  })

  it('keeps his tones out of the chip palette, so he is not made of pieces', () => {
    const colours = new Set(
      MOODS.flatMap((mood) =>
        orionSprite(mood)
          .flat()
          .filter((cell): cell is string => cell !== null),
      ),
    )

    for (const suit of SUIT_ORDER) {
      expect(colours.has(CHIP_COLOURS[suit].base)).toBe(false)
    }
  })
})

describe('constellation cards (GDD 11-5)', () => {
  it('draws a 36×52 card for every constellation', () => {
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

  it('gives every card its own sky', () => {
    // Twelve cards in a row must not read as twelve copies of one background.
    const skies = ALL_IDS.map((id) => JSON.stringify(skyOf(id)))

    expect(new Set(skies).size).toBe(ALL_IDS.length)
    for (const id of ALL_IDS) {
      const sky = skyOf(id)
      expect(sky.specks.length).toBeGreaterThan(20)
      expect(sky.nebulae.length).toBeGreaterThanOrEqual(1)
      expect(new Set(sky.specks.map((speck) => speck.kind)).size).toBeGreaterThan(1)
      // Redrawing a card must redraw the same card.
      expect(skyOf(id)).toEqual(sky)
    }
  })

  it('keeps the sky quieter than the figure drawn on it', () => {
    // Every background tone is mixed toward the card's own background, so all of
    // them sit below even the line colour the chart joins its stars with. A
    // brighter speck would read as one of the constellation's own stars.
    const chartColours = new Set<string>([PALETTE.starWhite, PALETTE.starGlow, PALETTE.starLink])

    for (const id of ALL_IDS) {
      const interior = constellationCard(id)
        .slice(CARD_FRAME, CARD_HEIGHT - CARD_FRAME)
        .map((row) => row.slice(CARD_FRAME, CARD_WIDTH - CARD_FRAME))

      for (const colour of coloursIn(interior)) {
        if (!chartColours.has(colour)) expect(luma(colour)).toBeLessThan(luma(PALETTE.starLink))
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

// P4-A. The shelf prints a label beside a composed chip and a shopper reads the
// two as one thing, so they must not be able to come apart. The suits are taken
// back *out of the label string* and checked against the pixels actually drawn —
// testing `specialChip(pair[0], pair[1])` against `pair` would only restate the
// call.
//
// Written after a report that `IMA&ACR` and `IMA&MIM` looked alike on the shelf.
// They do not share a rendering — Acrux's field is so near the background that
// what carries its half is the bright rim, which reads lavender next to Mimosa's
// purple. The shelf now names each half in its own suit's ink for that reason,
// and this pins the part that would have been a real bug.
describe('the shop shelf draws what its label says (GDD 3-2, 9-3)', () => {
  const stockedOver = (seeds: number) =>
    Array.from({ length: seeds }, (_, seed) =>
      rollStock(createStartingLoadout('aries'), mulberry32(seed)),
    )

  it('renders every stocked special as the two suits its label names', () => {
    for (const stock of stockedOver(40)) {
      for (const pair of stock.specials) {
        const label = `${pair[0]}&${pair[1]}`
        const [left, right] = label.split('&') as SuitId[]
        const chip = specialChip(pair[0], pair[1])
        const middle = chip[CHIP_SIZE / 2]

        expect(middle[6], `${label} left half`).toBe(CHIP_COLOURS[left].base)
        expect(middle[CHIP_SIZE - 7], `${label} right half`).toBe(CHIP_COLOURS[right].base)
      }
    }
  })

  it('never puts two chips on the shelf that render identically', () => {
    for (const stock of stockedOver(40)) {
      const drawn = stock.specials.map(([l, r]) => JSON.stringify(specialChip(l, r)))

      expect(new Set(drawn).size).toBe(drawn.length)
    }
  })
})

// ---------------------------------------------------------------- BOOTH-9a

// The three words GDD 11-9's treatment was extended to. What matters here is not
// how they look — `tools/glyph-proof.mjs` is for that — but that the table can spell
// every one of them and that the metric the whole thing rests on holds.
describe('pixel words (GDD 11-9, BOOTH-9a)', () => {
  it('has a glyph for every character of every word', () => {
    const missing = PIXEL_WORDS.flatMap((word) =>
      [...word].filter((c) => PIXEL_GLYPHS[c] === undefined).map((c) => `${word}: ${c}`),
    )
    expect(missing).toEqual([])
  })

  it('draws every glyph on the same 5×9 cell', () => {
    for (const [character, glyph] of Object.entries(PIXEL_GLYPHS)) {
      expect(glyph, character).toHaveLength(PIXEL_GLYPH_HEIGHT)
      for (const row of glyph) expect(row, character).toHaveLength(PIXEL_GLYPH_WIDTH)
    }
  })

  // ★ The metric that makes these sit on the Galmuri baseline: five rows of x-height
  // from row 2 to the baseline at row 7, which at 2× is the 10px Galmuri14 measures.
  // Every lowercase letter has to reach the x-height line and stop at the baseline;
  // one that stopped a row short would ride visibly high in a line of them.
  it('sets every lowercase letter on the x-height, from row 2 to the baseline', () => {
    const lower = Object.entries(PIXEL_GLYPHS).filter(([c]) => c === c.toLowerCase())

    for (const [character, glyph] of lower) {
      expect(glyph[2].some(Boolean), `${character} does not reach the x-height`).toBe(true)
      expect(
        glyph[PIXEL_GLYPH_BASELINE - 1].some(Boolean),
        `${character} does not reach the baseline`,
      ).toBe(true)
    }
  })

  // Only these four hang below the baseline. Anything else doing so is a stray pixel,
  // and it would push the whole word up by two rows at every call site.
  it('lets only γ ρ μ ς and Ц below the baseline', () => {
    const descending = Object.entries(PIXEL_GLYPHS)
      .filter(([, glyph]) => glyph.slice(PIXEL_GLYPH_BASELINE).some((row) => row.some(Boolean)))
      .map(([c]) => c)

    expect(new Set(descending)).toEqual(new Set(['γ', 'ρ', 'μ', 'ς', 'Ц']))
  })

  // The accent zone is one row, not two. Two put the acute 14px above the baseline —
  // taller than Galmuri14's capitals and the Hangul beside it (`pixels.ts`).
  it('keeps the accents of έ and ό off the top row', () => {
    for (const character of ['έ', 'ό']) {
      expect(PIXEL_GLYPHS[character][0].some(Boolean), `${character} uses row 0`).toBe(false)
      expect(PIXEL_GLYPHS[character][1].some(Boolean), `${character} has no accent`).toBe(true)
    }
  })

  it('composes a word at one cell per character plus a 1px gap', () => {
    for (const word of PIXEL_WORDS) {
      const map = pixelWord(word)
      const letters = [...word].length
      expect(map).toHaveLength(PIXEL_GLYPH_HEIGHT)
      expect(map[0]).toHaveLength(letters * (PIXEL_GLYPH_WIDTH + 1) - 1)
      // Every gap column is empty, or the letters would touch.
      for (let i = 1; i < letters; i++) {
        const gap = i * (PIXEL_GLYPH_WIDTH + 1) - 1
        expect(map.every((row) => !row[gap]), `${word}: gap ${i} is not clear`).toBe(true)
      }
    }
  })

  it('refuses a character it has no glyph for rather than dropping it', () => {
    expect(() => pixelWord('γx')).toThrow()
  })

  it('inks a word in the colour it is handed, and nothing else', () => {
    const map = pixelWordMap('γένεσις', PALETTE.starWhite)
    const inks = new Set(map.flat().filter((c): c is string => c !== null))
    expect(inks).toEqual(new Set([PALETTE.starWhite]))
  })
})

// The Sirius mark (GDD 11-10). Drawn from geometry rather than cut out of
// `docs/brand/SIRIUS-LOGO-SHEET.png`, because GDD 11-1 makes no image files — so the
// things worth holding are the ones a cropped PNG would have given for free.
describe('Sirius mark (GDD 11-10)', () => {
  it('is a square 56×56 at its reference size', () => {
    const map = siriusSymbol()
    expect(map).toHaveLength(SIRIUS_SIZE)
    for (const row of map) expect(row).toHaveLength(SIRIUS_SIZE)
  })

  // ★ The favicon is the same geometry re-evaluated, not the 56 resampled. 56/32 and
  // 56/16 are not whole numbers, so a downscale would land the arms between pixels
  // (CLAUDE.md §7) — this is what makes the three sizes one mark.
  it('draws itself at every favicon size without resampling', () => {
    for (const size of SIRIUS_ICON_SIZES) {
      const map = siriusSymbol(size, PALETTE.void)
      expect(map).toHaveLength(size)
      for (const row of map) expect(row).toHaveLength(size)
      // A filled background means no cell is transparent — a tab strip is the
      // browser's colour and four pale blues on white is an invisible icon.
      expect(map.flat().every((c) => c !== null)).toBe(true)
    }
  })

  it('spends no colour the palette does not already own (GDD 11-7)', () => {
    const inks = new Set(siriusSymbol().flat().filter((c): c is string => c !== null))
    expect(inks).toEqual(new Set(Object.values(SIRIUS_INK)))
    // Three of the four are palette primaries outright; `pale` is a derived tone,
    // which GDD 11-7 explicitly does not count against the 32.
    expect(SIRIUS_INK.core).toBe(PALETTE.starWhite)
    expect(SIRIUS_INK.mid).toBe(PALETTE.imaiEdge)
    expect(SIRIUS_INK.shade).toBe(PALETTE.imai)
  })

  // Sirius is a binary, which is the whole idea of the mark: a large star with a
  // small companion off its lower right, and clear space between the two.
  it('puts a separate companion off the lower right of the main star', () => {
    const layers = siriusLayers()
    const lit = (x: number, y: number) => layers[y][x] !== 'outside'

    // Something in the lower-right quadrant, away from the centre.
    const companion: [number, number][] = []
    for (let y = 0; y < SIRIUS_SIZE; y++) {
      for (let x = 0; x < SIRIUS_SIZE; x++) {
        if (lit(x, y) && x > 36 && y > 34) companion.push([x, y])
      }
    }
    expect(companion.length).toBeGreaterThan(0)

    // And a gap between it and the main star, along the diagonal joining them.
    let gap = 0
    for (let step = 1; step < 14; step++) {
      const x = Math.round(26 + step)
      const y = Math.round(24 + step)
      if (!lit(x, y)) gap++
    }
    expect(gap, 'the companion is fused to the main star').toBeGreaterThan(2)
  })

  // Lit from the upper left, so the two arms facing away carry the darkest tone. A
  // mark with four identical arms reads as a compass rose rather than as a star.
  it('shades the arms that face away from the light', () => {
    const layers = siriusLayers().flat()
    expect(layers.filter((l) => l === 'shade').length).toBeGreaterThan(0)
    expect(layers.filter((l) => l === 'core').length).toBeGreaterThan(0)
  })
})
