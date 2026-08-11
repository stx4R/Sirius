// The headless round/turn state machine from GDD 4-1 (CLAUDE.md §5).
//
// This is the ONLY implementation of game flow. The simulator, the Zustand store
// and the tests all drive these transitions; none of them may keep a loop of
// their own. Every transition is a pure function of state — randomness comes
// from the injected Rng carried on the state (CLAUDE.md §8).

import { createEmptyBoard, isEmpty, placeChip } from './board'
import {
  HAND_SIZE,
  MAX_PLACEMENTS_PER_TURN,
  MODE_PRESETS,
  MULTIPLIER_STACK_MODE,
  STARDUST_REWARDS,
  TURNS_PER_ROUND,
} from './config'
import type { MultiplierStackMode } from './config'
import { createInitialDeck, drawFromDeck, returnToDeck } from './deck'
import { shuffle } from './rng'
import type { Rng } from './rng'
import { randomDrifterChooser, scoreBoard } from './scoring'
import { applyPurchase, canAfford, grantDrifter, rerollPrice, rollStock, soldOut } from './shop'
import type { Loadout, Purchase, ShopStock } from './shop'
import type {
  Board,
  Chip,
  ConstellationId,
  GameMode,
  GameState,
  Position,
} from './types'

export interface Placement {
  readonly chip: Chip
  readonly position: Position
}

/** Where the round stands. Each transition below advances it. */
export type Phase = 'draw' | 'placing' | 'turnEnd' | 'roundEnd' | 'shop' | 'over'

export type Status = 'playing' | 'cleared' | 'gameOver'

export interface Game extends GameState {
  readonly mode: GameMode
  readonly stackMode: MultiplierStackMode
  readonly phase: Phase
  readonly status: Status
  /** The deck as owned. `deck` is the shuffled draw pile for the round (GDD 4-2). */
  readonly ownedDeck: readonly Chip[]
  readonly drifterOwned: boolean
  readonly nextChipId: number
  /** Reset at the start of every round (GDD 9-2). */
  readonly rerollsUsed: number
  readonly stock: ShopStock | null
  /**
   * The target curve in force, one entry per round. Defaults to the mode preset;
   * P2 injects candidate curves so a new one can be measured without editing
   * config.ts, and an all-zero curve to sample rounds without elimination.
   */
  readonly targets: readonly number[]
  readonly rng: Rng
}

// ------------------------------------------------------------------ internals

const scoringContext = (game: Game) => ({
  owned: game.ownedConstellations,
  stackMode: game.stackMode,
  chooseDrifterDirections: randomDrifterChooser(game.rng),
})

const loadoutOf = (game: Game): Loadout => ({
  deck: game.ownedDeck,
  constellations: game.ownedConstellations,
  stardust: game.stardust,
  drifterOwned: game.drifterOwned,
  nextChipId: game.nextChipId,
  companions: game.ownedCompanions,
})

const withLoadout = (game: Game, loadout: Loadout): Game => ({
  ...game,
  ownedDeck: loadout.deck,
  ownedConstellations: [...loadout.constellations],
  stardust: loadout.stardust,
  drifterOwned: loadout.drifterOwned,
  nextChipId: loadout.nextChipId,
})

export const boardHasDrifter = (board: Board): boolean =>
  board.some((row) => row.some((cell) => cell !== null && cell.kind === 'drifter'))

// ---------------------------------------------------------------- transitions

export function startGame(
  mode: GameMode,
  rng: Rng,
  stackMode: MultiplierStackMode = MULTIPLIER_STACK_MODE,
): Game {
  return fromLoadout(
    {
      deck: createInitialDeck(),
      constellations: [],
      stardust: 0,
      drifterOwned: false,
      nextChipId: 0,
    },
    mode,
    rng,
    stackMode,
  )
}

/** Builds a game around an existing loadout, so a run can start mid-progression. */
export function fromLoadout(
  loadout: Loadout,
  mode: GameMode,
  rng: Rng,
  stackMode: MultiplierStackMode = MULTIPLIER_STACK_MODE,
  targets: readonly number[] = MODE_PRESETS[mode].TARGET_SCORES,
): Game {
  return {
    targets,
    mode,
    stackMode,
    phase: 'draw',
    status: 'playing',
    board: createEmptyBoard(),
    deck: [...loadout.deck],
    hand: [],
    ownedDeck: loadout.deck,
    ownedConstellations: [...loadout.constellations],
    ownedCompanions: [...(loadout.companions ?? [])],
    stardust: loadout.stardust,
    drifterOwned: loadout.drifterOwned,
    nextChipId: loadout.nextChipId,
    rerollsUsed: 0,
    stock: null,
    round: 1,
    turn: 1,
    roundScore: 0,
    targetScore: targets[0],
    wagerHistory: [],
    drawHistory: [],
    rng,
  }
}

/** GDD 4-2: board cleared, deck restored from the owned deck (shop purchases included) and shuffled. */
export function startRound(game: Game): Game {
  return {
    ...game,
    board: createEmptyBoard(),
    deck: shuffle(game.ownedDeck, game.rng),
    hand: [],
    turn: 1,
    roundScore: 0,
    targetScore: game.targets[game.round - 1],
    rerollsUsed: 0,
    stock: null,
    phase: 'draw',
  }
}

/** GDD 4-2: HAND_SIZE chips off the top, without replacement. */
export function drawHand(game: Game): Game {
  const { drawn, deck } = drawFromDeck(game.deck, HAND_SIZE)
  return {
    ...game,
    deck,
    hand: drawn,
    drawHistory: [...game.drawHistory, { round: game.round, turn: game.turn, drawn }],
    phase: 'placing',
  }
}

/**
 * GDD 4-2: at most MAX_PLACEMENTS_PER_TURN chips, onto empty cells, fixed immediately.
 * Placements that break those rules are dropped rather than applied.
 */
export function placeChips(game: Game, placements: readonly Placement[]): Game {
  let board = game.board
  const placed = new Set<string>()

  for (const placement of placements) {
    if (placed.size >= MAX_PLACEMENTS_PER_TURN) break
    if (placed.has(placement.chip.id)) continue
    if (!game.hand.some((chip) => chip.id === placement.chip.id)) continue
    if (!isEmpty(board, placement.position)) continue
    board = placeChip(board, placement.position, placement.chip)
    placed.add(placement.chip.id)
  }

  return {
    ...game,
    board,
    hand: game.hand.filter((chip) => !placed.has(chip.id)),
    phase: 'turnEnd',
  }
}

/** GDD 4-2: unplaced chips return to the deck and it is reshuffled, then the board settles. */
export function endTurn(game: Game): Game {
  const deck = returnToDeck(game.deck, game.hand, game.rng)
  const turnScore = scoreBoard(game.board, scoringContext(game)).total
  const lastTurn = game.turn >= TURNS_PER_ROUND

  return {
    ...game,
    deck,
    hand: [],
    roundScore: game.roundScore + turnScore,
    turn: lastTurn ? game.turn : game.turn + 1,
    phase: lastTurn ? 'roundEnd' : 'draw',
  }
}

/** GDD 4-2 (C-5) and 9-1: target check, then the clear rewards. */
export function endRound(game: Game): Game {
  if (game.roundScore < game.targetScore) {
    return { ...game, status: 'gameOver', phase: 'over' }
  }

  const overshoot = Math.min(
    STARDUST_REWARDS.overshootMax,
    Math.floor((game.roundScore - game.targetScore) / STARDUST_REWARDS.overshootDivisor),
  )
  const stardust =
    game.stardust +
    STARDUST_REWARDS.roundClearBase +
    game.round * STARDUST_REWARDS.roundClearPerRound +
    overshoot

  if (game.round >= MODE_PRESETS[game.mode].TOTAL_ROUNDS) {
    return { ...game, stardust, status: 'cleared', phase: 'over' }
  }
  return { ...game, stardust, round: game.round + 1, phase: 'shop' }
}

/** GDD 13-4: the first visit to иєвυℓα is where the drifter is handed over. */
export function openShop(game: Game): Game {
  const gifted = withLoadout(game, grantDrifter(loadoutOf(game)))
  return {
    ...gifted,
    stock: rollStock(loadoutOf(gifted), gifted.rng),
    rerollsUsed: 0,
    phase: 'shop',
  }
}

/** Ignores a purchase the player cannot afford, and sells the slot only once. */
export function buy(game: Game, purchase: Purchase): Game {
  const loadout = loadoutOf(game)
  if (!canAfford(loadout, purchase)) return game

  // `applyPurchase` hands the same loadout back when it refuses — a constellation
  // already owned, a suit the deck has none of. Nothing was paid then, so nothing
  // leaves the shelf either.
  const bought = applyPurchase(loadout, purchase)
  if (bought === loadout) return game

  return {
    ...withLoadout(game, bought),
    stock: game.stock === null ? null : soldOut(game.stock, purchase),
  }
}

/** GDD 9-2: base price, then one more stardust per use within the same shop visit. */
export function reroll(game: Game): Game {
  const price = rerollPrice(game.rerollsUsed)
  if (game.stardust < price) return game
  return {
    ...game,
    stardust: game.stardust - price,
    rerollsUsed: game.rerollsUsed + 1,
    stock: rollStock(loadoutOf(game), game.rng),
  }
}

/**
 * GDD 9-1. The question bank arrives at P5 (GDD 13 #8), so only the reward is
 * applied here; `wagerHistory` starts filling once real questions exist.
 */
export function awardWager(game: Game, correct: boolean): Game {
  return correct ? { ...game, stardust: game.stardust + STARDUST_REWARDS.wagerCorrect } : game
}

/** GDD 9-1. The score half of DRIFT ORACLE needs per-chip attribution (GDD 13 #13). */
export function awardOracle(game: Game, correct: boolean): Game {
  return correct ? { ...game, stardust: game.stardust + STARDUST_REWARDS.oracleCorrect } : game
}

// ----------------------------------------------------- headless driver (sim)

export interface TurnView {
  readonly board: Board
  readonly hand: readonly Chip[]
  readonly constellations: readonly ConstellationId[]
  readonly stackMode: MultiplierStackMode
  readonly rng: Rng
}

/** Picks up to MAX_PLACEMENTS_PER_TURN chips from the hand and where they go. */
export type PlacementPolicy = (view: TurnView) => readonly Placement[]

export interface ShopView {
  readonly stock: ShopStock
  readonly loadout: Loadout
  readonly rng: Rng
}

/** Returns the purchases to attempt, in order. Unaffordable ones are skipped. */
export type ShopPolicy = (view: ShopView) => readonly Purchase[]

/** Whether the player answered correctly. Real games ask a question; the simulator rolls. */
export type Answer = (rng: Rng) => boolean

export interface GameOptions {
  readonly mode: GameMode
  readonly stackMode: MultiplierStackMode
  readonly place: PlacementPolicy
  readonly shop: ShopPolicy
  readonly answerWager: Answer
  readonly answerOracle: Answer
  /** Overrides the mode's target curve. See `Game.targets`. */
  readonly targets?: readonly number[]
  readonly rng: Rng
  /**
   * Called once per turn with what that settlement added to the round score.
   *
   * Observation only: it draws no randomness and its return value is discarded,
   * so a seed plays out identically whether or not an observer is attached —
   * `tests/baseline-curve.test.ts` is what holds that true.
   *
   * It exists because `GameResult` reports round totals, and a refactor of
   * `settle()` can move two turns in opposite directions without moving their
   * round. Recording turns outside core would mean a second turn loop, which is
   * what this file exists to prevent (CLAUDE.md §5).
   */
  readonly onTurnSettled?: (round: number, turn: number, score: number) => void
}

export interface GameResult {
  readonly roundsCleared: number
  readonly clearedAll: boolean
  /** One entry per round actually played. */
  readonly roundScores: readonly number[]
  readonly targets: readonly number[]
  readonly finalStardust: number
  readonly turnsPlayed: number
}

/** Drives one round through the transitions above. Returns the state after endRound. */
export function playRound(game: Game, options: GameOptions): Game {
  let next = startRound(game)

  for (let turn = 0; turn < TURNS_PER_ROUND; turn++) {
    // ORION'S WAGER comes before the draw (GDD 8-2).
    next = awardWager(next, options.answerWager(next.rng))
    next = drawHand(next)
    next = placeChips(
      next,
      options.place({
        board: next.board,
        hand: next.hand,
        constellations: next.ownedConstellations,
        stackMode: next.stackMode,
        rng: next.rng,
      }),
    )
    // DRIFT ORACLE runs just before settlement, once a drifter is on the board (GDD 8-3).
    if (boardHasDrifter(next.board)) next = awardOracle(next, options.answerOracle(next.rng))
    // Read before the transition: `endTurn` advances the turn counter.
    const round = next.round
    const turn = next.turn
    const before = next.roundScore
    next = endTurn(next)
    options.onTurnSettled?.(round, turn, next.roundScore - before)
  }

  return endRound(next)
}

export function playGame(startingLoadout: Loadout, options: GameOptions): GameResult {
  let game = fromLoadout(
    startingLoadout,
    options.mode,
    options.rng,
    options.stackMode,
    options.targets,
  )
  const roundScores: number[] = []
  let roundsCleared = 0

  while (game.status === 'playing') {
    const before = game.round
    game = playRound(game, options)
    roundScores.push(game.roundScore)
    if (game.status === 'gameOver') break
    roundsCleared++
    if (game.status === 'cleared') break

    game = openShop(game)
    const stock = game.stock
    if (stock !== null) {
      for (const purchase of options.shop({ stock, loadout: loadoutOf(game), rng: game.rng })) {
        game = buy(game, purchase)
      }
    }
    if (game.round === before) break
  }

  return {
    roundsCleared,
    clearedAll: game.status === 'cleared',
    roundScores,
    targets: game.targets,
    finalStardust: game.stardust,
    turnsPlayed: roundScores.length * TURNS_PER_ROUND,
  }
}
