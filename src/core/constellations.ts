// Line detection for the 12 zodiac constellations (GDD 6).
// Geometry only — multipliers are stacked and turned into points by scoring.ts.

import { inBounds, position } from './board'
import { BOARD_SIZE, CONSTELLATION_RULES, SHAPE_A_FORMS, SHAPE_T_FORMS } from './config'
import type { ConstellationId, LineAxis, Position, ScoredLine } from './types'

/** `grid[row][col]` — true when that cell is judged as the suit currently being scored. */
export type SuitGrid = boolean[][]

export type DetectedLine = Omit<ScoredLine, 'multiplier'>

type Step = readonly [number, number]

const RUN_AXES = ['vertical', 'horizontal', 'diagonal'] as const
type RunAxis = (typeof RUN_AXES)[number]

/** Largest form first, so a smaller one is never reported at the same anchor. */
const SHAPE_A_DESC = [...SHAPE_A_FORMS].sort((a, b) => b.cells - a.cells)
const SHAPE_T_DESC = [...SHAPE_T_FORMS].sort((a, b) => b.cells - a.cells)

const INDICES = Array.from({ length: BOARD_SIZE }, (_, i) => i)

/**
 * Walks each line from its starting cell and cuts it at gaps and edges, so every
 * run returned is maximal — a 3-run inside a 5-run is never reported (GDD 5-2).
 */
function collectRuns(grid: SuitGrid, starts: readonly Step[], step: Step): Position[][] {
  const runs: Position[][] = []
  for (const [startRow, startCol] of starts) {
    let run: Position[] = []
    let row = startRow
    let col = startCol
    while (inBounds(row, col)) {
      if (grid[row][col]) {
        run.push(position(row, col))
      } else if (run.length > 0) {
        runs.push(run)
        run = []
      }
      row += step[0]
      col += step[1]
    }
    if (run.length > 0) runs.push(run)
  }
  return runs
}

function runsForAxis(grid: SuitGrid, axis: RunAxis): Position[][] {
  const last = BOARD_SIZE - 1
  if (axis === 'vertical') {
    return collectRuns(grid, INDICES.map((col): Step => [0, col]), [1, 0])
  }
  if (axis === 'horizontal') {
    return collectRuns(grid, INDICES.map((row): Step => [row, 0]), [0, 1])
  }
  // Both diagonal orientations, every offset (GDD 5-2, B-5). '↗' is walked
  // downward-left, which covers the same cells as walking it upward-right.
  const downRight: Step[] = [
    ...INDICES.map((col): Step => [0, col]),
    ...INDICES.slice(1).map((row): Step => [row, 0]),
  ]
  const downLeft: Step[] = [
    ...INDICES.map((col): Step => [0, col]),
    ...INDICES.slice(1).map((row): Step => [row, last]),
  ]
  return [...collectRuns(grid, downRight, [1, 1]), ...collectRuns(grid, downLeft, [1, -1])]
}

function firingOn(
  owned: readonly ConstellationId[],
  axis: LineAxis,
  length: number,
): ConstellationId[] {
  return owned.filter((id) => {
    const rule = CONSTELLATION_RULES[id]
    if (rule.axis !== axis || rule.length === null) return false
    return rule.exact ? length === rule.length : length >= rule.length
  })
}

/** Collects cells if every one of them is in bounds and set; otherwise null. */
function gather(grid: SuitGrid, cells: readonly Step[]): Position[] | null {
  const out: Position[] = []
  for (const [row, col] of cells) {
    if (!inBounds(row, col) || !grid[row][col]) return null
    out.push(position(row, col))
  }
  return out
}

/** GDD 6-1: apex plus n cells down-left and n cells down-right. */
function shapeACells(row: number, col: number, n: number): Step[] {
  const cells: Step[] = [[row, col]]
  for (let i = 1; i <= n; i++) {
    cells.push([row + i, col - i], [row + i, col + i])
  }
  return cells
}

/** GDD 6-2: horizontal base of `base` cells plus `stem` cells up from its centre. */
function shapeTCells(row: number, centre: number, base: number, stem: number): Step[] {
  const half = (base - 1) / 2
  const cells: Step[] = []
  for (let col = centre - half; col <= centre + half; col++) cells.push([row, col])
  for (let up = 1; up <= stem; up++) cells.push([row - up, centre])
  return cells
}

/**
 * One line per anchor at most: the largest form wins and smaller ones at that
 * anchor are skipped. Different anchors are independent lines even when they
 * share cells, matching the crossing rule (GDD 5-2, B-4).
 */
function findShapes(
  grid: SuitGrid,
  owned: readonly ConstellationId[],
  id: ConstellationId,
  axis: LineAxis,
  cellsFor: (row: number, col: number) => readonly Step[][],
): DetectedLine[] {
  if (!owned.includes(id)) return []
  const lines: DetectedLine[] = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      for (const candidate of cellsFor(row, col)) {
        const positions = gather(grid, candidate)
        if (positions !== null) {
          lines.push({ positions, axis, constellations: [id] })
          break
        }
      }
    }
  }
  return lines
}

export function findLines(grid: SuitGrid, owned: readonly ConstellationId[]): DetectedLine[] {
  const lines: DetectedLine[] = []

  for (const axis of RUN_AXES) {
    for (const run of runsForAxis(grid, axis)) {
      const constellations = firingOn(owned, axis, run.length)
      if (constellations.length > 0) lines.push({ positions: run, axis, constellations })
    }
  }

  lines.push(
    ...findShapes(grid, owned, 'aquarius', 'shape_A', (row, col) =>
      SHAPE_A_DESC.map((form) => shapeACells(row, col, form.n)),
    ),
    ...findShapes(grid, owned, 'virgo', 'shape_T', (row, centre) =>
      SHAPE_T_DESC.map((form) => shapeTCells(row, centre, form.base, form.stem)),
    ),
  )

  return lines
}
