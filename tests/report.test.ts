import { describe, expect, it } from 'vitest'
import { REPORT_BAND_SIGMA, WAGER_GUESS_RATE } from '../src/core/config'
import { endRound, roundReport, startGame, startRound } from '../src/core/game'
import type { Game } from '../src/core/game'
import { buildReport } from '../src/core/report'
import type { RoundPopulation, SuitTally, Tally } from '../src/core/report'
import { mulberry32 } from '../src/core/rng'
import { SUIT_ORDER } from '../src/core/types'
import type { Chip, DrawRecord, SuitId, WagerRecord } from '../src/core/types'

const basic = (suit: SuitId, i: number): Chip => ({ id: `${suit}-${i}`, kind: 'basic', suit })

/** A deck of `each` basics per suit, so shares are exactly 1/5. */
const evenDeck = (each: number): Chip[] =>
  SUIT_ORDER.flatMap((suit) => Array.from({ length: each }, (_, i) => basic(suit, i)))

const population = (round: number, deck: readonly Chip[]): RoundPopulation => {
  const bySuit = { GAC: 0, IMA: 0, GIN: 0, MIM: 0, ACR: 0 }
  for (const chip of deck) if (chip.kind === 'basic') bySuit[chip.suit]++
  return { round, size: deck.length, bySuit }
}

const draw = (round: number, turn: number, drawn: readonly Chip[]): DrawRecord => ({
  round,
  turn,
  drawn,
})

const wager = (round: number, choice: WagerRecord['choice'], correct: boolean): WagerRecord => ({
  round,
  turn: 1,
  question: { text: '', answer: true, tier: 'comparison', explanation: '' },
  choice,
  correct,
})

const suitOf = (tally: Tally, suit: SuitId): SuitTally =>
  tally.bySuit.find((entry) => entry.suit === suit)!

describe('CONSTELLATION LOG — suit tally (GDD 8-4)', () => {
  // Hand check. A 50-card deck of 10 per suit gives every suit a share of
  // 10/50 = 0.2. Ten cards drawn, so the expectation is 10 × 0.2 = 2 apiece —
  // and the sample deliberately does not match it.
  const deck = evenDeck(10)
  const drawn = [
    basic('GAC', 0),
    basic('GAC', 1),
    basic('GAC', 2),
    basic('GAC', 3),
    basic('IMA', 0),
    basic('IMA', 1),
    basic('GIN', 0),
    basic('GIN', 1),
    basic('MIM', 0),
    basic('ACR', 0),
  ]

  const report = buildReport({
    round: 1,
    score: 500,
    target: 490,
    populations: [population(1, deck)],
    draws: [draw(1, 1, drawn)],
    wagers: [],
  })

  it('counts drawn cards, not hands', () => {
    expect(report.thisRound.cards).toBe(10)
    expect(report.thisRound.hands).toBe(1)
    expect(suitOf(report.thisRound, 'GAC').actual).toBe(4)
    expect(suitOf(report.thisRound, 'MIM').actual).toBe(1)
  })

  it('expects the round population share times the cards drawn', () => {
    for (const suit of SUIT_ORDER) expect(suitOf(report.thisRound, suit).expected).toBeCloseTo(2)
  })

  // 2 × √(10 × 0.2 × 0.8) = 2 × √1.6 ≈ 2.53, so 4 against an expected 2 is
  // inside the band and the screen must not call it strange.
  it('draws a band wide enough that an ordinary gap sits inside it', () => {
    const gac = suitOf(report.thisRound, 'GAC')

    expect(gac.spread).toBeCloseTo(REPORT_BAND_SIGMA * Math.sqrt(10 * 0.2 * 0.8), 6)
    expect(Math.abs(gac.actual - gac.expected)).toBeLessThanOrEqual(gac.spread)
  })

  it('counts a special chip under both of its suits (GDD 3-2)', () => {
    const special: Chip = { id: 'sp', kind: 'special', left: 'GAC', right: 'IMA' }
    const one = buildReport({
      round: 1,
      score: 0,
      target: 0,
      populations: [population(1, deck)],
      draws: [draw(1, 1, [special])],
      wagers: [],
    })

    expect(suitOf(one.thisRound, 'GAC').actual).toBe(1)
    expect(suitOf(one.thisRound, 'IMA').actual).toBe(1)
    // One card drawn, counted in two suits.
    expect(one.thisRound.cards).toBe(1)
  })

  it('counts a drifter under no suit at all (GDD 3-3)', () => {
    const one = buildReport({
      round: 1,
      score: 0,
      target: 0,
      populations: [population(1, deck)],
      draws: [draw(1, 1, [{ id: 'dr', kind: 'drifter' }])],
      wagers: [],
    })

    for (const suit of SUIT_ORDER) expect(suitOf(one.thisRound, suit).actual).toBe(0)
    expect(one.thisRound.cards).toBe(1)
  })
})

// The reason `RoundPopulation` exists: rounds are measured against the deck they
// were actually dealt from, so a cumulative figure is a sum of differently
// weighted rounds and not one deck applied to all of them.
describe('CONSTELLATION LOG — cumulative across a changing deck', () => {
  // Round 1: 10 per suit, 50 cards → GAC share 0.2, 10 cards drawn → expect 2.
  // Round 2: five more GAC bought → 15/55 ≈ 0.2727, 10 cards drawn → expect 2.727.
  // Cumulative expectation for GAC = 4.727, which no single deck produces:
  //   round-1 deck for both  → 2 + 2     = 4
  //   round-2 deck for both  → 2.727 × 2 = 5.454
  const first = evenDeck(10)
  const second = [...first, ...Array.from({ length: 5 }, (_, i) => basic('GAC', 100 + i))]

  const report = buildReport({
    round: 2,
    score: 700,
    target: 630,
    populations: [population(1, first), population(2, second)],
    draws: [
      draw(1, 1, Array.from({ length: 10 }, (_, i) => basic('GAC', i))),
      draw(2, 1, Array.from({ length: 10 }, (_, i) => basic('IMA', i))),
    ],
    wagers: [],
  })

  it('weights each round by the deck that round held', () => {
    expect(suitOf(report.cumulative, 'GAC').expected).toBeCloseTo(2 + 10 * (15 / 55), 6)
  })

  it('is neither deck applied to both rounds', () => {
    const gac = suitOf(report.cumulative, 'GAC').expected

    expect(gac).not.toBeCloseTo(4, 3)
    expect(gac).not.toBeCloseTo(10 * (15 / 55) * 2, 3)
  })

  it('reports the round just played against its own population', () => {
    expect(report.population.round).toBe(2)
    expect(report.population.size).toBe(55)
    expect(suitOf(report.thisRound, 'GAC').expected).toBeCloseTo(10 * (15 / 55), 6)
  })

  it('splits this round from the cumulative sample', () => {
    expect(report.thisRound.cards).toBe(10)
    expect(report.cumulative.cards).toBe(20)
    expect(suitOf(report.thisRound, 'GAC').actual).toBe(0)
    expect(suitOf(report.cumulative, 'GAC').actual).toBe(10)
  })
})

describe('CONSTELLATION LOG — wager tally', () => {
  const deck = evenDeck(10)
  const build = (wagers: readonly WagerRecord[]) =>
    buildReport({
      round: 1,
      score: 0,
      target: 0,
      populations: [population(1, deck)],
      draws: [draw(1, 1, [basic('GAC', 0)])],
      wagers,
    })

  // GDD 8-4 leaves the divisor open; BOOTH-5 puts abstentions outside it.
  it('divides by answered questions and keeps abstentions beside them', () => {
    const report = build([
      wager(1, 'yes', true),
      wager(1, 'no', true),
      wager(1, 'yes', false),
      wager(1, 'abstain', false),
      wager(1, 'abstain', false),
    ])

    expect(report.cumulative.wager).toMatchObject({ answered: 3, correct: 2, abstained: 2 })
    expect(report.cumulative.wager.rate).toBeCloseTo(2 / 3, 6)
  })

  // Counting 기권 as a miss would make a guess strictly better than declining,
  // which is the opposite of what the button is for (GDD 8-2).
  it('never lets an abstention pull the rate down', () => {
    const answered = build([wager(1, 'yes', true), wager(1, 'no', false)])
    const withAbstentions = build([
      wager(1, 'yes', true),
      wager(1, 'no', false),
      wager(1, 'abstain', false),
      wager(1, 'abstain', false),
    ])

    expect(withAbstentions.cumulative.wager.rate).toBe(answered.cumulative.wager.rate)
  })

  it('has no rate at all when every question was declined', () => {
    const report = build([wager(1, 'abstain', false)])

    expect(report.cumulative.wager.answered).toBe(0)
    expect(report.cumulative.wager.rate).toBeNull()
    expect(report.cumulative.wager.spread).toBe(0)
  })

  it('narrows the band a guesser would land in as answers pile up', () => {
    const few = build(Array.from({ length: 4 }, () => wager(1, 'yes', true)))
    const many = build(Array.from({ length: 36 }, () => wager(1, 'yes', true)))

    expect(few.cumulative.wager.spread).toBeCloseTo(
      REPORT_BAND_SIGMA * Math.sqrt((WAGER_GUESS_RATE * (1 - WAGER_GUESS_RATE)) / 4),
      6,
    )
    expect(many.cumulative.wager.spread).toBeLessThan(few.cumulative.wager.spread)
  })
})

describe('CONSTELLATION LOG — convergence series (GDD 8-4, Ⅲ-3)', () => {
  const deck = evenDeck(10)
  const hand = (round: number, turn: number) =>
    draw(round, turn, [basic('GAC', turn), basic('IMA', turn), basic('GIN', turn), basic('MIM', turn)])

  const build = (through: number) =>
    buildReport({
      round: through,
      score: 0,
      target: 0,
      populations: Array.from({ length: through }, (_, i) => population(i + 1, deck)),
      draws: Array.from({ length: through }, (_, i) => hand(i + 1, 1)),
      wagers: [],
    })

  it('has one point per round played, oldest first', () => {
    const report = build(3)

    expect(report.series.map((point) => point.round)).toEqual([1, 2, 3])
    expect(report.series.map((point) => point.cards)).toEqual([4, 8, 12])
  })

  // Round 1 has nothing behind it, so the series is a single point and the
  // screen has no comparison to draw yet.
  it('is a single point after round 1', () => {
    expect(build(1).series).toHaveLength(1)
  })

  // The part of the law that shows even in three rounds: the size a gap usually
  // takes falls with the sample, whichever way the draws happened to fall.
  it('shrinks the usual gap every round, whatever the draws did', () => {
    const { series } = build(4)

    for (let i = 1; i < series.length; i++) {
      expect(series[i].typical).toBeLessThan(series[i - 1].typical)
    }
  })

  it('measures the gap in shares, so it is comparable across sample sizes', () => {
    const { series } = build(2)

    for (const point of series) {
      expect(point.gap).toBeGreaterThanOrEqual(0)
      expect(point.gap).toBeLessThanOrEqual(1)
    }
  })
})

describe('CONSTELLATION LOG — round boundaries', () => {
  /** A run that has not started a round yet, so `populations` is still empty. */
  const fresh = (): Game => startGame('booth', mulberry32(4))

  it('snapshots the deck when the round starts', () => {
    let game = startRound(fresh())

    expect(game.populations).toHaveLength(1)
    expect(game.populations[0]).toMatchObject({ round: 1, size: 50 })
    expect(game.populations[0].bySuit.GAC).toBe(10)

    game = startRound({ ...game, round: 2 })
    expect(game.populations.map((entry) => entry.round)).toEqual([1, 2])
  })

  // `endRound` moves the counter on, so a report built from the game after it
  // would name the round that has not been played yet.
  it('names the round that was played, not the one endRound moved to', () => {
    const played: Game = { ...startRound(fresh()), roundScore: 600, targetScore: 490 }
    const after = endRound(played)

    expect(after.round).toBe(2)
    expect(roundReport(played).round).toBe(1)
    expect(roundReport(played).score).toBe(600)
    expect(roundReport(played).target).toBe(490)
  })

  it('reports zeros rather than nothing when a round drew no cards', () => {
    const report = roundReport(startRound(fresh()))

    expect(report.thisRound.cards).toBe(0)
    expect(report.thisRound.wager.rate).toBeNull()
    expect(report.series).toEqual([])
    for (const suit of SUIT_ORDER) {
      expect(suitOf(report.thisRound, suit)).toMatchObject({ actual: 0, expected: 0, spread: 0 })
    }
  })

  it('records one population per round of a full run', () => {
    let game = fresh()
    for (let round = 1; round <= 3; round++) {
      game = startRound({ ...game, round })
    }

    expect(game.populations.map((entry) => entry.round)).toEqual([1, 2, 3])
  })
})
