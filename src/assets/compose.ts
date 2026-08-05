// Sprites, built by colouring the masks in pixels.ts.
//
// Nothing here enumerates the ten special chips by hand (GDD 11-2): they are
// halved out of the five basics, so drawing five suits draws fifteen chips.

import { CONSTELLATION_RULES } from '../core/config'
import { SUIT_ORDER } from '../core/types'
import type { ConstellationId, SuitId } from '../core/types'
import { AXIS_COLOURS, CHIP_COLOURS, PALETTE } from './palette'
import { CONSTELLATION_GLYPHS, DISC, PRISM, SPRITE_SIZE, SUIT_GLYPHS } from './pixels'
import type { Mask } from './pixels'

/** One sprite. `null` is transparent. */
export type PixelMap = readonly (readonly (string | null)[])[]

const HALF = SPRITE_SIZE / 2

const blank = (): (string | null)[][] =>
  Array.from({ length: SPRITE_SIZE }, () => new Array<string | null>(SPRITE_SIZE).fill(null))

const inside = (row: number, col: number) =>
  row >= 0 && row < SPRITE_SIZE && col >= 0 && col < SPRITE_SIZE

const isOn = (m: Mask, row: number, col: number) => inside(row, col) && m[row][col]

/** Cells of `shape` with at least one neighbour outside it — the 1px lit edge. */
function isEdge(shape: Mask, row: number, col: number): boolean {
  if (!shape[row][col]) return false
  return [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ].some(([dr, dc]) => !isOn(shape, row + dr, col + dc))
}

/** GDD 11-4: a round token, lit at the edge so it reads against the void. */
export function basicChip(suit: SuitId): PixelMap {
  const colours = CHIP_COLOURS[suit]
  const glyph = SUIT_GLYPHS[suit]
  const out = blank()

  for (let row = 0; row < SPRITE_SIZE; row++) {
    for (let col = 0; col < SPRITE_SIZE; col++) {
      if (!DISC[row][col]) continue
      if (isEdge(DISC, row, col)) out[row][col] = colours.edge
      else if (glyph[row][col]) out[row][col] = colours.symbol
      else out[row][col] = colours.base
    }
  }
  return out
}

/**
 * GDD 3-2: left half of `left`'s chip, right half of `right`'s. Halving the
 * finished chips splits colour and symbol in one step, which is what the spec
 * describes — the seam runs between columns 7 and 8.
 */
export function specialChip(left: SuitId, right: SuitId): PixelMap {
  const a = basicChip(left)
  const b = basicChip(right)
  return a.map((row, r) => [...row.slice(0, HALF), ...b[r].slice(HALF)])
}

/**
 * GDD 11-6: no symbol, because it belongs to no suit. The five suit colours run
 * across it as refracted light — "not yet decided" rather than "a sixth suit" —
 * and the cut-gem outline keeps it apart from the two-tone specials.
 */
export function drifterChip(): PixelMap {
  const out = blank()

  for (let row = 0; row < SPRITE_SIZE; row++) {
    // Bands run across, never down: a vertical seam is what a special chip has,
    // and the two must not be confused (GDD 11-6).
    const band = Math.min(
      SUIT_ORDER.length - 1,
      Math.floor((row / SPRITE_SIZE) * SUIT_ORDER.length),
    )
    for (let col = 0; col < SPRITE_SIZE; col++) {
      if (!PRISM[row][col]) continue
      // The lit variants, not the bases: this is refracted light, and Acrux's
      // base would vanish into the void as one of the bands.
      out[row][col] = isEdge(PRISM, row, col)
        ? PALETTE.starWhite
        : CHIP_COLOURS[SUIT_ORDER[band]].edge
    }
  }
  return out
}

/**
 * GDD 11-5: a star chart of the rule. The hue names the axis family, the star
 * count and corona name the grade within it.
 */
export function constellationIcon(id: ConstellationId): PixelMap {
  const { lines, stars, glow } = CONSTELLATION_GLYPHS[id]
  const hue = AXIS_COLOURS[CONSTELLATION_RULES[id].axis]
  const out = blank()

  for (let row = 0; row < SPRITE_SIZE; row++) {
    for (let col = 0; col < SPRITE_SIZE; col++) {
      // The corona is laid down first so the join always survives on top of it:
      // a longer run must not lose the line that makes it read as a star chart.
      if (glow[row][col]) out[row][col] = PALETTE.textDim
      if (lines[row][col]) out[row][col] = PALETTE.starDim
      if (stars[row][col]) out[row][col] = hue
    }
  }
  return out
}
