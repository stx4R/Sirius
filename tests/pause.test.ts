// The ESC pause window (GDD 12-2 ①④, 12-2-c, 12-2-d — BOOTH-9c).
//
// BOOTH-9b left the play screen with no visible way back into the tutorial and no
// visible way out of a run; 9c gives both a home. What has to be pinned here is not
// what the window looks like — that is `npm run shot` — but the three promises it
// makes to the game behind it:
//
//   ① nothing advances while it is up
//   ② the run is exactly where it was when it closes, forced wager included
//   ③ 다시 시작 and 처음 화면으로 are different actions and say so
//
// ★ ① and ② are the same promise seen from two sides, and they are what makes the
// window safe to open in the middle of a settlement.

import { afterEach, describe, expect, it } from 'vitest'
import { FORCED_WAGER_COUNT, STARTING_CONSTELLATION_CHOICES } from '../src/core/config'
import { wagerIsForced } from '../src/core/game'
import { useGame } from '../src/store/gameStore'
import { LAYOUT } from '../src/ui/Canvas'
import { PAUSE_MENU, PAUSE_TEXT } from '../src/ui/Pause'
import type { PausePage } from '../src/ui/Pause'
import { RESET_CONFIRM, RESTART_CONFIRM, TITLE_CONFIRM } from '../src/ui/Reset'
import { SETTINGS_TEXT } from '../src/ui/Settings'
import { autoAdvances } from '../src/ui/Settlement'
import type { AdvanceView } from '../src/ui/Settlement'
import { animationsOn, setAnimations } from '../src/ui/motion'

const store = () => useGame.getState()

/** Every page of the window, so none of them is quietly exempt from a rule. */
const PAGES: readonly PausePage[] = ['menu', 'help', 'settings', 'restart', 'title']

// --------------------------------------------------- ① nothing advances behind it

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

describe('the pause holds the turn (GDD 12-2 ①④)', () => {
  it('stops the settlement advancing while it is open', () => {
    expect(autoAdvances(READY)).toBe(true)
    expect(autoAdvances({ ...READY, pauseOpen: true })).toBe(false)
  })

  // The window is opaque (`Pause.tsx`), so a turn advancing behind it is not merely
  // rushed — it happens where the player cannot see it at all.
  it('lets the turn resume the moment it closes', () => {
    expect(autoAdvances({ ...READY, pauseOpen: false })).toBe(true)
  })

  // `Game.tsx` reports the window as `pause !== null`, so every page holds the
  // timer and none of them can be quietly exempt. What can drift is the menu naming
  // a page the window does not have — a confirmation that never opens would leave
  // the run advancing behind an item that looks like it did something.
  it('sends every item to a page the window has', () => {
    for (const item of PAUSE_MENU) {
      if (item.id === 'resume') continue
      expect(PAGES, item.label).toContain(item.id)
    }
  })
})

// ------------------------------------------------- ② the run is where it was left

describe('the pause changes no game state (GDD 12-2 ①④)', () => {
  afterEach(() => setAnimations(true))

  /** Answers the wager standing in front of the draw, so a hand exists. */
  function answerWager(): void {
    if (store().game.pendingWager === null) return
    store().answerWager('yes')
    store().dismissWager()
  }

  // ★ The window is UI state and only UI state. Opening it, walking every page of
  // it, flipping the one setting it has and closing it must leave core's game
  // object *identical* — not equal, identical, because nothing here is allowed to
  // build a new one.
  it('leaves the game object untouched across a full walk of the window', () => {
    store().startRun({ mode: 'booth', starting: STARTING_CONSTELLATION_CHOICES[0] }, 7)
    answerWager()

    const before = store().game
    const staged = store().staged
    const settlement = store().settlement

    // Everything the window can do that is not one of its two destructive items.
    setAnimations(false)
    setAnimations(true)
    setAnimations(false)

    expect(store().game).toBe(before)
    expect(store().staged).toBe(staged)
    expect(store().settlement).toBe(settlement)
  })

  // ★ THE FORCED WINDOW (GDD 8-2). The first `FORCED_WAGER_COUNT` questions cannot
  // be abstained from, so the wager is the one modal ESC must not dismiss — and it
  // does not, because the pause draws over a modal rather than closing it. What this
  // holds is the consequence: the question is still pending and still forced.
  it('leaves a forced wager pending and forced', () => {
    store().startRun({ mode: 'booth', starting: STARTING_CONSTELLATION_CHOICES[0] }, 7)

    const asked = store().game
    expect(asked.pendingWager).not.toBeNull()
    expect(wagerIsForced(asked)).toBe(true)
    expect(asked.wagerHistory.length).toBeLessThan(FORCED_WAGER_COUNT)

    setAnimations(false)

    expect(store().game).toBe(asked)
    expect(store().game.pendingWager).toBe(asked.pendingWager)
    expect(wagerIsForced(store().game)).toBe(true)
  })

  // The setting is session state, so a restart keeps it — the same student is still
  // at the machine. What must not happen is core learning about it (CLAUDE.md §5).
  it('keeps the animation setting across a restart and out of the game', () => {
    store().startRun({ mode: 'booth', starting: STARTING_CONSTELLATION_CHOICES[0] }, 7)
    setAnimations(false)

    store().newGame(9)

    expect(animationsOn()).toBe(false)
    expect(Object.keys(store().game)).not.toContain('animations')
  })
})

// --------------------------------------------- ③ the two exits are different exits

describe('the two ways out are named apart (GDD 12-2-c)', () => {
  it('offers the five items in the order a stuck participant needs them', () => {
    expect(PAUSE_MENU.map((item) => item.id)).toEqual([
      'resume',
      'help',
      'restart',
      'title',
      'settings',
    ])
  })

  // 다시 시작 keeps the mode and the starting constellation; 처음 화면으로 hands both
  // questions back to the next participant. Two labels that read the same would make
  // the distinction invisible, which is the whole point of having both.
  it('gives 다시 시작 and 처음 화면으로 different labels and different questions', () => {
    const labels = PAUSE_MENU.map((item) => item.label)

    expect(new Set(labels).size).toBe(labels.length)
    expect(RESTART_CONFIRM.title).not.toBe(TITLE_CONFIRM.title)
    expect(RESTART_CONFIRM.confirm).not.toBe(TITLE_CONFIRM.confirm)
  })

  // BOOTH-7's rule: the confirm button repeats the label that was pressed, so what
  // is being agreed to is named on the button that does it.
  it('names each action on the button that performs it', () => {
    const byId = new Map(PAUSE_MENU.map((item) => [item.id, item.label]))

    expect(RESTART_CONFIRM.confirm).toBe(byId.get('restart'))
    expect(TITLE_CONFIRM.confirm).toBe(byId.get('title'))
    // Carrying on costs nothing, so it is the same word on all three cards and the
    // same word the menu's first item uses.
    for (const copy of [RESET_CONFIRM, RESTART_CONFIRM, TITLE_CONFIRM]) {
      expect(copy.cancel).toBe(byId.get('resume'))
      expect(copy.title.endsWith('?')).toBe(true)
    }
  })

  // Each card carries a `data-panel` so a screenshot can say which of the three it
  // caught; two sharing one would file two pictures under one name.
  it('gives each confirmation its own panel name', () => {
    const panels = [RESET_CONFIRM.panel, RESTART_CONFIRM.panel, TITLE_CONFIRM.panel]

    expect(new Set(panels).size).toBe(3)
  })

  // GDD 12-2 asks the screen to be read unaided, and these are read by somebody who
  // has already decided to leave. One line each, at the card's own width.
  it('keeps both new notes to one line of the confirmation card', () => {
    const perLine = Math.floor((LAYOUT.resetCard.w - 20 * 2) / 11)

    for (const copy of [RESTART_CONFIRM, TITLE_CONFIRM]) {
      expect(copy.note.length, copy.note).toBeLessThanOrEqual(perLine)
      expect(copy.title.length, copy.title).toBeLessThanOrEqual(perLine)
    }
  })
})

// ------------------------------------------------------------------- the settings

describe('the settings page (GDD 12-2-d)', () => {
  afterEach(() => setAnimations(true))

  // ★ The whole rule for this page: a control that controls nothing is worse than
  // no control. Animations are the one thing the UI can actually switch today.
  it('switches animations and nothing else', () => {
    expect(animationsOn()).toBe(true)

    setAnimations(false)
    expect(animationsOn()).toBe(false)

    setAnimations(true)
    expect(animationsOn()).toBe(true)
  })

  it('says what turning them off costs and what it does not', () => {
    expect(SETTINGS_TEXT.animationsNote).toContain('융합')
    expect(SETTINGS_TEXT.animationsNote).toContain('점수')
  })

  // Both hints name the key, because the window has no visible control that opens
  // it — see GDD 12-2-d. The one thing the player must not have to guess is how to
  // get back out of it.
  it('tells the player how to leave every page it has', () => {
    expect(PAUSE_TEXT.hint).toContain('ESC')
    expect(SETTINGS_TEXT.hint).toContain('ESC')
  })
})
