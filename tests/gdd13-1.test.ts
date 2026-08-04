// GDD 13-1: the two cases P2 must measure before the balance numbers are fixed.
// These print their figures — the point is the magnitude, not a pass/fail bound.

import { describe, expect, it } from 'vitest'
import { createEmptyBoard, placeChip, position } from '../src/core/board'
import { BOARD_SIZE } from '../src/core/config'
import { scoreBoard } from '../src/core/scoring'
import type { ScoringContext } from '../src/core/scoring'
import type { Board, ConstellationId, LineAxis } from '../src/core/types'
import { boardFrom, firstNeighbours } from './helpers'

const ctx = (owned: readonly ConstellationId[]): ScoringContext => ({
  owned,
  stackMode: 'sum',
  chooseDrifterDirections: firstNeighbours,
})

function floodedBoard(): Board {
  let board = createEmptyBoard()
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      board = placeChip(board, position(row, col), {
        id: `${row}-${col}`,
        kind: 'basic',
        suit: 'GAC',
      })
    }
  }
  return board
}

const countAxis = (board: Board, owned: ConstellationId[], axis: LineAxis) =>
  scoreBoard(board, ctx(owned)).lines.filter((line) => line.axis === axis).length

describe('GDD 13-1 ① single-suit flood with Aquarius + Virgo', () => {
  it('reports the shape-line count and score against the run-line alternative', () => {
    const board = floodedBoard()

    const shapes = scoreBoard(board, ctx(['aquarius', 'virgo']))
    const runs = scoreBoard(board, ctx(['sagittarius', 'leo']))
    const all = scoreBoard(board, ctx(['aquarius', 'virgo', 'sagittarius', 'leo']))

    console.log('\n[13-1 ①] 5×5 단일 문양 도배')
    console.log(`  ㅅ자 라인 수            ${countAxis(board, ['aquarius'], 'shape_A')}`)
    console.log(`  ㅗ자 라인 수            ${countAxis(board, ['virgo'], 'shape_T')}`)
    console.log(`  물병 + 처녀             ${shapes.total.toLocaleString('en-US')}점 (라인 ${shapes.lines.length}개)`)
    console.log(`  궁수 + 사자             ${runs.total.toLocaleString('en-US')}점 (라인 ${runs.lines.length}개)`)
    console.log(`  배수                    ${(shapes.total / runs.total).toFixed(2)}×`)
    console.log(`  네 별자리 전부          ${all.total.toLocaleString('en-US')}점`)

    expect(shapes.total).toBeGreaterThan(0)
    expect(runs.total).toBeGreaterThan(0)
  })
})

describe('GDD 13-1 ② drifter beside three chips', () => {
  /** Marginal points the drifter cell adds, versus leaving that cell empty. */
  function marginal(neighbours: readonly [string, string, string]): number {
    const [above, left, right] = neighbours
    const rows = (centre: string) => [
      '.  .  .  .  .',
      `.  .  ${above}  .  .`,
      `.  ${left}  ${centre}  ${right}  .`,
      '.  .  .  .  .',
      '.  .  .  .  .',
    ]
    return (
      scoreBoard(boardFrom(rows('*')), ctx([])).total -
      scoreBoard(boardFrom(rows('.')), ctx([])).total
    )
  }

  it('reports the drifter cell’s marginal contribution across neighbour mixes', () => {
    const best = marginal(['GAC&IMA', 'GIN&MIM', 'ACR&GAC'])
    const typical = marginal(['GAC', 'IMA', 'GIN'])
    const worst = marginal(['GAC', 'GAC', 'GAC'])
    const basicChip = 10

    console.log('\n[13-1 ②] 떠돌이 조각의 칸 기여 (별자리 없음 기준)')
    console.log(`  특수 조각 3개 인접 → 5종 판정   ${best}점/턴  (라운드 5턴 ${best * 5}점)`)
    console.log(`  기본 조각 3개, 서로 다른 문양   ${typical}점/턴`)
    console.log(`  기본 조각 3개, 같은 문양        ${worst}점/턴  ← 집합 규칙으로 1종`)
    console.log(`  기본 조각 1장(비교군)           ${basicChip}점/턴`)
    console.log(
      `  가격 대비: 떠돌이 20 → ${(best / 20).toFixed(1)} / ${(typical / 20).toFixed(1)} / ` +
        `${(worst / 20).toFixed(1)} 점·턴당 스타더스트, 기본 조각 3 → ${(basicChip / 3).toFixed(1)}`,
    )

    expect(best).toBe(50)
    expect(worst).toBe(basicChip)
  })
})
