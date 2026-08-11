// Deck of star fragments. Draws are without replacement within a turn; unplaced
// chips go back and the deck is reshuffled (GDD 4-2, C-2).

import { INITIAL_DECK } from './config'
import { shuffle } from './rng'
import type { Rng } from './rng'
import { SUIT_ORDER } from './types'
import type { Chip, SuitId } from './types'

/** 5 suits × 10 = 50 basic chips (GDD 4-2, C-7). Built in scoring order, so it is reproducible. */
export function createInitialDeck(): Chip[] {
  return SUIT_ORDER.flatMap((suit) =>
    Array.from({ length: INITIAL_DECK[suit] }, (_, i): Chip => ({
      id: `${suit}-${i}`,
      kind: 'basic',
      suit,
    })),
  )
}

export interface DrawResult {
  readonly drawn: Chip[]
  readonly deck: Chip[]
}

/** Takes `count` chips off the top. The source deck is not modified. */
export function drawFromDeck(deck: readonly Chip[], count: number): DrawResult {
  return { drawn: deck.slice(0, count), deck: deck.slice(count) }
}

/** Unplaced chips rejoin the deck, which is then reshuffled (GDD 4-2, C-2). */
export function returnToDeck(deck: readonly Chip[], chips: readonly Chip[], rng: Rng): Chip[] {
  return shuffle([...deck, ...chips], rng)
}

export interface DeckCounts {
  /** Chips that score as this suit. A special counts for both of its suits (GDD 3-2). */
  readonly bySuit: Readonly<Record<SuitId, number>>
  /** Basic chips only — the shop adds and removes nothing else (GDD 9-2). */
  readonly basicsBySuit: Readonly<Record<SuitId, number>>
}

/**
 * What the deck is made of, by suit. Pure and cheap, so a screen may call it on
 * every render.
 *
 * It lives in core rather than beside the shop screen because the two things
 * that need it are the same question asked twice: the shop shows how many of a
 * suit the deck holds, and STAR-CHART (GDD 8-1) turns those counts into the
 * probability of drawing one. The second is a calculation, and calculations do
 * not belong in `src/ui` (CLAUDE.md §5).
 *
 * A special chip is counted once under each of its suits, which is what both
 * callers mean: it really can complete a line of either. The drifter is in
 * neither total — it has no suit until it is scored (GDD 3-3).
 */
export function countDeck(deck: readonly Chip[]): DeckCounts {
  const bySuit = { GAC: 0, IMA: 0, GIN: 0, MIM: 0, ACR: 0 }
  const basicsBySuit = { GAC: 0, IMA: 0, GIN: 0, MIM: 0, ACR: 0 }

  for (const chip of deck) {
    if (chip.kind === 'basic') {
      bySuit[chip.suit]++
      basicsBySuit[chip.suit]++
    } else if (chip.kind === 'special') {
      bySuit[chip.left]++
      bySuit[chip.right]++
    }
  }
  return { bySuit, basicsBySuit }
}

/**
 * GDD 8-1: the chance that a hand of `handSize`, drawn without replacement from
 * a deck of `deckSize`, holds at least one chip of a suit the deck has `ofSuit`
 * of.
 *
 * What is computed is the complement — 여사건, Ⅱ-2 — because "at least one" has
 * to be summed over every way it could happen, while "not one" is a single
 * quotient:
 *
 *     P(at least one) = 1 − C(n−k, h) / C(n, h)
 *                     = 1 − ∏ (n−k−i) / (n−i)     for i in 0 … h−1
 *
 * The product is accumulated rather than built from three factorials. C(50, 8)
 * is already 5.4×10⁸ and 60! is past the range of a double, so forming the
 * numerator and denominator separately loses the answer to Infinity ÷ Infinity
 * before the division can happen. Every factor of the running product is itself
 * in [0, 1], so the value can never leave the range a probability must be in.
 *
 * `handSize` is a parameter and not `HAND_SIZE` because the hand is a setting,
 * not a constant of the arithmetic: GDD 7-2's 표본추출 원시별 takes it to 10, and
 * a panel that kept saying 8 would be answering about a hand the player is not
 * going to be dealt.
 */
export function chanceOfDrawing(deckSize: number, ofSuit: number, handSize: number): number {
  // Not in the deck, no cards, or no draw — nothing to find. This is tested
  // before the certainty case below on purpose: a deck smaller than the hand
  // would otherwise report a suit as certain when there is none of it left.
  if (ofSuit <= 0 || deckSize <= 0 || handSize <= 0) return 0

  // Too few other chips to fill the hand, so one of this suit has to turn up.
  // This is also what keeps the product from walking past the end of the deck
  // and multiplying by a negative count.
  if (deckSize - ofSuit < handSize) return 1

  let miss = 1
  for (let i = 0; i < handSize; i++) {
    miss *= (deckSize - ofSuit - i) / (deckSize - i)
  }
  return 1 - miss
}

/**
 * `chanceOfDrawing` for all five suits at once, which is what STAR-CHART shows.
 *
 * A special counts toward both of its suits here exactly as it does in
 * `countDeck` — it really can complete a line of either (GDD 3-2), so it really
 * does improve both of their odds.
 */
export function drawChances(
  deck: readonly Chip[],
  handSize: number,
): Readonly<Record<SuitId, number>> {
  const { bySuit } = countDeck(deck)
  const chances = {} as Record<SuitId, number>

  for (const suit of SUIT_ORDER) {
    chances[suit] = chanceOfDrawing(deck.length, bySuit[suit], handSize)
  }
  return chances
}
