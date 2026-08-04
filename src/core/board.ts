// 5×5 star chart. Every mutation returns a new board — placement is final
// once made (GDD 4-2), so nothing benefits from in-place edits.

import { BOARD_SIZE } from './config'
import type { Board, BoardCell, BoardRow, Chip, ColIndex, Position, RowIndex } from './types'

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  ) as Board
}

export function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

/** Narrowing constructor. Callers are expected to have checked `inBounds` first. */
export function position(row: number, col: number): Position {
  return { row: row as RowIndex, col: col as ColIndex }
}

export function getChip(board: Board, pos: Position): BoardCell {
  return board[pos.row][pos.col]
}

export function isEmpty(board: Board, pos: Position): boolean {
  return getChip(board, pos) === null
}

/** Returns a new board. Untouched rows keep their identity. */
export function placeChip(board: Board, pos: Position, chip: Chip): Board {
  return board.map((row, r) =>
    r === pos.row ? (row.map((cell, c) => (c === pos.col ? chip : cell)) as BoardRow) : row,
  ) as Board
}

export function occupiedPositions(board: Board): Position[] {
  const out: Position[] = []
  board.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell !== null) out.push(position(r, c))
    }),
  )
  return out
}
