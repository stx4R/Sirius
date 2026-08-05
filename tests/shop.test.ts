import { describe, expect, it } from 'vitest'
import {
  COMPANIONS_ENABLED,
  OWNED_CONSTELLATION_LIMIT,
  SHOP_PRICES,
  SHOP_SLOTS,
  SPECIAL_SUIT_PAIRS,
} from '../src/core/config'
import { createInitialDeck } from '../src/core/deck'
import { mulberry32 } from '../src/core/rng'
import {
  ALL_CONSTELLATIONS,
  applyPurchase,
  canAfford,
  grantDrifter,
  rerollPrice,
  rollStock,
} from '../src/core/shop'
import type { Loadout } from '../src/core/shop'
import type { Chip } from '../src/core/types'

const loadout = (over: Partial<Loadout> = {}): Loadout => ({
  deck: createInitialDeck(),
  constellations: [],
  stardust: 100,
  drifterOwned: false,
  nextChipId: 0,
  ...over,
})

describe('shop stock', () => {
  it('stocks exactly the slot counts from config', () => {
    const stock = rollStock(loadout(), mulberry32(1))

    expect(stock.specials).toHaveLength(SHOP_SLOTS.specialChips)
    expect(stock.constellations).toHaveLength(SHOP_SLOTS.constellations)
  })

  it('draws distinct specials from the 10 pairs', () => {
    const stock = rollStock(loadout(), mulberry32(7))
    const keys = stock.specials.map((pair) => pair.join('&'))

    expect(new Set(keys).size).toBe(keys.length)
    for (const pair of stock.specials) {
      expect(SPECIAL_SUIT_PAIRS.some((p) => p[0] === pair[0] && p[1] === pair[1])).toBe(true)
    }
  })

  it('never stocks a constellation the player already owns', () => {
    const owned = ALL_CONSTELLATIONS.slice(0, 4)

    for (let seed = 0; seed < 40; seed++) {
      const stock = rollStock(loadout({ constellations: owned }), mulberry32(seed))
      expect(stock.constellations.some((id) => owned.includes(id))).toBe(false)
      expect(new Set(stock.constellations).size).toBe(stock.constellations.length)
    }
  })

  it('never stocks the drifter — it is a gift, not merchandise (GDD 13-4)', () => {
    expect(rollStock(loadout(), mulberry32(3))).not.toHaveProperty('drifter')
  })

  it('leaves the companion slot empty while companions are disabled', () => {
    expect(COMPANIONS_ENABLED).toBe(false)
    expect(rollStock(loadout(), mulberry32(5)).companions).toEqual([])
  })

  it('raises the reroll price by one per use', () => {
    expect(rerollPrice(0)).toBe(SHOP_PRICES.rerollBase)
    expect(rerollPrice(1)).toBe(SHOP_PRICES.rerollBase + 1)
    expect(rerollPrice(2)).toBe(SHOP_PRICES.rerollBase + 2)
    expect(rerollPrice(5)).toBe(SHOP_PRICES.rerollBase + 5)
  })
})

describe('purchases', () => {
  it('charges the listed price and adds the chip', () => {
    const before = loadout({ stardust: 10 })

    const after = applyPurchase(before, { kind: 'special', pair: ['GAC', 'IMA'] })

    expect(after.stardust).toBe(10 - SHOP_PRICES.specialChip)
    expect(after.deck).toHaveLength(before.deck.length + 1)
    expect(after.deck[after.deck.length - 1]).toMatchObject({
      kind: 'special',
      left: 'GAC',
      right: 'IMA',
    })
  })

  it('grants the drifter free, and only once (GDD 13-4)', () => {
    const after = grantDrifter(loadout({ stardust: 7 }))

    expect(after.drifterOwned).toBe(true)
    expect(after.stardust).toBe(7)
    expect(after.deck.filter((chip) => chip.kind === 'drifter')).toHaveLength(1)
    expect(grantDrifter(after)).toBe(after)
  })

  it('removes exactly one basic chip of the chosen suit', () => {
    const before = loadout()

    const after = applyPurchase(before, { kind: 'removeBasic', suit: 'GIN' })

    const count = (deck: readonly Chip[]) =>
      deck.filter((chip) => chip.kind === 'basic' && chip.suit === 'GIN').length
    expect(count(after.deck)).toBe(count(before.deck) - 1)
    expect(after.deck).toHaveLength(before.deck.length - 1)
  })

  it('swaps out the named constellation once at the ownership limit', () => {
    const owned = ALL_CONSTELLATIONS.slice(0, OWNED_CONSTELLATION_LIMIT)
    const incoming = ALL_CONSTELLATIONS[OWNED_CONSTELLATION_LIMIT]

    const after = applyPurchase(loadout({ constellations: owned }), {
      kind: 'constellation',
      id: incoming,
      replaces: owned[0],
    })

    expect(after.constellations).toHaveLength(OWNED_CONSTELLATION_LIMIT)
    expect(after.constellations).toContain(incoming)
    expect(after.constellations).not.toContain(owned[0])
  })

  it('keeps every constellation while below the limit', () => {
    const owned = ALL_CONSTELLATIONS.slice(0, 2)

    const after = applyPurchase(loadout({ constellations: owned }), {
      kind: 'constellation',
      id: ALL_CONSTELLATIONS[5],
      replaces: null,
    })

    expect(after.constellations).toHaveLength(3)
  })

  it('reports affordability against the price list', () => {
    const pair = SPECIAL_SUIT_PAIRS[0]

    expect(canAfford(loadout({ stardust: SHOP_PRICES.specialChip }), { kind: 'special', pair })).toBe(
      true,
    )
    expect(
      canAfford(loadout({ stardust: SHOP_PRICES.specialChip - 1 }), { kind: 'special', pair }),
    ).toBe(false)
  })
})
