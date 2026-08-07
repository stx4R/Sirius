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
