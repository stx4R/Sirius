// CONSTELLATION LOG — the round-end statistics report (GDD 8-4). Pure core: no
// React, no DOM, and no randomness at all — every figure is counted off ledgers
// the round already wrote (CLAUDE.md §5, §8).
//
// ★ The unit here is the **card**. GDD 8-4 asks for 문양별 실제 등장 횟수, which
// counts drawn cards carrying a suit. That is a different statistic from
// `observedChances` in deck.ts, which counts *hands* holding at least one — the
// one STAR-CHART and the shop show (GDD 8-1). The two must not appear together
// or be read as one series, so this file never touches that one and the screen
// says which unit it is showing.
//
// ★ Every round is measured against the deck *that round* was dealt from, not
// against the deck the player now holds. The shop edits the deck between rounds
// (GDD 9-2 sells basics and buys them back, and 13-4 hands over the drifter), and
// reusing one deck for every round was measured at up to 2.64%p of suit share —
// against a booth-scale sampling spread of about 3.65%p, so the bias would be
// two thirds the size of the very wobble the report is teaching about. That is
// what `RoundPopulation` is for.

import { REPORT_BAND_SIGMA, WAGER_GUESS_RATE } from './config'
import { countDeck } from './deck'
import { SUIT_ORDER } from './types'
import type { DrawRecord, SuitId, WagerRecord } from './types'

/**
 * The deck a round was dealt from — counted, not copied. GDD 8-4 needs the
 * population each sample came out of, and nothing downstream needs the chips
 * themselves, so a snapshot of a whole deck per round would be state that is
 * never read.
 */
export interface RoundPopulation {
  readonly round: number
  /** Cards in the deck. A special chip is one card carrying two suits (GDD 3-2). */
  readonly size: number
  /** Cards carrying each suit — `countDeck().bySuit`, so a special is in two of them. */
  readonly bySuit: Readonly<Record<SuitId, number>>
}

export interface SuitTally {
  readonly suit: SuitId
  /** Drawn cards carrying this suit. */
  readonly actual: number
  /** Σ over rounds of (cards drawn that round) × (that round's share of this suit). */
  readonly expected: number
  /** Half-width of the range a sample this size usually lands in, around `expected`. */
  readonly spread: number
}

export interface WagerTally {
  /**
   * Questions answered. Abstentions are out of it: GDD 8-4 leaves the divisor to
   * the report, and counting 기권 as a miss would make guessing strictly better
   * than declining, which is the opposite of what GDD 8-2 offers the button for.
   */
  readonly answered: number
  readonly correct: number
  readonly abstained: number
  /** `correct / answered`, or null when nothing was answered. */
  readonly rate: number | null
  /** Half-width of the range a guesser's rate usually lands in, at this many answers. */
  readonly spread: number
}

export interface Tally {
  readonly hands: number
  /** Cards drawn. The unit every suit figure below is counted in. */
  readonly cards: number
  readonly wager: WagerTally
  /** Ordered by SUIT_ORDER (GDD 3-1). */
  readonly bySuit: readonly SuitTally[]
}

/**
 * One point of the convergence series — the cumulative sample as it stood at the
 * end of each round played (GDD 8-4, 큰수의 법칙 Ⅲ-3).
 *
 * `gap` is what the player's own draws did; `typical` is how big that gap
 * usually is at that sample size. `typical` shrinks with √cards no matter how
 * the dice fell, which is the part of the law that is always visible — a booth
 * run is three rounds and `gap` alone can wobble the wrong way over so few.
 */
export interface ConvergencePoint {
  readonly round: number
  readonly cards: number
  /** Mean |actual share − expected share| over the five suits. */
  readonly gap: number
  /** Mean spread of those five shares — about the size `gap` usually takes. */
  readonly typical: number
}

export interface RoundReport {
  /** The round just played. `endRound` has already moved the counter past it. */
  readonly round: number
  readonly score: number
  readonly target: number
  /** The deck this round was dealt from. */
  readonly population: RoundPopulation
  readonly thisRound: Tally
  readonly cumulative: Tally
  /** One entry per round played, oldest first. */
  readonly series: readonly ConvergencePoint[]
}

const zero = (): Record<SuitId, number> => ({ GAC: 0, IMA: 0, GIN: 0, MIM: 0, ACR: 0 })

/**
 * Expectation and its spread over a set of rounds, each weighted by its own
 * population.
 *
 * The variance treats each drawn card as an independent trial. Drawing is
 * actually without replacement, which makes the real spread smaller — so this
 * errs wide, and a band drawn from it never calls an ordinary result unusual.
 */
function expectation(
  populations: readonly RoundPopulation[],
  draws: readonly DrawRecord[],
): { readonly expected: Record<SuitId, number>; readonly variance: Record<SuitId, number> } {
  const expected = zero()
  const variance = zero()

  for (const population of populations) {
    if (population.size === 0) continue
    const cards = draws
      .filter((record) => record.round === population.round)
      .reduce((total, record) => total + record.drawn.length, 0)
    if (cards === 0) continue

    for (const suit of SUIT_ORDER) {
      const share = population.bySuit[suit] / population.size
      expected[suit] += cards * share
      variance[suit] += cards * share * (1 - share)
    }
  }

  return { expected, variance }
}

function countDrawn(draws: readonly DrawRecord[]): Record<SuitId, number> {
  const out = zero()
  for (const record of draws) {
    const { bySuit } = countDeck(record.drawn)
    for (const suit of SUIT_ORDER) out[suit] += bySuit[suit]
  }
  return out
}

function tallyWagers(wagers: readonly WagerRecord[]): WagerTally {
  const abstained = wagers.filter((record) => record.choice === 'abstain').length
  const answered = wagers.length - abstained
  const correct = wagers.filter((record) => record.correct).length

  return {
    answered,
    correct,
    abstained,
    rate: answered === 0 ? null : correct / answered,
    spread:
      answered === 0
        ? 0
        : REPORT_BAND_SIGMA * Math.sqrt((WAGER_GUESS_RATE * (1 - WAGER_GUESS_RATE)) / answered),
  }
}

function tally(
  populations: readonly RoundPopulation[],
  draws: readonly DrawRecord[],
  wagers: readonly WagerRecord[],
): Tally {
  const actual = countDrawn(draws)
  const { expected, variance } = expectation(populations, draws)

  return {
    hands: draws.length,
    cards: draws.reduce((total, record) => total + record.drawn.length, 0),
    wager: tallyWagers(wagers),
    bySuit: SUIT_ORDER.map((suit) => ({
      suit,
      actual: actual[suit],
      expected: expected[suit],
      spread: REPORT_BAND_SIGMA * Math.sqrt(variance[suit]),
    })),
  }
}

function convergence(
  populations: readonly RoundPopulation[],
  draws: readonly DrawRecord[],
  through: number,
): ConvergencePoint[] {
  const points: ConvergencePoint[] = []

  for (let round = 1; round <= through; round++) {
    const upTo = (record: { readonly round: number }) => record.round <= round
    const sofar = tally(populations.filter(upTo), draws.filter(upTo), [])
    if (sofar.cards === 0) continue

    const gap =
      sofar.bySuit.reduce(
        (total, entry) => total + Math.abs(entry.actual - entry.expected) / sofar.cards,
        0,
      ) / sofar.bySuit.length
    // `spread` is already scaled by REPORT_BAND_SIGMA; the series wants one
    // standard deviation, which is the size a gap usually takes.
    const typical =
      sofar.bySuit.reduce(
        (total, entry) => total + entry.spread / REPORT_BAND_SIGMA / sofar.cards,
        0,
      ) / sofar.bySuit.length

    points.push({ round, cards: sofar.cards, gap, typical })
  }

  return points
}

/**
 * GDD 8-4. Everything is read off ledgers, so calling this twice gives the same
 * answer and calling it never costs the game anything.
 *
 * `round` is the round that was just played, which the caller has to hand over:
 * `endRound` moves the counter on before the report is ever built, exactly as it
 * does to the turn counter during a settlement (GDD 4-1 unchanged).
 */
export function buildReport(input: {
  readonly round: number
  readonly score: number
  readonly target: number
  readonly populations: readonly RoundPopulation[]
  readonly draws: readonly DrawRecord[]
  readonly wagers: readonly WagerRecord[]
}): RoundReport {
  const { round, populations, draws, wagers } = input
  const thisRoundOnly = (record: { readonly round: number }) => record.round === round
  const upToNow = (record: { readonly round: number }) => record.round <= round

  const population = populations.find((entry) => entry.round === round) ?? {
    round,
    size: 0,
    bySuit: zero(),
  }

  return {
    round,
    score: input.score,
    target: input.target,
    population,
    thisRound: tally(
      populations.filter(thisRoundOnly),
      draws.filter(thisRoundOnly),
      wagers.filter(thisRoundOnly),
    ),
    cumulative: tally(populations.filter(upToNow), draws.filter(upToNow), wagers.filter(upToNow)),
    series: convergence(populations.filter(upToNow), draws.filter(upToNow), round),
  }
}
