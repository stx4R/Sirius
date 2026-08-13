// BOOTH-9b: the settlement advances the turn on a timer instead of on a button.
//
// Two things had to be pinned. The first is the modal rule — a timer that ran while
// the game was asking the player to read something would answer for them, and there
// are four things it must wait behind. The second is the last turn: the fifth
// settlement of a round has no next turn to advance to, and must leave through the
// round-end path instead.
//
// BOOTH-9c folded 9b's `helpOpen` and `resetOpen` into one `pauseOpen`: both of
// those overlays are pages of the ESC pause window now, so five fields became four.

import { describe, expect, it } from 'vitest'
import { MAX_PLACEMENTS_PER_TURN, TURNS_PER_ROUND } from '../src/core/config'
import { isEmpty } from '../src/core/board'
import { useGame } from '../src/store/gameStore'
import { autoAdvances } from '../src/ui/Settlement'
import type { AdvanceView } from '../src/ui/Settlement'
import type { Position } from '../src/core/types'

// ------------------------------------------------------------- the modal rule

/** A finished walk with nothing in the way — the one state that may advance. */
const READY: AdvanceView = {
  hasSettlement: true,
  walkDone: true,
  over: false,
  wagerOpen: false,
  oracleOpen: false,
  reportOpen: false,
  pauseOpen: false,
}

/** Every modal that must hold the timer, by the field that reports it. */
const MODALS = [
  ['wagerOpen', "ORION'S WAGER (GDD 8-2)"],
  ['oracleOpen', 'DRIFT ORACLE (GDD 8-3)'],
  ['reportOpen', 'CONSTELLATION LOG (GDD 8-4)'],
  ['pauseOpen', 'ESC 퍼즈 창 (GDD 12-2 ①④)'],
] as const

describe('autoAdvances (BOOTH-9b)', () => {
  it('advances once the walk is finished and nothing is in the way', () => {
    expect(autoAdvances(READY)).toBe(true)
  })

  it('waits while the walk is still running', () => {
    expect(autoAdvances({ ...READY, walkDone: false })).toBe(false)
  })

  it('does nothing when there is no settlement to leave', () => {
    expect(autoAdvances({ ...READY, hasSettlement: false })).toBe(false)
  })

  // The banner owns the screen once the run is over, and there is no turn to go to.
  it('does nothing once the run has ended', () => {
    expect(autoAdvances({ ...READY, over: true })).toBe(false)
  })

  // ★ The rule this file exists for. One at a time, so a modal that stopped holding
  // the timer is named rather than hidden behind another one that still does.
  for (const [field, what] of MODALS) {
    it(`holds the timer while ${what} is up`, () => {
      expect(autoAdvances({ ...READY, [field]: true })).toBe(false)
    })
  }

  it('holds the timer while every modal is up at once', () => {
    const all = MODALS.reduce((view, [field]) => ({ ...view, [field]: true }), READY)
    expect(autoAdvances(all)).toBe(false)
  })

  // A modal closing is what lets it run again — the screen goes back to a finished
  // settlement with nothing over it, which is `READY`.
  it('resumes when the modal closes', () => {
    for (const [field] of MODALS) {
      expect(autoAdvances({ ...READY, [field]: true })).toBe(false)
      expect(autoAdvances({ ...READY, [field]: false })).toBe(true)
    }
  })
})

// ------------------------------------------------------------ the last turn

const store = () => useGame.getState()

function newGame(seed: number): void {
  store().startRun({ mode: 'booth', starting: 'aries' }, seed)
  clearWager()
}

/** A run opens on its first wager (GDD 8-2); answering is what deals the hand. */
function clearWager(): void {
  if (store().game.pendingWager !== null) store().answerWager('yes')
  if (store().wagerResult !== null) store().dismissWager()
}

function freeCells(): Position[] {
  const { board } = store().game
  const out: Position[] = []
  const axis = [0, 1, 2, 3, 4] as const
  for (const row of axis) {
    for (const col of axis) {
      if (isEmpty(board, { row, col })) out.push({ row, col })
    }
  }
  return out
}

function placeSome(): void {
  const cells = freeCells()
  for (let i = 0; i < MAX_PLACEMENTS_PER_TURN && i < cells.length; i++) {
    const chip = store().game.hand[0]
    if (chip === undefined) return
    store().select(chip)
    store().placeAt(cells[i])
  }
}

/** Ends a turn and walks off the settlement, the way the timer now does. */
function endTurnAndAdvance(): void {
  store().commitTurn()
  if (store().game.pendingOracle !== null) {
    store().answerOracle(0)
    store().dismissOracle()
  }
  store().dismissSettlement()
  clearWager()
}

describe('the last turn of a round (GDD 4-1, BOOTH-9b)', () => {
  // The timer calls `dismissSettlement` on every turn alike, so the thing that has
  // to be true is that core routes the fifth one differently by itself.
  it('leaves turn 5 through the round-end path rather than to a sixth turn', () => {
    newGame(7)

    for (let turn = 1; turn < TURNS_PER_ROUND; turn++) {
      expect(store().game.turn, `turn ${turn}`).toBe(turn)
      placeSome()
      endTurnAndAdvance()
    }

    expect(store().game.turn).toBe(TURNS_PER_ROUND)
    placeSome()
    store().commitTurn()
    if (store().game.pendingOracle !== null) {
      store().answerOracle(0)
      store().dismissOracle()
    }

    // Core has already decided: the fifth settlement ends a round, not a turn.
    expect(store().game.phase).toBe('roundEnd')
    expect(store().game.turn).toBe(TURNS_PER_ROUND)

    store().dismissSettlement()

    // Whichever way the round went, the screen is no longer on a turn — there is
    // either a report to read or a banner, and never a sixth hand.
    expect(store().settlement).toBeNull()
    expect(store().game.turn).not.toBe(TURNS_PER_ROUND + 1)
    expect(store().report !== null || store().game.status !== 'playing').toBe(true)
  })

  // The timer is only ever allowed to fire on a finished walk, and a finished walk
  // on turn 5 is exactly the state above — so the view it is given must say so.
  it('reports a turn-5 settlement as advanceable once its walk is done', () => {
    expect(
      autoAdvances({ ...READY, reportOpen: false, over: false }),
    ).toBe(true)
  })
})
