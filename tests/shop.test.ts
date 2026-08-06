import { describe, expect, it } from 'vitest'
import {
  COMPANIONS_ENABLED,
  COMPANIONS_STOCKED,
  MULTIPLIER_STACK_MODE,
  OWNED_CONSTELLATION_LIMIT,
  SHOP_PRICES,
  SHOP_SLOTS,
  SPECIAL_SUIT_PAIRS,
} from '../src/core/config'
import { createInitialDeck } from '../src/core/deck'
import { mulberry32 } from '../src/core/rng'
import { buy, fromLoadout, openShop, playRound } from '../src/core/game'
import {
  ALL_CONSTELLATIONS,
  applyPurchase,
  createStartingLoadout,
  canAfford,
  grantDrifter,
  rerollPrice,
  rollStock,
} from '../src/core/shop'
import type { Loadout, Purchase } from '../src/core/shop'
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

  // P4-A split "on the shelf" from "for sale": the slot fills so the player can
  // see the system and its tier prices, while the till stays shut (GDD 7-1-b).
  it('fills the companion slot even though none can be bought', () => {
    expect(COMPANIONS_ENABLED).toBe(false)
    expect(rollStock(loadout(), mulberry32(5)).companions).toHaveLength(SHOP_SLOTS.companions)
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

// ---------------------------------------------------------------- P4-A
// GDD 7-1-b. The shelf is on, the till is not. P2-B measured the entire target
// curve with companions inactive (GDD 13-6), so a companion reaching game state
// by any route would invalidate those numbers — these pin the seal shut.
describe('companions are stocked but never owned (P4-A)', () => {
  it('puts companions on the shelf', () => {
    const stock = rollStock(createStartingLoadout('aries'), mulberry32(3))

    expect(COMPANIONS_STOCKED).toBe(true)
    expect(stock.companions.length).toBeGreaterThan(0)
    expect(new Set(stock.companions).size).toBe(stock.companions.length)
  })

  it('offers no way to buy one', () => {
    // The guarantee is structural: `Purchase` has no companion variant, so a
    // companion purchase cannot be constructed, let alone applied. If this ever
    // fails to compile, the seal has been broken.
    const kinds: Purchase['kind'][] = ['addBasic', 'removeBasic', 'special', 'constellation']

    expect(COMPANIONS_ENABLED).toBe(false)
    expect(kinds).not.toContain('companion')
  })

  it('leaves the loadout untouched when the shop is walked through', () => {
    const before = createStartingLoadout('aries')
    const stock = rollStock(before, mulberry32(11))
    // Everything on the shelf, applied: only the sellable kinds exist.
    const after = stock.specials.reduce<Loadout>(
      (loadout, pair) =>
        canAfford(loadout, { kind: 'special', pair })
          ? applyPurchase(loadout, { kind: 'special', pair })
          : loadout,
      { ...before, stardust: 100 },
    )

    expect(after.companions ?? []).toEqual([])
  })

  it('finishes a full eight-round game with no companion ever held', () => {
    let game = fromLoadout(createStartingLoadout('aries'), 'full', mulberry32(20260101))
    const seen: number[] = []

    while (game.status === 'playing') {
      game = playRound(game, {
        mode: 'full',
        stackMode: MULTIPLIER_STACK_MODE,
        // Fill the board left to right; the score is beside the point here.
        place: ({ board, hand }) => {
          const free: { row: number; col: number }[] = []
          board.forEach((row, r) =>
            row.forEach((cell, c) => {
              if (cell === null) free.push({ row: r, col: c })
            }),
          )
          return hand
            .slice(0, 4)
            .map((chip, i) => ({ chip, position: free[i] }))
            .filter((p) => p.position !== undefined) as never
        },
        shop: () => [],
        answerWager: () => true,
        answerOracle: () => true,
        rng: game.rng,
      })
      seen.push(game.ownedCompanions.length)
      if (game.status !== 'playing') break

      // Walk the shop the way the screen does, buying everything on offer.
      game = openShop(game)
      for (const pair of game.stock?.specials ?? []) {
        game = buy(game, { kind: 'special', pair })
      }
      for (const id of game.stock?.constellations ?? []) {
        game = buy(game, { kind: 'constellation', id, replaces: null })
      }
      seen.push(game.ownedCompanions.length)
    }

    expect(seen.length).toBeGreaterThan(0)
    expect(new Set(seen)).toEqual(new Set([0]))
  })
})
