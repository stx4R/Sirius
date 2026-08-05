import { describe, expect, it } from 'vitest'
import { occupiedPositions, position } from '../src/core/board'
import {
  HAND_SIZE,
  MAX_PLACEMENTS_PER_TURN,
  MODE_PRESETS,
  SHOP_PRICES,
  TURNS_PER_ROUND,
} from '../src/core/config'
import {
  buy,
  drawHand,
  endRound,
  endTurn,
  openShop,
  placeChips,
  playGame,
  reroll,
  startGame,
  startRound,
} from '../src/core/game'
import type { Game, Placement, PlacementPolicy, ShopPolicy } from '../src/core/game'
import { mulberry32 } from '../src/core/rng'
import { createStartingLoadout } from '../src/core/shop'
import type { Loadout } from '../src/core/shop'
import type { ConstellationId } from '../src/core/types'

const newGame = (seed = 42): Game => startGame('full', mulberry32(seed))

/** Fills the board left to right with whatever the hand holds. */
const fillPolicy: PlacementPolicy = ({ board, hand }) => {
  const taken = new Set(occupiedPositions(board).map((p) => `${p.row},${p.col}`))
  const free: Placement[] = []
  for (let row = 0; row < 5 && free.length < hand.length; row++) {
    for (let col = 0; col < 5 && free.length < hand.length; col++) {
      if (!taken.has(`${row},${col}`)) free.push({ chip: hand[free.length], position: position(row, col) })
    }
  }
  return free
}

const buyNothing: ShopPolicy = () => []

const options = (place: PlacementPolicy = fillPolicy, shop: ShopPolicy = buyNothing) => ({
  mode: 'full' as const,
  stackMode: 'sum' as const,
  place,
  shop,
  answerWager: () => true,
  answerOracle: () => true,
  rng: mulberry32(9),
})

describe('startGame / startRound', () => {
  it('opens on round 1 with the full deck and no purchases', () => {
    const game = newGame()

    expect(game.round).toBe(1)
    expect(game.turn).toBe(1)
    expect(game.status).toBe('playing')
    expect(game.ownedDeck).toHaveLength(50)
    expect(game.ownedConstellations).toEqual([])
    expect(game.stardust).toBe(0)
    expect(game.targetScore).toBe(MODE_PRESETS.full.TARGET_SCORES[0])
  })

  it('clears the board and reshuffles the owned deck (GDD 4-2)', () => {
    const started = startRound(newGame())

    expect(occupiedPositions(started.board)).toEqual([])
    expect(started.deck).toHaveLength(50)
    expect(started.deck.map((chip) => chip.id)).not.toEqual(
      started.ownedDeck.map((chip) => chip.id),
    )
    expect(new Set(started.deck.map((c) => c.id))).toEqual(
      new Set(started.ownedDeck.map((c) => c.id)),
    )
  })

  it('restores the deck including shop purchases, not the starting 50', () => {
    const bought = buy({ ...newGame(), stardust: 20 }, { kind: 'special', pair: ['GAC', 'IMA'] })

    const started = startRound(bought)

    expect(started.deck).toHaveLength(51)
    expect(started.deck.some((chip) => chip.kind === 'special')).toBe(true)
  })

  it('reads each round its own target', () => {
    const round4 = startRound({ ...newGame(), round: 4 })

    expect(round4.targetScore).toBe(MODE_PRESETS.full.TARGET_SCORES[3])
  })
})

describe('drawHand / placeChips', () => {
  it('draws HAND_SIZE chips without replacement', () => {
    const drawn = drawHand(startRound(newGame()))

    expect(drawn.hand).toHaveLength(HAND_SIZE)
    expect(drawn.deck).toHaveLength(50 - HAND_SIZE)
    expect(drawn.deck.some((chip) => drawn.hand.includes(chip))).toBe(false)
  })

  it('logs the draw for the CONSTELLATION LOG', () => {
    const drawn = drawHand(startRound(newGame()))

    expect(drawn.drawHistory).toHaveLength(1)
    expect(drawn.drawHistory[0]).toMatchObject({ round: 1, turn: 1 })
    expect(drawn.drawHistory[0].drawn).toHaveLength(HAND_SIZE)
  })

  it('caps placements at MAX_PLACEMENTS_PER_TURN', () => {
    const drawn = drawHand(startRound(newGame()))

    const placed = placeChips(drawn, fillPolicy({ ...drawn, constellations: [], stackMode: 'sum' }))

    expect(occupiedPositions(placed.board)).toHaveLength(MAX_PLACEMENTS_PER_TURN)
    expect(placed.hand).toHaveLength(HAND_SIZE - MAX_PLACEMENTS_PER_TURN)
  })

  it('refuses a cell that is already taken', () => {
    const drawn = drawHand(startRound(newGame()))
    const target = position(2, 2)

    const placed = placeChips(drawn, [
      { chip: drawn.hand[0], position: target },
      { chip: drawn.hand[1], position: target },
    ])

    expect(occupiedPositions(placed.board)).toHaveLength(1)
    expect(placed.hand).toHaveLength(HAND_SIZE - 1)
  })

  it('refuses a chip that is not in hand', () => {
    const drawn = drawHand(startRound(newGame()))
    const stranger = { id: 'not-in-hand', kind: 'basic' as const, suit: 'GAC' as const }

    const placed = placeChips(drawn, [{ chip: stranger, position: position(0, 0) }])

    expect(occupiedPositions(placed.board)).toEqual([])
  })
})

describe('endTurn', () => {
  it('returns unplaced chips to the deck and reshuffles (GDD 4-2, C-2)', () => {
    const drawn = drawHand(startRound(newGame()))
    const placed = placeChips(drawn, fillPolicy({ ...drawn, constellations: [], stackMode: 'sum' }))

    const ended = endTurn(placed)

    expect(ended.hand).toEqual([])
    expect(ended.deck).toHaveLength(50 - MAX_PLACEMENTS_PER_TURN)
  })

  it('accumulates the settled score into roundScore', () => {
    const drawn = drawHand(startRound(newGame()))
    const placed = placeChips(drawn, fillPolicy({ ...drawn, constellations: [], stackMode: 'sum' }))

    const ended = endTurn(placed)

    // 4 chips, no constellations owned, so every chip scores its flat base.
    expect(ended.roundScore).toBe(40)
    expect(ended.turn).toBe(2)
    expect(ended.phase).toBe('draw')
  })

  it('moves to roundEnd after the last turn', () => {
    const drawn = drawHand({ ...startRound(newGame()), turn: TURNS_PER_ROUND })

    const ended = endTurn(placeChips(drawn, []))

    expect(ended.turn).toBe(TURNS_PER_ROUND)
    expect(ended.phase).toBe('roundEnd')
  })
})

describe('endRound', () => {
  it('ends the game when the target is missed (GDD 4-2, C-5)', () => {
    const missed = endRound({ ...newGame(), roundScore: 10, targetScore: 300 })

    expect(missed.status).toBe('gameOver')
    expect(missed.phase).toBe('over')
  })

  it('pays the clear reward plus the overshoot bonus (GDD 9-1)', () => {
    const cleared = endRound({ ...newGame(), round: 2, roundScore: 900, targetScore: 500 })

    // 5 + round 2, plus floor(400 / 100) = 4 overshoot.
    expect(cleared.stardust).toBe(5 + 2 + 4)
    expect(cleared.round).toBe(3)
    expect(cleared.phase).toBe('shop')
  })

  it('caps the overshoot bonus', () => {
    const cleared = endRound({ ...newGame(), round: 1, roundScore: 99999, targetScore: 300 })

    expect(cleared.stardust).toBe(5 + 1 + 5)
  })

  it('marks the run cleared after the final round', () => {
    const won = endRound({
      ...newGame(),
      round: MODE_PRESETS.full.TOTAL_ROUNDS,
      roundScore: 99999,
      targetScore: 9000,
    })

    expect(won.status).toBe('cleared')
  })
})

describe('shop transitions', () => {
  it('rolls stock and resets the reroll counter', () => {
    const opened = openShop({ ...newGame(), rerollsUsed: 3 })

    expect(opened.stock).not.toBeNull()
    expect(opened.rerollsUsed).toBe(0)
  })

  it('charges an escalating reroll price and replaces the stock', () => {
    const opened = openShop({ ...newGame(), stardust: 20 })

    const once = reroll(opened)
    const twice = reroll(once)

    expect(once.stardust).toBe(20 - SHOP_PRICES.rerollBase)
    expect(twice.stardust).toBe(20 - SHOP_PRICES.rerollBase - (SHOP_PRICES.rerollBase + 1))
    expect(twice.rerollsUsed).toBe(2)
  })

  it('ignores a purchase the player cannot afford', () => {
    const broke = { ...newGame(), stardust: 1 }

    expect(buy(broke, { kind: 'special', pair: ['GAC', 'IMA'] })).toBe(broke)
  })

  it('hands the drifter over at the first shop, once (GDD 13-4)', () => {
    const drifters = (game: Game) => game.ownedDeck.filter((chip) => chip.kind === 'drifter').length
    const first = openShop({ ...newGame(), stardust: 0 })

    expect(drifters(newGame())).toBe(0)
    expect(first.drifterOwned).toBe(true)
    expect(first.stardust).toBe(0)
    expect(drifters(first)).toBe(1)
    expect(drifters(openShop(first))).toBe(1)
  })

  it('clears the reroll counter again at the next round (GDD 9-2)', () => {
    const afterRerolls = reroll(reroll(openShop({ ...newGame(), stardust: 50 })))

    expect(startRound(afterRerolls).rerollsUsed).toBe(0)
  })
})

describe('full playthrough', () => {
  it('drives all 8 rounds through the transitions without crashing', () => {
    // Balance is P2-B's question, so the target check is satisfied outright here.
    // What this exercises is the loop wiring: 8 rounds × 5 turns, shop in between.
    let game = newGame(11)
    const roundsSeen: number[] = []

    while (game.status === 'playing') {
      roundsSeen.push(game.round)
      game = startRound(game)
      for (let turn = 0; turn < TURNS_PER_ROUND; turn++) {
        game = drawHand(game)
        game = placeChips(game, fillPolicy({ ...game, constellations: [], stackMode: 'sum' }))
        game = endTurn(game)
      }
      expect(game.phase).toBe('roundEnd')
      game = endRound({ ...game, roundScore: game.targetScore })
      if (game.status !== 'playing') break
      game = openShop(game)
      game = buy(game, { kind: 'addBasic', suit: 'GAC' })
    }

    expect(roundsSeen).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(game.status).toBe('cleared')
    expect(game.drawHistory).toHaveLength(MODE_PRESETS.full.TOTAL_ROUNDS * TURNS_PER_ROUND)
  })

  it('stops the run at the first missed target', () => {
    // Row-major filling never lines suits up, so the score plateaus at the flat
    // base and round 3 is missed. The loop must end cleanly rather than hang.
    const flat: Loadout = {
      deck: startGame('full', mulberry32(1)).ownedDeck,
      constellations: ['aries', 'capricorn', 'sagittarius', 'leo'],
      stardust: 0,
      drifterOwned: false,
      nextChipId: 0,
    }

    const result = playGame(flat, { ...options(), mode: 'full' })

    expect(result.clearedAll).toBe(false)
    expect(result.roundsCleared).toBe(result.roundScores.length - 1)
    expect(result.turnsPlayed).toBe(result.roundScores.length * TURNS_PER_ROUND)
  })

  it('drives booth mode to completion in 3 rounds', () => {
    const result = playGame(
      {
        deck: startGame('booth', mulberry32(2)).ownedDeck,
        constellations: [],
        stardust: 0,
        drifterOwned: false,
        nextChipId: 0,
      },
      { ...options(), mode: 'booth' },
    )

    expect(result.targets).toEqual(MODE_PRESETS.booth.TARGET_SCORES)
    expect(result.roundScores.length).toBeLessThanOrEqual(MODE_PRESETS.booth.TOTAL_ROUNDS)
  })

  it('is reproducible for a seed', () => {
    const run = () =>
      playGame(
        {
          deck: startGame('full', mulberry32(3)).ownedDeck,
          constellations: [],
          stardust: 0,
          drifterOwned: false,
          nextChipId: 0,
        },
        { ...options(), rng: mulberry32(77) },
      )

    expect(run()).toEqual(run())
  })
})

describe('injected target curve', () => {
  const emptyLoadout = (): Loadout => ({
    deck: startGame('full', mulberry32(5)).ownedDeck,
    constellations: [],
    stardust: 0,
    drifterOwned: false,
    nextChipId: 0,
  })

  it('replaces the mode preset', () => {
    const targets = MODE_PRESETS.full.TARGET_SCORES.map(() => 1_000_000)
    const result = playGame(emptyLoadout(), { ...options(), targets })

    expect(result.targets).toEqual(targets)
    expect(result.roundScores).toHaveLength(1)
    expect(result.clearedAll).toBe(false)
  })

  it('samples every round when nothing eliminates', () => {
    const targets = MODE_PRESETS.full.TARGET_SCORES.map(() => 0)
    const result = playGame(emptyLoadout(), { ...options(), targets })

    expect(result.roundScores).toHaveLength(MODE_PRESETS.full.TOTAL_ROUNDS)
    expect(result.clearedAll).toBe(true)
  })
})

describe('GDD 13-5 starting constellation', () => {
  /** Fills a single column, so a vertical run of 3 forms and aries can fire. */
  const columnPolicy: PlacementPolicy = ({ board, hand }) => {
    const taken = new Set(occupiedPositions(board).map((p) => `${p.row},${p.col}`))
    const free: Placement[] = []
    for (let col = 0; col < 5 && free.length < hand.length; col++) {
      for (let row = 0; row < 5 && free.length < hand.length; row++) {
        if (!taken.has(`${row},${col}`)) free.push({ chip: hand[free.length], position: position(row, col) })
      }
    }
    return free
  }

  const round1Score = (constellations: readonly ConstellationId[], place: PlacementPolicy) =>
    playGame(
      { ...createStartingLoadout('aries'), constellations },
      { ...options(place), targets: MODE_PRESETS.full.TARGET_SCORES.map(() => 0) },
    ).roundScores[0]

  it('leaves round 1 fixed at the flat base when nothing is owned', () => {
    // 4 chips a turn for 5 turns, every settlement scoring the whole board:
    // 40 + 80 + 120 + 160 + 200. No constellation, no line, no variance.
    expect(round1Score([], fillPolicy)).toBe(600)
    expect(round1Score([], columnPolicy)).toBe(600)
  })

  it('makes round 1 respond to placement once one is held', () => {
    const withStarting = round1Score(['aries'], columnPolicy)

    expect(withStarting).toBeGreaterThan(600)
  })
})
