// Automated players approximating middle-school play at three skill levels.
// These are player models, not game rules — the weights below are simulator
// parameters and deliberately do not live in config.ts.

import { placeChip, position } from '../src/core/board'
import {
  BOARD_SIZE,
  CONSTELLATION_MULTIPLIERS,
  CONSTELLATION_RULES,
  MAX_PLACEMENTS_PER_TURN,
} from '../src/core/config'
import { shuffle } from '../src/core/rng'
import type { Rng } from '../src/core/rng'
import type { Placement, PlacementPolicy, ShopPolicy, TurnView } from '../src/core/game'
import { scoreBoard } from '../src/core/scoring'
import type { DrifterChooser } from '../src/core/scoring'
import { canAfford, priceOf } from '../src/core/shop'
import type { Loadout, Purchase, ShopStock } from '../src/core/shop'
import { SUIT_ORDER } from '../src/core/types'
import type { Board, Chip, ConstellationId, LineAxis, Position, SuitId } from '../src/core/types'

export type Tier = 'random' | 'greedy' | 'smart'

/** Credit, in points, that `smart` assigns per unit of progress toward a constellation. */
const SMART_LOOKAHEAD_WEIGHT = 12

/** Correct-answer rates for ORION'S WAGER and DRIFT ORACLE, per tier. */
export const ACCURACY: Readonly<Record<Tier, number>> = {
  random: 0.5,
  greedy: 0.65,
  smart: 0.8,
}

/**
 * During its search a player evaluates one representative drifter outcome rather
 * than the random one, so identical boards compare equally. Actual settlement
 * still rolls (GDD 3-3).
 */
const searchChooser: DrifterChooser = (adjacent) => adjacent.slice(0, 3)

function emptyPositions(board: Board): Position[] {
  const out: Position[] = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === null) out.push(position(row, col))
    }
  }
  return out
}

function suitsOf(chip: Chip): readonly SuitId[] {
  if (chip.kind === 'basic') return [chip.suit]
  if (chip.kind === 'special') return [chip.left, chip.right]
  return []
}

/** Interchangeable chips are searched once — a hand of 8 basics has at most 5 distinct types. */
function signature(chip: Chip): string {
  if (chip.kind === 'basic') return `b:${chip.suit}`
  if (chip.kind === 'special') return `s:${chip.left}:${chip.right}`
  return 'd'
}

// ------------------------------------------------------------------ placement

const randomPlacements: PlacementPolicy = ({ board, hand, rng }) => {
  const cells = shuffle(emptyPositions(board), rng)
  return shuffle(hand, rng)
    .slice(0, Math.min(MAX_PLACEMENTS_PER_TURN, cells.length))
    .map((chip, i) => ({ chip, position: cells[i] }))
}

const AXIS_STEPS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  vertical: [[1, 0]],
  horizontal: [[0, 1]],
  diagonal: [
    [1, 1],
    [1, -1],
  ],
}

/** Length of the run of `suit` through `pos` along `step`, counting `pos` itself. */
function runThrough(board: Board, pos: Position, suit: SuitId, step: readonly [number, number]) {
  let length = 1
  for (const direction of [1, -1]) {
    let row = pos.row + step[0] * direction
    let col = pos.col + step[1] * direction
    while (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
      const chip = board[row][col]
      if (chip === null || !suitsOf(chip).includes(suit)) break
      length++
      row += step[0] * direction
      col += step[1] * direction
    }
  }
  return length
}

function bestRun(board: Board, pos: Position, suit: SuitId, axis: LineAxis): number {
  const steps = AXIS_STEPS[axis]
  if (steps === undefined) return 0
  return Math.max(...steps.map((step) => runThrough(board, pos, suit, step)))
}

/**
 * Rewards a placement that grows a run toward an owned constellation's threshold
 * without reaching it yet — the payoff lands on a later turn of the same round,
 * which the immediate score cannot see.
 */
function lookahead(
  board: Board,
  pos: Position,
  chip: Chip,
  owned: readonly ConstellationId[],
): number {
  let credit = 0
  for (const suit of suitsOf(chip)) {
    for (const id of owned) {
      const rule = CONSTELLATION_RULES[id]
      if (rule.length === null) continue
      const length = bestRun(board, pos, suit, rule.axis)
      if (length < rule.length) credit += length / rule.length
    }
  }
  return credit * SMART_LOOKAHEAD_WEIGHT
}

/** Places one chip at a time, each time taking the cell that scores highest right now. */
function greedySearch(view: TurnView, useLookahead: boolean): Placement[] {
  const context = {
    owned: view.constellations,
    stackMode: view.stackMode,
    chooseDrifterDirections: searchChooser,
  }
  let board = view.board
  let remaining = [...view.hand]
  const chosen: Placement[] = []

  for (let step = 0; step < MAX_PLACEMENTS_PER_TURN; step++) {
    const cells = emptyPositions(board)
    if (cells.length === 0 || remaining.length === 0) break

    let best: { chip: Chip; position: Position; value: number } | null = null
    const seen = new Set<string>()

    for (const chip of remaining) {
      const key = signature(chip)
      if (seen.has(key)) continue
      seen.add(key)

      for (const cell of cells) {
        const next = placeChip(board, cell, chip)
        const value =
          scoreBoard(next, context).total +
          (useLookahead ? lookahead(next, cell, chip, view.constellations) : 0)
        if (best === null || value > best.value) best = { chip, position: cell, value }
      }
    }

    if (best === null) break
    board = placeChip(board, best.position, best.chip)
    chosen.push({ chip: best.chip, position: best.position })
    remaining = remaining.filter((chip) => chip.id !== best.chip.id)
  }

  return chosen
}

const greedyPlacements: PlacementPolicy = (view) => greedySearch(view, false)
const smartPlacements: PlacementPolicy = (view) => greedySearch(view, true)

// ----------------------------------------------------------------------- shop

function strength(id: ConstellationId): number {
  const spec = CONSTELLATION_MULTIPLIERS[id]
  return spec.kind === 'fixed' ? spec.value : Math.max(...Object.values(spec.table))
}

function suitCounts(deck: readonly Chip[]): Record<SuitId, number> {
  const counts: Record<SuitId, number> = { GAC: 0, IMA: 0, GIN: 0, MIM: 0, ACR: 0 }
  for (const chip of deck) for (const suit of suitsOf(chip)) counts[suit]++
  return counts
}

function weakestOwned(owned: readonly ConstellationId[]): ConstellationId | null {
  if (owned.length === 0) return null
  return [...owned].sort((a, b) => strength(a) - strength(b))[0]
}

function options(stock: ShopStock, loadout: Loadout, concentrate: boolean, rng: Rng): Purchase[] {
  const counts = suitCounts(loadout.deck)
  const ranked = [...SUIT_ORDER].sort((a, b) => counts[b] - counts[a])
  const thickest = concentrate ? ranked[0] : SUIT_ORDER[Math.floor(rng() * SUIT_ORDER.length)]
  const thinnest = concentrate
    ? ranked[ranked.length - 1]
    : SUIT_ORDER[Math.floor(rng() * SUIT_ORDER.length)]

  const list: Purchase[] = [
    ...stock.specials.map((pair): Purchase => ({ kind: 'special', pair })),
    ...stock.constellations
      .filter((id) => !loadout.constellations.includes(id))
      .map((id): Purchase => ({ kind: 'constellation', id, replaces: weakestOwned(loadout.constellations) })),
    { kind: 'removeBasic', suit: thinnest },
    { kind: 'addBasic', suit: thickest },
  ]
  if (stock.drifter) list.push({ kind: 'drifter' })
  return list
}

/** Buys the most expensive thing it can still afford, each stock item at most once. */
const spendHigh =
  (concentrate: boolean): ShopPolicy =>
  ({ stock, loadout, rng }) => {
    const wanted = options(stock, loadout, concentrate, rng).sort((a, b) => priceOf(b) - priceOf(a))
    const plan: Purchase[] = []
    let purse = loadout
    for (const purchase of wanted) {
      if (!canAfford(purse, purchase)) continue
      plan.push(purchase)
      purse = { ...purse, stardust: purse.stardust - priceOf(purchase) }
    }
    return plan
  }

const spendRandom: ShopPolicy = ({ stock, loadout, rng }) => {
  const wanted = shuffle(options(stock, loadout, false, rng), rng)
  const plan: Purchase[] = []
  let purse = loadout
  for (const purchase of wanted) {
    if (!canAfford(purse, purchase)) continue
    plan.push(purchase)
    purse = { ...purse, stardust: purse.stardust - priceOf(purchase) }
  }
  return plan
}

// --------------------------------------------------------------------- tiers

export interface PlayerProfile {
  readonly place: PlacementPolicy
  readonly shop: ShopPolicy
  readonly accuracy: number
}

export const PLAYERS: Readonly<Record<Tier, PlayerProfile>> = {
  random: { place: randomPlacements, shop: spendRandom, accuracy: ACCURACY.random },
  greedy: { place: greedyPlacements, shop: spendHigh(false), accuracy: ACCURACY.greedy },
  smart: { place: smartPlacements, shop: spendHigh(true), accuracy: ACCURACY.smart },
}

export const TIERS: readonly Tier[] = ['random', 'greedy', 'smart']
