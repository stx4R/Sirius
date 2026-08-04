import { describe, expect, it } from 'vitest'
import {
  createEmptyBoard,
  getChip,
  inBounds,
  isEmpty,
  occupiedPositions,
  placeChip,
  position,
} from '../src/core/board'
import { BOARD_SIZE } from '../src/core/config'
import type { Chip } from '../src/core/types'

const gacrux: Chip = { id: 'GAC-0', kind: 'basic', suit: 'GAC' }

describe('board', () => {
  it('starts as a 5×5 grid of empty cells', () => {
    const board = createEmptyBoard()

    expect(board).toHaveLength(BOARD_SIZE)
    for (const row of board) {
      expect(row).toHaveLength(BOARD_SIZE)
      expect(row.every((cell) => cell === null)).toBe(true)
    }
  })

  it('leaves the source board untouched when placing', () => {
    const board = createEmptyBoard()

    const next = placeChip(board, position(2, 3), gacrux)

    expect(getChip(next, position(2, 3))).toBe(gacrux)
    expect(getChip(board, position(2, 3))).toBeNull()
    expect(next).not.toBe(board)
  })

  it('rebuilds only the row it changed', () => {
    const board = createEmptyBoard()

    const next = placeChip(board, position(1, 1), gacrux)

    expect(next[1]).not.toBe(board[1])
    expect(next[0]).toBe(board[0])
    expect(next[4]).toBe(board[4])
  })

  it('reports occupancy per cell', () => {
    const board = placeChip(createEmptyBoard(), position(0, 0), gacrux)

    expect(isEmpty(board, position(0, 0))).toBe(false)
    expect(isEmpty(board, position(0, 1))).toBe(true)
    expect(inBounds(0, 0)).toBe(true)
    expect(inBounds(-1, 0)).toBe(false)
    expect(inBounds(0, BOARD_SIZE)).toBe(false)
  })

  it('lists occupied positions in row-major order', () => {
    let board = createEmptyBoard()
    board = placeChip(board, position(4, 4), gacrux)
    board = placeChip(board, position(0, 2), gacrux)

    expect(occupiedPositions(board)).toEqual([
      { row: 0, col: 2 },
      { row: 4, col: 4 },
    ])
  })
})
