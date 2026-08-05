// Settlement, following the pseudocode in GDD 5-1.

import { getChip, inBounds, position } from './board'
import {
  BASE_CHIP_SCORE,
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

export interface ScoreResult {
  readonly total: number
  readonly lines: readonly ScoredLine[]
  /** Suits that scored nothing are omitted. Ordered by SUIT_ORDER (GDD 3-1). */
  readonly bySuit: readonly SuitBreakdown[]
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

const cellKey = (pos: Position): string => `${pos.row},${pos.col}`

export function scoreBoard(board: Board, ctx: ScoringContext): ScoreResult {
  const suits = resolveSuits(board, ctx.chooseDrifterDirections)
  const counts = countBySuit(suits)
  const mostPlaced = Math.max(...SUIT_ORDER.map((suit) => counts[suit]))
  const cancerOwned = ctx.owned.includes('cancer')

  let total = 0
  const lines: ScoredLine[] = []
  const bySuit: SuitBreakdown[] = []

  for (const suit of SUIT_ORDER) {
    const count = counts[suit]
    if (count === 0) continue

    const grid = suits.map((row) => row.map((cell) => cell !== null && cell.has(suit)))
    const inLine = new Set<string>()
    const suitLines: ScoredLine[] = []
    let lineScore = 0

    for (const line of findLines(grid, ctx.owned)) {
      const multiplier = stackMultipliers(
        line.constellations.map((id) => multiplierFor(id, line.positions.length)),
        ctx.stackMode,
      )
      lineScore += line.positions.length * BASE_CHIP_SCORE * multiplier
      for (const pos of line.positions) inLine.add(cellKey(pos))
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

    total += lineScore + flatScore + cancerBonus
    bySuit.push({
      suit,
      lines: suitLines,
      lineScore: Math.round(lineScore),
      flatScore: Math.round(flatScore),
      cancerBonus: Math.round(cancerBonus),
      total: Math.round(lineScore + flatScore + cancerBonus),
    })
  }

  // Multipliers are decimals, so the running total drifts by ~1e-13. Scores are
  // integers everywhere in the GDD, so the drift is rounded off once at the end.
  //
  // Under the shipped 'sum' mode every per-suit figure is an exact integer before
  // the drift — cells × 10 × a one-decimal multiplier — so the rounded parts add
  // back up to the rounded whole, and the settlement screen can show the sum as
  // an equation. 'product' mode can put two decimals on a multiplier and break
  // that; it is a Phase 2 comparison mode only and never reaches the screen.
  return { total: Math.round(total), lines, bySuit }
}
