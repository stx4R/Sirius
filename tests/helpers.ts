import { createEmptyBoard } from '../src/core/board'
import { DRIFTER_DIRECTIONS_CHOSEN } from '../src/core/config'
import type { MultiplierStackMode } from '../src/core/config'
import type { SuitGrid } from '../src/core/constellations'
import { resolveSuits } from '../src/core/scoring'
import type { DrifterChooser, ScoringContext } from '../src/core/scoring'
import type { Board, Chip, ConstellationId, SuitId } from '../src/core/types'

/**
 * Builds a board from whitespace-separated tokens, one string per row.
 *   '.'        empty
 *   'GAC'      basic chip
 *   'GAC&IMA'  special chip
 *   '*'        drifter
 */
export function boardFrom(rows: readonly string[]): Board {
  const board = createEmptyBoard()
  rows.forEach((line, r) => {
    line
      .trim()
      .split(/\s+/)
      .forEach((token, c) => {
        if (token !== '.') board[r][c] = chipFrom(token, `${r}-${c}`)
      })
  })
  return board
}

function chipFrom(token: string, id: string): Chip {
  if (token === '*') return { id, kind: 'drifter' }
  if (token.includes('&')) {
    const [left, right] = token.split('&') as [SuitId, SuitId]
    return { id, kind: 'special', left, right }
  }
  return { id, kind: 'basic', suit: token as SuitId }
}

/** Deterministic stand-in for the random chooser: the first neighbours in board order. */
export const firstNeighbours: DrifterChooser = (adjacent) =>
  adjacent.slice(0, DRIFTER_DIRECTIONS_CHOSEN)

export function context(
  owned: readonly ConstellationId[],
  stackMode: MultiplierStackMode = 'sum',
  chooseDrifterDirections: DrifterChooser = firstNeighbours,
): ScoringContext {
  return { owned, stackMode, chooseDrifterDirections }
}

/** The cells judged as `suit`, in the shape `findLines` expects. */
export function gridFor(
  board: Board,
  suit: SuitId,
  chooser: DrifterChooser = firstNeighbours,
): SuitGrid {
  return resolveSuits(board, chooser).map((row) =>
    row.map((cell) => cell !== null && cell.has(suit)),
  )
}
