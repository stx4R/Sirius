// STAR-CHART's arithmetic (GDD 8-1): the chance that the next hand contains at
// least one chip of a given suit, drawn without replacement.
//
// Written before the implementation. The cases that matter are the degenerate
// ones — an empty suit and a deck too small to avoid it — because those are
// where a plain C(n-k,h)/C(n,h) either divides by zero or returns a combination
// of a negative count.

import { describe, expect, it } from 'vitest'
import { HAND_SIZE, INITIAL_DECK } from '../src/core/config'
import {
  chanceOfDrawing,
  createInitialDeck,
  drawChances,
  observedChances,
} from '../src/core/deck'
import { SUIT_ORDER } from '../src/core/types'
import type { Chip, DrawRecord, SuitId } from '../src/core/types'

/**
 * Exact C(n, k) in BigInt, for checking the floating-point implementation
 * against real combinatorics. Only the test may compute it this way: it is
 * exact but allocates, and the panel recomputes on every render.
 */
function choose(n: number, k: number): bigint {
  if (k < 0 || k > n) return 0n
  let out = 1n
  for (let i = 0n; i < BigInt(k); i++) {
    out = (out * BigInt(n - Number(i))) / (i + 1n)
  }
  return out
}

/** 1 - C(n-k, h) / C(n, h), evaluated exactly and only then divided. */
function reference(n: number, k: number, h: number): number {
  const total = choose(n, h)
  if (total === 0n) return 0
  const without = choose(n - k, h)
  return 1 - Number(without) / Number(total)
}

describe('chanceOfDrawing (GDD 8-1)', () => {
  it('is 0 when the suit is not in the deck', () => {
    expect(chanceOfDrawing(50, 0, 8)).toBe(0)
    expect(chanceOfDrawing(1, 0, 1)).toBe(0)
    // Even when the draw would take the whole deck.
    expect(chanceOfDrawing(5, 0, 5)).toBe(0)
  })

  it('is 1 when there are too few other chips to avoid the suit', () => {
    // 3 of the 5 are the suit, so a 3-card draw cannot dodge all of them.
    expect(chanceOfDrawing(5, 3, 3)).toBe(1)
    // Exactly at the boundary: n - k === h leaves one way to miss, so not 1.
    expect(chanceOfDrawing(5, 2, 3)).toBeLessThan(1)
    expect(chanceOfDrawing(5, 3, 2)).toBeLessThan(1)
    // Drawing the entire deck always finds it.
    expect(chanceOfDrawing(10, 1, 10)).toBe(1)
    // And a draw larger than the deck is still the whole deck.
    expect(chanceOfDrawing(4, 1, 8)).toBe(1)
  })

  it('matches hand arithmetic on small decks', () => {
    // n=5, k=2, h=2: miss = C(3,2)/C(5,2) = 3/10, so hit = 7/10.
    expect(chanceOfDrawing(5, 2, 2)).toBeCloseTo(0.7, 10)
    // n=10, k=1, h=1: one card, one tenth.
    expect(chanceOfDrawing(10, 1, 1)).toBeCloseTo(0.1, 10)
    // n=4, k=2, h=2: miss = C(2,2)/C(4,2) = 1/6.
    expect(chanceOfDrawing(4, 2, 2)).toBeCloseTo(5 / 6, 10)
  })

  // GDD 8-1 prints this worked example. The expression is the definition, so
  // this pins the implementation to it.
  it('agrees with exact combinatorics on the GDD 8-1 example', () => {
    expect(chanceOfDrawing(40, 7, 8)).toBeCloseTo(reference(40, 7, 8), 12)
    // ...and the value that expression actually has, which is not the 78.4%
    // the GDD table used to claim beside it.
    expect(chanceOfDrawing(40, 7, 8)).toBeCloseTo(0.8195, 4)
  })

  it('agrees with exact combinatorics across a sweep', () => {
    for (let n = 1; n <= 30; n++) {
      for (let k = 0; k <= n; k++) {
        for (const h of [1, 2, 5, 8, 10]) {
          if (h > n) continue
          expect(chanceOfDrawing(n, k, h), `n=${n} k=${k} h=${h}`).toBeCloseTo(
            reference(n, k, h),
            10,
          )
        }
      }
    }
  })

  // The multiplicative form exists so this stays finite: C(600, 60) overflows a
  // double long before it is divided, and a factorial version returns NaN here.
  it('stays a real probability on a deck far larger than the game will ever have', () => {
    const big = chanceOfDrawing(600, 60, 60)

    expect(Number.isFinite(big)).toBe(true)
    expect(big).toBeGreaterThan(0)
    expect(big).toBeLessThan(1)
  })

  it('never leaves 0..1, whatever it is asked', () => {
    for (let n = 0; n <= 60; n += 3) {
      for (let k = 0; k <= n; k += 2) {
        for (const h of [0, 1, 8, 10, 25]) {
          const p = chanceOfDrawing(n, k, h)
          expect(p, `n=${n} k=${k} h=${h}`).toBeGreaterThanOrEqual(0)
          expect(p, `n=${n} k=${k} h=${h}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('rises as the suit gets commoner and as more chips are drawn', () => {
    for (let k = 1; k < 10; k++) {
      expect(chanceOfDrawing(50, k + 1, 8)).toBeGreaterThan(chanceOfDrawing(50, k, 8))
    }
    for (let h = 1; h < 10; h++) {
      expect(chanceOfDrawing(50, 10, h + 1)).toBeGreaterThan(chanceOfDrawing(50, 10, h))
    }
  })

  /**
   * The hand size is a setting, not a constant of the arithmetic — GDD 7-2's
   * 표본추출 원시별 takes it from 8 to 10, and STAR-CHART has to answer for the
   * hand the player will actually be dealt.
   */
  it('reports a better chance for the 10-card hand than the 8-card one', () => {
    for (const suit of SUIT_ORDER) {
      const eight = chanceOfDrawing(50, INITIAL_DECK[suit], 8)
      const ten = chanceOfDrawing(50, INITIAL_DECK[suit], 10)

      expect(ten).toBeGreaterThan(eight)
    }
    // The opening deck, 10 of 50: 8 cards find a suit 85.7% of the time, 10
    // cards 91.7%.
    expect(chanceOfDrawing(50, 10, 8)).toBeCloseTo(0.8568, 4)
    expect(chanceOfDrawing(50, 10, 10)).toBeCloseTo(0.9175, 4)
  })
})

describe('drawChances over a real deck (GDD 8-1)', () => {
  it('gives every suit a probability in range on the opening deck', () => {
    const chances = drawChances(createInitialDeck(), HAND_SIZE)

    for (const suit of SUIT_ORDER) {
      expect(chances[suit]).toBeGreaterThan(0)
      expect(chances[suit]).toBeLessThan(1)
    }
  })

  it('treats the five even suits of the opening deck as equally likely', () => {
    const chances = drawChances(createInitialDeck(), HAND_SIZE)
    const first = chances[SUIT_ORDER[0]]

    for (const suit of SUIT_ORDER) expect(chances[suit]).toBeCloseTo(first, 12)
  })

  /**
   * A special chip scores as both of its suits (GDD 3-2), so it lifts both of
   * their chances — which is the whole reason the shop sells it.
   */
  it('counts a special toward both of the suits it scores as', () => {
    const deck = createInitialDeck()
    const plain = drawChances(deck, HAND_SIZE)
    const withSpecial = drawChances(
      [...deck, { id: 'sp-0', kind: 'special', left: 'GAC', right: 'IMA' }],
      HAND_SIZE,
    )

    expect(withSpecial.GAC).toBeGreaterThan(plain.GAC)
    expect(withSpecial.IMA).toBeGreaterThan(plain.IMA)
    // The other three gained a chip they cannot use, so they get rarer.
    expect(withSpecial.GIN).toBeLessThan(plain.GIN)
  })

  it('gives an absent suit a flat zero', () => {
    const noGinan = createInitialDeck().filter((chip) => chip.kind !== 'basic' || chip.suit !== 'GIN')

    expect(drawChances(noGinan, HAND_SIZE).GIN).toBe(0)
  })

  it('is 1 for every suit when the hand would take the whole deck', () => {
    const tiny = createInitialDeck().slice(0, 6)

    for (const suit of SUIT_ORDER) {
      const chance = drawChances(tiny, 8)[suit]
      // Only the suits actually present can be certain; the rest are impossible.
      expect(chance === 0 || chance === 1).toBe(true)
    }
  })
})

// The 통계적 확률 half of GDD 8-1: what the hands actually dealt did, as opposed to
// what the counts say they should.
describe('observedChances (GDD 8-1)', () => {
  const basic = (suit: SuitId, i: number): Chip => ({ id: `${suit}-${i}`, kind: 'basic', suit })
  const hand = (chips: readonly Chip[], turn = 1): DrawRecord => ({ round: 1, turn, drawn: chips })

  it('has nothing to say before a hand has been dealt', () => {
    const observed = observedChances([])

    expect(observed.hands).toBe(0)
    for (const suit of SUIT_ORDER) expect(observed.bySuit[suit]).toBe(0)
  })

  it('counts a hand once however many of the suit it held', () => {
    // Three Ginan in one hand is still one hand that held Ginan.
    const observed = observedChances([hand([basic('GIN', 0), basic('GIN', 1), basic('GIN', 2)])])

    expect(observed.hands).toBe(1)
    expect(observed.bySuit.GIN).toBe(1)
    expect(observed.bySuit.GAC).toBe(0)
  })

  it('is the share of hands that held the suit', () => {
    const observed = observedChances([
      hand([basic('GAC', 0)], 1),
      hand([basic('IMA', 0)], 2),
      hand([basic('GAC', 1)], 3),
      hand([basic('MIM', 0)], 4),
    ])

    expect(observed.hands).toBe(4)
    expect(observed.bySuit.GAC).toBeCloseTo(0.5, 12)
    expect(observed.bySuit.IMA).toBeCloseTo(0.25, 12)
    expect(observed.bySuit.ACR).toBe(0)
  })

  // The calculated side counts a special toward both suits, so this must too —
  // otherwise the two columns would be answering different questions.
  it('counts a special toward both of the suits it scores as', () => {
    const observed = observedChances([
      hand([{ id: 'sp-0', kind: 'special', left: 'GAC', right: 'IMA' }]),
    ])

    expect(observed.bySuit.GAC).toBe(1)
    expect(observed.bySuit.IMA).toBe(1)
    expect(observed.bySuit.GIN).toBe(0)
  })

  // The drifter has no suit until it is scored (GDD 3-3), so it is evidence for
  // nothing.
  it('credits the drifter to no suit', () => {
    const observed = observedChances([hand([{ id: 'dr-0', kind: 'drifter' }])])

    expect(observed.hands).toBe(1)
    for (const suit of SUIT_ORDER) expect(observed.bySuit[suit]).toBe(0)
  })

  it('never leaves 0..1', () => {
    const history = Array.from({ length: 17 }, (_, i) =>
      hand([basic(SUIT_ORDER[i % SUIT_ORDER.length], i)], i + 1),
    )
    const observed = observedChances(history)

    for (const suit of SUIT_ORDER) {
      expect(observed.bySuit[suit]).toBeGreaterThanOrEqual(0)
      expect(observed.bySuit[suit]).toBeLessThanOrEqual(1)
    }
  })
})
