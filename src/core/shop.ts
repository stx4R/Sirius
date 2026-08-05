// иєвυℓα's shop (GDD 9-2, 9-3). Stock rolling and purchase effects.
//
// The companion slot exists but stays empty while COMPANIONS_ENABLED is false:
// their effect parameters arrive at P4 (GDD 7-1-b), so selling them now would
// only drain stardust for nothing.

import {
  COMPANIONS,
  COMPANIONS_ENABLED,
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
  /** Empty until COMPANIONS_ENABLED (GDD 7-1-b). */
  readonly companions: readonly CompanionId[]
}

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
    companions: COMPANIONS_ENABLED ? rollCompanions(loadout.companions ?? [], rng) : [],
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
      const kept =
        paid.constellations.length < OWNED_CONSTELLATION_LIMIT
          ? paid.constellations
          : paid.constellations.filter((id) => id !== purchase.replaces)
      return { ...paid, constellations: [...kept, purchase.id] }
    }
  }
}
