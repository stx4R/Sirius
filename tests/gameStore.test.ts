// P3-B: the store drives a real playthrough. These are the checks a browser
// cannot make cheaply — that the store defers to core for every rule, and that a
// round can actually be played from the first draw to the target check.

import { describe, expect, it } from 'vitest'
import { occupiedPositions, position } from '../src/core/board'
import { BOARD_SIZE, MAX_PLACEMENTS_PER_TURN, TURNS_PER_ROUND } from '../src/core/config'
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
    const shown = stepsOf(settlement).reduce((total, step) => total + step.points, 0)
    expect(shown).toBe(settlement.awarded)
  })

  it('plays a full round of five turns and checks the target', () => {
    store().newGame(7)

    for (let turn = 0; turn < TURNS_PER_ROUND; turn++) {
      expect(store().game.turn).toBe(turn + 1)
      placeChips(MAX_PLACEMENTS_PER_TURN)
      store().commitTurn()
      store().dismissSettlement()
    }

    // Five turns of four chips fill twenty of the twenty-five cells (GDD 4-2),
    // which clears round one and opens round two with a fresh board and hand.
    const { game } = store()
    expect(game.status).toBe('playing')
    expect(game.round).toBe(2)
    expect(game.turn).toBe(1)
    expect(game.roundScore).toBe(0)
    expect(game.hand.length).toBeGreaterThan(0)
    expect(occupiedPositions(game.board)).toHaveLength(0)
  })

  it('hands over the drifter on the way past the shop (GDD 13-4)', () => {
    store().newGame(7)
    expect(store().game.drifterOwned).toBe(false)

    for (let turn = 0; turn < TURNS_PER_ROUND; turn++) {
      placeChips(MAX_PLACEMENTS_PER_TURN)
      store().commitTurn()
      store().dismissSettlement()
    }

    // P3-B draws no shop screen, but the visit still happens, so the rule that
    // lives there is not silently skipped.
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
