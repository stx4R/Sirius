// Zustand wrapper around core/game.ts.
//
// CLAUDE.md §5: no game rule lives here. Every transition is a call into core,
// and the only state this file owns beyond core's is what the *pointer* is doing
// — which chip is picked up, and which placements the player has proposed but
// not yet committed.
//
// Placements are staged rather than applied one at a time on purpose. Core
// enforces the per-turn limit inside a single `placeChips` call, so calling it
// once per chip would quietly bypass the limit. Instead the turn's opening state
// is kept and the whole staged list is replayed through core on every change:
// core stays the only thing that decides which placements are legal.

import { create } from 'zustand'
import { isEmpty } from '../core/board'
import {
  DEFAULT_MODE,
  MULTIPLIER_STACK_MODE,
  STARTING_CONSTELLATION_CHOICES,
} from '../core/config'
import type { MultiplierStackMode } from '../core/config'
import {
  askWager,
  buy,
  drawHand,
  endRound,
  endTurn,
  fromLoadout,
  openShop,
  placeChips,
  reroll,
  resolveWager,
  startRound,
} from '../core/game'
import type { Game, Placement } from '../core/game'
import { mulberry32 } from '../core/rng'
import { scoreBoard } from '../core/scoring'
import type { ScoreResult } from '../core/scoring'
import { createStartingLoadout } from '../core/shop'
import type { Purchase } from '../core/shop'
import type {
  Board,
  Chip,
  ConstellationId,
  GameMode,
  Position,
  WagerChoice,
  WagerRecord,
} from '../core/types'

/**
 * What the title screen decides before a run can be built: how long it runs
 * (GDD 12-3) and which constellation it opens holding (GDD 13-5). Both used to
 * be constants here because P3-B had no screen to ask on.
 */
export interface RunSetup {
  readonly mode: GameMode
  readonly starting: ConstellationId
}

/**
 * The setup the store is seeded with before anyone has chosen anything.
 *
 * A run has to exist for `game` to be non-null, but this one is never played:
 * `started` is false until the title screen calls `startRun`, and the title is
 * what is on screen until then. Both values come from config rather than being
 * picked here, so this placeholder cannot drift from what the game defaults to.
 */
const PLACEHOLDER_SETUP: RunSetup = {
  mode: DEFAULT_MODE,
  starting: STARTING_CONSTELLATION_CHOICES[0],
}

/**
 * `?seed=12345` pins every run this page starts, so a screenshot run or a bug
 * report can be replayed draw for draw. Anything else — no query, not a number,
 * negative — falls through to the clock, which is what a player has to get: a
 * booth machine replaying one fixed run would deal the same hands all day.
 *
 * Read once, here, rather than per run. The query cannot change without a reload,
 * and this is the only place the URL is allowed to reach the game — core takes an
 * injected `Rng` and knows nothing about a browser (CLAUDE.md §5, §8).
 */
function pinnedSeed(): number | null {
  if (typeof window === 'undefined') return null

  const raw = new URLSearchParams(window.location.search).get('seed')
  if (raw === null || raw.trim() === '') return null

  const value = Number(raw)
  return Number.isInteger(value) && value >= 0 ? value : null
}

const PINNED_SEED = pinnedSeed()

/** The pinned seed when there is one, otherwise a fresh run off the clock. */
const defaultSeed = (): number => PINNED_SEED ?? Date.now() % 100000

/**
 * Settlement rolls the drifter's reading (GDD 3-3), so a breakdown computed for
 * display would consume the generator and diverge from the score core awards.
 * The breakdown therefore reads one fixed outcome, and the store compares its
 * total against what core actually added — see `settlementIsExact`.
 */
const displayChooser = (adjacent: readonly Position[]) => adjacent.slice(0, 3)

export interface Settlement {
  readonly result: ScoreResult
  /** The board as it was settled, so the display can highlight the right cells. */
  readonly board: Board
  /** What core added to the round score. Authoritative. */
  readonly awarded: number
  /** False when the drifter's roll made the breakdown differ from the award. */
  readonly exact: boolean
  /**
   * The turn this settles, captured before `endTurn` advances the counter. The
   * header would otherwise read "턴 2" while turn 1 was still being counted.
   * Display only — core's transitions are unchanged (GDD 4-1).
   */
  readonly turn: number
  /** The round score this turn started from, so the total counts up from it. */
  readonly roundScoreBefore: number
}

interface GameStore {
  game: Game
  /** The turn as it stood when the hand was drawn; staged placements replay from here. */
  turnStart: Game
  staged: Placement[]
  selected: Chip | null
  settlement: Settlement | null
  /**
   * The wager just answered, held so the explanation can be read (GDD 8-2 asks
   * for it immediately). Core has already scored and recorded it — this is the
   * same record, kept back only because the screen has to show it before the
   * turn moves on.
   */
  wagerResult: WagerRecord | null
  /**
   * The seed this run was built from. ORION's lines are drawn from a generator
   * of their own, seeded off this one (CLAUDE.md §8) — taking them from
   * `game.rng` would spend draws the deck and the drifter are counting on, and a
   * replayed seed would stop producing the same run.
   */
  seed: number
  /** The title screen's answers, kept so a restart replays the same kind of run. */
  setup: RunSetup
  /** False while the title screen is up. `game` holds a placeholder run until then. */
  started: boolean

  /** GDD 12-2 ④: the title screen commits both choices and the run begins. */
  startRun: (setup: RunSetup, seed?: number) => void
  /** Back to the title, so the next participant chooses for themselves. */
  toTitle: () => void
  newGame: (seed?: number) => void
  select: (chip: Chip) => void
  placeAt: (pos: Position) => void
  commitTurn: () => void
  dismissSettlement: () => void
  /** GDD 8-2. Core scores it, records it, and only then is the hand dealt. */
  answerWager: (choice: WagerChoice) => void
  /** Closes the explanation. The turn is already under way behind it. */
  dismissWager: () => void
  /** GDD 9-2. Core decides whether the purse reaches and what leaves the shelf. */
  buyItem: (purchase: Purchase) => void
  rerollStock: () => void
  /** GDD 4-2: leaving the shop is what starts the next round. */
  leaveShop: () => void
  /** Dev only. Replaces core state wholesale; never call from game UI. */
  devSet: (patch: (game: Game) => Game) => void
}

/**
 * A run opens on its first wager rather than on a hand: GDD 8-2 puts the
 * question before the draw, so there is nothing to deal until it is answered.
 */
const openingGame = (setup: RunSetup, seed: number): Game =>
  askWager(
    startRound(fromLoadout(createStartingLoadout(setup.starting), setup.mode, mulberry32(seed))),
  )

const placeholder = openingGame(PLACEHOLDER_SETUP, 1)

export const useGame = create<GameStore>((set, get) => ({
  game: placeholder,
  turnStart: placeholder,
  staged: [],
  selected: null,
  settlement: null,
  wagerResult: null,
  seed: 1,
  setup: PLACEHOLDER_SETUP,
  started: false,

  startRun: (setup, seed = defaultSeed()) => {
    const game = openingGame(setup, seed)
    set({
      game,
      turnStart: game,
      staged: [],
      selected: null,
      settlement: null,
      wagerResult: null,
      seed,
      setup,
      started: true,
    })
  },

  toTitle: () => set({ started: false }),

  newGame: (seed = defaultSeed()) => {
    const game = openingGame(get().setup, seed)
    set({
      game,
      turnStart: game,
      staged: [],
      selected: null,
      settlement: null,
      wagerResult: null,
      seed,
    })
  },

  select: (chip) => set({ selected: get().selected?.id === chip.id ? null : chip }),

  placeAt: (pos) => {
    const { turnStart, staged, selected, game } = get()
    if (selected === null || !isEmpty(game.board, pos)) return

    const next = [...staged, { chip: selected, position: pos }]
    const replayed = placeChips(turnStart, next)
    // Core takes a chip out of the hand for each placement it accepts. If the
    // hand did not shrink, it refused this one — the turn is full, or the
    // placement broke a rule. Either way the answer came from core, not here.
    if (replayed.hand.length === game.hand.length) return set({ selected: null })

    set({ game: replayed, staged: next, selected: null })
  },

  commitTurn: () => {
    const { game } = get()
    const result = scoreBoard(game.board, {
      owned: game.ownedConstellations,
      stackMode: game.stackMode,
      chooseDrifterDirections: displayChooser,
    })

    const settled = endTurn(game)
    const awarded = settled.roundScore - game.roundScore

    set({
      game: settled,
      staged: [],
      selected: null,
      settlement: {
        result,
        board: game.board,
        awarded,
        exact: result.total === awarded,
        turn: game.turn,
        roundScoreBefore: game.roundScore,
      },
    })
  },

  dismissSettlement: () => {
    const { game } = get()
    let next = game

    if (next.phase === 'roundEnd') next = endRound(next)
    // The shop is a screen of its own from P4-A, so the walk stops here: core
    // rolls the stock and hands over the drifter (GDD 13-4), and the next round
    // does not start until `leaveShop`.
    if (next.phase === 'shop') next = openShop(next)
    else if (next.phase === 'draw') next = askWager(next)

    set({ game: next, turnStart: next, staged: [], selected: null, settlement: null })
  },

  answerWager: (choice) => {
    const { game } = get()
    if (game.pendingWager === null) return

    const scored = resolveWager(game, choice)
    // Core hands the game straight back when the choice is not open — abstaining
    // inside the tutorial window (GDD 8-2). Nothing was recorded, so nothing here
    // moves either.
    if (scored === game) return

    set({ game: scored, wagerResult: scored.wagerHistory[scored.wagerHistory.length - 1] })
  },

  // The hand is dealt here rather than on the answer, so the prediction is fully
  // settled — read explanation and all — before the draw it was about happens.
  // It also keeps the shuffle beat visible: dealt behind the panel, it would run
  // out while the explanation was still being read (see `Game.tsx`).
  dismissWager: () => {
    const { game, wagerResult } = get()
    if (wagerResult === null) return

    const drawn = drawHand(game)
    set({ game: drawn, turnStart: drawn, staged: [], selected: null, wagerResult: null })
  },

  buyItem: (purchase) => {
    const game = buy(get().game, purchase)
    set({ game, turnStart: game })
  },

  rerollStock: () => {
    const game = reroll(get().game)
    set({ game, turnStart: game })
  },

  leaveShop: () => {
    if (get().game.phase !== 'shop') return
    const game = askWager(startRound(get().game))
    set({ game, turnStart: game, staged: [], selected: null, settlement: null, wagerResult: null })
  },

  devSet: (patch) => {
    const game = patch(get().game)
    set({ game, turnStart: game, staged: [], selected: null })
  },
}))

/** A live look at what the board would score right now. Dev panel only. */
export function previewScore(game: Game): ScoreResult {
  return scoreBoard(game.board, {
    owned: game.ownedConstellations,
    stackMode: game.stackMode,
    chooseDrifterDirections: displayChooser,
  })
}

export const stackMode: MultiplierStackMode = MULTIPLIER_STACK_MODE
