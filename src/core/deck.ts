// Deck of star fragments. Draws are without replacement within a turn; unplaced
// chips go back and the deck is reshuffled (GDD 4-2, C-2).

import { INITIAL_DECK } from './config'
import { shuffle } from './rng'
import type { Rng } from './rng'
import { SUIT_ORDER } from './types'
import type { Chip } from './types'

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
