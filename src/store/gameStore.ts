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
import { MULTIPLIER_STACK_MODE } from '../core/config'
import type { MultiplierStackMode } from '../core/config'
import {
  drawHand,
  endRound,
  endTurn,
  fromLoadout,
  openShop,
  placeChips,
  startRound,
} from '../core/game'
import type { Game, Placement } from '../core/game'
import { mulberry32 } from '../core/rng'
import { scoreBoard } from '../core/scoring'
import type { ScoreResult } from '../core/scoring'
import { createStartingLoadout } from '../core/shop'
import type { Board, Chip, ConstellationId, Position } from '../core/types'

/** GDD 13-5: the player picks one to start with. P3-B has no title screen yet. */
const OPENING_CONSTELLATION: ConstellationId = 'aries'

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
}

interface GameStore {
  game: Game
  /** The turn as it stood when the hand was drawn; staged placements replay from here. */
  turnStart: Game
  staged: Placement[]
  selected: Chip | null
  settlement: Settlement | null

  newGame: (seed?: number) => void
  select: (chip: Chip) => void
  placeAt: (pos: Position) => void
  commitTurn: () => void
  dismissSettlement: () => void
  /** Dev only. Replaces core state wholesale; never call from game UI. */
  devSet: (patch: (game: Game) => Game) => void
}

const openingGame = (seed: number): Game =>
  drawHand(
    startRound(fromLoadout(createStartingLoadout(OPENING_CONSTELLATION), 'full', mulberry32(seed))),
  )

export const useGame = create<GameStore>((set, get) => ({
  game: openingGame(1),
  turnStart: openingGame(1),
  staged: [],
  selected: null,
  settlement: null,

  newGame: (seed = Date.now() % 100000) => {
    const game = openingGame(seed)
    set({ game, turnStart: game, staged: [], selected: null, settlement: null })
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
      settlement: { result, board: game.board, awarded, exact: result.total === awarded },
    })
  },

  dismissSettlement: () => {
    const { game } = get()
    let next = game

    if (next.phase === 'roundEnd') next = endRound(next)
    // There is no shop screen yet, but the visit still happens: it is where
    // иєвυℓα hands over the drifter (GDD 13-4). Opening and leaving keeps that rule.
    if (next.phase === 'shop') next = startRound(openShop(next))
    if (next.phase === 'draw') next = drawHand(next)

    set({ game: next, turnStart: next, staged: [], selected: null, settlement: null })
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
