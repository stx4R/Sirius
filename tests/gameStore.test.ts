// P3-B: the store drives a real playthrough. These are the checks a browser
// cannot make cheaply — that the store defers to core for every rule, and that a
// round can actually be played from the first draw to the target check.

import { describe, expect, it } from 'vitest'
import { occupiedPositions, position } from '../src/core/board'
import {
  BOARD_SIZE,
  MAX_PLACEMENTS_PER_TURN,
  MODE_PRESETS,
  OWNED_CONSTELLATION_LIMIT,
  SHOP_PRICES,
  SHOP_SLOTS,
  STARDUST_REWARDS,
  STARTING_CONSTELLATION_CHOICES,
  TURNS_PER_ROUND,
} from '../src/core/config'
import { ALL_CONSTELLATIONS } from '../src/core/shop'
import type { ConstellationId, Position } from '../src/core/types'
import { useGame } from '../src/store/gameStore'
import { stepsOf } from '../src/ui/Settlement'
import { boardFrom } from './helpers'

const store = () => useGame.getState()

/**
 * BOOTH-3b: GDD 8-2 puts a wager in front of every draw, so a hand only exists
 * once one has been answered. YES rather than 기권 because the first three of a
 * game are the tutorial and core refuses to waive them (`resolveWager`).
 */
function answerWager(): void {
  if (store().game.pendingWager === null) return
  store().answerWager('yes')
  // Reading the explanation is what deals the hand — see `dismissWager`.
  store().dismissWager()
}

/** A run and the opening wager that deals its first hand. */
function newGame(seed: number): void {
  store().newGame(seed)
  answerWager()
}

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
  // A turn opens on its wager (GDD 8-2), and the hand is behind it.
  answerWager()
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
    newGame(7)
    const chip = store().game.hand[0]

    store().select(chip)
    expect(store().selected?.id).toBe(chip.id)

    store().select(chip)
    expect(store().selected).toBeNull()
  })

  it('puts the chip on the board and takes it out of the hand', () => {
    newGame(7)
    const handSize = store().game.hand.length

    expect(placeChips(1)).toBe(1)
    expect(store().game.hand).toHaveLength(handSize - 1)
    expect(occupiedPositions(store().game.board)).toHaveLength(1)
  })

  it('lets core refuse the fifth placement of a turn (GDD 4-2)', () => {
    newGame(7)

    // The store stages placements and replays the whole list through core, so
    // the per-turn limit is core's to enforce and cannot be walked around by
    // placing one chip at a time.
    expect(placeChips(MAX_PLACEMENTS_PER_TURN + 3)).toBe(MAX_PLACEMENTS_PER_TURN)
    expect(occupiedPositions(store().game.board)).toHaveLength(MAX_PLACEMENTS_PER_TURN)
  })

  it('refuses a cell that is already taken', () => {
    newGame(7)
    placeChips(1)
    const taken = position(0, 0)

    store().select(store().game.hand[0])
    store().placeAt(taken)

    expect(store().staged).toHaveLength(1)
  })
})

describe('turn and round', () => {
  it('settles the turn and hands out the score core computed', () => {
    newGame(7)
    placeChips(MAX_PLACEMENTS_PER_TURN)
    store().commitTurn()

    const settlement = store().settlement
    expect(settlement).not.toBeNull()
    expect(settlement!.awarded).toBeGreaterThan(0)
    expect(store().game.roundScore).toBe(settlement!.awarded)
  })

  it('breaks the settlement into steps that add up to what was awarded', () => {
    newGame(7)
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
    newGame(7)

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
    newGame(7)
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
    newGame(7)

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

    // Leaving the shop starts the round on its wager, not on a hand (GDD 8-2).
    expect(store().game.pendingWager).not.toBeNull()
    expect(store().game.hand).toHaveLength(0)
    answerWager()

    const { game } = store()
    expect(game.phase).toBe('placing')
    expect(game.round).toBe(2)
    expect(game.turn).toBe(1)
    expect(game.roundScore).toBe(0)
    expect(game.hand.length).toBeGreaterThan(0)
    expect(occupiedPositions(game.board)).toHaveLength(0)
  })

  it('hands over the drifter on arrival at the shop (GDD 13-4)', () => {
    newGame(7)
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
    newGame(7)
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
    newGame(7)
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
      newGame(7)
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

// BOOTH-1: the title screen is what supplies the mode and the starting
// constellation. Both used to be constants in this file (`'full'` and `'aries'`),
// so what these check is that the player's two answers actually reach core.
describe('the title screen starts the run (GDD 12-3, 13-5)', () => {
  it('starts the run the mode says, and no other', () => {
    for (const mode of ['booth', 'full'] as const) {
      store().startRun({ mode, starting: STARTING_CONSTELLATION_CHOICES[0] })

      const { game } = store()
      expect(game.mode).toBe(mode)
      expect(game.targets).toEqual(MODE_PRESETS[mode].TARGET_SCORES)
      expect(game.targets).toHaveLength(MODE_PRESETS[mode].TOTAL_ROUNDS)
      expect(game.targetScore).toBe(MODE_PRESETS[mode].TARGET_SCORES[0])
    }

    // The two modes are the reason the choice exists: three rounds or eight.
    expect(MODE_PRESETS.booth.TOTAL_ROUNDS).toBe(3)
    expect(MODE_PRESETS.full.TOTAL_ROUNDS).toBe(8)
  })

  it('opens holding the constellation that was picked, whichever it was', () => {
    for (const starting of STARTING_CONSTELLATION_CHOICES) {
      store().startRun({ mode: 'booth', starting })

      // GDD 13-5: it fills one of the four slots, so R1 already has a line to
      // build toward. Exactly one — the rest are bought.
      expect(store().game.ownedConstellations).toEqual([starting])
    }
  })

  it('is up until a run is started, and comes back when one is abandoned', () => {
    store().toTitle()
    expect(store().started).toBe(false)

    store().startRun({ mode: 'booth', starting: STARTING_CONSTELLATION_CHOICES[1] })
    expect(store().started).toBe(true)

    // GDD 12-2 ④: one click resets the machine for the next participant.
    store().toTitle()
    expect(store().started).toBe(false)
  })

  // A restart from the dev panel replays the run that was chosen, rather than
  // falling back to whatever the store was seeded with.
  it('replays the chosen setup on a restart', () => {
    const starting = STARTING_CONSTELLATION_CHOICES[1]
    store().startRun({ mode: 'booth', starting })

    newGame(11)

    expect(store().game.mode).toBe('booth')
    expect(store().game.ownedConstellations).toEqual([starting])
  })

  /** Puts the run on its last turn of `round`, already at the target. */
  function atFinalTurnOf(round: number): void {
    store().devSet((game) => ({
      ...game,
      round,
      turn: TURNS_PER_ROUND,
      targetScore: game.targets[round - 1],
      roundScore: game.targets[round - 1],
    }))
  }

  // The whole point of the mode choice: booth stops after its third round where
  // full carries on to a fourth. Core owns the rule (`endRound`); this checks the
  // title's pick is what core is deciding it against.
  it('ends a booth run after its last round, where a full run goes on', () => {
    const booth = MODE_PRESETS.booth.TOTAL_ROUNDS

    store().startRun({ mode: 'booth', starting: STARTING_CONSTELLATION_CHOICES[0] })
    atFinalTurnOf(booth)
    store().commitTurn()
    store().dismissSettlement()

    expect(store().game.status).toBe('cleared')

    store().startRun({ mode: 'full', starting: STARTING_CONSTELLATION_CHOICES[0] })
    atFinalTurnOf(booth)
    store().commitTurn()
    store().dismissSettlement()

    // Same round, same score, longer mode — so it is the shop, not the end.
    expect(store().game.status).toBe('playing')
    expect(store().game.phase).toBe('shop')
    expect(store().game.round).toBe(booth + 1)
  })
})

// BOOTH-4b: GDD 8-3 puts DRIFT ORACLE between the end-turn button and the
// score, so the store has one more thing that can hold a settlement back. These
// are the same checks the wager modal gets: core decides whether to ask, and
// nothing is scored until the answer has been read.
describe('DRIFT ORACLE (GDD 8-3)', () => {
  const EMPTY = '.   .   .   .   .'

  /** Puts a fixed board under the turn in progress, as the dev panel would. */
  function withBoard(rows: readonly string[]): void {
    store().devSet((game) => ({ ...game, board: boardFrom(rows) }))
  }

  const drifterBoard = ['.   GAC .   .   .', 'IMA *   MIM .   .', '.   GAC .   .   .', EMPTY, EMPTY]

  it('stops the turn on the question instead of settling it', () => {
    newGame(7)
    withBoard(drifterBoard)
    store().commitTurn()

    expect(store().game.pendingOracle).not.toBeNull()
    expect(store().settlement).toBeNull()
    expect(store().game.roundScore).toBe(0)
  })

  it('settles only once the explanation has been read', () => {
    newGame(7)
    withBoard(drifterBoard)
    store().commitTurn()
    store().answerOracle(store().game.pendingOracle!.answer)

    // Answered, but the board has still not been scored.
    expect(store().game.pendingOracle).toBeNull()
    expect(store().oracleResult).not.toBeNull()
    expect(store().settlement).toBeNull()

    store().dismissOracle()

    expect(store().settlement).not.toBeNull()
    expect(store().oracleResult).toBeNull()
    expect(store().game.roundScore).toBeGreaterThan(0)
  })

  it('pays the stardust for a right answer and nothing for a wrong one', () => {
    newGame(7)
    withBoard(drifterBoard)
    store().commitTurn()

    const before = store().game.stardust
    const question = store().game.pendingOracle!
    const wrong = question.choices.find((choice) => choice !== question.answer)!

    store().answerOracle(wrong)
    expect(store().oracleResult!.correct).toBe(false)
    expect(store().game.stardust).toBe(before)

    store().dismissOracle()

    // And again, answering correctly this time.
    newGame(7)
    withBoard(drifterBoard)
    store().commitTurn()
    store().answerOracle(store().game.pendingOracle!.answer)

    expect(store().oracleResult!.correct).toBe(true)
    expect(store().game.stardust).toBe(before + STARDUST_REWARDS.oracleCorrect)
  })

  it('asks nothing, and settles straight away, when no drifter is on the board', () => {
    newGame(7)
    withBoard(['GAC GAC GAC .   .', EMPTY, EMPTY, EMPTY, EMPTY])
    store().commitTurn()

    expect(store().game.pendingOracle).toBeNull()
    expect(store().settlement).not.toBeNull()
  })

  // GDD 3-3: a drifter with nothing adjacent takes no suit and scores nothing,
  // so there is no expectation to ask about.
  it('asks nothing when the drifter has no neighbour', () => {
    newGame(7)
    withBoard(['*   .   .   .   .', EMPTY, '.   .   GAC .   .', EMPTY, EMPTY])
    store().commitTurn()

    expect(store().game.pendingOracle).toBeNull()
    expect(store().settlement).not.toBeNull()
  })
})
