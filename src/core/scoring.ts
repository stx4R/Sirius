// Settlement, following the pseudocode in GDD 5-1.

import { getChip, inBounds, position } from './board'
import {
  BASE_CHIP_SCORE,
  BOARD_SIZE,
  CONSTELLATION_MULTIPLIERS,
  DRIFTER_DIRECTIONS_CHOSEN,
  NO_LINE_MULTIPLIER,
} from './config'
import type { MultiplierStackMode } from './config'
import { findLines } from './constellations'
import { sample } from './rng'
import type { Rng } from './rng'
import { SUIT_ORDER } from './types'
import type { Board, Chip, ConstellationId, Position, ScoredLine, SuitId } from './types'

/** Which adjacent cells a drifter reads. Injected so tests stay deterministic (CLAUDE.md §8). */
export type DrifterChooser = (adjacent: readonly Position[]) => readonly Position[]

/** Suits each cell is judged as. `null` marks an empty cell. */
export type SuitMap = (Set<SuitId> | null)[][]

export interface ScoringContext {
  readonly owned: readonly ConstellationId[]
  readonly stackMode: MultiplierStackMode
  readonly chooseDrifterDirections: DrifterChooser
}

/**
 * One suit's share of the settlement, split the way GDD 5-1 computes it. Every
 * number here was already worked out inside `scoreBoard`; before this existed
 * they were added into `total` and thrown away, which left the UI re-deriving
 * them from the board — scoring logic in `src/ui/`, which CLAUDE.md §5 forbids.
 */
export interface SuitBreakdown {
  readonly suit: SuitId
  /**
   * Every cell judged as this suit — set `S` in GDD 5-1's pseudocode, in
   * row-major order. The settlement screen lights these up on the suit's turn,
   * so the cells it highlights are the ones core actually scored rather than a
   * second reading of the board taken in `src/ui/`.
   */
  readonly cells: readonly Position[]
  /** The lines that fired for this suit, in the order they fired. */
  readonly lines: readonly ScoredLine[]
  /** Σ over `lines` of cells × BASE_CHIP_SCORE × multiplier. */
  readonly lineScore: number
  /** Chips of this suit that belong to no firing line (GDD 5-1). */
  readonly flatScore: number
  /** GDD 6-3: cancer pays on the whole suit rather than on a line. */
  readonly cancerBonus: number
  readonly total: number
}

/**
 * One chip's share of the settlement (GDD 13 #13). `bySuit` answers what GAC
 * earned; this answers what the chip at (1,1) earned, which is the question
 * DRIFT ORACLE pays out on — a fraction of what the drifter itself scored
 * (GDD 8-3) — and the one companion group A has to modify per chip (GDD 7-2 A).
 *
 * A cell judged as several suits — a special chip, a drifter — carries the sum
 * over all of them rather than a per-suit split. The suit axis is `bySuit`.
 */
export interface CellContribution {
  readonly position: Position
  /**
   * Σ over every firing line this cell belongs to. A chip where two lines cross
   * is paid by both of them (GDD 5-2, B-4), so it earns twice what a chip in one
   * line does; which line paid what is not kept.
   */
  readonly lineScore: number
  /** ×1.0 for each suit of this cell that no firing line covered (GDD 5-1). */
  readonly flatScore: number
  /** This cell's share of the whole-suit cancer bonus (GDD 6-3). */
  readonly cancerBonus: number
  /** The three above, summed. */
  readonly total: number
}

export interface ScoreResult {
  readonly total: number
  readonly lines: readonly ScoredLine[]
  /** Suits that scored nothing are omitted. Ordered by SUIT_ORDER (GDD 3-1). */
  readonly bySuit: readonly SuitBreakdown[]
  /** One entry per occupied cell, row-major. A chip that earned nothing is 0, not absent. */
  readonly byCell: readonly CellContribution[]
}

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/**
 * GDD 3-3: 3 of the 4 adjacent chips at random. With 3 or fewer neighbours every
 * one of them is taken and nothing is rolled.
 */
export function randomDrifterChooser(rng: Rng): DrifterChooser {
  return (adjacent) =>
    adjacent.length <= DRIFTER_DIRECTIONS_CHOSEN
      ? adjacent
      : sample(adjacent, DRIFTER_DIRECTIONS_CHOSEN, rng)
}

/** Suits a chip carries on its own. A drifter has none until it reads its neighbours. */
function ownSuits(chip: Chip): readonly SuitId[] {
  switch (chip.kind) {
    case 'basic':
      return [chip.suit]
    case 'special':
      return [chip.left, chip.right]
    case 'drifter':
      return []
  }
}

function occupiedNeighbours(board: Board, pos: Position): Position[] {
  return ORTHOGONAL.map(([dr, dc]) => [pos.row + dr, pos.col + dc] as const)
    .filter(([row, col]) => inBounds(row, col) && board[row][col] !== null)
    .map(([row, col]) => position(row, col))
}

/**
 * A special chip is judged as both of its suits (GDD 3-2); a drifter as the union
 * of the suits it reads, so the same suit arriving from two directions counts once.
 */
export function resolveSuits(board: Board, chooseDirections: DrifterChooser): SuitMap {
  return board.map((row, r) =>
    row.map((chip, c) => {
      if (chip === null) return null
      if (chip.kind !== 'drifter') return new Set(ownSuits(chip))
      const suits = new Set<SuitId>()
      for (const pos of chooseDirections(occupiedNeighbours(board, position(r, c)))) {
        const neighbour = getChip(board, pos)
        if (neighbour !== null) for (const suit of ownSuits(neighbour)) suits.add(suit)
      }
      return suits
    }),
  )
}

/** GDD 5-2. The mode is a config constant so Phase 2 can compare all three. */
export function stackMultipliers(values: readonly number[], mode: MultiplierStackMode): number {
  switch (mode) {
    case 'sum':
      return values.reduce((acc, value) => acc + value, 0)
    case 'product':
      return values.reduce((acc, value) => acc * value, 1)
    case 'additive_delta':
      return 1 + values.reduce((acc, value) => acc + (value - 1), 0)
  }
}

function multiplierFor(id: ConstellationId, cells: number): number {
  const spec = CONSTELLATION_MULTIPLIERS[id]
  return spec.kind === 'fixed' ? spec.value : spec.table[cells]
}

function countBySuit(suits: SuitMap): Record<SuitId, number> {
  const counts: Record<SuitId, number> = { GAC: 0, IMA: 0, GIN: 0, MIM: 0, ACR: 0 }
  for (const row of suits) {
    for (const cell of row) {
      if (cell === null) continue
      for (const suit of cell) counts[suit]++
    }
  }
  return counts
}

const cellIndex = (pos: Position): number => pos.row * BOARD_SIZE + pos.col

export function scoreBoard(board: Board, ctx: ScoringContext): ScoreResult {
  const suits = resolveSuits(board, ctx.chooseDrifterDirections)
  const counts = countBySuit(suits)
  const mostPlaced = Math.max(...SUIT_ORDER.map((suit) => counts[suit]))
  const cancerOwned = ctx.owned.includes('cancer')

  let total = 0
  const lines: ScoredLine[] = []
  const bySuit: SuitBreakdown[] = []

  // Per-cell running sums, kept beside the per-suit ones rather than derived from
  // them. Every figure below is added to `total` exactly as it was before this
  // existed, so the decomposition cannot move a score (tests/baseline-curve).
  const cellCount = BOARD_SIZE * BOARD_SIZE
  const cellLine = new Array<number>(cellCount).fill(0)
  const cellFlat = new Array<number>(cellCount).fill(0)
  const cellCancer = new Array<number>(cellCount).fill(0)

  for (const suit of SUIT_ORDER) {
    const count = counts[suit]
    if (count === 0) continue

    const grid = suits.map((row) => row.map((cell) => cell !== null && cell.has(suit)))
    const cells = grid.flatMap((row, r) =>
      row.flatMap((has, c) => (has ? [position(r, c)] : [])),
    )
    const inLine = new Set<number>()
    const suitLines: ScoredLine[] = []
    let lineScore = 0

    for (const line of findLines(grid, ctx.owned)) {
      const multiplier = stackMultipliers(
        line.constellations.map((id) => multiplierFor(id, line.positions.length)),
        ctx.stackMode,
      )
      lineScore += line.positions.length * BASE_CHIP_SCORE * multiplier
      const perCell = BASE_CHIP_SCORE * multiplier
      for (const pos of line.positions) {
        inLine.add(cellIndex(pos))
        cellLine[cellIndex(pos)] += perCell
      }
      const scored = { ...line, multiplier }
      lines.push(scored)
      suitLines.push(scored)
    }

    const flatScore = (count - inLine.size) * BASE_CHIP_SCORE * NO_LINE_MULTIPLIER

    // The one constellation that pays on the whole suit rather than a line, and
    // as a bonus rather than a multiplier (GDD 5-1, 6-3). Ties all fire.
    const cancerBonus =
      cancerOwned && count === mostPlaced
        ? count * BASE_CHIP_SCORE * (multiplierFor('cancer', count) - 1)
        : 0

    // The same two figures again, spread over the cells that earned them: the
    // flat rate goes to each cell no line covered, the cancer bonus to all of
    // them, since it is paid on the suit's whole count.
    const cancerPerCell = cancerBonus === 0 ? 0 : cancerBonus / count
    for (const pos of cells) {
      const index = cellIndex(pos)
      if (!inLine.has(index)) cellFlat[index] += BASE_CHIP_SCORE * NO_LINE_MULTIPLIER
      cellCancer[index] += cancerPerCell
    }

    total += lineScore + flatScore + cancerBonus
    bySuit.push({
      suit,
      cells,
      lines: suitLines,
      lineScore: Math.round(lineScore),
      flatScore: Math.round(flatScore),
      cancerBonus: Math.round(cancerBonus),
      total: Math.round(lineScore + flatScore + cancerBonus),
    })
  }

  const byCell: CellContribution[] = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (suits[row][col] === null) continue
      const index = row * BOARD_SIZE + col
      byCell.push({
        position: position(row, col),
        lineScore: Math.round(cellLine[index]),
        flatScore: Math.round(cellFlat[index]),
        cancerBonus: Math.round(cellCancer[index]),
        total: Math.round(cellLine[index] + cellFlat[index] + cellCancer[index]),
      })
    }
  }

  // Multipliers are decimals, so the running total drifts by ~1e-13. Scores are
  // integers everywhere in the GDD, so the drift is rounded off once at the end.
  //
  // Under the shipped 'sum' mode every per-suit and per-cell figure is an exact
  // integer before the drift — 10 × a one-decimal multiplier — so the rounded
  // parts add back up to the rounded whole, and the settlement screen can show
  // the sum as an equation. 'product' mode can put two decimals on a multiplier
  // and break that; it is a Phase 2 comparison mode only and never reaches the
  // screen.
  return { total: Math.round(total), lines, bySuit, byCell }
}
