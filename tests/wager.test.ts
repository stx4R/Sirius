// ORION'S WAGER question generation (GDD 8-2). Written before the generator.
//
// Two checks carry this file. The first is that `answer` follows from the deck
// actually in play: the propositions are computed, not drawn from a bank, so the
// test recomputes every one of them in exact BigInt combinatorics and compares.
// The second is the wording — GDD 1-4 ③ bans reading a deck state as a sequence
// of events, and a generator that phrases one question that way has failed
// educationally even though every number in it is right.

import { describe, expect, it } from 'vitest'
import { HAND_SIZE, WAGER_MIN_GAP, WAGER_TIER_BY_ROUND } from '../src/core/config'
import { createInitialDeck } from '../src/core/deck'
import { mulberry32, shuffle } from '../src/core/rng'
import type { Rng } from '../src/core/rng'
import { generateWager, wagerTierFor } from '../src/core/wager'
import type { Chip, SuitId, WagerQuestion, WagerTier } from '../src/core/types'

/**
 * Exact C(n, k). Declared here rather than shared with tests/probability.test.ts
 * because each file is checking a different implementation against the same
 * arithmetic, and a helper they both import is a second implementation to trust.
 */
function choose(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n
  let out = 1n
  for (let i = 0n; i < BigInt(k); i++) {
    out = (out * BigInt(n - Number(i))) / (i + 1n)
  }
  return out
}

type Fraction = readonly [bigint, bigint]

/** Exact P(at least one of the suit in `h` draws), with `chanceOfDrawing`'s boundaries. */
function chanceExact(n: number, k: number, h: number): Fraction {
  if (k <= 0 || n <= 0 || h <= 0) return [0n, 1n]
  if (n - k < h) return [1n, 1n]
  const total = choose(n, h)
  return [total - choose(n - k, h), total]
}

function compare(a: Fraction, b: Fraction): number {
  const left = a[0] * b[1]
  const right = b[0] * a[1]
  return left === right ? 0 : left < right ? -1 : 1
}

function toNumber(f: Fraction): number {
  return Number(f[0]) / Number(f[1])
}

const NAME_OF: Readonly<Record<SuitId, string>> = {
  GAC: 'Gacrux',
  IMA: 'Imai',
  GIN: 'Ginan',
  MIM: 'Mimosa',
  ACR: 'Acrux',
}

/** The suits a question names, in order of first appearance. */
function suitsIn(text: string): SuitId[] {
  return (Object.keys(NAME_OF) as SuitId[])
    .filter((suit) => text.includes(NAME_OF[suit]))
    .sort((a, b) => text.indexOf(NAME_OF[a]) - text.indexOf(NAME_OF[b]))
}

function countAs(deck: readonly Chip[], suit: SuitId): number {
  return deck.filter(
    (chip) =>
      (chip.kind === 'basic' && chip.suit === suit) ||
      (chip.kind === 'special' && (chip.left === suit || chip.right === suit)),
  ).length
}

function countEither(deck: readonly Chip[], a: SuitId, b: SuitId): number {
  return deck.filter(
    (chip) =>
      (chip.kind === 'basic' && (chip.suit === a || chip.suit === b)) ||
      (chip.kind === 'special' &&
        (chip.left === a || chip.right === a || chip.left === b || chip.right === b)),
  ).length
}

interface Reading {
  readonly answer: boolean
  /** Distance between the two quantities the question puts side by side. */
  readonly gap: number
  /** Whether they are exactly equal, which is unambiguous however small the gap. */
  readonly tied: boolean
}

/**
 * Reads a generated question back into the arithmetic it claims, from its own
 * wording. Throws on a shape it does not know: a reworded template must fail
 * loudly here rather than quietly stop being checked.
 */
function read(question: WagerQuestion, deck: readonly Chip[], handSize = HAND_SIZE): Reading {
  const text = question.text
  const suits = suitsIn(text)
  const n = deck.length

  if (text.includes('조건이 주어질 때')) {
    const [a, b] = suits
    const union = countEither(deck, a, b)
    const share: Fraction = union === 0 ? [0n, 1n] : [BigInt(countAs(deck, a)), BigInt(union)]
    const half: Fraction = [1n, 2n]
    const side = compare(share, half)
    const gap = Math.abs(toNumber(share) - 0.5)
    if (text.includes('정확히 절반일까')) return { answer: side === 0, gap, tied: side === 0 }
    if (text.includes('절반보다 클까')) return { answer: side > 0, gap, tied: side === 0 }
  }

  if (text.includes('1장도 안 나올 확률')) {
    const [suit] = suits
    const percent = /(\d+)%/.exec(text)
    if (percent === null) throw new Error(`no threshold in: ${text}`)
    const any = chanceExact(n, countAs(deck, suit), handSize)
    const none: Fraction = [any[1] - any[0], any[1]]
    const threshold: Fraction = [BigInt(percent[1]), 100n]
    const side = compare(none, threshold)
    return {
      answer: side > 0,
      gap: Math.abs(toNumber(none) - Number(percent[1]) / 100),
      tied: side === 0,
    }
  }

  const [a, b] = suits
  const chanceA = chanceExact(n, countAs(deck, a), handSize)
  const chanceB = chanceExact(n, countAs(deck, b), handSize)
  const side = compare(chanceA, chanceB)
  const gap = Math.abs(toNumber(chanceA) - toNumber(chanceB))

  if (text.includes('정확히 같을까')) return { answer: side === 0, gap, tied: side === 0 }
  if (text.includes('서로 다를까')) return { answer: side !== 0, gap, tied: side === 0 }
  if (text.includes('크거나 같을까')) return { answer: side >= 0, gap, tied: side === 0 }

  throw new Error(`unreadable question: ${text}`)
}

/**
 * GDD 1-4 ③. Every one of these turns a deck state into a story about events in
 * order, which is the misconception the textbook warns against by name.
 */
const FORBIDDEN = [
  '이미',
  '이제',
  '다음엔',
  '그다음',
  '그 다음',
  '뒤라서',
  '뒤에',
  '뒤이어',
  '먼저',
  '나중',
  '방금',
  '직전',
  '직후',
  '이후',
  '이전',
  '했으니',
  '하고 나서',
  '그러고',
  '순서대로',
  '한 다음',
  '때문에',
  'P(',
  '|',
]

function deckOf(counts: Partial<Record<SuitId, number>>): Chip[] {
  return (Object.keys(counts) as SuitId[]).flatMap((suit) =>
    Array.from({ length: counts[suit] ?? 0 }, (_, i): Chip => ({
      id: `${suit}-${i}`,
      kind: 'basic',
      suit,
    })),
  )
}

/** A deck part-way through a round: chips are gone from it in no particular pattern. */
function worn(rng: Rng, dropped: number): Chip[] {
  return shuffle(createInitialDeck(), rng).slice(dropped)
}

const ROUND_OF: Readonly<Record<WagerTier, number>> = {
  comparison: 1,
  complement: 3,
  conditional: 6,
}

/** 300 decks worn by every amount a round can wear them, one per seed. */
function sample(tier: WagerTier): { deck: Chip[]; question: WagerQuestion }[] {
  return Array.from({ length: 300 }, (_, i) => {
    const deck = worn(mulberry32(i + 1), i % 17)
    return { deck, question: generateWager(deck, ROUND_OF[tier], mulberry32(i * 7 + 3)) }
  })
}

describe('wagerTierFor (GDD 8-2)', () => {
  it('follows WAGER_TIER_BY_ROUND', () => {
    for (let round = 1; round <= WAGER_TIER_BY_ROUND.length; round++) {
      expect(wagerTierFor(round)).toBe(WAGER_TIER_BY_ROUND[round - 1])
    }
  })

  it('clamps rounds outside the table', () => {
    const first = WAGER_TIER_BY_ROUND[0]
    const last = WAGER_TIER_BY_ROUND[WAGER_TIER_BY_ROUND.length - 1]
    expect(wagerTierFor(0)).toBe(first)
    expect(wagerTierFor(-4)).toBe(first)
    expect(wagerTierFor(WAGER_TIER_BY_ROUND.length + 1)).toBe(last)
    expect(wagerTierFor(100)).toBe(last)
  })
})

describe('generateWager (GDD 8-2)', () => {
  it('is decided by the seed and the deck alone', () => {
    const deck = worn(mulberry32(11), 9)
    const first = generateWager(deck, 3, mulberry32(2026))
    const again = generateWager(deck, 3, mulberry32(2026))
    expect(again).toEqual(first)
  })

  it('does not ask the same question whatever the seed', () => {
    const deck = worn(mulberry32(11), 9)
    const texts = new Set(
      Array.from({ length: 50 }, (_, i) => generateWager(deck, 3, mulberry32(i + 1)).text),
    )
    expect(texts.size).toBeGreaterThan(1)
  })

  it('tags the question with the round its tier came from', () => {
    const deck = createInitialDeck()
    for (let round = 1; round <= WAGER_TIER_BY_ROUND.length; round++) {
      expect(generateWager(deck, round, mulberry32(round)).tier).toBe(WAGER_TIER_BY_ROUND[round - 1])
    }
  })

  for (const tier of ['comparison', 'complement', 'conditional'] as const) {
    describe(tier, () => {
      const cases = sample(tier)

      it('answers what the deck says, in exact combinatorics', () => {
        for (const { deck, question } of cases) {
          expect({ text: question.text, answer: question.answer }).toEqual({
            text: question.text,
            answer: read(question, deck).answer,
          })
        }
      })

      it('leaves a gap a student can act on', () => {
        for (const { deck, question } of cases) {
          const { gap, tied } = read(question, deck)
          // Exactly equal is not a close call — the counts are there to be read
          // off, and "the same" is a defensible answer to a hair's breadth apart.
          expect(tied || gap >= WAGER_MIN_GAP).toBe(true)
        }
      })

      it('is answered YES about as often as NO', () => {
        const yes = cases.filter(({ question }) => question.answer).length
        expect(yes / cases.length).toBeGreaterThanOrEqual(0.35)
        expect(yes / cases.length).toBeLessThanOrEqual(0.65)
      })

      it('says nothing GDD 1-4 ③ forbids', () => {
        for (const { question } of cases) {
          for (const phrase of FORBIDDEN) {
            expect(`${question.text}\n${question.explanation}`).not.toContain(phrase)
          }
        }
      })

      it('explains with the numbers it used', () => {
        for (const { question } of cases) {
          expect(question.text.endsWith('?')).toBe(true)
          expect(question.explanation).toMatch(/\d/)
          // The wrong side is named, so the popup rebuts the choice that was made.
          expect(/YES를 고르|NO를 고르/.test(question.explanation)).toBe(true)
        }
      })

      // BOOTH-6b: a booth run reads fifteen of these and BOOTH-6a measured them at
      // 44% of the whole 20-minute budget, so the length is a budget line and not
      // a matter of taste.
      //
      // The cap is per tier because the conditional carries a third count — the
      // size of the range the condition leaves — that the other two do not, and
      // GDD 8-2 puts it in rounds 6-8, which a booth run never reaches.
      it('stays inside its character budget', () => {
        const cap = tier === 'conditional' ? 110 : 90

        for (const { question } of cases) {
          expect(question.explanation.length, question.explanation).toBeLessThanOrEqual(cap)
        }
      })

      // The shape the budget was cut to: the basis first, then the misconception
      // the wrong side stands for, and nothing after it. The qualitative tails
      // that used to follow the rebuttal are what went.
      it('ends on the misconception it is rebutting', () => {
        for (const { question } of cases) {
          const last = question.explanation.trim().split('. ').at(-1) ?? ''

          expect(last, question.explanation).toMatch(/^(YES|NO)를 고르면/)
        }
      })
    })
  }

  it('moves with the deck rather than the round', () => {
    const fresh = createInitialDeck()
    const spent = deckOf({ GAC: 10, IMA: 9, GIN: 2, MIM: 10, ACR: 8 })

    for (const round of [1, 3, 6]) {
      const before = new Set(
        Array.from(
          { length: 40 },
          (_, i) =>
            `${generateWager(fresh, round, mulberry32(i + 1)).text}|${generateWager(fresh, round, mulberry32(i + 1)).answer}`,
        ),
      )
      const after = Array.from(
        { length: 40 },
        (_, i) =>
          `${generateWager(spent, round, mulberry32(i + 1)).text}|${generateWager(spent, round, mulberry32(i + 1)).answer}`,
      )
      // Some proposition the worn deck supports is one the full deck never made.
      expect(after.some((entry) => !before.has(entry))).toBe(true)
    }
  })

  it('still stands where a probability is exactly 0 or 1', () => {
    // GIN is gone, and MIM has so few others beside it that an 8-card draw
    // cannot avoid ACR — the two ends of `chanceOfDrawing`.
    const decks = [
      deckOf({ GAC: 10, IMA: 10, GIN: 0, MIM: 10, ACR: 10 }),
      deckOf({ GAC: 2, IMA: 1, GIN: 0, MIM: 1, ACR: 8 }),
    ]

    for (const deck of decks) {
      for (let round = 1; round <= WAGER_TIER_BY_ROUND.length; round++) {
        for (let seed = 1; seed <= 40; seed++) {
          const question = generateWager(deck, round, mulberry32(seed))
          expect(question.answer).toBe(read(question, deck).answer)
        }
      }
    }
  })

  it('finds a suit that is gone certain not to turn up', () => {
    const deck = deckOf({ GAC: 12, IMA: 12, GIN: 0, MIM: 12, ACR: 12 })
    const asked = Array.from({ length: 60 }, (_, i) => generateWager(deck, 3, mulberry32(i + 1)))
    const aboutGinan = asked.filter((question) => question.text.includes('Ginan'))
    expect(aboutGinan.length).toBeGreaterThan(0)
    // "1장도 안 나올 확률" is 100% for a suit with no chips left, so it clears
    // every threshold on offer.
    for (const question of aboutGinan) expect(question.answer).toBe(true)
  })

  it('returns a well-formed question for a deck it can say nothing about', () => {
    // Unreachable in play — unplaced chips go back before the next wager, so the
    // deck never falls below 34 (GDD 4-2). Kept so the fallback stays honest.
    for (let round = 1; round <= WAGER_TIER_BY_ROUND.length; round++) {
      const question = generateWager([], round, mulberry32(round))
      expect(question.text.length).toBeGreaterThan(0)
      expect(question.explanation.length).toBeGreaterThan(0)
      expect(typeof question.answer).toBe('boolean')
    }
  })
})
