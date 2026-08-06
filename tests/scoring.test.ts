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

describe('per-suit breakdown', () => {
  it('splits one suit into line score and the flat remainder', () => {
    const board = boardFrom([
      'GAC GAC GAC .   .',
      'GAC .   .   .   .',
      'GAC .   .   .   .',
      EMPTY,
      EMPTY,
    ])

    const { bySuit } = scoreBoard(board, context(['aries']))

    expect(bySuit).toHaveLength(1)
    expect(bySuit[0]).toMatchObject({
      suit: 'GAC',
      lineScore: 36,
      flatScore: 20,
      cancerBonus: 0,
      total: 56,
    })
  })

  it('keeps the whole-suit cancer bonus in its own field', () => {
    const board = boardFrom(['GAC GAC .   .   .', 'IMA IMA .   .   .', EMPTY, EMPTY, EMPTY])

    const { bySuit } = scoreBoard(board, context(['cancer']))

    expect(bySuit.map((entry) => entry.suit)).toEqual(['GAC', 'IMA'])
    for (const entry of bySuit) {
      expect(entry).toMatchObject({ lineScore: 0, flatScore: 20, cancerBonus: 2, total: 22 })
    }
  })

  it('gives a special chip an entry under each of its two suits', () => {
    const board = boardFrom(['GAC&IMA .   .   .   .', EMPTY, EMPTY, EMPTY, EMPTY])

    const { bySuit } = scoreBoard(board, context([]))

    expect(bySuit.map((entry) => entry.suit)).toEqual(['GAC', 'IMA'])
    expect(bySuit.every((entry) => entry.total === 10)).toBe(true)
  })

  it('omits suits that scored nothing', () => {
    const board = boardFrom(['GAC .   .   .   .', EMPTY, EMPTY, EMPTY, EMPTY])

    expect(scoreBoard(board, context([])).bySuit.map((entry) => entry.suit)).toEqual(['GAC'])
  })

  // The settlement screen lights `cells` up on the suit's turn, so it has to be
  // every cell the suit was scored over — lines and the flat remainder alike.
  it('lists every cell a suit was judged over, a special chip under both suits', () => {
    const board = boardFrom([
      'GAC GAC .       .   .',
      '.   .   GAC&IMA .   .',
      EMPTY,
      EMPTY,
      EMPTY,
    ])

    const { bySuit } = scoreBoard(board, context([]))
    const cellsOf = (suit: string) =>
      bySuit
        .find((entry) => entry.suit === suit)!
        .cells.map((pos) => `${pos.row},${pos.col}`)

    expect(cellsOf('GAC')).toEqual(['0,0', '0,1', '1,2'])
    expect(cellsOf('IMA')).toEqual(['1,2'])
  })

  it('counts one cell per suit even when a drifter reads the same suit twice', () => {
    // The drifter at (1,1) reads three neighbours, two of them GAC. GDD 3-3
    // unions the suits, so the cell is one GAC cell and not two.
    const board = boardFrom([
      '.   GAC .   .   .',
      'GAC *   IMA .   .',
      EMPTY,
      EMPTY,
      EMPTY,
    ])

    const { bySuit } = scoreBoard(board, context([]))
    const gac = bySuit.find((entry) => entry.suit === 'GAC')!

    expect(gac.cells.map((pos) => `${pos.row},${pos.col}`)).toEqual(['0,1', '1,0', '1,1'])
    expect(gac.total).toBe(gac.cells.length * 10)
  })

  // The settlement screen shows the suit columns as an equation that ends on the
  // round score, so the parts have to add up to the whole exactly (GDD 5-1).
  it('adds back up to the total, and accounts for every line', () => {
    const boards = [
      ['GAC GAC GAC .   .', 'GAC .   .   .   .', 'GAC .   .   .   .', EMPTY, EMPTY],
      ['GAC GAC .   .   .', 'IMA IMA .   .   .', EMPTY, EMPTY, EMPTY],
      ['GAC&IMA GAC&IMA GAC&IMA .   .', 'MIM MIM MIM .   .', EMPTY, EMPTY, EMPTY],
      ['GAC GAC GAC GAC GAC', 'IMA IMA IMA IMA .', 'ACR .   .   .   .', EMPTY, EMPTY],
      ['GAC .   .   .   .', 'GAC .   .   .   .', '*   .   .   .   .', 'MIM MIM MIM .   .', EMPTY],
    ]
    const owned = ['aries', 'libra', 'cancer', 'leo'] as const

    for (const rows of boards) {
      const result = scoreBoard(boardFrom(rows), context([...owned], MULTIPLIER_STACK_MODE))

      const summed = result.bySuit.reduce((acc, entry) => acc + entry.total, 0)
      expect(summed).toBe(result.total)

      expect(result.bySuit.flatMap((entry) => entry.lines)).toEqual(result.lines)
    }
  })
})
