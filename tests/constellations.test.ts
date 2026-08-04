import { describe, expect, it } from 'vitest'
import { findLines } from '../src/core/constellations'
import type { DetectedLine } from '../src/core/constellations'
import type { ConstellationId } from '../src/core/types'
import { boardFrom, gridFor } from './helpers'

const linesOf = (rows: readonly string[], owned: readonly ConstellationId[]): DetectedLine[] =>
  findLines(gridFor(boardFrom(rows), 'GAC'), owned)

const sizes = (lines: readonly DetectedLine[]) =>
  lines.map((line) => line.positions.length).sort((a, b) => a - b)

const EMPTY = '.   .   .   .   .'

const VERTICAL: ConstellationId[] = ['aries', 'capricorn', 'sagittarius']
const HORIZONTAL: ConstellationId[] = ['libra', 'pisces', 'leo']
const DIAGONAL: ConstellationId[] = ['gemini', 'taurus', 'scorpio']

describe('vertical constellations', () => {
  it('fires Aries alone on a run of 3', () => {
    const lines = linesOf(
      ['GAC .   .   .   .', 'GAC .   .   .   .', 'GAC .   .   .   .', EMPTY, EMPTY],
      VERTICAL,
    )

    expect(lines).toHaveLength(1)
    expect(lines[0].axis).toBe('vertical')
    expect(lines[0].constellations).toEqual(['aries'])
  })

  it('adds Capricorn on a run of 4', () => {
    const lines = linesOf(
      ['GAC .   .   .   .', 'GAC .   .   .   .', 'GAC .   .   .   .', 'GAC .   .   .   .', EMPTY],
      VERTICAL,
    )

    expect(lines).toHaveLength(1)
    expect(lines[0].constellations).toEqual(['aries', 'capricorn'])
  })

  it('adds Sagittarius on a run of 5', () => {
    const lines = linesOf(
      [
        'GAC .   .   .   .',
        'GAC .   .   .   .',
        'GAC .   .   .   .',
        'GAC .   .   .   .',
        'GAC .   .   .   .',
      ],
      VERTICAL,
    )

    expect(lines).toHaveLength(1)
    expect(lines[0].constellations).toEqual(['aries', 'capricorn', 'sagittarius'])
  })

  it('fires nothing on a run of 2', () => {
    const lines = linesOf(['GAC .   .   .   .', 'GAC .   .   .   .', EMPTY, EMPTY, EMPTY], VERTICAL)

    expect(lines).toEqual([])
  })

  it('reports the maximal run only, not the 3-runs inside it', () => {
    const lines = linesOf(
      [
        'GAC .   .   .   .',
        'GAC .   .   .   .',
        'GAC .   .   .   .',
        'GAC .   .   .   .',
        'GAC .   .   .   .',
      ],
      ['aries'],
    )

    expect(lines).toHaveLength(1)
    expect(lines[0].positions).toHaveLength(5)
  })

  it('splits a column at a gap', () => {
    const lines = linesOf(
      ['GAC .   .   .   .', 'GAC .   .   .   .', 'GAC .   .   .   .', EMPTY, 'GAC .   .   .   .'],
      VERTICAL,
    )

    expect(sizes(lines)).toEqual([3])
  })
})

describe('horizontal constellations', () => {
  it('fires Libra alone on a run of 3', () => {
    const lines = linesOf(['GAC GAC GAC .   .', EMPTY, EMPTY, EMPTY, EMPTY], HORIZONTAL)

    expect(lines).toHaveLength(1)
    expect(lines[0].axis).toBe('horizontal')
    expect(lines[0].constellations).toEqual(['libra'])
  })

  it('adds Pisces on a run of 4', () => {
    const lines = linesOf(['GAC GAC GAC GAC .', EMPTY, EMPTY, EMPTY, EMPTY], HORIZONTAL)

    expect(lines[0].constellations).toEqual(['libra', 'pisces'])
  })

  it('adds Leo on a run of 5', () => {
    const lines = linesOf(['GAC GAC GAC GAC GAC', EMPTY, EMPTY, EMPTY, EMPTY], HORIZONTAL)

    expect(lines).toHaveLength(1)
    expect(lines[0].constellations).toEqual(['libra', 'pisces', 'leo'])
  })

  it('fires nothing on a run of 2', () => {
    const lines = linesOf(['GAC GAC .   .   .', EMPTY, EMPTY, EMPTY, EMPTY], HORIZONTAL)

    expect(lines).toEqual([])
  })

  it('treats each row as its own line', () => {
    const lines = linesOf(
      ['GAC GAC GAC .   .', EMPTY, 'GAC GAC GAC GAC .', EMPTY, EMPTY],
      HORIZONTAL,
    )

    expect(sizes(lines)).toEqual([3, 4])
  })
})

describe('diagonal constellations', () => {
  it('fires Gemini on a ↘ run of 3', () => {
    const lines = linesOf(
      ['GAC .   .   .   .', '.   GAC .   .   .', '.   .   GAC .   .', EMPTY, EMPTY],
      DIAGONAL,
    )

    expect(lines).toHaveLength(1)
    expect(lines[0].axis).toBe('diagonal')
    expect(lines[0].constellations).toEqual(['gemini'])
  })

  it('adds Taurus on a ↘ run of 4', () => {
    const lines = linesOf(
      ['GAC .   .   .   .', '.   GAC .   .   .', '.   .   GAC .   .', '.   .   .   GAC .', EMPTY],
      DIAGONAL,
    )

    expect(lines[0].constellations).toEqual(['gemini', 'taurus'])
  })

  it('adds Scorpio on a ↘ run of 5', () => {
    const lines = linesOf(
      [
        'GAC .   .   .   .',
        '.   GAC .   .   .',
        '.   .   GAC .   .',
        '.   .   .   GAC .',
        '.   .   .   .   GAC',
      ],
      DIAGONAL,
    )

    expect(lines).toHaveLength(1)
    expect(lines[0].constellations).toEqual(['gemini', 'taurus', 'scorpio'])
  })

  it('fires on a ↗ run too', () => {
    const lines = linesOf(
      ['.   .   GAC .   .', '.   GAC .   .   .', 'GAC .   .   .   .', EMPTY, EMPTY],
      DIAGONAL,
    )

    expect(lines).toHaveLength(1)
    expect(lines[0].constellations).toEqual(['gemini'])
  })

  it('accepts offset diagonals that miss the corners', () => {
    const lines = linesOf(
      [
        '.   GAC .   .   .',
        '.   .   GAC .   .',
        '.   .   .   GAC .',
        '.   .   .   .   GAC',
        EMPTY,
      ],
      DIAGONAL,
    )

    expect(sizes(lines)).toEqual([4])
    expect(lines[0].constellations).toEqual(['gemini', 'taurus'])
  })

  it('puts a shared chip in both the ↘ and the ↗ line', () => {
    const lines = linesOf(
      [
        'GAC .   .   .   GAC',
        '.   GAC .   GAC .',
        '.   .   GAC .   .',
        '.   GAC .   GAC .',
        'GAC .   .   .   GAC',
      ],
      ['gemini'],
    )

    expect(sizes(lines)).toEqual([5, 5])
    const centre = lines.filter((line) =>
      line.positions.some((pos) => pos.row === 2 && pos.col === 2),
    )
    expect(centre).toHaveLength(2)
  })
})

describe("Aquarius 'ㅅ' shapes", () => {
  it('fires on the 3-cell form', () => {
    const lines = linesOf(
      ['.   GAC .   .   .', 'GAC .   GAC .   .', EMPTY, EMPTY, EMPTY],
      ['aquarius'],
    )

    expect(lines).toHaveLength(1)
    expect(lines[0].axis).toBe('shape_A')
    expect(lines[0].positions).toHaveLength(3)
  })

  it('fires on the 5-cell form, which only fits with the apex at (0,2)', () => {
    const lines = linesOf(
      ['.   .   GAC .   .', '.   GAC .   GAC .', 'GAC .   .   .   GAC', EMPTY, EMPTY],
      ['aquarius'],
    )

    expect(lines).toHaveLength(1)
    expect(lines[0].positions).toHaveLength(5)
    expect(lines[0].positions[0]).toEqual({ row: 0, col: 2 })
  })

  it('reports only the larger form when both fit the same apex', () => {
    const lines = linesOf(
      ['.   .   GAC .   .', '.   GAC .   GAC .', 'GAC .   .   .   GAC', EMPTY, EMPTY],
      ['aquarius'],
    )

    expect(sizes(lines)).toEqual([5])
  })

  it('fires separately for each apex even when the shapes share cells', () => {
    const lines = linesOf(
      ['.   .   GAC .   .', '.   GAC .   GAC .', 'GAC .   GAC .   GAC', EMPTY, EMPTY],
      ['aquarius'],
    )

    expect(sizes(lines)).toEqual([3, 3, 5])
  })
})

describe("Virgo 'ㅗ' shapes", () => {
  it('fires on base 3 + stem 1', () => {
    const lines = linesOf(
      [EMPTY, '.   GAC .   .   .', 'GAC GAC GAC .   .', EMPTY, EMPTY],
      ['virgo'],
    )

    expect(lines).toHaveLength(1)
    expect(lines[0].axis).toBe('shape_T')
    expect(lines[0].positions).toHaveLength(4)
  })

  it('fires on base 3 + stem 2', () => {
    const lines = linesOf(
      ['.   GAC .   .   .', '.   GAC .   .   .', 'GAC GAC GAC .   .', EMPTY, EMPTY],
      ['virgo'],
    )

    expect(sizes(lines)).toEqual([5])
  })

  it('fires on base 5 + stem 1', () => {
    const lines = linesOf(
      [EMPTY, '.   .   GAC .   .', 'GAC GAC GAC GAC GAC', EMPTY, EMPTY],
      ['virgo'],
    )

    expect(sizes(lines)).toEqual([6])
  })

  it('fires on base 5 + stem 2', () => {
    const lines = linesOf(
      ['.   .   GAC .   .', '.   .   GAC .   .', 'GAC GAC GAC GAC GAC', EMPTY, EMPTY],
      ['virgo'],
    )

    expect(sizes(lines)).toEqual([7])
  })

  it('reports only the largest form that fits one base row and centre', () => {
    const lines = linesOf(
      ['.   .   GAC .   .', '.   .   GAC .   .', 'GAC GAC GAC GAC GAC', EMPTY, EMPTY],
      ['virgo'],
    )

    expect(lines).toHaveLength(1)
  })
})
