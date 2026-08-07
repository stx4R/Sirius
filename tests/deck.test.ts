import { describe, expect, it } from 'vitest'
import { INITIAL_DECK } from '../src/core/config'
import { countDeck, createInitialDeck, drawFromDeck, returnToDeck } from '../src/core/deck'
import { mulberry32 } from '../src/core/rng'
import { SUIT_ORDER } from '../src/core/types'
import type { Chip, SuitId } from '../src/core/types'

const countSuits = (deck: readonly Chip[]) => {
  const counts: Partial<Record<SuitId, number>> = {}
  for (const chip of deck) {
    if (chip.kind !== 'basic') continue
    counts[chip.suit] = (counts[chip.suit] ?? 0) + 1
  }
  return counts
}

describe('deck', () => {
  it('starts at 50 chips', () => {
    expect(createInitialDeck()).toHaveLength(50)
  })

  it('holds 10 of each suit, matching INITIAL_DECK', () => {
    const counts = countSuits(createInitialDeck())

    for (const suit of SUIT_ORDER) {
      expect(counts[suit]).toBe(INITIAL_DECK[suit])
      expect(counts[suit]).toBe(10)
    }
  })

  it('gives every chip a unique id', () => {
    const deck = createInitialDeck()

    expect(new Set(deck.map((chip) => chip.id)).size).toBe(deck.length)
  })

  it('contains only basic chips — specials and the drifter come from the shop', () => {
    expect(createInitialDeck().every((chip) => chip.kind === 'basic')).toBe(true)
  })

  it('draws without replacement and leaves the source deck alone', () => {
    const deck = createInitialDeck()

    const { drawn, deck: rest } = drawFromDeck(deck, 8)

    expect(drawn).toHaveLength(8)
    expect(rest).toHaveLength(42)
    expect(deck).toHaveLength(50)
    expect(rest.some((chip) => drawn.includes(chip))).toBe(false)
  })

  // The shop prints these and STAR-CHART (GDD 8-1) turns them into draw
  // probabilities at P5, which is why the count lives in core.
  it('counts the opening deck as ten basics of each suit', () => {
    const counts = countDeck(createInitialDeck())

    for (const suit of SUIT_ORDER) {
      expect(counts.bySuit[suit]).toBe(10)
      expect(counts.basicsBySuit[suit]).toBe(10)
    }
  })

  it('counts a special under both of its suits, and as no basic (GDD 3-2)', () => {
    const deck: Chip[] = [
      { id: 'a', kind: 'basic', suit: 'GAC' },
      { id: 'b', kind: 'special', left: 'GAC', right: 'MIM' },
    ]

    const counts = countDeck(deck)

    expect(counts.bySuit.GAC).toBe(2)
    expect(counts.bySuit.MIM).toBe(1)
    expect(counts.basicsBySuit.GAC).toBe(1)
    expect(counts.basicsBySuit.MIM).toBe(0)
  })

  // GDD 3-3: it has no suit until it is scored, so it belongs to neither total.
  it('counts the drifter under no suit at all', () => {
    const counts = countDeck([{ id: 'd', kind: 'drifter' }])

    for (const suit of SUIT_ORDER) {
      expect(counts.bySuit[suit]).toBe(0)
      expect(counts.basicsBySuit[suit]).toBe(0)
    }
  })

  it('returns unplaced chips and reshuffles reproducibly', () => {
    const { drawn, deck: rest } = drawFromDeck(createInitialDeck(), 8)
    const unplaced = drawn.slice(4)

    const first = returnToDeck(rest, unplaced, mulberry32(11))
    const second = returnToDeck(rest, unplaced, mulberry32(11))

    expect(first).toHaveLength(46)
    expect(first.map((chip) => chip.id)).toEqual(second.map((chip) => chip.id))
    expect(new Set(first.map((chip) => chip.id))).toEqual(
      new Set([...rest, ...unplaced].map((chip) => chip.id)),
    )
  })
})
