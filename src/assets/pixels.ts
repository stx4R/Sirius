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

// -------------------------------------------------------- иєвυℓα, as a word
//
// Her name is spelled with и є в υ ℓ α — Cyrillic, Greek and a script ell, none
// of which Galmuri has a glyph for. Typed, the browser falls back per character
// and the shop title comes out as smooth antialiased curves sitting next to dot
// Hangul: the one string on screen that is not made of pixels.
//
// GDD 11-9 fixes the spelling, so the letters are what has to change medium, not
// the name. Six 5×7 glyphs on a 1px gap — 35×7 in total, which at 2× is exactly
// the 14px line the title is set in, so it sits on the same baseline as the text
// beside it without a fractional scale (CLAUDE.md §7).
//
// x-height letters start at row 2; only ℓ uses the two ascender rows.
// The name is a stylised NEBULA, so the glyphs are drawn to read as one at a
// glance and as their own letters on a second look: є keeps its open right side
// rather than squaring off into an E, and ℓ keeps the ascender loop that is the
// only thing separating it from a plain l.
export const NEBULA_NAME: Mask = mask([
  '..........................##.......',
  '.........................#..#......',
  '#...#...###.####..#...#..#..#..###.',
  '#..##..#....#...#.#...#..#..#.#...#',
  '#.#.#..###..####..#...#...##..#...#',
  '##..#..#....#...#.#...#...#...#..##',
  '#...#...###.####...###....###..##.#',
])

// ------------------------------------------------------------------ иєвυℓα
// GDD 11-9. Built from geometry rather than a hand-drawn map, like the chip —
// 60×78 is 4,680 cells and the shape is a silhouette, not a portrait.
//
// ORION is a person with a nebula for a body; иєвυℓα is a nebula wearing the
// shape of a person. Both readings depend on the same thing: she has to be
// legible as a *figure* first. The first attempt was not — a tall hood ellipse
// straight onto a flaring cone, with a black ellipse for a face, read as a
// rocket or a candle rather than as somebody standing behind a counter.
//
// So the skeleton is now humanoid and stated plainly — head, neck, sloped
// shoulders, two sleeves — and the *dissolving* is what makes her uncanny,
// rather than the absence of anatomy. She is a person down to about the waist
// and strands of gas below it.
//
// Four rules the rebuild is bound by. Break any of them and the silhouette goes
// with it — all four were learned the expensive way:
//
//  1. NO PIXEL-LEVEL RANDOMNESS. Per-column or per-pixel noise puts a 1px spike
//     beside a 1px gap and the whole hem reads as static. Everything wispy here
//     comes from low-frequency sines, which also makes it free to reproduce
//     (CLAUDE.md §8 — no generator is consulted at all).
//  2. NOT MIRROR-SYMMETRIC BELOW THE SHOULDERS. The first version drove the hem
//     off |x − cx|, which made the bottom a perfectly symmetric cone — the nozzle
//     read. The hem and the dissolve are now driven off x itself, and the two
//     sleeves are deliberately at different heights.
//  3. NO BLACK HOLE IN THE HOOD. A pure-void ellipse where the face goes reads as
//     a hole punched through her, not as a shadowed face. The hood interior is
//     lit from within instead, and it holds a pair of eyes.
//  4. NO UNIFORM BRIGHT OUTLINE. The second version ran one bright pink all the
//     way round. It out-shone the eyes, so nothing pulled the look to her face,
//     and a silhouette closed by an unbroken bright line cannot scatter — she
//     read as a sticker on the background. The rim tone is graded by distance
//     from the hood's light in compose.ts; the geometry's part of the bargain is
//     rule 5's corollary, that she must not end on a line either.
//
// And what that costs the hem: she has no bottom edge. Everything below the
// waist is decided by density — each row keeps a smaller fraction than the row
// above it until none are left. A computed contour, which is what the second
// version had, is still a line, and it cut a notch up the middle that read as
// the gap between two legs.

export const NEBULA_WIDTH = 60
export const NEBULA_HEIGHT = 78

export type NebulaLayer =
  | 'outside'
  | 'rim'
  | 'veil'
  | 'fold'
  /** A sleeve, drawn a value up from the robe so an arm is a shape and not a bulge. */
  | 'sleeve'
  /** Deep shade under the hood — dark, but never the background colour. */
  | 'hollow'
  /** Where the core's light reaches the inside of the hood. */
  | 'hollowLit'
  | 'glow'
  /** The pair of lights that give her a gaze. */
  | 'eye'

const NEBULA_CX = (NEBULA_WIDTH - 1) / 2

/**
 * Head, and the opening cut into the front of it.
 *
 * Roughly a quarter of her height. The first version gave the hood ry 25 of 78 —
 * a head half the figure — and no proportion below it could recover from that.
 */
const HOOD = { cy: 15, rx: 11.5, ry: 13 }
const FACE = { cy: 17, rx: 6, ry: 7 }

/**
 * A gaze needs two points and a gap between them; one blob is a lamp. Everything
 * lit inside the hood is graded off the distance to the nearer of these, so the
 * light demonstrably comes *from* the eyes rather than sitting behind them as a
 * separate pool — which is what the first attempt did, and it swallowed them.
 */
const EYES = { dx: 3.4, cy: 16, r: 1.4 }
/** Halo radii around an eye, as multiples of the eye itself. */
const EYE_GLOW = 1.5
const EYE_BLEED = 2.6

/**
 * The one light on her, and the point every other brightness is graded away
 * from — compose.ts grades the rim off it (GDD 11-9, and the same hierarchy
 * 11-5 puts on a card frame).
 */
export const NEBULA_LIGHT = { x: NEBULA_CX, y: EYES.cy } as const

/**
 * A neck: three rows where nothing but a narrow column joins the hood to the
 * shoulders.
 *
 * The second version had none — shoulders began while the hood was still wide,
 * on the theory that the hood's own ellipse would narrow enough to serve. It
 * does not: at the row the shoulders started, head and body were within two
 * pixels of the same width, so they read as one lump with a face on it. Two or
 * three rows of gap is all it takes to make them separate parts.
 */
const NECK = { top: 27, bottom: 29, half: 4.5 }

const SHOULDER_Y = 30
const WAIST_Y = 56
/** Half-widths: shoulders wider than the head, a real waist, then the flare. */
const TORSO = { shoulder: 17, waist: 13, hem: 20 }
/** How many rows the shoulders take to reach full width. A hard step is a shelf. */
const SHOULDER_SLOPE = 5
/** Where the slope starts, as a share of full width — a shoulder, not a spike. */
const SHOULDER_START = 0.6

/**
 * Sleeves, as two tapered lengths off the sides of the upper torso.
 *
 * They are the whole reason she reads as humanoid rather than as a cone. They sit
 * high, above the waist, so the outline goes wide at the arms, pulls *in* at the
 * waist and flares again at the hem — a silhouette that changes direction three
 * times reads as a body, and a monotonic flare reads as a nozzle no matter what
 * is on top of it.
 *
 * ★ Tapered, not lobes. The second version made each one an ellipse, which is as
 * wide at the cuff as at the shoulder, and a rounded shape of even thickness is
 * a mitten — the arms read as a doll's. An arm narrows toward the hand, and at
 * 60×78 that taper is most of what says "arm" rather than "bulge in the cloth".
 * `lean` walks the centre line back toward the body as it falls, so the cuff
 * still meets the robe instead of hanging in space beside it.
 *
 * One is raised and one hangs. That is also what keeps rule 2: two matching
 * sleeves would put the mirror symmetry straight back.
 */
const SLEEVES = [
  { top: 33, bottom: 56, x: NEBULA_CX - 18.5, lean: 4, wide: 6.5, cuff: 0.8 },
  { top: 30, bottom: 48, x: NEBULA_CX + 18.5, lean: -4, wide: 5.5, cuff: 0.8 },
] as const

/** How many rows a sleeve takes to reach its full width, so the shoulder rounds. */
const SLEEVE_CAP = 3

/**
 * Where cloth stops and gas begins. Everything below it is decided by density.
 *
 * Both sleeves end above it: a cuff caught in the fade is the first thing to go,
 * and losing it costs the arm the taper that is most of what makes it an arm.
 */
export const NEBULA_FADE_TOP = WAIST_Y

/**
 * How many pixels the fade leaves in a row, and how fast that number falls.
 *
 * ★ The count is stated and the field only chooses *which* pixels — the reverse
 * of the draft before this one, which set a threshold and let the field decide
 * how many survived. That gave no fade at all for ten rows and then a cliff,
 * because the field has its own low-frequency swell in y and the threshold
 * crossed it all at once. It also tore a hole through her middle on the way,
 * which is the two-legs read arrived at from the opposite direction.
 *
 * Stating the count instead makes the density monotonic by construction rather
 * than by tuning, which is the one property the hem actually has to have.
 */
const FADE_WIDTH = 2 * TORSO.waist + 1
const FADE_CURVE = 1.3

/**
 * How much harder it is to survive, per pixel of distance from the centre line.
 *
 * Fraying inward makes the robe narrow to a wisp, which is the one ending that
 * cannot be mistaken for a pair of legs. It has to outweigh the wisp field to do
 * that: at a fifth of this the field won and the survivors came apart into two
 * clumps with a gap between them — the same read, from the opposite direction.
 * At this strength the field is worth about nine pixels of boundary, which is
 * ragged, and the centre line always survives, which is connected.
 *
 * It is measured off |x − cx| and rule 2 still holds, because `drapeAt` is not:
 * the taper is symmetric, what rides on it is not — the same arrangement the hem
 * contour used before it was removed.
 */
const EDGE_BIAS = 0.7

/** Fold lines: spacing, how far they wander across the robe, and how fast. */
const FOLD_PERIOD = 9
const FOLD_BEND = 2.2
const FOLD_BEND_RATE = 0.055
const FOLD_HALF_WIDTH = 0.07

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

/** Normalised distance from an ellipse's centre. 1 is on the boundary. */
const ellipseDistance = (x: number, y: number, e: { cx: number; cy: number; rx: number; ry: number }) =>
  Math.sqrt(((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2)

function torsoHalfWidth(y: number): number {
  if (y < SHOULDER_Y) return 0
  if (y <= WAIST_Y) {
    const slope = Math.min(1, (y - SHOULDER_Y) / SHOULDER_SLOPE)
    const settled = TORSO.shoulder * (SHOULDER_START + (1 - SHOULDER_START) * slope)
    const toWaist = (y - SHOULDER_Y) / (WAIST_Y - SHOULDER_Y)
    return settled + (TORSO.waist - TORSO.shoulder) * toWaist * slope
  }
  const t = (y - WAIST_Y) / (NEBULA_HEIGHT - 1 - WAIST_Y)
  return TORSO.waist + (TORSO.hem - TORSO.waist) * t
}

/**
 * Worked in distance from the centre line, so both arms are one expression.
 *
 * The outer edge tapers; the inner edge is welded to the torso — an arm never
 * stops short of the body it hangs from. The first tapered draft did not weld
 * and the raised sleeve came away from the shoulder by four pixels, because the
 * torso is still narrowing into its slope at the row that sleeve starts on.
 * Tuning the two to meet is a tuning that breaks again the next time either
 * moves; making the sleeve reach is one that cannot.
 */
function inSleeve(x: number, y: number): boolean {
  return SLEEVES.some((sleeve) => {
    if (y < sleeve.top || y > sleeve.bottom) return false
    if (Math.sign(x - NEBULA_CX) !== Math.sign(sleeve.x - NEBULA_CX)) return false

    const along = (y - sleeve.top) / (sleeve.bottom - sleeve.top)
    // Rounded over its first few rows. Starting at full width put a flat
    // horizontal edge across the top of each sleeve, which at 3× is a bar.
    const cap = Math.min(1, (y - sleeve.top + 1) / SLEEVE_CAP)
    const half = (sleeve.wide + (sleeve.cuff - sleeve.wide) * along) * cap
    const axis = Math.abs(sleeve.x + sleeve.lean * along - NEBULA_CX)
    const torso = torsoHalfWidth(y)
    const inner = torso > 0 ? Math.min(axis - half, torso) : axis - half

    const from = Math.abs(x - NEBULA_CX)
    return from >= inner && from <= axis + half
  })
}

/**
 * Which columns hang lower than their neighbours. Driven off x rather than
 * |x − cx| (rule 2), with two frequencies that do not divide each other, so no
 * part of the hem is the mirror of another part and neighbouring columns still
 * stay close.
 */
const drapeAt = (x: number) =>
  Math.sin(x * 0.23 + 0.7) * 0.8 + Math.sin(x * 0.081 + 2.2) * 1.2

/**
 * How far what is left of her has drifted off her own centre line, by row.
 *
 * Rule 2, restated for a fade that keeps a stated count: with the count fixed,
 * only the *shape* of the score across a row decides anything — a field that
 * merely rises and falls with y shifts every pixel equally and changes nothing.
 * So the asymmetry has to be a lean, and this is it. Zero at the waist, out and
 * back by the bottom, which reads as gas drifting off rather than as a cone.
 */
const driftAt = (y: number) => Math.sin((y - NEBULA_FADE_TOP) * 0.16) * 5

/**
 * What holds on longest. Three low-frequency waves crossing in x and y give soft
 * lobes of gas (rule 1 — no randomness), the edge bias pulls the survivors in
 * toward the centre line, and the drape lets some columns outlast their
 * neighbours.
 *
 * Only the *order* matters: `nebulaBody` keeps the highest scores in a row and
 * drops the rest, so the constants here decide the shape of the fray and not how
 * much of it is left.
 */
function wispScore(x: number, y: number): number {
  // Three waves, not two. Two of similar wavelength beat into parallel diagonal
  // bands and the hem came away in a straight slash; the third crosses them.
  //
  // ★ Long in x and tall in amplitude, which is not how they started. What
  // decides whether a row's survivors are one run or two is how fast the field
  // can climb across x against EDGE_BIAS, and what decides how ragged the run is
  // is how far the field can move its edges. Shortening the wavelengths buys the
  // second at the cost of the first; raising the amplitudes buys it for free.
  const wisp =
    Math.sin(x * 0.11 + y * 0.13) * 1.4 +
    Math.sin(x * 0.07 - y * 0.19 + 2.1) * 1.1 +
    Math.sin(x * 0.19 + y * 0.31 + 1.3) * 0.6
  return wisp - EDGE_BIAS * Math.abs(x - NEBULA_CX - driftAt(y)) + drapeAt(x)
}

/** How many of a row's pixels survive the fade. Zero on the bottom row. */
function keptAt(y: number): number {
  const depth = (y - NEBULA_FADE_TOP) / (NEBULA_HEIGHT - 1 - NEBULA_FADE_TOP)
  return Math.round(FADE_WIDTH * (1 - depth) ** FADE_CURVE)
}

/** The shape, before the fade takes anything out of it. */
function isSolid(x: number, y: number): boolean {
  if (inEllipse(x, y, NEBULA_CX, HOOD.cy, HOOD.rx, HOOD.ry)) return true
  if (y >= NECK.top && y <= NECK.bottom && Math.abs(x - NEBULA_CX) <= NECK.half) return true
  if (y >= SHOULDER_Y && Math.abs(x - NEBULA_CX) <= torsoHalfWidth(y)) return true
  return inSleeve(x, y)
}

/**
 * The silhouette: the shape, then the fade taken out of it row by row.
 *
 * It is a two-pass job rather than one predicate per pixel because how many
 * pixels a row keeps is a fact about the row, not about any pixel in it — which
 * is exactly the property a per-pixel threshold could not give.
 */
function nebulaBody(): boolean[][] {
  const body = Array.from({ length: NEBULA_HEIGHT }, (_, y) =>
    Array.from({ length: NEBULA_WIDTH }, (_, x) => isSolid(x, y)),
  )

  for (let y = NEBULA_FADE_TOP; y < NEBULA_HEIGHT; y++) {
    const columns = body[y].flatMap((solid, x) => (solid ? [x] : []))
    columns.sort((a, b) => wispScore(b, y) - wispScore(a, y))
    for (const x of columns.slice(keptAt(y))) body[y][x] = false
  }
  return body
}

/** GDD 11-9: one grid of layers, rim derived from what has empty space beside it. */
export function nebulaLayers(): NebulaLayer[][] {
  const body = nebulaBody()

  return body.map((row, y) =>
    row.map((solid, x): NebulaLayer => {
      if (!solid) return 'outside'

      // Inside the hood: shade, with the light graded outward from the eyes. The
      // gradient is what stops the opening reading as a hole — a flat dark patch
      // the shape of a face is a hole, a lit one is a face in shadow.
      if (y < NECK.top && inEllipse(x, y, NEBULA_CX, FACE.cy, FACE.rx, FACE.ry)) {
        const eye = Math.min(
          ellipseDistance(x, y, { cx: NEBULA_CX - EYES.dx, cy: EYES.cy, rx: EYES.r, ry: EYES.r }),
          ellipseDistance(x, y, { cx: NEBULA_CX + EYES.dx, cy: EYES.cy, rx: EYES.r, ry: EYES.r }),
        )
        if (eye <= 1) return 'eye'
        if (eye <= EYE_GLOW) return 'glow'
        return eye <= EYE_BLEED ? 'hollowLit' : 'hollow'
      }

      const open = (dx: number, dy: number) => body[y + dy]?.[x + dx] !== true
      if (open(-1, 0) || open(0, -1) || open(1, 0) || open(0, 1)) return 'rim'

      // A sleeve is drawn a value up from the robe behind it. Outline alone is
      // not enough at this size: a lobe merged into the torso reads as a bulge in
      // the cloth, and an arm has to be a separate *shape*, not a wider one.
      if (inSleeve(x, y)) return 'sleeve'

      // Folds in the cloth: thin lines that bend as they fall, rather than the
      // dead-straight evenly spaced stripes of the first version, which banded
      // the robe like a barrel and were the other half of the rocket reading.
      //
      // Solved for the nearest fold line rather than thresholded off a sine.
      // Thresholding samples the wave at integer columns and misses its peak on
      // most rows, so the folds came out as scattered specks instead of lines.
      //
      // They stop at the waist because gas has no folds. Below it they survived
      // into strands three pixels wide, and a bright line running down a thread
      // of cloth is what made the fraying read as unravelling stitching.
      if (y > SHOULDER_Y + 6 && y < NEBULA_FADE_TOP) {
        const bend = Math.sin(y * FOLD_BEND_RATE) * FOLD_BEND
        const phase = (x - NEBULA_CX - bend) / FOLD_PERIOD
        if (Math.abs(phase - Math.round(phase)) < FOLD_HALF_WIDTH) return 'fold'
      }
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
