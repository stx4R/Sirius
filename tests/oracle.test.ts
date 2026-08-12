import { describe, expect, it } from 'vitest'
import { DRIFT_ORACLE_BONUS } from '../src/core/config'
import { findDrifter, generateOracle, particleFor } from '../src/core/oracle'
import { mulberry32 } from '../src/core/rng'
import { scoreBoard } from '../src/core/scoring'
import type { ConstellationId } from '../src/core/types'
import { boardFrom, context } from './helpers'

const EMPTY = '.   .   .   .   .'
const rng = () => mulberry32(7)

/** The scoring half of a `context`, which is all the oracle takes. */
const ctx = (owned: readonly ConstellationId[] = []) => ({
  owned,
  stackMode: 'sum' as const,
})

const ask = (rows: readonly string[], owned: readonly ConstellationId[] = []) =>
  generateOracle(boardFrom(rows), ctx(owned), rng())

describe('DRIFT ORACLE cases (GDD 8-3)', () => {
  // The drifter at (1,1) reads four basic neighbours, one suit each. Every case
  // takes three of them, so every case is worth three chips at ×1.0 = 30. The
  // expectation of a constant is that constant.
  const fourWays = ['.   ACR .   .   .', 'GIN *   GAC .   .', '.   MIM .   .   .', EMPTY, EMPTY]

  it('enumerates ₄C₃ = 4 readings, each at 1/4, in GDD 8-3 table order', () => {
    const question = ask(fourWays)!

    expect(question.cases).toHaveLength(4)
    expect(question.cases.map((entry) => entry.label)).toEqual([
      '상·하·좌',
      '상·하·우',
      '상·좌·우',
      '하·좌·우',
    ])
    for (const entry of question.cases) expect(entry.probability).toBe(1 / 4)
  })

  it('reads the suits each case is judged as, dropping the direction left out', () => {
    const question = ask(fourWays)!
    const suitsOf = (label: string) =>
      question.cases.find((entry) => entry.label === label)!.suits

    // 상=ACR 하=MIM 좌=GIN 우=GAC, listed back in SUIT_ORDER (GDD 3-1).
    expect(suitsOf('상·하·좌')).toEqual(['GIN', 'MIM', 'ACR'])
    expect(suitsOf('상·하·우')).toEqual(['GAC', 'MIM', 'ACR'])
    expect(suitsOf('상·좌·우')).toEqual(['GAC', 'GIN', 'ACR'])
    expect(suitsOf('하·좌·우')).toEqual(['GAC', 'GIN', 'MIM'])
  })

  // Hand check: three suits, none of them in a firing line, is 3 × 10 × 1.0 = 30
  // for the drifter's own cell in every one of the four readings — so E = 30.
  it('takes each case straight from the settlement it would produce', () => {
    const question = ask(fourWays)!

    for (const entry of question.cases) expect(entry.score).toBe(30)
    expect(question.expected).toBe(30)
    expect(question.answer).toBe(30)
  })

  // GDD 3-3: a special neighbour hands over both of its suits, so three special
  // neighbours can put five suits on one cell.
  it('gives a drifter beside special chips every suit they carry', () => {
    const question = ask([
      '.       GAC&IMA .   .   .',
      'GIN&MIM *       ACR .   .',
      EMPTY,
      EMPTY,
      EMPTY,
    ])!

    // Three neighbours, so the reading is forced and there is one case.
    expect(question.cases).toHaveLength(1)
    expect(question.cases[0].suits).toEqual(['GAC', 'IMA', 'GIN', 'MIM', 'ACR'])
    // Five suits, none in a line: 5 × 10.
    expect(question.cases[0].score).toBe(50)
    expect(question.expected).toBe(50)
  })

  it('agrees with what the board actually settles for that cell', () => {
    const rows = ['.   GAC .   .   .', 'GAC *   .   .   .', 'GAC .   .   .   .', EMPTY, EMPTY]
    const question = ask(rows, ['aries'])!
    const chosen = question.cases[0]

    const settled = scoreBoard(
      boardFrom(rows),
      context(['aries'], 'sum', () => [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ]),
    )
    const cell = settled.byCell.find((entry) => entry.position.row === 1 && entry.position.col === 1)!

    expect(chosen.score).toBe(cell.total)
  })
})

describe('DRIFT ORACLE expectation', () => {
  // Hand check. 상=GAC 하=GAC 좌=IMA 우=MIM, aries held (vertical run of 3, ×1.2).
  //
  // GAC sits both above and below the drifter, so *every* reading that takes
  // either of them makes (1,1) a GAC cell and closes the column-1 run of three —
  // the drifter's GAC share is 10 × 1.2 = 12 in all four cases. What the readings
  // differ on is how many suits come with it: taking 상 and 하 together merges
  // into one GAC (GDD 3-3), leaving room for only one more suit.
  //
  //   상·하·좌 → {GAC, IMA}      → 12 + 10           = 22
  //   상·하·우 → {GAC, MIM}      → 12 + 10           = 22
  //   상·좌·우 → {GAC, IMA, MIM} → 12 + 10 + 10      = 32
  //   하·좌·우 → {GAC, IMA, MIM} → 12 + 10 + 10      = 32
  //   E = (22 + 22 + 32 + 32) / 4 = 27
  const board = ['.   GAC .   .   .', 'IMA *   MIM .   .', '.   GAC .   .   .', EMPTY, EMPTY]

  it('matches the hand calculation', () => {
    const question = ask(board, ['aries'])!

    expect(question.cases.map((entry) => entry.score)).toEqual([22, 22, 32, 32])
    expect(question.expected).toBe(27)
    expect(question.answer).toBe(27)
  })

  it('writes the weighted sum out in the explanation', () => {
    const question = ask(board, ['aries'])!

    expect(question.explanation).toContain('22×1/4 + 22×1/4 + 32×1/4 + 32×1/4 = 27')
  })

  // An expectation need not be a whole number, and the choices are whole numbers
  // (see below), so the question asks for the nearest one and the explanation
  // carries the exact figure.
  //
  //   상=GAC 하=GAC 좌=GAC 우=IMA, nothing held, so every suit is flat ×1.0.
  //   상·하·좌 → three GAC neighbours merge to {GAC} → 10
  //   the other three readings each keep 우 → {GAC, IMA} → 20
  //   E = (10 + 20 + 20 + 20) / 4 = 17.5
  it('rounds a fractional expectation to the value asked for', () => {
    const question = ask(['.   GAC .   .   .', 'GAC *   IMA .   .', '.   GAC .   .   .', EMPTY, EMPTY])!

    expect(question.cases.map((entry) => entry.score)).toEqual([10, 20, 20, 20])
    expect(question.expected).toBe(17.5)
    expect(question.answer).toBe(18)
    expect(question.explanation).toContain('= 17.5')
    expect(question.explanation).toContain('가장 가까운 값은 18')
  })
})

describe('DRIFT ORACLE choices (GDD 8-3: 3지선다)', () => {
  const board = ['.   GAC .   .   .', 'IMA *   MIM .   .', '.   GAC .   .   .', EMPTY, EMPTY]

  it('offers three distinct values, one of them right', () => {
    const question = ask(board, ['aries'])!

    expect(question.choices).toHaveLength(3)
    expect(new Set(question.choices).size).toBe(3)
    expect(question.choices).toContain(question.answer)
  })

  it('offers whole numbers only, so the right one is not the odd-looking one', () => {
    const question = ask(board, ['aries'])!

    for (const choice of question.choices) expect(Number.isInteger(choice)).toBe(true)
  })

  it('puts the best and the worst case up as the wrong answers', () => {
    const question = ask(board, ['aries'])!
    const scores = question.cases.map((entry) => entry.score)

    expect(question.choices).toContain(Math.max(...scores))
    expect(question.choices).toContain(Math.min(...scores))
  })

  // Where every reading scores the same there is no best and worst to offer, so
  // the wrong answers come from the next two misreadings on the list.
  it('still finds two wrong answers when every case scores alike', () => {
    const question = ask(['.   ACR .   .   .', 'GIN *   GAC .   .', '.   MIM .   .   .', EMPTY, EMPTY])!

    expect(new Set(question.choices).size).toBe(3)
    expect(question.choices).toContain(question.answer)
    expect(question.choices).toContain(Math.round(question.expected * (1 + DRIFT_ORACLE_BONUS)))
  })

  it('does not settle the choices in a fixed order', () => {
    const orders = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        generateOracle(boardFrom(board), ctx(['aries']), mulberry32(seed))!.choices.join(','),
      ),
    )

    expect(orders.size).toBeGreaterThan(1)
  })
})

// GDD 8-3 left this open for P5. BOOTH-4b decides it: the question is asked,
// with wording that says the case is certain rather than hiding it behind the
// four-case face.
describe('DRIFT ORACLE with one forced case', () => {
  const board = ['.   GAC .   .   .', 'IMA *   .   .   .', EMPTY, EMPTY, EMPTY]

  it('asks a single case at probability 1', () => {
    const question = ask(board)!

    expect(question.cases).toHaveLength(1)
    expect(question.cases[0].probability).toBe(1)
    expect(question.cases[0].label).toBe('상·좌')
    expect(question.expected).toBe(question.cases[0].score)
  })

  it('says in the question that the reading is forced', () => {
    const question = ask(board)!

    expect(question.text).toContain('확률 1')
    expect(question.text).not.toContain('가장 가까운')
  })

  it('says in the explanation that one case makes its score the expectation', () => {
    const question = ask(board)!

    expect(question.explanation).toContain('경우가 하나뿐')
    expect(question.explanation).toContain(`${question.cases[0].score}×1 = ${question.expected}`)
  })

  it('still offers three distinct choices', () => {
    const question = ask(board)!

    expect(new Set(question.choices).size).toBe(3)
    expect(question.choices).toContain(question.answer)
  })
})

// The explanation names the best and the worst case, and the screen names the
// number the player picked. Which particle follows depends on how the number is
// read aloud, not on how it is written.
describe('particles after a number', () => {
  it('takes the vowel form after a digit read ending in one', () => {
    for (const value of [2, 4, 5, 9, 32, 54, 105, 199]) {
      expect(particleFor(value, '는', '은')).toBe('는')
      expect(particleFor(value, '를', '을')).toBe('를')
    }
  })

  it('takes the consonant form after every other digit, 0 included', () => {
    // 30 is 삼십, 100 is 백 — a number ending in 0 closes on a consonant.
    for (const value of [0, 1, 3, 6, 7, 8, 10, 30, 33, 100]) {
      expect(particleFor(value, '는', '은')).toBe('은')
      expect(particleFor(value, '를', '을')).toBe('을')
    }
  })

  it('reaches the explanation', () => {
    // Best 20, worst 10: 이십 ends on a consonant, 십 does too.
    const question = ask(['.   GAC .   .   .', 'GAC *   IMA .   .', '.   GAC .   .   .', EMPTY, EMPTY])!

    expect(question.explanation).toContain('최댓값 20은')
    expect(question.explanation).toContain('최솟값 10은')
  })
})

describe('DRIFT ORACLE with nothing to ask', () => {
  it('asks nothing when no drifter is on the board', () => {
    expect(ask(['GAC GAC .   .   .', EMPTY, EMPTY, EMPTY, EMPTY])).toBeNull()
  })

  // GDD 3-3: no neighbour means no suit and no score, so every answer would be 0.
  it('asks nothing when the drifter has no neighbour', () => {
    expect(ask(['*   .   .   .   .', EMPTY, EMPTY, EMPTY, EMPTY])).toBeNull()
    expect(ask([EMPTY, '.   .   *   .   .', EMPTY, EMPTY, EMPTY])).toBeNull()
  })

  it('finds the drifter, or reports that there is none', () => {
    expect(findDrifter(boardFrom([EMPTY, '.   .   *   .   .', EMPTY, EMPTY, EMPTY]))).toEqual({
      row: 1,
      col: 2,
    })
    expect(findDrifter(boardFrom([EMPTY, EMPTY, EMPTY, EMPTY, EMPTY]))).toBeNull()
  })
})
