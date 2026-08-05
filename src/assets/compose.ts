// Sprites, built by colouring the geometry and masks in pixels.ts.
//
// Nothing here enumerates the ten special chips by hand (GDD 11-2): they are
// halved out of the five basics, so drawing five suits draws fifteen chips.

import { CONSTELLATION_RULES } from '../core/config'
import { SUIT_ORDER } from '../core/types'
import type { ConstellationId, SuitId } from '../core/types'
import { AXIS_COLOURS, CHIP_COLOURS, PALETTE } from './palette'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CHART_ORIGIN,
  CHIP_SIZE,
  CONSTELLATION_CHARTS,
  GLYPH_OFFSET,
  GLYPH_SIZE,
  SUIT_GLYPHS,
  chipLayerAt,
  isPrism,
  isSpeck,
} from './pixels'
import type { ChartStar, Magnitude } from './pixels'

/** One sprite. `null` is transparent. */
export type PixelMap = readonly (readonly (string | null)[])[]

/** Where a special chip is cut, and the mirror line every chip layer respects. */
const CHIP_SEAM = CHIP_SIZE / 2

const blank = (width: number, height: number): (string | null)[][] =>
  Array.from({ length: height }, () => new Array<string | null>(width).fill(null))

const within = (value: number, limit: number) => value >= 0 && value < limit

// -------------------------------------------------------------------- chips

/**
 * GDD 11-4: a round token in four layers — notched edge, dark inner ring, dotted
 * circle, and the suit symbol at the centre.
 *
 * The notches take the suit's lit colour rather than a neutral cream. It reads as
 * starlight leaking through the rim instead of a casino chip, and it carries the
 * suit all the way out to the edge — so a special chip announces both of its
 * suits from the silhouette, not only from the middle.
 */
export function basicChip(suit: SuitId): PixelMap {
  const colours = CHIP_COLOURS[suit]
  const glyph = SUIT_GLYPHS[suit]
  const out = blank(CHIP_SIZE, CHIP_SIZE)

  for (let row = 0; row < CHIP_SIZE; row++) {
    for (let col = 0; col < CHIP_SIZE; col++) {
      switch (chipLayerAt(row, col)) {
        case 'outside':
          break
        // A notch is the same lit colour as the rim; what marks it out is depth,
        // reaching three pixels further in through the band.
        case 'rim':
        case 'notch':
        case 'dot':
          out[row][col] = colours.edge
          break
        case 'ring':
          out[row][col] = colours.symbol
          break
        case 'band':
        case 'field':
          out[row][col] = colours.base
          break
      }
    }
  }

  for (let row = 0; row < GLYPH_SIZE; row++) {
    for (let col = 0; col < GLYPH_SIZE; col++) {
      if (glyph[row][col]) out[row + GLYPH_OFFSET][col + GLYPH_OFFSET] = colours.symbol
    }
  }
  return out
}

/**
 * GDD 3-2: left half of `left`'s chip, right half of `right`'s. Every ring and
 * notch is mirror-symmetric about the seam, so the two halves meet without a
 * visible break; the symbol splits at its own centre, as it always has.
 */
export function specialChip(left: SuitId, right: SuitId): PixelMap {
  const a = basicChip(left)
  const b = basicChip(right)
  return a.map((row, r) => [...row.slice(0, CHIP_SEAM), ...b[r].slice(CHIP_SEAM)])
}

/**
 * GDD 11-6: no symbol, because it belongs to no suit. The five suit colours run
 * across it as refracted light — their lit variants, since Acrux's base would
 * vanish into the void as one of the bands.
 */
export function drifterChip(): PixelMap {
  const out = blank(CHIP_SIZE, CHIP_SIZE)

  for (let row = 0; row < CHIP_SIZE; row++) {
    // Bands run across, never down: a vertical seam is what a special chip has,
    // and the two must not be confused.
    const band = Math.min(
      SUIT_ORDER.length - 1,
      Math.floor((row / CHIP_SIZE) * SUIT_ORDER.length),
    )
    for (let col = 0; col < CHIP_SIZE; col++) {
      if (!isPrism(row, col)) continue
      const edge =
        !isPrism(row - 1, col) ||
        !isPrism(row + 1, col) ||
        !isPrism(row, col - 1) ||
        !isPrism(row, col + 1)
      out[row][col] = edge ? PALETTE.starWhite : CHIP_COLOURS[SUIT_ORDER[band]].edge
    }
  }
  return out
}

// -------------------------------------------------------- constellation card

/** Arm length of a star's cross, by magnitude. A faint star is a bare point. */
const ARM_LENGTH: Readonly<Record<Magnitude, number>> = { 0: 3, 1: 2, 2: 0 }

function paintLine(
  out: (string | null)[][],
  from: ChartStar,
  to: ChartStar,
  colour: string,
): void {
  // Steps of one pixel along the longer axis, which is enough for lines this short.
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))
  for (let i = 1; i < steps; i++) {
    const col = CHART_ORIGIN.col + Math.round(from.x + ((to.x - from.x) * i) / steps)
    const row = CHART_ORIGIN.row + Math.round(from.y + ((to.y - from.y) * i) / steps)
    if (within(row, CARD_HEIGHT) && within(col, CARD_WIDTH)) out[row][col] = colour
  }
}

function paintStar(out: (string | null)[][], entry: ChartStar): void {
  const col = CHART_ORIGIN.col + entry.x
  const row = CHART_ORIGIN.row + entry.y
  const arm = ARM_LENGTH[entry.mag]

  for (let step = 1; step <= arm; step++) {
    for (const [dr, dc] of [
      [-step, 0],
      [step, 0],
      [0, -step],
      [0, step],
    ]) {
      const r = row + dr
      const c = col + dc
      if (within(r, CARD_HEIGHT) && within(c, CARD_WIDTH)) out[r][c] = PALETTE.starGlow
    }
  }
  if (within(row, CARD_HEIGHT) && within(col, CARD_WIDTH)) {
    out[row][col] = entry.mag === 2 ? PALETTE.starGlow : PALETTE.starWhite
  }
}

/**
 * GDD 11-5: a card, not a chip. It carries the constellation's own figure in
 * blue-white; the axis family is told by the frame colour instead, because the
 * figures themselves say nothing about which axis scores.
 *
 * The card cannot state the run length or the multiplier at this size — the UI
 * prints those beside it, which is where readability is meant to come from.
 */
export function constellationCard(id: ConstellationId): PixelMap {
  const out = blank(CARD_WIDTH, CARD_HEIGHT)
  const frame = AXIS_COLOURS[CONSTELLATION_RULES[id].axis]
  const chart = CONSTELLATION_CHARTS[id]

  for (let row = 0; row < CARD_HEIGHT; row++) {
    for (let col = 0; col < CARD_WIDTH; col++) {
      const onEdge = row === 0 || col === 0 || row === CARD_HEIGHT - 1 || col === CARD_WIDTH - 1
      // Dropping the four corner pixels is what rounds the card at this size.
      const corner =
        (row === 0 || row === CARD_HEIGHT - 1) && (col === 0 || col === CARD_WIDTH - 1)
      if (corner) continue
      if (onEdge) {
        out[row][col] = frame
        continue
      }
      out[row][col] = isSpeck(row, col) ? PALETTE.panelEdge : PALETTE.nebulaDeep
    }
  }

  for (const [from, to] of chart.links) {
    paintLine(out, chart.stars[from], chart.stars[to], PALETTE.starLink)
  }
  for (const entry of chart.stars) paintStar(out, entry)

  return out
}
