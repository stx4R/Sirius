// P3-B: the store drives a real playthrough. These are the checks a browser
// cannot make cheaply — that the store defers to core for every rule, and that a
// round can actually be played from the first draw to the target check.

import { describe, expect, it } from 'vitest'
import { occupiedPositions, position } from '../src/core/board'
import {
  BOARD_SIZE,
  MAX_PLACEMENTS_PER_TURN,
  OWNED_CONSTELLATION_LIMIT,
  SHOP_PRICES,
  SHOP_SLOTS,
  TURNS_PER_ROUND,
} from '../src/core/config'
import { ALL_CONSTELLATIONS } from '../src/core/shop'
import type { ConstellationId, Position } from '../src/core/types'
import { useGame } from '../src/store/gameStore'
import { stepsOf } from '../src/ui/Settlement'

const store = () => useGame.getState()

/** First empty cell in reading order. */
function firstFree(): Position | null {
  const { board } = store().game
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === null) return position(row, col)
    }
  }
  return null
}

/** Places `count` chips from the hand, as a player clicking would. */
function placeChips(count: number): number {
  let placed = 0
  for (let i = 0; i < count; i++) {
    const { game } = store()
    const chip = game.hand[0]
    const cell = firstFree()
    if (chip === undefined || cell === null) break
    const before = store().staged.length
    store().select(chip)
    store().placeAt(cell)
    if (store().staged.length > before) placed++
  }
  return placed
}

describe('placement', () => {
  it('picks a chip up and puts it back down', () => {
    store().newGame(7)
    const chip = store().game.hand[0]

    store().select(chip)
    expect(store().selected?.id).toBe(chip.id)

    store().select(chip)
    expect(store().selected).toBeNull()
  })

  it('puts the chip on the board and takes it out of the hand', () => {
    store().newGame(7)
    const handSize = store().game.hand.length

    expect(placeChips(1)).toBe(1)
    expect(store().game.hand).toHaveLength(handSize - 1)
    expect(occupiedPositions(store().game.board)).toHaveLength(1)
  })

  it('lets core refuse the fifth placement of a turn (GDD 4-2)', () => {
    store().newGame(7)

    // The store stages placements and replays the whole list through core, so
    // the per-turn limit is core's to enforce and cannot be walked around by
    // placing one chip at a time.
    expect(placeChips(MAX_PLACEMENTS_PER_TURN + 3)).toBe(MAX_PLACEMENTS_PER_TURN)
    expect(occupiedPositions(store().game.board)).toHaveLength(MAX_PLACEMENTS_PER_TURN)
  })

  it('refuses a cell that is already taken', () => {
    store().newGame(7)
    placeChips(1)
    const taken = position(0, 0)

    store().select(store().game.hand[0])
    store().placeAt(taken)

    expect(store().staged).toHaveLength(1)
  })
})

describe('turn and round', () => {
  it('settles the turn and hands out the score core computed', () => {
    store().newGame(7)
    placeChips(MAX_PLACEMENTS_PER_TURN)
    store().commitTurn()

    const settlement = store().settlement
    expect(settlement).not.toBeNull()
    expect(settlement!.awarded).toBeGreaterThan(0)
    expect(store().game.roundScore).toBe(settlement!.awarded)
  })

  it('breaks the settlement into steps that add up to what was awarded', () => {
    store().newGame(7)
    placeChips(MAX_PLACEMENTS_PER_TURN)
    store().commitTurn()
    const settlement = store().settlement!

    // No drifter is in play, so the breakdown is exact rather than one sample.
    expect(settlement.exact).toBe(true)
    // The settlement screen prints the suit columns as an equation, so the beats
    // it walks have to add up to the score core handed out (GDD 5-1).
    const shown = stepsOf(settlement).reduce((total, step) => total + step.total, 0)
    expect(shown).toBe(settlement.awarded)
  })

  // GDD 4-1 has `endTurn` advance the turn counter, so by the time the settlement
  // is on screen `game.turn` already names the *next* turn. The snapshot is what
  // the header reads from; core's transitions are untouched.
  it('remembers which turn is being settled, not the one core moved on to', () => {
    store().newGame(7)

    for (let turn = 1; turn <= 3; turn++) {
      expect(store().game.turn).toBe(turn)
      placeChips(MAX_PLACEMENTS_PER_TURN)
      store().commitTurn()

      const settlement = store().settlement!
      expect(settlement.turn).toBe(turn)
      expect(store().game.turn).toBe(turn + 1)

      store().dismissSettlement()
    }
  })

  it('snapshots the round score the settled turn started from', () => {
    store().newGame(7)
    placeChips(MAX_PLACEMENTS_PER_TURN)
    store().commitTurn()
    expect(store().settlement!.roundScoreBefore).toBe(0)

    store().dismissSettlement()
    const carried = store().game.roundScore

    placeChips(MAX_PLACEMENTS_PER_TURN)
    store().commitTurn()
    const second = store().settlement!
    expect(second.roundScoreBefore).toBe(carried)
    // What the big figure counts up to is where the round actually stands.
    expect(second.roundScoreBefore + second.awarded).toBe(store().game.roundScore)
  })

  it('plays a full round of five turns and stops in the shop', () => {
    store().newGame(7)

    for (let turn = 0; turn < TURNS_PER_ROUND; turn++) {
      expect(store().game.turn).toBe(turn + 1)
      placeChips(MAX_PLACEMENTS_PER_TURN)
      store().commitTurn()
      store().dismissSettlement()
    }

    // Five turns of four chips fill twenty of the twenty-five cells (GDD 4-2),
    // which clears round one. From P4-A that lands in иєвυℓα's shop and waits
    // there — dismissing the settlement no longer walks straight on into round 2.
    const shop = store().game
    expect(shop.status).toBe('playing')
    expect(shop.phase).toBe('shop')
    expect(shop.round).toBe(2)
    expect(shop.stock).not.toBeNull()
    expect(shop.hand).toHaveLength(0)

    store().leaveShop()

    const { game } = store()
    expect(game.phase).toBe('placing')
    expect(game.round).toBe(2)
    expect(game.turn).toBe(1)
    expect(game.roundScore).toBe(0)
    expect(game.hand.length).toBeGreaterThan(0)
    expect(occupiedPositions(game.board)).toHaveLength(0)
  })

  it('hands over the drifter on arrival at the shop (GDD 13-4)', () => {
    store().newGame(7)
    expect(store().game.drifterOwned).toBe(false)

    for (let turn = 0; turn < TURNS_PER_ROUND; turn++) {
      placeChips(MAX_PLACEMENTS_PER_TURN)
      store().commitTurn()
      store().dismissSettlement()
    }

    // The gift is `openShop`'s, so it happens as the screen opens rather than
    // when the player leaves — it is in the deck for anything bought after it.
    expect(store().game.drifterOwned).toBe(true)
    expect(store().game.ownedDeck.filter((chip) => chip.kind === 'drifter')).toHaveLength(1)
  })

  it('ends the game when a round misses its target', () => {
    store().newGame(7)
    // Nothing placed for five turns scores nothing, which cannot reach round 1.
    for (let turn = 0; turn < TURNS_PER_ROUND; turn++) {
      store().commitTurn()
      store().dismissSettlement()
    }

    expect(store().game.status).toBe('gameOver')
    expect(store().game.roundScore).toBeLessThan(store().game.targetScore)
  })
})

// P4-A: the shop is a screen the run stops at. These check that the screen's
// three verbs go through core and come back with core's answer — the buttons
// decide nothing (CLAUDE.md §5).
describe('the shop (GDD 9-3)', () => {
  /** Clears round 1 the way a player would, which is what opens the shop. */
  function reachShop(stardust: number): void {
    store().newGame(7)
    for (let turn = 0; turn < TURNS_PER_ROUND; turn++) {
      placeChips(MAX_PLACEMENTS_PER_TURN)
      store().commitTurn()
      store().dismissSettlement()
    }
    expect(store().game.phase).toBe('shop')
    store().devSet((game) => ({ ...game, stardust }))
  }

  it('charges for a special and takes it off the shelf', () => {
    reachShop(40)
    const pair = store().game.stock!.specials[0]

    store().buyItem({ kind: 'special', pair })

    const { game } = store()
    expect(game.stardust).toBe(40 - SHOP_PRICES.specialChip)
    expect(game.ownedDeck.filter((chip) => chip.kind === 'special')).toHaveLength(1)
    // A slot sells once. Leaving it on the shelf would let a full purse buy the
    // same chip four times over, which is not what P2-B measured (core/shop.ts).
    expect(game.stock!.specials.some((p) => p[0] === pair[0] && p[1] === pair[1])).toBe(false)
    expect(game.stock!.specials).toHaveLength(SHOP_SLOTS.specialChips - 1)
  })

  it('leaves the shelf alone when the purse cannot reach', () => {
    reachShop(SHOP_PRICES.specialChip - 1)
    const pair = store().game.stock!.specials[0]

    store().buyItem({ kind: 'special', pair })

    expect(store().game.stardust).toBe(SHOP_PRICES.specialChip - 1)
    expect(store().game.stock!.specials).toHaveLength(SHOP_SLOTS.specialChips)
  })

  it('swaps a constellation out at the ownership limit (GDD 6)', () => {
    reachShop(40)
    const owned = ALL_CONSTELLATIONS.slice(0, OWNED_CONSTELLATION_LIMIT)
    store().devSet((game) => ({ ...game, stardust: 40, ownedConstellations: [...owned] }))

    const incoming = store().game.stock!.constellations.find((id) => !owned.includes(id))
    expect(incoming).toBeDefined()
    store().buyItem({ kind: 'constellation', id: incoming!, replaces: owned[0] })

    const { game } = store()
    expect(game.ownedConstellations).toHaveLength(OWNED_CONSTELLATION_LIMIT)
    expect(game.ownedConstellations).toContain(incoming)
    expect(game.ownedConstellations).not.toContain(owned[0])
  })

  it('adds and removes basic chips at the listed prices (GDD 9-2)', () => {
    reachShop(40)
    const held = () => store().game.ownedDeck.length

    const before = held()
    store().buyItem({ kind: 'addBasic', suit: 'GAC' })
    expect(held()).toBe(before + 1)
    expect(store().game.stardust).toBe(40 - SHOP_PRICES.addBasicChip)

    store().buyItem({ kind: 'removeBasic', suit: 'GAC' })
    expect(held()).toBe(before)
    expect(store().game.stardust).toBe(40 - SHOP_PRICES.addBasicChip - SHOP_PRICES.removeBasicChip)
  })

  it('rerolls the shelf and raises the price each time (GDD 9-2)', () => {
    reachShop(40)

    store().rerollStock()
    expect(store().game.rerollsUsed).toBe(1)
    expect(store().game.stardust).toBe(40 - SHOP_PRICES.rerollBase)

    store().rerollStock()
    expect(store().game.rerollsUsed).toBe(2)
    expect(store().game.stardust).toBe(
      40 - SHOP_PRICES.rerollBase - (SHOP_PRICES.rerollBase + SHOP_PRICES.rerollIncrement),
    )
  })

  it('carries what was bought into the next round and resets the rerolls', () => {
    reachShop(40)
    const pair = store().game.stock!.specials[0]
    store().buyItem({ kind: 'special', pair })
    store().rerollStock()

    store().leaveShop()

    const { game } = store()
    expect(game.round).toBe(2)
    expect(game.rerollsUsed).toBe(0)
    expect(game.stock).toBeNull()
    // `startRound` rebuilds the draw pile from the owned deck, so the purchase is
    // in play immediately rather than from the round after (GDD 4-2).
    expect(game.deck.concat(game.hand).filter((chip) => chip.kind === 'special')).toHaveLength(1)
  })
})

describe('constellations change the score', () => {
  it('scores more with a constellation held than without', () => {
    // The dev panel exists so this is visible by hand; here it is measured.
    const scoreWith = (owned: readonly ConstellationId[]) => {
      store().newGame(7)
      store().devSet((game) => ({ ...game, ownedConstellations: [...owned] }))

      // A column of one suit, so aries' vertical run of three can form.
      const opener = store().game.hand.find((chip) => chip.kind === 'basic')
      expect(opener?.kind).toBe('basic')
      const suit = opener?.kind === 'basic' ? opener.suit : null

      for (let row = 0; row < MAX_PLACEMENTS_PER_TURN; row++) {
        const chip = store().game.hand.find(
          (candidate) => candidate.kind === 'basic' && candidate.suit === suit,
        )
        if (chip === undefined) break
        store().select(chip)
        store().placeAt(position(row, 0))
      }
      store().commitTurn()
      return store().settlement!.awarded
    }

    expect(scoreWith(['aries'])).toBeGreaterThan(scoreWith([]))
  })
})
