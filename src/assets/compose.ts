// Sprites, built by colouring the geometry and masks in pixels.ts.
//
// Nothing here enumerates the ten special chips by hand (GDD 11-2): they are
// halved out of the five basics, so drawing five suits draws fifteen chips.

import { CONSTELLATION_RULES } from '../core/config'
import type { ConstellationId, SuitId } from '../core/types'
import { AXIS_COLOURS, CHIP_COLOURS, PALETTE, luma, mix } from './palette'
import {
  CARD_FRAME,
  CARD_HEIGHT,
  CARD_WIDTH,
  CHART_ORIGIN,
  CHIP_SIZE,
  CONSTELLATION_CHARTS,
  CROWN_GLYPH,
  GLYPH_OFFSET,
  GLYPH_SIZE,
  GRID_CELLS,
  SUIT_GLYPHS,
  chipLayerAt,
  gridColumn,
  gridRow,
  isSpeck,
  scoringCells,
} from './pixels'
import type { ChartStar, Magnitude, Mask } from './pixels'

/** One sprite. `null` is transparent. */
export type PixelMap = readonly (readonly (string | null)[])[]

/** Where a special chip is cut, and the mirror line every chip layer respects. */
const CHIP_SEAM = CHIP_SIZE / 2

const blank = (width: number, height: number): (string | null)[][] =>
  Array.from({ length: height }, () => new Array<string | null>(width).fill(null))

const within = (value: number, limit: number) => value >= 0 && value < limit

// -------------------------------------------------------------------- chips

interface ChipPaint {
  /** The lit colour: rim, notches and the dotted circle. */
  readonly edgeAt: (row: number) => string
  /** The dark colour: inner ring and the symbol. */
  readonly symbol: string
  /** The field. Both vary down the chip for the drifter, and are flat for a suit. */
  readonly baseAt: (row: number) => string
  readonly glyph: Mask
}

/**
 * GDD 11-4: a round token in four layers — notched edge, dark inner ring, dotted
 * circle, and a 16×16 symbol at the centre.
 *
 * The notches take the suit's lit colour rather than a neutral cream. It reads as
 * starlight leaking through the rim instead of a casino chip, and it carries the
 * suit all the way out to the edge — so a special chip announces both of its
 * suits from the silhouette, not only from the middle.
 */
function renderChip(paint: ChipPaint): PixelMap {
  const out = blank(CHIP_SIZE, CHIP_SIZE)

  for (let row = 0; row < CHIP_SIZE; row++) {
    const base = paint.baseAt(row)
    const edge = paint.edgeAt(row)
    for (let col = 0; col < CHIP_SIZE; col++) {
      switch (chipLayerAt(row, col)) {
        case 'outside':
          break
        // A notch is the same lit colour as the rim; what marks it out is depth,
        // reaching three pixels further in through the band.
        case 'rim':
        case 'notch':
        case 'dot':
          out[row][col] = edge
          break
        case 'ring':
          out[row][col] = paint.symbol
          break
        case 'band':
        case 'field':
          out[row][col] = base
          break
      }
    }
  }

  for (let row = 0; row < GLYPH_SIZE; row++) {
    for (let col = 0; col < GLYPH_SIZE; col++) {
      if (paint.glyph[row][col]) out[row + GLYPH_OFFSET][col + GLYPH_OFFSET] = paint.symbol
    }
  }
  return out
}

export function basicChip(suit: SuitId): PixelMap {
  const colours = CHIP_COLOURS[suit]
  return renderChip({
    edgeAt: () => colours.edge,
    symbol: colours.symbol,
    baseAt: () => colours.base,
    glyph: SUIT_GLYPHS[suit],
  })
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
 * Spectrum order rather than scoring order, so the drifter's field reads as a
 * rainbow instead of a list. Acrux is left out: black is not a colour of light,
 * and as a band it would read as a dead stripe across the chip.
 */
const SPECTRUM: readonly SuitId[] = ['GIN', 'GAC', 'IMA', 'MIM']

/** The spectrum as a continuous gradient down the chip. */
function refract(row: number): string {
  const position = (row / (CHIP_SIZE - 1)) * (SPECTRUM.length - 1)
  const stop = Math.min(SPECTRUM.length - 2, Math.floor(position))
  return mix(
    CHIP_COLOURS[SPECTRUM[stop]].base,
    CHIP_COLOURS[SPECTRUM[stop + 1]].base,
    position - stop,
  )
}

/**
 * GDD 11-6: the same chip as any other — notches, ring, dotted circle, centre
 * symbol — so it sits on the board as a chip and not as an oddity. What sets it
 * apart is what it is: no suit of its own, so a rainbow field and a crown.
 */
export function drifterChip(): PixelMap {
  return renderChip({
    // The rim carries the rainbow too. A white rim would swallow it — the notches
    // and dotted circle are a third of the chip's surface.
    edgeAt: (row) => mix(refract(row), PALETTE.starWhite, 0.4),
    // Dark against every colour of the rainbow, which no suit colour would be.
    symbol: PALETTE.void,
    baseAt: refract,
    glyph: CROWN_GLYPH,
  })
}

// -------------------------------------------------------- constellation card

/** Arm length of a star's cross, by magnitude. A faint star is a bare point. */
const ARM_LENGTH: Readonly<Record<Magnitude, number>> = { 0: 3, 1: 2, 2: 0 }

const coreOf = (mag: Magnitude) => (mag === 2 ? PALETTE.starGlow : PALETTE.starWhite)

/**
 * GDD 11-5, the brightness rule: the frame may never out-shine the chart. Both
 * frame tones are stepped toward the card's background until the brighter of
 * them sits under the chart's mean star brightness, with room to spare.
 *
 * This is why the dark tone is not the frame hue untouched — at full strength an
 * amber or teal frame is about as bright as the chart it surrounds, and the eye
 * goes to the border instead of the figure. The hue survives on the outline,
 * which is a single pixel and reads as the card's identity rather than as light.
 */
function frameTones(hue: string, chartMean: number): { dark: string; light: string } {
  const dark = mix(hue, PALETTE.nebulaDeep, 0.3)
  let light = mix(hue, PALETTE.starWhite, 0.4)
  // A tenth at a time, so a hue that is already quiet is barely touched.
  while (luma(light) > chartMean * 0.8) light = mix(light, PALETTE.nebulaDeep, 0.1)
  return { dark, light }
}

function paintLine(out: (string | null)[][], from: ChartStar, to: ChartStar, colour: string): void {
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

  for (let step = 1; step <= ARM_LENGTH[entry.mag]; step++) {
    for (const [dr, dc] of [
      [-step, 0],
      [step, 0],
      [0, -step],
      [0, step],
    ]) {
      if (within(row + dr, CARD_HEIGHT) && within(col + dc, CARD_WIDTH)) {
        out[row + dr][col + dc] = PALETTE.starGlow
      }
    }
  }
  if (within(row, CARD_HEIGHT) && within(col, CARD_WIDTH)) out[row][col] = coreOf(entry.mag)
}

/**
 * The 5×5 board, laid under the chart: faint cell outlines, with the cells this
 * constellation scores drawn up.
 *
 * A scored cell is outlined rather than filled. A solid block at this size is a
 * slab of colour the figure has to compete with, and the figure is the subject —
 * the board is the surface it is being read against.
 */
function paintBoard(out: (string | null)[][], id: ConstellationId, hue: string): void {
  const global = CONSTELLATION_RULES[id].axis === 'global'
  const faint = mix(PALETTE.nebulaDeep, hue, 0.1)
  const outline = mix(PALETTE.nebulaDeep, hue, global ? 0.19 : 0.32)
  const wash = mix(PALETTE.nebulaDeep, hue, global ? 0.07 : 0.13)
  const scored = new Set(scoringCells(id).map(([row, col]) => `${row},${col}`))

  const put = (chartRow: number, chartCol: number, colour: string) => {
    const row = CHART_ORIGIN.row + chartRow
    const col = CHART_ORIGIN.col + chartCol
    if (within(row, CARD_HEIGHT) && within(col, CARD_WIDTH)) out[row][col] = colour
  }

  for (let cellRow = 0; cellRow < GRID_CELLS; cellRow++) {
    for (let cellCol = 0; cellCol < GRID_CELLS; cellCol++) {
      const [top, bottom] = gridRow(cellRow)
      const [left, right] = gridColumn(cellCol)
      const isScored = scored.has(`${cellRow},${cellCol}`)

      for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
          const onEdge = row === top || row === bottom || col === left || col === right
          if (onEdge) put(row, col, isScored ? outline : faint)
          else if (isScored) put(row, col, wash)
        }
      }
    }
  }
}

/** Stars strung along the frame, joined all the way round, anchored at the corners. */
function paintFrame(out: (string | null)[][], hue: string, chartMean: number): void {
  const { dark, light } = frameTones(hue, chartMean)
  const inset = CARD_FRAME - 1
  const last = { row: CARD_HEIGHT - 1, col: CARD_WIDTH - 1 }

  for (let row = 0; row < CARD_HEIGHT; row++) {
    for (let col = 0; col < CARD_WIDTH; col++) {
      const onOutline = row === 0 || col === 0 || row === last.row || col === last.col
      // Dropping the four corner pixels is what rounds the card at this size.
      const corner = (row === 0 || row === last.row) && (col === 0 || col === last.col)
      if (onOutline && !corner) out[row][col] = dark
    }
  }

  // The decoration track: one ring in, so it reads as inside the border.
  const track: [number, number][] = []
  for (let col = inset; col <= last.col - inset; col++) track.push([inset, col])
  for (let row = inset + 1; row <= last.row - inset; row++) track.push([row, last.col - inset])
  for (let col = last.col - inset - 1; col >= inset; col--) track.push([last.row - inset, col])
  for (let row = last.row - inset - 1; row > inset; row--) track.push([row, inset])

  // The strand the stars hang on sits below the outline, so the stars read as
  // points of light rather than as gaps in a second border.
  const strand = mix(dark, PALETTE.nebulaDeep, 0.4)
  for (const [row, col] of track) out[row][col] = strand
  track.forEach(([row, col], index) => {
    if (index % 6 === 0) out[row][col] = light
  })

  // Corner anchors: brighter, and two pixels across rather than one.
  for (const [row, col] of [
    [inset, inset],
    [inset, last.col - inset],
    [last.row - inset, inset],
    [last.row - inset, last.col - inset],
  ]) {
    for (const [dr, dc] of [
      [0, 0],
      [0, 1],
      [1, 0],
    ]) {
      const r = row + (row > CARD_HEIGHT / 2 ? -dr : dr)
      const c = col + (col > CARD_WIDTH / 2 ? -dc : dc)
      if (within(r, CARD_HEIGHT) && within(c, CARD_WIDTH)) out[r][c] = light
    }
  }
}

/**
 * GDD 11-5: a card, not a chip. It carries the constellation's own figure in
 * blue-white over the 5×5 board it scores on; the axis family is told by the
 * frame colour, because the figures themselves say nothing about which axis wins.
 *
 * The card cannot state the run length or the multiplier at this size — the UI
 * prints those beside it, which is where readability is meant to come from.
 */
export function constellationCard(id: ConstellationId): PixelMap {
  const out = blank(CARD_WIDTH, CARD_HEIGHT)
  const hue = AXIS_COLOURS[CONSTELLATION_RULES[id].axis]
  const chart = CONSTELLATION_CHARTS[id]
  const chartMean =
    chart.stars.reduce((total, entry) => total + luma(coreOf(entry.mag)), 0) / chart.stars.length

  for (let row = CARD_FRAME; row < CARD_HEIGHT - CARD_FRAME; row++) {
    for (let col = CARD_FRAME; col < CARD_WIDTH - CARD_FRAME; col++) {
      out[row][col] = PALETTE.nebulaDeep
    }
  }
  paintBoard(out, id, hue)
  for (let row = CARD_FRAME; row < CARD_HEIGHT - CARD_FRAME; row++) {
    for (let col = CARD_FRAME; col < CARD_WIDTH - CARD_FRAME; col++) {
      if (isSpeck(row, col) && out[row][col] === PALETTE.nebulaDeep) {
        out[row][col] = PALETTE.panelEdge
      }
    }
  }

  for (const [from, to] of chart.links) {
    paintLine(out, chart.stars[from], chart.stars[to], PALETTE.starLink)
  }
  for (const entry of chart.stars) paintStar(out, entry)

  paintFrame(out, hue, chartMean)
  return out
}
