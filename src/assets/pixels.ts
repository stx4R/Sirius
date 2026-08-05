// Pixel maps (GDD 11-1: no image files — everything is defined in code).
//
// Two quite different objects live here:
//   · the suit chip, a 32×32 round token of concentric layers (GDD 11-4)
//   · the constellation card, a 32×48 star chart (GDD 11-5)
//
// Suit symbols stay 16×16 and sit in the middle of the chip, so the chip grew
// from 16 to 32 without a single symbol being redrawn.

import type { ConstellationId, SuitId } from '../core/types'

export const GLYPH_SIZE = 16
export const CHIP_SIZE = 32
export const CARD_WIDTH = 32
export const CARD_HEIGHT = 48

/** A boolean mask, one entry per pixel. */
export type Mask = readonly (readonly boolean[])[]

const mask = (rows: readonly string[]): Mask => rows.map((row) => [...row].map((c) => c === '#'))

// ------------------------------------------------------------- suit symbols

/**
 * Centred on the seam between columns 7 and 8, so that a special chip's two
 * halves each keep a readable half-symbol (GDD 3-2).
 */
export const SUIT_GLYPHS: Readonly<Record<SuitId, Mask>> = {
  // Gacrux — clover
  GAC: mask([
    '................',
    '................',
    '................',
    '......####......',
    '.....######.....',
    '.....######.....',
    '......####......',
    '..############..',
    '..############..',
    '...##########...',
    '......####......',
    '......####......',
    '....########....',
    '................',
    '................',
    '................',
  ]),
  // Imai — diamond
  IMA: mask([
    '................',
    '................',
    '................',
    '.......##.......',
    '......####......',
    '.....######.....',
    '....########....',
    '...##########...',
    '....########....',
    '.....######.....',
    '......####......',
    '.......##.......',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Ginan — heart
  GIN: mask([
    '................',
    '................',
    '................',
    '....###..###....',
    '...##########...',
    '...##########...',
    '...##########...',
    '....########....',
    '.....######.....',
    '......####......',
    '.......##.......',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Mimosa — cross
  MIM: mask([
    '................',
    '................',
    '................',
    '...##......##...',
    '....##....##....',
    '.....##..##.....',
    '......####......',
    '.......##.......',
    '.......##.......',
    '......####......',
    '.....##..##.....',
    '....##....##....',
    '...##......##...',
    '................',
    '................',
    '................',
  ]),
  // Acrux — spade
  ACR: mask([
    '................',
    '................',
    '................',
    '.......##.......',
    '......####......',
    '.....######.....',
    '....########....',
    '...##########...',
    '...##########...',
    '...###.##.###...',
    '......####......',
    '.....######.....',
    '................',
    '................',
    '................',
    '................',
  ]),
}

// ---------------------------------------------------------------- chip body
// GDD 11-4: 32×32, four concentric layers. Every layer is mirror-symmetric about
// the vertical centre line, which is what lets a special chip be cut at column 16
// and still show an unbroken ring and evenly spaced notches (GDD 3-2).

/** Which concentric layer a chip pixel belongs to. */
export type ChipLayer = 'outside' | 'rim' | 'notch' | 'band' | 'ring' | 'dot' | 'field'

const CHIP_CENTRE = (CHIP_SIZE - 1) / 2

/** Radii, outermost first. The band is 3px so a notch reads as a spot, not a nick. */
const R_OUTER = 15.5
const R_RIM = 14.5
const R_BAND = 11.5
const R_RING = 10.5
const R_DOTS = 8.5
const R_DOTS_INNER = 7.5

/** Six notches, 60° apart. Mirroring about the vertical maps the set onto itself. */
const NOTCH_COUNT = 6
const NOTCH_HALF_WIDTH = Math.PI / 13

/** Dashes of the dotted circle, counted off the vertical so the two halves match. */
const DOT_SEGMENTS = 12

/**
 * Angle from straight up, folded onto [0, π]. Folding is what makes every angular
 * feature symmetric about the cut line without special-casing anything.
 */
function foldedAngle(row: number, col: number): number {
  return Math.abs(Math.atan2(col - CHIP_CENTRE, CHIP_CENTRE - row))
}

function nearNotch(angle: number): boolean {
  const spacing = (2 * Math.PI) / NOTCH_COUNT
  return Math.abs(angle - Math.round(angle / spacing) * spacing) <= NOTCH_HALF_WIDTH
}

export function chipLayerAt(row: number, col: number): ChipLayer {
  const dy = row - CHIP_CENTRE
  const dx = col - CHIP_CENTRE
  const distance = Math.sqrt(dx * dx + dy * dy)
  if (distance > R_OUTER) return 'outside'

  const angle = foldedAngle(row, col)
  if (distance > R_RIM) return nearNotch(angle) ? 'notch' : 'rim'
  if (distance > R_BAND) return nearNotch(angle) ? 'notch' : 'band'
  if (distance > R_RING) return 'ring'
  if (distance > R_DOTS) return 'field'
  if (distance > R_DOTS_INNER) {
    return Math.floor(angle / (Math.PI / DOT_SEGMENTS)) % 2 === 0 ? 'dot' : 'field'
  }
  return 'field'
}

/** Top-left of the 16×16 symbol box inside the chip. */
export const GLYPH_OFFSET = (CHIP_SIZE - GLYPH_SIZE) / 2

/**
 * GDD 11-6: the drifter must not read as a sixth suit, nor be mistaken for a
 * special chip. A cut-crystal outline — flat sides, points top and bottom —
 * separates it at the silhouette, before any colour is read.
 */
export function isPrism(row: number, col: number): boolean {
  const dy = Math.abs(row - CHIP_CENTRE)
  const dx = Math.abs(col - CHIP_CENTRE)
  return dx <= 10.5 && dx + dy <= 16.5
}

// -------------------------------------------------------------- star charts
// GDD 11-5: the card carries the constellation's own figure, not a diagram of
// the rule it scores. These are stylised asterisms — the recognisable gesture of
// each figure at this size, not astrometry.

/** Where the chart sits inside the card, leaving room for the frame. */
export const CHART_ORIGIN = { col: 3, row: 4 } as const
export const CHART_WIDTH = 26
export const CHART_HEIGHT = 40

/** 0 is a named first-magnitude star, 2 is a faint one. */
export type Magnitude = 0 | 1 | 2

export interface ChartStar {
  readonly x: number
  readonly y: number
  readonly mag: Magnitude
}

export interface StarChart {
  readonly stars: readonly ChartStar[]
  /** Index pairs, drawn as the lines a star chart joins its figure with. */
  readonly links: readonly (readonly [number, number])[]
}

const star = (x: number, y: number, mag: Magnitude): ChartStar => ({ x, y, mag })

export const CONSTELLATION_CHARTS: Readonly<Record<ConstellationId, StarChart>> = {
  // Hamal, Sheratan and Mesarthim in a short bend, with 41 Ari trailing off.
  aries: {
    stars: [star(18, 14, 0), star(11, 20, 1), star(8, 23, 2), star(21, 7, 2)],
    links: [
      [2, 1],
      [1, 0],
      [0, 3],
    ],
  },
  // The Hyades V with Aldebaran at its foot, horns reaching up and out.
  taurus: {
    stars: [
      star(13, 26, 0),
      star(9, 20, 1),
      star(5, 13, 1),
      star(2, 6, 2),
      star(17, 20, 1),
      star(21, 12, 1),
      star(24, 4, 2),
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [0, 4],
      [4, 5],
      [5, 6],
    ],
  },
  // Castor and Pollux at the head of two parallel figures.
  gemini: {
    stars: [
      star(7, 4, 0),
      star(18, 5, 0),
      star(8, 14, 1),
      star(19, 15, 1),
      star(5, 25, 1),
      star(21, 25, 1),
      star(3, 35, 2),
      star(14, 33, 2),
      star(23, 34, 2),
    ],
    links: [
      [0, 2],
      [2, 4],
      [4, 6],
      [1, 3],
      [3, 5],
      [5, 8],
      [2, 3],
      [4, 7],
      [5, 7],
    ],
  },
  // The inverted Y. Cancer has no bright star in the sky, but a card that reads
  // as empty is a card nobody learns, so its centre is drawn up a magnitude.
  cancer: {
    stars: [
      star(12, 16, 0),
      star(4, 7, 1),
      star(20, 9, 1),
      star(13, 27, 1),
      star(7, 36, 2),
      star(20, 34, 2),
    ],
    links: [
      [1, 0],
      [2, 0],
      [0, 3],
      [3, 4],
      [3, 5],
    ],
  },
  // The Sickle curling up from Regulus, then the body out to Denebola.
  leo: {
    stars: [
      star(6, 26, 0),
      star(5, 19, 1),
      star(8, 13, 1),
      star(13, 9, 1),
      star(17, 12, 2),
      star(15, 17, 2),
      star(23, 30, 0),
      star(17, 22, 1),
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [0, 7],
      [7, 6],
      [7, 5],
    ],
  },
  // Spica at the foot, the figure branching above it.
  virgo: {
    stars: [
      star(9, 36, 0),
      star(13, 27, 1),
      star(19, 20, 1),
      star(7, 19, 1),
      star(3, 12, 2),
      star(16, 10, 2),
      star(23, 13, 2),
    ],
    links: [
      [0, 1],
      [1, 2],
      [1, 3],
      [3, 4],
      [2, 5],
      [2, 6],
    ],
  },
  // The scales: a quadrilateral with one pan hanging below.
  libra: {
    stars: [star(5, 22, 1), star(12, 11, 0), star(21, 17, 0), star(16, 29, 1), star(8, 34, 2)],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
    ],
  },
  // The head, then Antares, then the long curl of the tail.
  scorpio: {
    stars: [
      star(3, 7, 2),
      star(8, 6, 1),
      star(13, 8, 1),
      star(14, 15, 0),
      star(16, 22, 1),
      star(18, 29, 1),
      star(15, 35, 1),
      star(10, 37, 2),
      star(7, 33, 2),
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
    ],
  },
  // The Teapot.
  sagittarius: {
    stars: [
      star(4, 24, 1),
      star(7, 16, 1),
      star(12, 20, 1),
      star(17, 14, 1),
      star(22, 21, 1),
      star(20, 29, 1),
      star(9, 30, 1),
      star(2, 17, 2),
    ],
    links: [
      [7, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 0],
      [0, 1],
      [2, 5],
    ],
  },
  // The arrowhead.
  capricorn: {
    stars: [star(4, 11, 1), star(21, 7, 1), star(17, 32, 0), star(8, 22, 2)],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ],
  },
  // The water jar, and the stream falling from it.
  aquarius: {
    stars: [
      star(5, 9, 1),
      star(11, 13, 1),
      star(17, 8, 1),
      star(22, 14, 1),
      star(17, 21, 2),
      star(21, 28, 2),
      star(15, 33, 2),
      star(19, 38, 2),
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
    ],
  },
  // Two chains of stars knotted together at Alrescha. Alternating magnitudes keep
  // the chains readable — all-faint, the card reads as blank.
  pisces: {
    stars: [
      star(22, 33, 0),
      star(18, 26, 1),
      star(14, 20, 2),
      star(10, 13, 1),
      star(6, 7, 2),
      star(16, 37, 1),
      star(10, 36, 2),
      star(5, 31, 1),
      star(3, 24, 2),
    ],
    links: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8],
    ],
  },
}

/**
 * Faint specks behind the figure. Hashed from the coordinate rather than rolled,
 * so every render of a card is the same card (CLAUDE.md §8).
 */
export function isSpeck(row: number, col: number): boolean {
  let h = Math.imul(col + 1, 374761393) + Math.imul(row + 1, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) % 100 < 7
}
