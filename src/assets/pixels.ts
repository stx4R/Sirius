// Pixel maps (GDD 11-1: no image files — everything is defined in code).
//
// Two quite different objects live here:
//   · the suit chip, a 32×32 round token of concentric layers (GDD 11-4)
//   · the constellation card, a 36×52 star chart (GDD 11-5)
//
// Suit symbols stay 16×16 and sit in the middle of the chip, so the chip grew
// from 16 to 32 without a single symbol being redrawn.

import { CONSTELLATION_RULES } from '../core/config'
import { mulberry32 } from '../core/rng'
import type { ConstellationId, SuitId } from '../core/types'

export const GLYPH_SIZE = 16
export const CHIP_SIZE = 32
/** GDD 11-4: 36×52 leaves the frame 2px without shrinking the chart inside it. */
export const CARD_WIDTH = 36
export const CARD_HEIGHT = 52
export const CARD_FRAME = 2

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

/**
 * GDD 11-6: the drifter's mark. Not a suit — a crown, for the chip that can be
 * any of them. Drawn to the same 16×16 box as the five suits so it drops into
 * the middle of a chip with no special handling.
 */
export const CROWN_GLYPH: Mask = mask([
  '................',
  '................',
  '................',
  '..##...##...##..',
  '..##...##...##..',
  '..##..####..##..',
  '..###.####.###..',
  '..############..',
  '..#.##.##.##.#..',
  '..############..',
  '..############..',
  '...##########...',
  '................',
  '................',
  '................',
  '................',
])

/**
 * A placement is fixed the moment it lands (GDD 4-2), and the board gives no
 * other sign of it — a chip in a cell looks the same whether it was played this
 * turn or four turns ago. This padlock pops in over a chip as it settles to say
 * the choice is spent.
 *
 * 12×12 rather than the 16×16 of a suit symbol: it rides on the corner of a chip
 * as a badge, so at 16 it would cover the symbol underneath it.
 */
export const LOCK_SIZE = 12

export const LOCK_GLYPH: Mask = mask([
  '............',
  '....####....',
  '...##..##...',
  '...##..##...',
  '.##########.',
  '.##########.',
  '.####..####.',
  '.####..####.',
  '.####..####.',
  '.##########.',
  '.##########.',
  '............',
])

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

// ------------------------------------------------------------------ иєвυℓα
// GDD 11-9. Built from geometry rather than a hand-drawn map, like the chip —
// 60×78 is 4,680 cells and the shape is a silhouette, not a portrait.
//
// The whole design goal is that the silhouette alone says "unidentified". So the
// hood has an opening where a face should be and there is nothing inside it but
// light. ORION is a person with a nebula for a body; иєвυℓα is a nebula wearing
// the shape of a person, and the reading has to survive at 60px with no features
// to lean on.

export const NEBULA_WIDTH = 60
export const NEBULA_HEIGHT = 78

export type NebulaLayer = 'outside' | 'rim' | 'veil' | 'fold' | 'hollow' | 'glow'

const NEBULA_CX = (NEBULA_WIDTH - 1) / 2
/** The hood, and the opening cut into the front of it. */
const HOOD = { cy: 27, rx: 19, ry: 25 }
const FACE = { cy: 32, rx: 11, ry: 14 }
/** Where the light sits inside the opening — low and slightly right, not centred. */
const CORE = { cx: NEBULA_CX + 1.5, cy: 34, rx: 6.5, ry: 7.5 }

const SHOULDER_Y = 42

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

/** Half-width of the robe at a row: it flares steadily from the shoulders down. */
function robeHalfWidth(y: number): number {
  if (y < SHOULDER_Y) return 0
  return 14 + ((y - SHOULDER_Y) / (NEBULA_HEIGHT - SHOULDER_Y)) * 15
}

/**
 * How far down each column of the robe reaches.
 *
 * Two sine waves rather than noise. Random per-column cuts put a 1px spike next
 * to a 1px gap and the hem came out as static; two low frequencies beating
 * against each other keep neighbouring columns close, so the bottom reads as
 * strands hanging off a robe. It is also flatly deterministic, which is the
 * cheapest possible way to satisfy CLAUDE.md §8.
 */
const HEM_BOTTOM = Array.from({ length: NEBULA_WIDTH }, (_, x) => {
  // Driven off the distance from the centre line, not from x, so she is
  // symmetric — a lopsided hem read as damage rather than as drapery.
  const fromCentre = Math.abs(x - NEBULA_CX) / NEBULA_CX
  const drape = Math.sin(fromCentre * 9.5) * 2 + Math.sin(fromCentre * 3.6) * 3
  return NEBULA_HEIGHT - 1 - Math.round(fromCentre * 26 + drape)
})

function isBody(x: number, y: number): boolean {
  if (inEllipse(x, y, NEBULA_CX, HOOD.cy, HOOD.rx, HOOD.ry)) return true
  if (y < SHOULDER_Y || y > HEM_BOTTOM[x]) return false
  return Math.abs(x - NEBULA_CX) <= robeHalfWidth(y)
}

/** GDD 11-9: one grid of layers, rim derived from what has empty space beside it. */
export function nebulaLayers(): NebulaLayer[][] {
  const body: boolean[][] = Array.from({ length: NEBULA_HEIGHT }, (_, y) =>
    Array.from({ length: NEBULA_WIDTH }, (_, x) => isBody(x, y)),
  )

  return body.map((row, y) =>
    row.map((solid, x): NebulaLayer => {
      if (!solid) return 'outside'

      // The hood's opening. Nothing in it but the light — no eyes, no mouth.
      if (y < SHOULDER_Y + 4 && inEllipse(x, y, NEBULA_CX, FACE.cy, FACE.rx, FACE.ry)) {
        return inEllipse(x, y, CORE.cx, CORE.cy, CORE.rx, CORE.ry) ? 'glow' : 'hollow'
      }

      const open = (dx: number, dy: number) =>
        body[y + dy]?.[x + dx] !== true
      if (open(-1, 0) || open(0, -1) || open(1, 0) || open(0, 1)) return 'rim'

      // Folds run down the robe, spaced so the cloth reads as cloth at 2×.
      const fromCentre = Math.abs(x - NEBULA_CX)
      if (y > SHOULDER_Y && fromCentre > 4 && Math.round(fromCentre) % 7 === 0) return 'fold'
      return 'veil'
    }),
  )
}

// -------------------------------------------------------------- star charts
// GDD 11-5: the card carries the constellation's own figure, not a diagram of
// the rule it scores. These are stylised asterisms — the recognisable gesture of
// each figure at this size, not astrometry.

/** The chart keeps its size; the card grew around it to make room for the frame. */
export const CHART_WIDTH = 26
export const CHART_HEIGHT = 40
export const CHART_ORIGIN = {
  col: CARD_FRAME + (CARD_WIDTH - 2 * CARD_FRAME - CHART_WIDTH) / 2,
  row: CARD_FRAME + (CARD_HEIGHT - 2 * CARD_FRAME - CHART_HEIGHT) / 2,
} as const

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

// ------------------------------------------------------------------ the sky
// GDD 11-5: the night the figure is drawn on. Each card gets its own sky, so a
// row of twelve does not read as twelve copies of one background.
//
// Seeded from the constellation's own index rather than rolled, so a card is the
// same card every time it is drawn (CLAUDE.md §8).

/** 1px point, a small cross, or — rarely — a bright one. */
export type SpeckKind = 'dot' | 'cross' | 'bright'

export interface Speck {
  readonly row: number
  readonly col: number
  readonly kind: SpeckKind
}

/** A faint patch of nebulosity, drawn in a very dark tint of the card's colour. */
export interface Nebula {
  readonly row: number
  readonly col: number
  readonly radius: number
}

export interface Sky {
  readonly specks: readonly Speck[]
  readonly nebulae: readonly Nebula[]
}

const SKY_SEED = 0x57a3
const SPECK_COUNT = 52
const BRIGHT_CHANCE = 0.06
const CROSS_CHANCE = 0.24

const CONSTELLATION_ORDER = Object.keys(CONSTELLATION_RULES) as ConstellationId[]

export function skyOf(id: ConstellationId): Sky {
  const rng = mulberry32(SKY_SEED + CONSTELLATION_ORDER.indexOf(id) * 977)
  const top = CARD_FRAME
  const left = CARD_FRAME
  const height = CARD_HEIGHT - 2 * CARD_FRAME
  const width = CARD_WIDTH - 2 * CARD_FRAME

  const specks: Speck[] = Array.from({ length: SPECK_COUNT }, () => {
    const row = top + Math.floor(rng() * height)
    const col = left + Math.floor(rng() * width)
    const roll = rng()
    const kind: SpeckKind =
      roll < BRIGHT_CHANCE ? 'bright' : roll < BRIGHT_CHANCE + CROSS_CHANCE ? 'cross' : 'dot'
    return { row, col, kind }
  })

  const nebulae: Nebula[] = Array.from({ length: rng() < 0.5 ? 1 : 2 }, () => ({
    row: top + Math.floor(rng() * height),
    col: left + Math.floor(rng() * width),
    radius: 5 + Math.floor(rng() * 4),
  }))

  return { specks, nebulae }
}
