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
  soldOut,
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

  // GDD 6's holding limit is an invariant, not a shop-screen convention: 13-6
  // measured the whole target curve against four slots. Written over *every*
  // purchase kind rather than the constellation branch alone, so a new
  // `Purchase` variant — P4-B's companion — lands in the same net.
  it('never lets the loadout pass the constellation limit, whatever is bought', () => {
    const owned = ALL_CONSTELLATIONS.slice(0, OWNED_CONSTELLATION_LIMIT)
    const unowned = ALL_CONSTELLATIONS.slice(OWNED_CONSTELLATION_LIMIT)

    // Keyed by kind, so adding a `Purchase` variant fails to compile until it
    // is listed here and therefore exercised.
    const byKind: Record<Purchase['kind'], readonly Purchase[]> = {
      addBasic: [{ kind: 'addBasic', suit: 'GAC' }],
      removeBasic: [{ kind: 'removeBasic', suit: 'GAC' }],
      special: [{ kind: 'special', pair: SPECIAL_SUIT_PAIRS[0] }],
      constellation: [
        // No replacement named; a card held, named to replace; and a card the
        // player does not hold, named to replace.
        ...unowned.map((id): Purchase => ({ kind: 'constellation', id, replaces: null })),
        ...unowned.map((id): Purchase => ({ kind: 'constellation', id, replaces: owned[0] })),
        ...unowned.map((id): Purchase => ({ kind: 'constellation', id, replaces: unowned[0] })),
      ],
    }
    const everyPurchase = Object.values(byKind).flat()

    // Each one on its own, against a loadout already at the limit...
    for (const purchase of everyPurchase) {
      const after = applyPurchase(loadout({ constellations: owned }), purchase)
      expect(after.constellations.length, JSON.stringify(purchase)).toBeLessThanOrEqual(
        OWNED_CONSTELLATION_LIMIT,
      )
    }

    // ...and all of them in a row from empty, so the limit is crossed mid-run.
    const end = everyPurchase.reduce<Loadout>(
      (current, purchase) => applyPurchase(current, purchase),
      loadout({ constellations: [], stardust: 1000 }),
    )
    expect(end.constellations.length).toBeLessThanOrEqual(OWNED_CONSTELLATION_LIMIT)
    expect(new Set(end.constellations).size).toBe(end.constellations.length)
  })

  it('refuses a fifth constellation when no held card is named to replace', () => {
    const owned = ALL_CONSTELLATIONS.slice(0, OWNED_CONSTELLATION_LIMIT)
    const before = loadout({ constellations: owned, stardust: 40 })

    for (const replaces of [null, ALL_CONSTELLATIONS[OWNED_CONSTELLATION_LIMIT + 1]]) {
      const after = applyPurchase(before, {
        kind: 'constellation',
        id: ALL_CONSTELLATIONS[OWNED_CONSTELLATION_LIMIT],
        replaces,
      })

      // The same loadout back: `buy` reads that as a refusal and leaves both the
      // purse and the shelf alone (GDD 9-3).
      expect(after).toBe(before)
    }
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

  // A shelf slot holds one item and sells it once (core/shop.ts). P2-B's shop
  // policy buys each stocked item at most once, so a shelf that refilled itself
  // would put the player past targets that curve was never measured against.
  it('takes a bought special off the shelf and leaves the rest', () => {
    const stock = rollStock(loadout(), mulberry32(2))
    const sold = stock.specials[1]

    const after = soldOut(stock, { kind: 'special', pair: sold })

    expect(after.specials).toHaveLength(stock.specials.length - 1)
    expect(after.specials.some((pair) => pair[0] === sold[0] && pair[1] === sold[1])).toBe(false)
    expect(after.constellations).toEqual(stock.constellations)
  })

  it('takes a bought constellation off the shelf', () => {
    const stock = rollStock(loadout(), mulberry32(2))
    const sold = stock.constellations[0]

    const after = soldOut(stock, { kind: 'constellation', id: sold, replaces: null })

    expect(after.constellations).not.toContain(sold)
    expect(after.specials).toEqual(stock.specials)
  })

  // GDD 9-3 lists add and remove as standing offers rather than slots.
  it('keeps the basic chip offers up no matter how often they are used', () => {
    const stock = rollStock(loadout(), mulberry32(2))

    const after = soldOut(soldOut(stock, { kind: 'addBasic', suit: 'GAC' }), {
      kind: 'removeBasic',
      suit: 'GAC',
    })

    expect(after).toEqual(stock)
  })

  it('sells nothing when the purse cannot reach it', () => {
    const game = openShop(fromLoadout(loadout({ stardust: 0 }), 'full', mulberry32(4)))
    const pair = game.stock!.specials[0]

    const after = buy(game, { kind: 'special', pair })

    expect(after).toBe(game)
    expect(after.stock!.specials).toHaveLength(SHOP_SLOTS.specialChips)
  })

  // `applyPurchase` refuses a constellation already held. Nothing is paid, so
  // nothing may leave the shelf either.
  it('keeps a refused purchase on the shelf', () => {
    const game = openShop(fromLoadout(loadout({ stardust: 100 }), 'full', mulberry32(6)))
    const id = game.stock!.constellations[0]
    const owned = buy(game, { kind: 'constellation', id, replaces: null })

    const again = buy({ ...owned, stock: game.stock }, { kind: 'constellation', id, replaces: null })

    expect(again.stardust).toBe(owned.stardust)
    expect(again.stock!.constellations).toContain(id)
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
// GDD 6: a fifth constellation has to replace one of the four held, so the shop
// asks which. Either answer has to leave the run intact.
//
// These are core tests, not UI tests, because GDD 9-3 puts the policy in core on
// purpose: "구매가 거절되면 스타더스트를 쓰지 않았으므로 진열에도 그대로 남는다".
// The screen's cancel button is only the thing that decides *whether* to call
// `buy` — what must hold after it is a property of `Game`.
describe('replacing a constellation at the ownership limit (GDD 6)', () => {
  const OWNED = ALL_CONSTELLATIONS.slice(0, OWNED_CONSTELLATION_LIMIT)

  /** A shop visit with the shelf rolled, four constellations held and a full purse. */
  function atTheLimit(seed = 6) {
    const game = openShop(
      fromLoadout(
        loadout({ constellations: [...OWNED], stardust: 40 }),
        'full',
        mulberry32(seed),
      ),
    )
    const incoming = game.stock!.constellations.find((id) => !OWNED.includes(id))
    expect(incoming, 'the shelf must offer something not already held').toBeDefined()
    return { game, incoming: incoming! }
  }

  /** Everything a purchase could move, in one comparable value. */
  const snapshot = (game: ReturnType<typeof atTheLimit>['game']) =>
    JSON.stringify({
      stardust: game.stardust,
      constellations: game.ownedConstellations,
      deck: game.ownedDeck.map((chip) => chip.id),
      nextChipId: game.nextChipId,
      stock: game.stock,
      rerollsUsed: game.rerollsUsed,
    })

  // Cancelling means core is never asked, so the invariant is that the state the
  // prompt opened over is still exactly there — including the shelf, which a
  // half-applied purchase would have thinned.
  it('leaves everything untouched when the choice is cancelled', () => {
    const { game } = atTheLimit()
    const before = snapshot(game)

    // The screen opens the prompt, the player backs out: no core call happens.
    expect(snapshot(game)).toBe(before)
    expect(game.stardust).toBe(40)
    expect(game.ownedConstellations).toEqual(OWNED)
    expect(game.stock!.constellations).toHaveLength(SHOP_SLOTS.constellations)
    expect(game.stock!.specials).toHaveLength(SHOP_SLOTS.specialChips)
  })

  // The same invariant, but reached through core rather than around it: core
  // refuses a constellation already held, and a refusal must cost nothing and
  // sell nothing (GDD 9-3).
  it('spends nothing and sells nothing when core refuses the purchase', () => {
    const { game } = atTheLimit()
    const before = snapshot(game)

    const after = buy(game, { kind: 'constellation', id: OWNED[0], replaces: OWNED[1] })

    expect(snapshot(after)).toBe(before)
    expect(after.stardust).toBe(40)
    expect(after.ownedConstellations).toEqual(OWNED)
  })

  it('does not drift when the player backs out over and over', () => {
    const { game, incoming } = atTheLimit()
    const before = snapshot(game)

    let current = game
    for (let attempt = 0; attempt < 5; attempt++) {
      // Each round trip is: open the prompt, refuse, and — the case that does
      // reach core — try something core will not apply.
      current = buy(current, { kind: 'constellation', id: OWNED[attempt % OWNED.length], replaces: null })
      expect(snapshot(current), `after ${attempt + 1} cancels`).toBe(before)
    }

    // And the run is still able to complete the purchase afterwards.
    const done = buy(current, { kind: 'constellation', id: incoming, replaces: OWNED[0] })
    expect(done.ownedConstellations).toContain(incoming)
  })

  it('swaps exactly one card out when the choice is confirmed', () => {
    const { game, incoming } = atTheLimit()
    const discarded = OWNED[2]

    const after = buy(game, { kind: 'constellation', id: incoming, replaces: discarded })

    expect(after.stardust).toBe(40 - SHOP_PRICES.constellation)
    expect(after.ownedConstellations).toHaveLength(OWNED_CONSTELLATION_LIMIT)
    expect(after.ownedConstellations).toContain(incoming)
    // Gone from the loadout entirely — not merely absent from the visible four.
    expect(after.ownedConstellations).not.toContain(discarded)
    expect(JSON.stringify(after)).not.toContain(`"${discarded}"`)
    // The slot sold (GDD 9-3), and the rest of the shelf did not move.
    expect(after.stock!.constellations).not.toContain(incoming)
    expect(after.stock!.specials).toEqual(game.stock!.specials)
  })
})

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
    const constellationCounts: number[] = []

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
        // The screen asks which card a fifth one replaces, so the walk answers
        // the way the screen does. `null` at the limit is refused outright
        // (core/shop.ts), which would quietly turn this into a walk that buys
        // nothing once four are held.
        const held = game.ownedConstellations
        const replaces = held.length >= OWNED_CONSTELLATION_LIMIT ? held[0] : null
        game = buy(game, { kind: 'constellation', id, replaces })
        constellationCounts.push(game.ownedConstellations.length)
      }
      seen.push(game.ownedCompanions.length)
    }

    expect(seen.length).toBeGreaterThan(0)
    expect(new Set(seen)).toEqual(new Set([0]))
    // The seal is about companions, but the same walk is the only place a real
    // run's purchases are applied in sequence, so GDD 6's limit rides along.
    expect(constellationCounts.length).toBeGreaterThan(0)
    for (const count of constellationCounts) {
      expect(count).toBeLessThanOrEqual(OWNED_CONSTELLATION_LIMIT)
    }
  })
})
