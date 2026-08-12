// What BOOTH-7 added for running the booth itself (GDD 12-2 ③ ④, 12-4).
//
// None of it is a game rule, which is why none of it is in `src/core/`. It is
// the three things a one-person booth cannot run without: a build that does not
// offer a forty-minute mode to a fourteen-year-old, a way out of a run that has
// been abandoned, and the run remembering to ask for the vote it is scored on.

import { describe, expect, it } from 'vitest'
import {
  MAX_PLACEMENTS_PER_TURN,
  MODE_PRESETS,
  STARTING_CONSTELLATION_CHOICES,
  TURNS_PER_ROUND,
} from '../src/core/config'
import { position } from '../src/core/board'
import type { Position } from '../src/core/types'
import { useGame } from '../src/store/gameStore'
import { coachStep } from '../src/ui/Coach'
import { VOTE_NOTE } from '../src/ui/Game'
import { RESET_CONFIRM } from '../src/ui/Reset'
import { modeOrder } from '../src/ui/Title'

const store = () => useGame.getState()

// ------------------------------------------------------- GDD 12-2 ③ · the build

describe('the booth build offers one mode (GDD 12-2 ③)', () => {
  it('gives a development build both modes', () => {
    expect(modeOrder(false, false)).toEqual(['booth', 'full'])
    expect(modeOrder(false, true)).toEqual(['booth', 'full'])
  })

  // The whole reason for the branch: the full version is eight rounds to booth's
  // three (GDD 12-3), and GDD 12-1 counts the booth's score in participants an
  // hour. A participant who picks it holds a laptop for something like forty
  // minutes, and nothing on the title screen warns them off it.
  it('gives a production build the booth mode alone', () => {
    expect(modeOrder(true, false)).toEqual(['booth'])
  })

  // GDD 12-2 ③ still needs the full version to exist for development and for a
  // demo, so it is hidden rather than removed — `?mode=full` is the way back to
  // it on a booth laptop, and no participant types a query string by accident.
  it('re-opens the full version on a production build when it is unlocked', () => {
    expect(modeOrder(true, true)).toEqual(['booth', 'full'])
  })

  // Booth first in every build, because the first entry is what the screen
  // defaults to (`Title.tsx`) — a production build that defaulted to full would
  // make the branch pointless.
  it('always leads with booth', () => {
    for (const prod of [true, false]) {
      for (const unlocked of [true, false]) {
        expect(modeOrder(prod, unlocked)[0]).toBe('booth')
      }
    }
  })

  // Every mode offered has to be one core can build a run from, so the list can
  // never name a preset that is not there.
  it('only ever names modes config has a preset for', () => {
    for (const prod of [true, false]) {
      for (const mode of modeOrder(prod, false)) expect(MODE_PRESETS[mode]).toBeDefined()
    }
  })
})

// ------------------------------------------------------- GDD 12-2 ④ · the reset

describe('the mid-run reset (GDD 12-2 ④)', () => {
  /** Answers the wager standing in front of the draw, so a hand exists. */
  function answerWager(): void {
    if (store().game.pendingWager === null) return
    store().answerWager('yes')
    store().dismissWager()
  }

  /** First empty cell in reading order. */
  function firstFree(): Position | null {
    const { board } = store().game
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board.length; col++) {
        if (board[row][col] === null) return position(row, col)
      }
    }
    return null
  }

  /** A run several turns deep, with chips on the board and a wager answered. */
  function abandonedRun(): void {
    store().startRun({ mode: 'booth', starting: STARTING_CONSTELLATION_CHOICES[0] }, 7)
    answerWager()
    for (let i = 0; i < MAX_PLACEMENTS_PER_TURN; i++) {
      const chip = store().game.hand[0]
      const cell = firstFree()
      if (chip === undefined || cell === null) break
      store().select(chip)
      store().placeAt(cell)
    }
    store().commitTurn()
  }

  it('leaves a run that was under way', () => {
    abandonedRun()
    expect(store().started).toBe(true)

    store().toTitle()

    expect(store().started).toBe(false)
  })

  // The point of the button. The next participant starts their own run, so
  // nothing the last one did may still be on the board, in the hand, in the purse
  // or in the settlement panel.
  it('starts the next participant on a clean run, not the abandoned one', () => {
    abandonedRun()
    const abandoned = store().game
    expect(abandoned.roundScore).toBeGreaterThan(0)
    expect(store().settlement).not.toBeNull()

    store().toTitle()
    store().startRun({ mode: 'booth', starting: STARTING_CONSTELLATION_CHOICES[1] }, 9)

    const { game } = store()
    expect(game.round).toBe(1)
    expect(game.turn).toBe(1)
    expect(game.roundScore).toBe(0)
    expect(game.stardust).toBe(0)
    expect(game.status).toBe('playing')
    expect(game.drifterOwned).toBe(false)
    expect(game.wagerHistory).toEqual([])
    expect(game.board.flat().every((cell) => cell === null)).toBe(true)
    // And the title's answers are the new participant's, not the last one's.
    expect(game.ownedConstellations).toEqual([STARTING_CONSTELLATION_CHOICES[1]])

    // The store's own state, which is what would carry a stale panel across.
    expect(store().settlement).toBeNull()
    expect(store().staged).toEqual([])
    expect(store().selected).toBeNull()
    expect(store().report).toBeNull()
    expect(store().wagerResult).toBeNull()
    expect(store().oracleResult).toBeNull()
  })

  // GDD 12-2-a rejected every "show it once" scheme in favour of every run's
  // round 1, precisely so that a reset cannot leave the next participant without
  // the tutorial. This is that decision held down.
  it('brings the coach marks back for the next participant', () => {
    store().startRun({ mode: 'booth', starting: STARTING_CONSTELLATION_CHOICES[0] }, 7)
    answerWager()

    const midRun = {
      round: store().game.round,
      turn: store().game.turn,
      shuffling: false,
      pendingWager: store().game.pendingWager !== null,
      wagerOpen: false,
      oracleOpen: false,
      reportOpen: false,
      answered: store().game.wagerHistory.length,
      holding: false,
      placed: 0,
      settlingTurn: null,
    }
    // One wager answered, so the opening caption is done with.
    expect(coachStep(midRun)).not.toBe('wager')

    store().toTitle()
    store().startRun({ mode: 'booth', starting: STARTING_CONSTELLATION_CHOICES[0] }, 9)

    const { game } = store()
    expect(game.round).toBe(1)
    expect(game.wagerHistory).toHaveLength(0)
    expect(
      coachStep({ ...midRun, round: 1, turn: 1, answered: 0, pendingWager: true, wagerOpen: true }),
    ).toBe('wager')
  })

  // The banner's own way back to the title is untouched: it is the path a
  // finished run takes and the reset button is deliberately not on screen then.
  it('leaves the end-of-run path alone', () => {
    store().startRun({ mode: 'booth', starting: STARTING_CONSTELLATION_CHOICES[0] }, 7)
    for (let turn = 0; turn < TURNS_PER_ROUND; turn++) {
      answerWager()
      store().commitTurn()
      store().dismissSettlement()
    }

    expect(store().game.status).toBe('gameOver')
    expect(store().started).toBe(true)

    store().toTitle()

    expect(store().started).toBe(false)
  })

  it('names the action on the button that performs it', () => {
    // The corner button and the one that confirms say the same thing, so what is
    // being agreed to is on the button doing it rather than behind a 확인.
    expect(RESET_CONFIRM.confirm).toBe(RESET_CONFIRM.button)
    expect(RESET_CONFIRM.cancel).not.toBe(RESET_CONFIRM.confirm)
    // A question, so it reads as one — the note says what is lost.
    expect(RESET_CONFIRM.title.endsWith('?')).toBe(true)
    expect(RESET_CONFIRM.note.length).toBeGreaterThan(0)
  })
})

// ------------------------------------------------------- GDD 12-4 · the vote

describe('the vote note on the end screen (GDD 12-4)', () => {
  // GDD 12-1 makes throughput the score because GBL is ranked by the
  // participants' vote, and until BOOTH-7 the game never mentioned it once.
  it('asks for the vote however the run ended', () => {
    for (const outcome of ['cleared', 'gameOver'] as const) {
      expect(VOTE_NOTE[outcome]).toContain('투표')
    }
  })

  // GDD 12-4: a participant who fails and leaves costs a vote, so the losing line
  // has to close the run before it asks. The clear does not need that half.
  it('says it differently on a loss than on a clear', () => {
    expect(VOTE_NOTE.cleared).not.toBe(VOTE_NOTE.gameOver)
  })

  // ⚠️ The wording is a placeholder: the vote mechanism is not decided, so what
  // this holds is the slot rather than the copy. What it does fix is that no QR
  // code and no address was invented to fill it — there is nothing to point one
  // at yet, and a dead link on the last screen of the run is worse than no link.
  it('points nowhere while there is nowhere to point', () => {
    for (const line of Object.values(VOTE_NOTE)) {
      expect(line).not.toMatch(/QR|https?:|www\.|@/)
      // The banner is 320px wide at the 11px face — 25 glyphs a line, three lines
      // of room under the result note.
      expect(line.length, line).toBeLessThanOrEqual(40)
    }
  })
})
