// DRIFT ORACLE — the expected-value question put just before a settlement that
// has a drifter on the board (GDD 8-3). Pure core: no React, no DOM, and the
// only randomness is the injected Rng that shuffles the three choices
// (CLAUDE.md §5, §8).
//
// Nothing here re-derives a score. Each case is settled through `scoreBoard`
// with the drifter's reading pinned to that case, and the figure the table shows
// is the drifter cell's own entry in `ScoreResult.byCell` (GDD 5-1). That is the
// whole reason the per-cell decomposition exists: a table of scores computed a
// second way would teach an expectation the settlement then fails to pay.
//
// Pinning the reading is also what keeps this free of the generator. GDD 3-3
// rolls the drifter's three directions inside the settlement, so enumerating the
// cases by rolling them would spend the draws the real settlement is counting on.

import { position } from './board'
import { BOARD_SIZE, DRIFTER_DIRECTIONS_CHOSEN, DRIFT_ORACLE_BONUS } from './config'
import { shuffle } from './rng'
import type { Rng } from './rng'
import { occupiedNeighbours, resolveSuits, scoreBoard } from './scoring'
import type { ScoreResult, ScoringContext } from './scoring'
import { SUIT_ORDER } from './types'
import type { Board, Position, SuitId } from './types'

/** The four cells a drifter can read, named the way GDD 8-3's table names them. */
export type OracleDirection = 'up' | 'down' | 'left' | 'right'

const DIRECTION_LABEL: Readonly<Record<OracleDirection, string>> = {
  up: '상',
  down: '하',
  left: '좌',
  right: '우',
}

/** One row of GDD 8-3's table: a reading the drifter might take, and its payoff. */
export interface OracleCase {
  readonly directions: readonly OracleDirection[]
  /** `상·하·좌` — the directions written as GDD 8-3 writes them. */
  readonly label: string
  /** Suits the drifter is judged as under this reading, in SUIT_ORDER (GDD 3-3). */
  readonly suits: readonly SuitId[]
  /** What the drifter's own cell contributes to the settlement (GDD 5-1 `byCell`). */
  readonly score: number
  /** 1 / (number of cases). Every 3-subset is equally likely (GDD 3-3). */
  readonly probability: number
}

export interface OracleQuestion {
  readonly position: Position
  /** One per reading the drifter might take: four, or one when the choice is forced. */
  readonly cases: readonly OracleCase[]
  /** Σ score × probability, unrounded. */
  readonly expected: number
  readonly text: string
  /** Three values in a seeded order (GDD 8-3: 3지선다). */
  readonly choices: readonly number[]
  /** The right one of `choices`. */
  readonly answer: number
  readonly explanation: string
}

/** One answered question, for the screen to show its verdict against. */
export interface OracleRecord {
  readonly question: OracleQuestion
  readonly choice: number
  readonly correct: boolean
}

export function findDrifter(board: Board): Position | null {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const chip = board[row][col]
      if (chip !== null && chip.kind === 'drifter') return position(row, col)
    }
  }
  return null
}

function directionOf(from: Position, to: Position): OracleDirection {
  if (to.row < from.row) return 'up'
  if (to.row > from.row) return 'down'
  return to.col < from.col ? 'left' : 'right'
}

/** The drifter's own cell. It holds a chip, so `byCell` always has an entry for it. */
function contributionAt(result: ScoreResult, pos: Position): number {
  const cell = result.byCell.find(
    (entry) => entry.position.row === pos.row && entry.position.col === pos.col,
  )
  return cell === undefined ? 0 : cell.total
}

/** No trailing zeros: 80, 80.5, 80.25 — the probabilities are quarters at worst. */
function figure(value: number): string {
  return String(Number(value.toFixed(2)))
}

/**
 * The particle that follows a number, which depends on how the number is *read*
 * rather than on how it is written: 32 is 삼십이 and ends on a vowel, 33 is
 * 삼십삼 and does not. Only the last digit decides it, and 2·4·5·9 are the
 * digits read ending in a vowel — 0 included with the rest, since a number
 * ending in it is read 십·백·천 and closes on a consonant.
 *
 * Exported because the screen writes sentences about these numbers too.
 */
export function particleFor(value: number, afterVowel: string, afterConsonant: string): string {
  return [2, 4, 5, 9].includes(Math.abs(Math.trunc(value)) % 10) ? afterVowel : afterConsonant
}

/**
 * Two wrong answers, taken in this order from the ways the table is misread:
 * the best case, the worst case, the score with the +50% bonus already counted
 * in, the scores added without weighting, and half the expectation. Anything
 * equal to the right answer or to one already taken is passed over.
 *
 * The list always yields two. Where the readings all score the same — one forced
 * case, or four cases over identical neighbours — the first two entries collapse
 * onto the answer, and the last three do not: every case scores at least one
 * chip's ×1.0, so the expectation is at least BASE_CHIP_SCORE and ×1.5 and ÷2
 * land either side of it.
 */
function distractors(expected: number, scores: readonly number[], answer: number): number[] {
  const candidates = [
    Math.max(...scores),
    Math.min(...scores),
    Math.round(expected * (1 + DRIFT_ORACLE_BONUS)),
    scores.reduce((sum, score) => sum + score, 0),
    Math.round(expected / 2),
  ]

  const out: number[] = []
  for (const value of candidates) {
    if (value === answer || out.includes(value)) continue
    out.push(value)
    if (out.length === 2) break
  }
  return out
}

/**
 * The question for one turn's oracle, or null when there is nothing to ask.
 *
 * Two boards ask nothing: one with no drifter on it, and one where the drifter
 * has no occupied neighbour. GDD 3-3 gives the second no suits and no score, so
 * there is no random variable to take an expectation of — asking would be a
 * question whose every answer is zero.
 *
 * `rng` is spent only on the order of the three choices. Sorting them instead
 * would put the right answer between the best and the worst case every time.
 */
export function generateOracle(
  board: Board,
  ctx: Omit<ScoringContext, 'chooseDrifterDirections'>,
  rng: Rng,
): OracleQuestion | null {
  const spot = findDrifter(board)
  if (spot === null) return null

  const neighbours = occupiedNeighbours(board, spot)
  if (neighbours.length === 0) return null

  // GDD 3-3: four neighbours means ₄C₃ readings, one per neighbour left out;
  // three or fewer are all taken and there is a single reading. The subsets run
  // in GDD 8-3's table order — 상·하·좌 first, 하·좌·우 last.
  const forced = neighbours.length <= DRIFTER_DIRECTIONS_CHOSEN
  const subsets = forced
    ? [neighbours]
    : neighbours.map((_, omit) => neighbours.filter((__, i) => i !== omit)).reverse()

  const probability = 1 / subsets.length
  const cases: OracleCase[] = subsets.map((chosen) => {
    const chooseDrifterDirections = () => chosen
    const suits = resolveSuits(board, chooseDrifterDirections)[spot.row][spot.col]
    const scored = scoreBoard(board, { ...ctx, chooseDrifterDirections })

    return {
      directions: chosen.map((pos) => directionOf(spot, pos)),
      label: chosen.map((pos) => DIRECTION_LABEL[directionOf(spot, pos)]).join('·'),
      suits: SUIT_ORDER.filter((suit) => suits !== null && suits.has(suit)),
      score: contributionAt(scored, spot),
      probability,
    }
  })

  const scores = cases.map((entry) => entry.score)
  const expected = cases.reduce((sum, entry) => sum + entry.score * entry.probability, 0)
  const answer = Math.round(expected)
  const choices = shuffle([answer, ...distractors(expected, scores, answer)], rng)

  const fraction = forced ? '1' : `1/${subsets.length}`
  const sum = `${cases.map((entry) => `${entry.score}×${fraction}`).join(' + ')} = ${figure(expected)}`

  // GDD 8-3 left it open whether a forced reading should be asked at all. It is
  // asked, in different words: a probability of 1 is a legitimate case of the
  // same calculation, three or fewer neighbours is common, and a device that
  // goes quiet on the common case teaches nothing on it. What it must not do is
  // wear the four-case face — so the sentence says outright that one case is
  // certain, and the reason it is.
  const text = forced
    ? `인접한 칩이 ${neighbours.length}개뿐이라 방향을 고를 여지가 없다. 이 판정 하나가 확률 1로 일어난다. 떠돌이 조각이 이번 융합에서 낼 점수의 기댓값은?`
    : '떠돌이 조각이 이번 융합에서 낼 점수의 기댓값에 가장 가까운 값은?'

  const best = Math.max(...scores)
  const worst = Math.min(...scores)
  const explanation = forced
    ? `경우가 하나뿐이고 그것이 확률 1로 일어나므로, 기댓값은 그 점수 그대로다. ${sum}. 확률이 1이어도 구하는 방법은 같다 — 점수에 확률을 곱해 더하는 것이고, 더할 항이 하나일 뿐이다.`
    : `각 경우의 점수에 그 확률을 곱해 모두 더한 값이 기댓값이다. ${sum}${
        answer === expected ? '' : `이고, 가장 가까운 값은 ${answer}이다`
      }. 최댓값 ${best}${particleFor(best, '는', '은')} 가장 좋은 경우일 뿐이고 최솟값 ${worst}${particleFor(worst, '는', '은')} 가장 나쁜 경우일 뿐이라, 어느 쪽도 기댓값이 아니다.`

  return { position: spot, cases, expected, text, choices, answer, explanation }
}
