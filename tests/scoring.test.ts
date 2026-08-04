import { describe, expect, it } from 'vitest'
import { MULTIPLIER_STACK_MODE } from '../src/core/config'
import { mulberry32 } from '../src/core/rng'
import { randomDrifterChooser, resolveSuits, scoreBoard } from '../src/core/scoring'
import { boardFrom, context, firstNeighbours } from './helpers'

const EMPTY = '.   .   .   .   .'

const suitsAt = (rows: readonly string[], row: number, col: number) =>
  resolveSuits(boardFrom(rows), firstNeighbours)[row][col]

describe('Cancer', () => {
  it('pays nothing when it is not owned', () => {
    const board = boardFrom(['GAC GAC .   .   .', 'IMA IMA .   .   .', EMPTY, EMPTY, EMPTY])

    expect(scoreBoard(board, context([])).total).toBe(40)
  })

  it('adds 10% of the single most placed suit', () => {
    const board = boardFrom(['GAC GAC GAC .   .', 'IMA IMA .   .   .', EMPTY, EMPTY, EMPTY])

    // GAC 3×10 + 10% of 30 = 33, IMA 2×10 = 20 — the bonus skips the smaller suit.
    expect(scoreBoard(board, context(['cancer'])).total).toBe(53)
  })

  it('fires for every suit tied for most placed', () => {
    const board = boardFrom(['GAC GAC .   .   .', 'IMA IMA .   .   .', EMPTY, EMPTY, EMPTY])

    expect(scoreBoard(board, context(['cancer'])).total).toBe(44)
  })
})

describe('special chips', () => {
  it('scores once under each of its two suits', () => {
    const board = boardFrom(['GAC&IMA .   .   .   .', EMPTY, EMPTY, EMPTY, EMPTY])

    expect(scoreBoard(board, context([])).total).toBe(20)
  })

  it('completes a line in both suits at once', () => {
    const board = boardFrom([
      'GAC     .   .   .   .',
      'GAC     .   .   .   .',
      'GAC&IMA .   .   .   .',
      'IMA     .   .   .   .',
      'IMA     .   .   .   .',
    ])

    // Two separate Aries runs of 3: (3 × 10 × 1.2) twice.
    expect(scoreBoard(board, context(['aries'])).total).toBe(72)
  })

  it('can be in a line for one suit and loose for the other', () => {
    const board = boardFrom([
      'GAC     .   .   .   .',
      'GAC     .   .   .   .',
      'GAC&IMA .   .   .   .',
      EMPTY,
      EMPTY,
    ])

    // GAC run of 3 → 36; the chip's IMA half is in no line → 10.
    expect(scoreBoard(board, context(['aries'])).total).toBe(46)
  })
})

describe('drifter chips', () => {
  it('reads exactly the directions the chooser picks', () => {
    const rows = ['.   GAC .   .   .', 'IMA *   GIN .   .', '.   MIM .   .   .', EMPTY, EMPTY]

    const suits = suitsAt(rows, 1, 1)

    expect(suits).toEqual(new Set(['GAC', 'MIM', 'IMA']))
    expect(scoreBoard(boardFrom(rows), context([])).total).toBe(70)
  })

  it('takes every neighbour without rolling when there are 3 or fewer', () => {
    const board = boardFrom(['.   GAC .   .   .', 'IMA *   .   .   .', EMPTY, EMPTY, EMPTY])

    for (const seed of [1, 2, 3, 99]) {
      const suits = resolveSuits(board, randomDrifterChooser(mulberry32(seed)))[1][1]
      expect(suits).toEqual(new Set(['GAC', 'IMA']))
    }
  })

  it('scores nothing with no neighbours', () => {
    const rows = ['*   .   .   .   .', EMPTY, EMPTY, EMPTY, EMPTY]

    expect(suitsAt(rows, 0, 0)).toEqual(new Set())
    expect(scoreBoard(boardFrom(rows), context([])).total).toBe(0)
  })

  it('counts a suit once even when two directions supply it', () => {
    const rows = ['.   GAC .   .   .', 'GAC *   GAC .   .', EMPTY, EMPTY, EMPTY]

    expect(suitsAt(rows, 1, 1)).toEqual(new Set(['GAC']))
    // 3 basics + the drifter's single GAC judgement.
    expect(scoreBoard(boardFrom(rows), context([])).total).toBe(40)
  })

  it('takes both suits from a special neighbour', () => {
    const rows = [EMPTY, 'GAC&IMA *   .   .   .', EMPTY, EMPTY, EMPTY]

    expect(suitsAt(rows, 1, 1)).toEqual(new Set(['GAC', 'IMA']))
    expect(scoreBoard(boardFrom(rows), context([])).total).toBe(40)
  })
})

describe('settlement', () => {
  const gdd53 = [
    'GAC .   .   .   .',
    'GAC .   .   .   .',
    'GAC .   .   .   .',
    'GAC .   .   .   .',
    'GAC .   .   .   .',
  ]
  const owned = ['aries', 'capricorn', 'sagittarius'] as const

  it('matches the GDD 5-3 worked example: 275 in sum mode', () => {
    const result = scoreBoard(boardFrom(gdd53), context([...owned], 'sum'))

    expect(MULTIPLIER_STACK_MODE).toBe('sum')
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].multiplier).toBeCloseTo(1.2 + 1.8 + 2.5)
    expect(result.total).toBe(275)
  })

  it('gives 270 for the same board in product mode', () => {
    // 1.2 × 1.8 × 2.5 = 5.4 → 50 × 5.4
    expect(scoreBoard(boardFrom(gdd53), context([...owned], 'product')).total).toBe(270)
  })

  it('gives 175 for the same board in additive_delta mode', () => {
    // 1.0 + (0.2 + 0.8 + 1.5) = 3.5 → 50 × 3.5
    expect(scoreBoard(boardFrom(gdd53), context([...owned], 'additive_delta')).total).toBe(175)
  })

  it('pays a crossing chip in both its lines', () => {
    const board = boardFrom([
      'GAC GAC GAC .   .',
      'GAC .   .   .   .',
      'GAC .   .   .   .',
      EMPTY,
      EMPTY,
    ])

    // (3 × 10 × 1.2) vertical + (3 × 10 × 1.2) horizontal; (0,0) counts in both.
    const result = scoreBoard(board, context(['aries', 'libra']))

    expect(result.lines).toHaveLength(2)
    expect(result.total).toBe(72)
  })

  it('scores chips outside every firing line at ×1.0', () => {
    const board = boardFrom([
      'GAC GAC GAC .   .',
      'GAC .   .   .   .',
      'GAC .   .   .   .',
      EMPTY,
      EMPTY,
    ])

    // Vertical run of 3 → 36; (0,1) and (0,2) are in no line → 20.
    expect(scoreBoard(board, context(['aries'])).total).toBe(56)
  })

  it('lets a drifter complete a line', () => {
    const board = boardFrom(['GAC .   .   .   .', 'GAC .   .   .   .', '*   .   .   .   .', EMPTY, EMPTY])

    // The drifter reads GAC from above and becomes the third cell of the run.
    const result = scoreBoard(board, context(['aries']))

    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].positions).toHaveLength(3)
    expect(result.total).toBe(36)
  })
})
