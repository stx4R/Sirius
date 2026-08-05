// Pixel maps, written as art rather than nested arrays so a change is legible in
// review (GDD 11-1: no image files — everything is defined in code).
//
// '#' is on, '.' is off. Every map is SPRITE_SIZE rows of SPRITE_SIZE characters.

import { CONSTELLATION_RULES } from '../core/config'
import type { ConstellationId, SuitId } from '../core/types'

export const SPRITE_SIZE = 16

/** A boolean mask the size of one sprite. */
export type Mask = readonly (readonly boolean[])[]

const mask = (rows: readonly string[]): Mask => rows.map((row) => [...row].map((c) => c === '#'))

const emptyMask = (): boolean[][] =>
  Array.from({ length: SPRITE_SIZE }, () => new Array<boolean>(SPRITE_SIZE).fill(false))

const inside = (row: number, col: number) =>
  row >= 0 && row < SPRITE_SIZE && col >= 0 && col < SPRITE_SIZE

/**
 * The suit chip is a round token (GDD 11-4). Every suit shares this outline, so
 * halving a special chip down the middle leaves the circle intact on both sides.
 */
export const DISC: Mask = mask([
  '.....######.....',
  '...##########...',
  '..############..',
  '.##############.',
  '.##############.',
  '################',
  '################',
  '################',
  '################',
  '################',
  '################',
  '.##############.',
  '.##############.',
  '..############..',
  '...##########...',
  '.....######.....',
])

/**
 * GDD 11-6: the drifter must not read as a sixth suit, and must not be confused
 * with a special chip — both carry several colours. A cut-gem outline separates
 * it at the silhouette, before any colour is read.
 */
export const PRISM: Mask = mask([
  '.......##.......',
  '......####......',
  '.....######.....',
  '....########....',
  '...##########...',
  '..############..',
  '..############..',
  '..############..',
  '..############..',
  '..############..',
  '..############..',
  '...##########...',
  '....########....',
  '.....######.....',
  '......####......',
  '.......##.......',
])

/**
 * Suit symbols, centred on the seam between columns 7 and 8 so that a special
 * chip's two halves each keep a readable half-symbol (GDD 3-2).
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

// ------------------------------------------------------ constellation icons
// GDD 11-5. The icon is the scoring rule drawn as a star chart: stars where the
// pattern's cells are, joined by the lines a star chart would draw between them.
//
// These are generated from CONSTELLATION_RULES rather than hand-drawn, so an icon
// cannot describe a rule the game no longer has.

const STAR_SIZE = 2
/** Star pitch: the 2px star plus a 1px gap. */
const STAR_STEP = STAR_SIZE + 1
/** Top-left of a star sitting on the sprite's centre line. */
const CENTRE = SPRITE_SIZE / 2 - STAR_SIZE / 2

type Cell = readonly [row: number, col: number]

/** The three layers an icon is painted from: joins, stars, and the glow around them. */
export interface IconLayers {
  readonly lines: Mask
  readonly stars: Mask
  readonly glow: Mask
}

/** Evenly spaced star origins for a run of `count`, centred in the sprite. */
const spacing = (count: number): number[] => {
  const start = Math.floor((SPRITE_SIZE - (count * STAR_STEP - 1)) / 2)
  return Array.from({ length: count }, (_, i) => start + i * STAR_STEP)
}

/** Star origins and the runs of them a star chart would join. */
function layoutOf(id: ConstellationId): { stars: Cell[]; runs: Cell[][] } {
  const rule = CONSTELLATION_RULES[id]
  const length = rule.length ?? 0

  switch (rule.axis) {
    case 'vertical': {
      const run = spacing(length).map((row): Cell => [row, CENTRE])
      return { stars: run, runs: [run] }
    }
    case 'horizontal': {
      const run = spacing(length).map((col): Cell => [CENTRE, col])
      return { stars: run, runs: [run] }
    }
    case 'diagonal': {
      const run = spacing(length).map((at): Cell => [at, at])
      return { stars: run, runs: [run] }
    }
    // GDD 6-1: an apex with a diagonal falling away on each side.
    case 'shape_A': {
      const apex: Cell = [3, CENTRE]
      const left: Cell = [11, 2]
      const right: Cell = [11, 12]
      return {
        stars: [apex, left, right],
        runs: [
          [left, apex],
          [apex, right],
        ],
      }
    }
    // GDD 6-2: a horizontal base with a column rising from its centre.
    case 'shape_T': {
      const base: Cell[] = [
        [11, 2],
        [11, CENTRE],
        [11, 12],
      ]
      const stem: Cell = [4, CENTRE]
      return { stars: [...base, stem], runs: [base, [base[1], stem]] }
    }
    // GDD 6-3: scored over the whole board rather than along a line, so nothing joins.
    case 'global':
      return {
        stars: [
          [2, 2],
          [2, 12],
          [12, 2],
          [12, 12],
          [CENTRE, CENTRE],
        ],
        runs: [],
      }
  }
}

const step = (from: number, to: number) => Math.sign(to - from)

/** The STAR_SIZE² cells a star at `origin` occupies. */
const blockAt = ([row, col]: Cell): Cell[] =>
  Array.from({ length: STAR_SIZE * STAR_SIZE }, (_, i): Cell => [
    row + Math.floor(i / STAR_SIZE),
    col + (i % STAR_SIZE),
  ])

const key = ([row, col]: Cell) => `${row},${col}`

/** The block shifted by `delta`, minus the block itself — a 1px fringe on that side. */
function fringe(origin: Cell, delta: Cell): Cell[] {
  const block = blockAt(origin)
  const occupied = new Set(block.map(key))
  return block
    .map(([row, col]): Cell => [row + delta[0], col + delta[1]])
    .filter((cell) => !occupied.has(key(cell)))
}

const paint = (out: boolean[][], cells: readonly Cell[]): void => {
  for (const [row, col] of cells) if (inside(row, col)) out[row][col] = true
}

/** Joins consecutive stars with a line as wide as the stars themselves. */
function paintJoins(out: boolean[][], run: readonly Cell[]): void {
  for (let i = 0; i + 1 < run.length; i++) {
    let [row, col] = run[i]
    const [endRow, endCol] = run[i + 1]
    while (row !== endRow || col !== endCol) {
      paint(out, blockAt([row, col]))
      row += step(row, endRow)
      col += step(col, endCol)
    }
  }
}

/**
 * GDD 11-5: within one axis family the grade is told apart by star count and by
 * how brightly the stars burn.
 *
 * The corona only ever reaches sideways, never along the run. Filling the gaps
 * between stars would weld a run of 5 into a solid bar and destroy the count,
 * which is the clearer of the two cues. So: 3 burns bare, 4 gains flanks, 5 gains
 * flanks plus a cap past each end.
 */
function paintCorona(out: boolean[][], run: readonly Cell[], length: number): void {
  if (run.length < 2 || length < 4) return

  const first = run[0]
  const last = run[run.length - 1]
  const along: Cell = [step(first[0], run[1][0]), step(first[1], run[1][1])]
  const sideways: Cell[] = [
    [-along[1], along[0]],
    [along[1], -along[0]],
  ]

  for (const origin of run) for (const side of sideways) paint(out, fringe(origin, side))

  if (length >= 5) {
    paint(out, fringe(first, [-along[0], -along[1]]))
    paint(out, fringe(last, along))
  }
}

function iconLayers(id: ConstellationId): IconLayers {
  const { stars, runs } = layoutOf(id)
  const rule = CONSTELLATION_RULES[id]
  const lines = emptyMask()
  const starMask = emptyMask()
  const glow = emptyMask()

  for (const run of runs) {
    paintJoins(lines, run)
    // Shapes and the global rule stand alone in their families, so they have no
    // grade to signal and take no corona.
    if (rule.length !== null) paintCorona(glow, run, rule.length)
  }
  for (const origin of stars) paint(starMask, blockAt(origin))

  return { lines, stars: starMask, glow }
}

const ALL_CONSTELLATION_IDS = Object.keys(CONSTELLATION_RULES) as ConstellationId[]

export const CONSTELLATION_GLYPHS: Readonly<Record<ConstellationId, IconLayers>> =
  Object.fromEntries(ALL_CONSTELLATION_IDS.map((id) => [id, iconLayers(id)])) as Record<
    ConstellationId,
    IconLayers
  >
