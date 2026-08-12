// The first-run coach marks and the shortened wager explanation (GDD 12-2 ①, 8-2).
//
// Both are BOOTH-6b, and both are pure functions on purpose. The coach has no
// state of its own — `coachStep` reads the game the screen is already showing —
// so the thing worth testing is that walking a first turn lights each caption
// exactly once and in order, and that nothing lights it again afterwards.

import { describe, expect, it } from 'vitest'
import {
  FORCED_WAGER_COUNT,
  MAX_PLACEMENTS_PER_TURN,
  STARTING_CONSTELLATION_CHOICES,
  TURNS_PER_ROUND,
} from '../src/core/config'
import type { WagerRecord } from '../src/core/types'
import { COACH_ORDER, coachLine, coachStep } from '../src/ui/Coach'
import type { CoachStep, CoachView } from '../src/ui/Coach'
import { conditionOf, multiplierOf } from '../src/ui/ConstellationCard'
import { showsExplanation } from '../src/ui/Wager'

/** Round 1, turn 1, nothing open, nothing done. */
const AT_REST: CoachView = {
  round: 1,
  turn: 1,
  shuffling: false,
  pendingWager: false,
  wagerOpen: false,
  oracleOpen: false,
  reportOpen: false,
  answered: 0,
  holding: false,
  placed: 0,
  settlingTurn: null,
}

const view = (patch: Partial<CoachView>): CoachView => ({ ...AT_REST, ...patch })

describe('coachStep (GDD 12-2 ①)', () => {
  /**
   * A first turn, in the order the store actually moves through it: the opening
   * wager, its explanation, the deal, a chip picked up, a chip placed, the
   * settlement. Each entry is what the screen looks like at that moment and the
   * caption it should be showing.
   */
  const FIRST_TURN: readonly { readonly at: string; readonly view: CoachView; readonly step: CoachStep | null }[] = [
    {
      at: 'the run opens on its first wager',
      view: view({ pendingWager: true, wagerOpen: true }),
      step: 'wager',
    },
    {
      at: 'the wager is answered and its verdict is up',
      view: view({ wagerOpen: true, answered: 1 }),
      step: null,
    },
    {
      at: 'the deck is being shuffled',
      view: view({ answered: 1, shuffling: true }),
      step: null,
    },
    { at: 'the hand has landed', view: view({ answered: 1 }), step: 'hand' },
    { at: 'a chip is held', view: view({ answered: 1, holding: true }), step: 'board' },
    { at: 'one chip is down', view: view({ answered: 1, placed: 1 }), step: 'limit' },
    {
      at: 'the turn is full',
      view: view({ answered: 1, placed: MAX_PLACEMENTS_PER_TURN }),
      step: 'limit',
    },
    {
      at: 'the settlement is walking',
      // Core advanced the counter inside `endTurn`, so the game says turn 2.
      view: view({ answered: 1, turn: 2, placed: 0, settlingTurn: 1 }),
      step: 'target',
    },
  ]

  it('lights each caption at its own moment', () => {
    for (const { at, view: state, step } of FIRST_TURN) {
      expect(coachStep(state), at).toBe(step)
    }
  })

  it('walks the five captions in order and shows each exactly once', () => {
    const seen = FIRST_TURN.map(({ view: state }) => coachStep(state)).filter(
      (step): step is CoachStep => step !== null,
    )
    // 'limit' holds across two of the moments above, which is one caption and not two.
    const distinct = seen.filter((step, i) => step !== seen[i - 1])

    expect(distinct).toEqual(COACH_ORDER)
  })

  it('shows nothing from round 2 on', () => {
    for (const { view: state } of FIRST_TURN) {
      expect(coachStep({ ...state, round: 2 })).toBeNull()
    }
  })

  it('shows nothing after the first turn of round 1', () => {
    for (let turn = 2; turn <= TURNS_PER_ROUND; turn++) {
      expect(coachStep(view({ answered: turn, turn }))).toBeNull()
      expect(coachStep(view({ answered: turn, turn, holding: true }))).toBeNull()
      expect(coachStep(view({ answered: turn, turn: turn + 1, settlingTurn: turn }))).toBeNull()
    }
  })

  // Only the first wager of the run gets a caption. Later ones are the same modal
  // and the player has answered one already.
  it('captions only the opening wager', () => {
    expect(coachStep(view({ pendingWager: true, wagerOpen: true, answered: 0 }))).toBe('wager')
    for (const answered of [1, 2, FORCED_WAGER_COUNT, 9]) {
      expect(coachStep(view({ pendingWager: true, wagerOpen: true, answered }))).toBeNull()
    }
  })

  // The captions draw above the modals so the wager step can sit under its own
  // panel. Every other step therefore has to stand down while one is open, or it
  // would cover what is being read.
  it('stands down behind the oracle and the report', () => {
    expect(coachStep(view({ answered: 1, placed: 2, oracleOpen: true }))).toBeNull()
    expect(coachStep(view({ answered: 1, placed: 2, reportOpen: true }))).toBeNull()
    expect(coachStep(view({ answered: 1, turn: 2, settlingTurn: 1, reportOpen: true }))).toBeNull()
  })

  // A chip put back down returns the player to the step that asks them to pick one.
  it('goes back a step when a held chip is put down', () => {
    expect(coachStep(view({ answered: 1, holding: true }))).toBe('board')
    expect(coachStep(view({ answered: 1, holding: false }))).toBe('hand')
  })
})

describe('coachLine (GDD 12-2 ①, 13-5)', () => {
  // The whole point of GDD 13-5's two starting choices is that they differ in
  // axis, so a hardcoded "세로로 3개" would teach the wrong thing to half the
  // players. The line is built from the same two helpers the card prints.
  it('takes the board line from the constellation the player chose', () => {
    for (const id of STARTING_CONSTELLATION_CHOICES) {
      const line = coachLine('board', id, 490)

      expect(line).toContain(conditionOf(id))
      expect(line).toContain(multiplierOf(id))
    }
  })

  it('gives the two starting choices different board lines', () => {
    const [first, second] = STARTING_CONSTELLATION_CHOICES

    expect(coachLine('board', first, 490)).not.toBe(coachLine('board', second, 490))
  })

  it('still says something with no constellation held', () => {
    expect(coachLine('board', null, 490).length).toBeGreaterThan(0)
  })

  it('reads its figures off config rather than repeating them', () => {
    expect(coachLine('limit', 'aries', 490)).toContain(String(MAX_PLACEMENTS_PER_TURN))
    expect(coachLine('target', 'aries', 490)).toContain(String(TURNS_PER_ROUND))
    expect(coachLine('target', 'aries', 490)).toContain('490')
    expect(coachLine('target', 'aries', 1530)).toContain('1,530')
  })

  // BOOTH-6a set the budget: a booth participant does not read long captions, and
  // one that wraps past its 40px box is clipped rather than shortened.
  it('keeps every caption to 30 characters', () => {
    for (const step of COACH_ORDER) {
      for (const id of STARTING_CONSTELLATION_CHOICES) {
        const line = coachLine(step, id, 490)

        expect(line.length, `${step}: ${line}`).toBeLessThanOrEqual(30)
        expect(line.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('showsExplanation (GDD 8-2)', () => {
  const record = (correct: boolean, choice: WagerRecord['choice'] = 'yes'): WagerRecord => ({
    round: 1,
    turn: 1,
    choice,
    correct,
    question: { text: '?', answer: true, tier: 'comparison', explanation: '.' },
  })

  it('always explains a miss', () => {
    for (const answered of [1, FORCED_WAGER_COUNT, FORCED_WAGER_COUNT + 1, 15]) {
      expect(showsExplanation(record(false), answered)).toBe(true)
    }
  })

  // An abstention is recorded with `correct: false` (GDD 8-2), so it explains for
  // the same reason a wrong answer does.
  it('always explains an abstention', () => {
    expect(showsExplanation(record(false, 'abstain'), 15)).toBe(true)
  })

  // The tutorial window is the point: there the reasoning matters more than the
  // score. `answered` counts the wager that was just recorded, so the boundary
  // is `<=` — the FORCED_WAGER_COUNT-th wager is still inside it.
  it('explains a hit inside the tutorial window and not after it', () => {
    for (let answered = 1; answered <= FORCED_WAGER_COUNT; answered++) {
      expect(showsExplanation(record(true), answered), `wager ${answered}`).toBe(true)
    }
    for (const answered of [FORCED_WAGER_COUNT + 1, 15]) {
      expect(showsExplanation(record(true), answered), `wager ${answered}`).toBe(false)
    }
  })
})
