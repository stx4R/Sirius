// иєвυℓα's shop (GDD 9-2, 9-3). Stock rolling and purchase effects.
//
// Companions are stocked but not sold at P4-A: the shelf shows what they are and
// what a tier costs, while `COMPANIONS_ENABLED` keeps the buy shut until their
// effect parameters exist at P4-B (GDD 7-1-b). Selling one now would take
// stardust for nothing.
//
// GDD 13-4: the drifter is not stock. иєвυℓα gives it away at the first meeting,
// so it has no price and never appears on a shelf — see `grantDrifter`.

import {
  COMPANIONS,
  COMPANIONS_STOCKED,
  COMPANION_TIER_WEIGHTS,
  CONSTELLATION_MULTIPLIERS,
  OWNED_CONSTELLATION_LIMIT,
  SHOP_PRICES,
  SHOP_SLOTS,
  SPECIAL_SUIT_PAIRS,
} from './config'
import { createInitialDeck } from './deck'
import { sample } from './rng'
import type { Rng } from './rng'
import type { Chip, CompanionId, CompanionTier, ConstellationId, SuitId } from './types'

export type SuitPair = readonly [SuitId, SuitId]

export const ALL_CONSTELLATIONS = Object.keys(CONSTELLATION_MULTIPLIERS) as ConstellationId[]

const COMPANION_IDS = Object.keys(COMPANIONS) as CompanionId[]

export interface ShopStock {
  readonly specials: readonly SuitPair[]
  readonly constellations: readonly ConstellationId[]
  /** On the shelf from P4-A; purchasable only once COMPANIONS_ENABLED (GDD 7-1-b). */
  readonly companions: readonly CompanionId[]
}

/**
 * ★ There is deliberately no `companion` variant here, and there must not be one
 * until P4-B.
 *
 * P2-B measured the whole target curve with companions inactive (GDD 13-6). If a
 * companion could reach game state by any route those numbers stop describing
 * the shipped game. A runtime guard could be forgotten; leaving the variant out
 * of the union makes a companion purchase unrepresentable — `applyPurchase`
 * cannot be handed one, so `Loadout.companions` cannot grow. That is the
 * strongest form of the guarantee, and it is why COMPANIONS_ENABLED has nothing
 * to switch on yet: stocking a shelf (COMPANIONS_STOCKED) and selling from it
 * are separate, and only the first is on.
 */
export type Purchase =
  | { readonly kind: 'addBasic'; readonly suit: SuitId }
  | { readonly kind: 'removeBasic'; readonly suit: SuitId }
  | { readonly kind: 'special'; readonly pair: SuitPair }
  | {
      readonly kind: 'constellation'
      readonly id: ConstellationId
      /** Which owned constellation to discard when already at the limit (GDD 6). */
      readonly replaces: ConstellationId | null
    }

/** Everything a player carries between rounds. */
export interface Loadout {
  readonly deck: readonly Chip[]
  readonly constellations: readonly ConstellationId[]
  readonly stardust: number
  readonly drifterOwned: boolean
  readonly nextChipId: number
  /** Optional until companions become purchasable at P4 (GDD 7-1-b). */
  readonly companions?: readonly CompanionId[]
}

/**
 * GDD 13-5: the loadout a game opens with. `starting` is the player's pick from
 * STARTING_CONSTELLATION_CHOICES and takes one of the four constellation slots,
 * so R1 already has a line to build toward.
 */
export function createStartingLoadout(starting: ConstellationId): Loadout {
  return {
    deck: createInitialDeck(),
    constellations: [starting],
    stardust: 0,
    drifterOwned: false,
    nextChipId: 0,
  }
}

/** Draws one tier by the published weights (GDD 7-1), then a companion of that tier. */
function rollCompanions(owned: readonly CompanionId[], rng: Rng): CompanionId[] {
  const total = Object.values(COMPANION_TIER_WEIGHTS).reduce((a, b) => a + b, 0)
  const picked: CompanionId[] = []

  while (picked.length < SHOP_SLOTS.companions) {
    let roll = rng() * total
    let tier: CompanionTier = 'rare'
    for (const [name, weight] of Object.entries(COMPANION_TIER_WEIGHTS)) {
      roll -= weight
      if (roll < 0) {
        tier = name as CompanionTier
        break
      }
    }
    const pool = COMPANION_IDS.filter(
      (id) => COMPANIONS[id].tier === tier && !owned.includes(id) && !picked.includes(id),
    )
    if (pool.length === 0) break
    picked.push(pool[Math.floor(rng() * pool.length)])
  }
  return picked
}

/**
 * GDD 9-3: 4 specials of 10, 2 constellations of 12.
 * Constellations already owned are excluded so a slot is never wasted.
 */
export function rollStock(loadout: Loadout, rng: Rng): ShopStock {
  return {
    specials: sample(SPECIAL_SUIT_PAIRS, SHOP_SLOTS.specialChips, rng),
    constellations: sample(
      ALL_CONSTELLATIONS.filter((id) => !loadout.constellations.includes(id)),
      SHOP_SLOTS.constellations,
      rng,
    ),
    companions: COMPANIONS_STOCKED ? rollCompanions(loadout.companions ?? [], rng) : [],
  }
}

/**
 * GDD 13-4: иєвυℓα hands the drifter over at the first meeting rather than selling
 * it. Priced at 10 it was bought by 98.6% of runs on the first visit and the rest
 * never cleared, so the choice was fiction; free, the stardust goes to real
 * decisions and DRIFT ORACLE reaches every player.
 */
export function grantDrifter(loadout: Loadout): Loadout {
  if (loadout.drifterOwned) return loadout
  return {
    ...loadout,
    deck: [...loadout.deck, { id: `gift-${loadout.nextChipId}`, kind: 'drifter' }],
    drifterOwned: true,
    nextChipId: loadout.nextChipId + 1,
  }
}

export function priceOf(purchase: Purchase): number {
  switch (purchase.kind) {
    case 'addBasic':
      return SHOP_PRICES.addBasicChip
    case 'removeBasic':
      return SHOP_PRICES.removeBasicChip
    case 'special':
      return SHOP_PRICES.specialChip
    case 'constellation':
      return SHOP_PRICES.constellation
  }
}

export function rerollPrice(timesUsed: number): number {
  return SHOP_PRICES.rerollBase + timesUsed * SHOP_PRICES.rerollIncrement
}

export function canAfford(loadout: Loadout, purchase: Purchase): boolean {
  return loadout.stardust >= priceOf(purchase)
}

/**
 * Takes what was just bought off the shelf. A slot holds one item and sells it
 * once; the next one costs a reroll.
 *
 * This is a rule, not a display choice, which is why it is here and not in the
 * screen that draws the shelf. P2-B measured the target curve against a shop
 * policy that buys each stocked item at most once (`sim/player.ts`), so a shelf
 * that refilled itself for free would let a player past a target the curve was
 * never checked against.
 *
 * The basic chips are not a slot: GDD 9-3 lists add and remove as standing
 * offers, so they survive every purchase.
 */
export function soldOut(stock: ShopStock, purchase: Purchase): ShopStock {
  switch (purchase.kind) {
    case 'special': {
      const [left, right] = purchase.pair
      return {
        ...stock,
        specials: stock.specials.filter((pair) => pair[0] !== left || pair[1] !== right),
      }
    }
    case 'constellation':
      return { ...stock, constellations: stock.constellations.filter((id) => id !== purchase.id) }
    case 'addBasic':
    case 'removeBasic':
      return stock
  }
}


/** Applies a purchase the caller has already confirmed with `canAfford`. */
export function applyPurchase(loadout: Loadout, purchase: Purchase): Loadout {
  const paid = { ...loadout, stardust: loadout.stardust - priceOf(purchase) }
  const id = `shop-${loadout.nextChipId}`

  switch (purchase.kind) {
    case 'addBasic':
      return {
        ...paid,
        deck: [...paid.deck, { id, kind: 'basic', suit: purchase.suit }],
        nextChipId: paid.nextChipId + 1,
      }
    case 'removeBasic': {
      const index = paid.deck.findIndex(
        (chip) => chip.kind === 'basic' && chip.suit === purchase.suit,
      )
      if (index < 0) return loadout
      return { ...paid, deck: [...paid.deck.slice(0, index), ...paid.deck.slice(index + 1)] }
    }
    case 'special':
      return {
        ...paid,
        deck: [
          ...paid.deck,
          { id, kind: 'special', left: purchase.pair[0], right: purchase.pair[1] },
        ],
        nextChipId: paid.nextChipId + 1,
      }
    case 'constellation': {
      if (paid.constellations.includes(purchase.id)) return loadout
      // GDD 6 holds the limit at 4, and GDD 13-6 measured the target curve on
      // that. A fifth card has to name one of the four it replaces; anything
      // else is refused, which by `buy`'s rule costs nothing and sells nothing.
      const atLimit = paid.constellations.length >= OWNED_CONSTELLATION_LIMIT
      const validReplace =
        purchase.replaces != null && paid.constellations.includes(purchase.replaces)
      if (atLimit && !validReplace) return loadout
      const kept = atLimit
        ? paid.constellations.filter((id) => id !== purchase.replaces)
        : paid.constellations
      return { ...paid, constellations: [...kept, purchase.id] }
    }
  }
}
