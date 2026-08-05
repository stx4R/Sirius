// Automated players approximating middle-school play at three skill levels.
// These are player models, not game rules — the weights and search limits below
// are simulator parameters and deliberately do not live in config.ts.
//
// The players only supply policies; core/game.ts owns the loop (CLAUDE.md §5).

import { placeChip, position } from '../src/core/board'
import {
  BOARD_SIZE,
  CONSTELLATION_MULTIPLIERS,
  CONSTELLATION_RULES,
  MAX_PLACEMENTS_PER_TURN,
  SHOP_PRICES,
} from '../src/core/config'
import type { Placement, PlacementPolicy, ShopPolicy, TurnView } from '../src/core/game'
import { shuffle } from '../src/core/rng'
import { scoreBoard } from '../src/core/scoring'
import type { DrifterChooser } from '../src/core/scoring'
import { canAfford, priceOf } from '../src/core/shop'
import type { Loadout, Purchase, ShopStock } from '../src/core/shop'
import { SUIT_ORDER } from '../src/core/types'
import type {
  Board,
  BoardCell,
  Chip,
  ConstellationId,
  LineAxis,
  Position,
  SuitId,
} from '../src/core/types'

export type Tier = 'random' | 'greedy' | 'smart'

export const TIERS: readonly Tier[] = ['random', 'greedy', 'smart']

/** Correct-answer rates for ORION'S WAGER and DRIFT ORACLE (GDD 8-2, 8-3). */
export const ACCURACY: Readonly<Record<Tier, number>> = {
  random: 0.5,
  greedy: 0.65,
  smart: 0.8,
}

/** Cells fully settled per chip per placement step. See SEARCH NOTES below. */
const SEARCH_CANDIDATES = 8

/** Points `smart` credits per unit of progress toward an owned constellation. */
const SMART_LOOKAHEAD_WEIGHT = 12

/** How many suits `smart` tries to concentrate its deck into. */
const SMART_TARGET_SUITS = 3

/** Removals `smart` will buy in one shop visit. */
const SMART_MAX_REMOVALS = 2

/**
 * During its search a player evaluates one representative drifter outcome rather
 * than the random one, so identical boards compare equally. Actual settlement
 * still rolls (GDD 3-3).
 */
const searchChooser: DrifterChooser = (adjacent) => adjacent.slice(0, 3)

const LINE_STEPS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
]

const AXIS_STEPS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  vertical: [[1, 0]],
  horizontal: [[0, 1]],
  diagonal: [
    [1, 1],
    [1, -1],
  ],
}

const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

// ------------------------------------------------------------------- run log

/** Per-run instrumentation, filled by the policies as they are invoked. */
export interface RunLog {
  /** Round after which the drifter was bought, or null if it never was. */
  drifterBoughtAfterRound: number | null
  /** Settlements observed with the drifter on the board. */
  drifterTurns: number
  /** Summed marginal points of the drifter cell across those settlements. */
  drifterPoints: number
  shopVisits: number
}

export const newRunLog = (): RunLog => ({
  drifterBoughtAfterRound: null,
  drifterTurns: 0,
  drifterPoints: 0,
  shopVisits: 0,
})

// ------------------------------------------------------------------ helpers

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

const inBoard = (row: number, col: number) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE

function countsAs(cell: BoardCell, suit: SuitId): boolean {
  return cell !== null && suitsOf(cell).includes(suit)
}

/** Run of `suit` through (row, col) along `step`, counting the cell itself. */
function runLength(
  board: Board,
  row: number,
  col: number,
  suit: SuitId,
  step: readonly [number, number],
): number {
  let length = 1
  for (const direction of [1, -1]) {
    let r = row + step[0] * direction
    let c = col + step[1] * direction
    while (inBoard(r, c) && countsAs(board[r][c], suit)) {
      length++
      r += step[0] * direction
      c += step[1] * direction
    }
  }
  return length
}

function hasAdjacentDrifter(board: Board, row: number, col: number): boolean {
  return ORTHOGONAL.some(([dr, dc]) => {
    const cell = inBoard(row + dr, col + dc) ? board[row + dr][col + dc] : null
    return cell !== null && cell.kind === 'drifter'
  })
}

/**
 * SEARCH NOTES — why the search is not exhaustive.
 *
 * A cell is *inert* for a suit when nothing in its row, column or either
 * diagonal already counts as that suit, and no drifter sits beside it. Placing
 * there yields a run of 1, which no constellation fires on (every threshold is
 * 3 or more) and which no ㅅ/ㅗ shape can use, so the marginal score is the flat
 * base — identical for every inert cell. Collapsing them to one representative
 * is exact, not an approximation, and on an empty board it turns 25 candidate
 * cells into 1.
 *
 * The remaining live cells are ranked by the runs they would create and only the
 * best SEARCH_CANDIDATES are settled in full. That part *is* an approximation;
 * `npm run sim -- --compare-search` prints it against the exhaustive search. At
 * 60 runs the round means agree within 1.2% at half the cost, so the pruning does
 * not cost the player measurable strength.
 */
function isInert(board: Board, row: number, col: number, suit: SuitId): boolean {
  if (hasAdjacentDrifter(board, row, col)) return false
  for (const step of LINE_STEPS) {
    for (const direction of [1, -1]) {
      let r = row + step[0] * direction
      let c = col + step[1] * direction
      while (inBoard(r, c)) {
        if (countsAs(board[r][c], suit)) return false
        r += step[0] * direction
        c += step[1] * direction
      }
    }
  }
  return true
}

/** Cheap rank: how much run this placement would build, before any full settlement. */
function promise(board: Board, row: number, col: number, chip: Chip): number {
  if (chip.kind === 'drifter') {
    return ORTHOGONAL.filter(([dr, dc]) => {
      const cell = inBoard(row + dr, col + dc) ? board[row + dr][col + dc] : null
      return cell !== null
    }).length
  }
  let total = 0
  for (const suit of suitsOf(chip)) {
    for (const step of LINE_STEPS) total += runLength(board, row, col, suit, step) ** 2
  }
  return total
}

function candidateCells(board: Board, chip: Chip, exhaustive: boolean): Position[] {
  const live: Position[] = []
  let inertRepresentative: Position | null = null
  const suits = suitsOf(chip)

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] !== null) continue
      if (exhaustive) {
        live.push(position(row, col))
        continue
      }
      const inert =
        chip.kind !== 'drifter' &&
        suits.every((suit) => isInert(board, row, col, suit)) &&
        !hasAdjacentDrifter(board, row, col)
      if (inert) {
        if (inertRepresentative === null) inertRepresentative = position(row, col)
      } else {
        live.push(position(row, col))
      }
    }
  }

  if (exhaustive) return live

  const ranked = live
    .map((cell) => ({ cell, rank: promise(board, cell.row, cell.col, chip) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, SEARCH_CANDIDATES)
    .map((entry) => entry.cell)

  return inertRepresentative === null ? ranked : [...ranked, inertRepresentative]
}

function bestRun(board: Board, pos: Position, suit: SuitId, axis: LineAxis): number {
  const steps = AXIS_STEPS[axis]
  if (steps === undefined) return 0
  return Math.max(...steps.map((step) => runLength(board, pos.row, pos.col, suit, step)))
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

// ---------------------------------------------------------------- placement

const randomPlacements: PlacementPolicy = ({ board, hand, rng }) => {
  const cells: Position[] = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === null) cells.push(position(row, col))
    }
  }
  const shuffled = shuffle(cells, rng)
  return shuffle(hand, rng)
    .slice(0, Math.min(MAX_PLACEMENTS_PER_TURN, shuffled.length))
    .map((chip, index) => ({ chip, position: shuffled[index] }))
}

/** Marginal points the drifter cell contributes to `board`, versus leaving it empty. */
function drifterContribution(board: Board, view: TurnView): number | null {
  let spot: Position | null = null
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col]
      if (cell !== null && cell.kind === 'drifter') spot = position(row, col)
    }
  }
  if (spot === null) return null

  const context = {
    owned: view.constellations,
    stackMode: view.stackMode,
    chooseDrifterDirections: searchChooser,
  }
  const without = board.map((row, r) =>
    row.map((cell, c) => (r === spot.row && c === spot.col ? null : cell)),
  ) as Board

  return scoreBoard(board, context).total - scoreBoard(without, context).total
}

/** Places one chip at a time, each time taking the cell that settles highest. */
function greedySearch(
  view: TurnView,
  useLookahead: boolean,
  log: RunLog | null,
  exhaustive = false,
): Placement[] {
  const context = {
    owned: view.constellations,
    stackMode: view.stackMode,
    chooseDrifterDirections: searchChooser,
  }
  let board = view.board
  let remaining = [...view.hand]
  const chosen: Placement[] = []

  for (let step = 0; step < MAX_PLACEMENTS_PER_TURN; step++) {
    if (remaining.length === 0) break

    let best: { chip: Chip; position: Position; value: number } | null = null
    const seen = new Set<string>()

    for (const chip of remaining) {
      const key = signature(chip)
      if (seen.has(key)) continue
      seen.add(key)

      for (const cell of candidateCells(board, chip, exhaustive)) {
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

  // `board` is exactly what core will settle this turn, so this is the real
  // contribution rather than a reconstruction (CLAUDE.md §5 keeps the loop in core).
  if (log !== null) {
    const contribution = drifterContribution(board, view)
    if (contribution !== null) {
      log.drifterTurns++
      log.drifterPoints += contribution
    }
  }

  return chosen
}

// --------------------------------------------------------------------- shop

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

const axesOwned = (owned: readonly ConstellationId[]): Set<LineAxis> =>
  new Set(owned.map((id) => CONSTELLATION_RULES[id].axis))

function constellationBuys(stock: ShopStock, loadout: Loadout, preferOverlap: boolean): Purchase[] {
  const axes = axesOwned(loadout.constellations)
  const ranked = [...stock.constellations].sort((a, b) => {
    if (preferOverlap) {
      const overlap =
        Number(axes.has(CONSTELLATION_RULES[b].axis)) -
        Number(axes.has(CONSTELLATION_RULES[a].axis))
      if (overlap !== 0) return overlap
    }
    return strength(b) - strength(a)
  })
  return ranked.map((id) => ({
    kind: 'constellation',
    id,
    replaces: weakestOwned(loadout.constellations),
  }))
}

/**
 * greedy: drifter, then constellations, specials, and a basic top-up.
 * smart: the same, but constellations sharing an axis with what it already owns
 * come first and it thins the deck toward SMART_TARGET_SUITS.
 */
function plannedBuys(view: { stock: ShopStock; loadout: Loadout }, smart: boolean): Purchase[] {
  const { stock, loadout } = view
  const counts = suitCounts(loadout.deck)
  const byCount = [...SUIT_ORDER].sort((a, b) => counts[b] - counts[a])
  const plan: Purchase[] = []

  // Only one drifter exists per game, so it is taken as soon as it is affordable.
  if (stock.drifter && loadout.stardust >= SHOP_PRICES.drifterChip) plan.push({ kind: 'drifter' })

  plan.push(...constellationBuys(stock, loadout, smart))
  plan.push(...stock.specials.map((pair): Purchase => ({ kind: 'special', pair })))

  if (smart) {
    for (const suit of byCount.slice(SMART_TARGET_SUITS, SMART_TARGET_SUITS + SMART_MAX_REMOVALS)) {
      if (counts[suit] > 0) plan.push({ kind: 'removeBasic', suit })
    }
  }
  plan.push({ kind: 'addBasic', suit: byCount[0] })
  return plan
}

/** Drops anything the purse cannot reach, in the order the plan lists it. */
function affordable(plan: readonly Purchase[], loadout: Loadout): Purchase[] {
  const kept: Purchase[] = []
  let purse = loadout
  for (const purchase of plan) {
    if (!canAfford(purse, purchase)) continue
    kept.push(purchase)
    purse = { ...purse, stardust: purse.stardust - priceOf(purchase) }
  }
  return kept
}

function makeShopPolicy(tier: Tier, log: RunLog | null): ShopPolicy {
  return ({ stock, loadout, rng }) => {
    const plan =
      tier === 'random'
        ? shuffle(
            [
              ...stock.specials.map((pair): Purchase => ({ kind: 'special', pair })),
              ...constellationBuys(stock, loadout, false),
              { kind: 'addBasic' as const, suit: SUIT_ORDER[Math.floor(rng() * SUIT_ORDER.length)] },
              { kind: 'removeBasic' as const, suit: SUIT_ORDER[Math.floor(rng() * SUIT_ORDER.length)] },
              ...(stock.drifter ? [{ kind: 'drifter' as const }] : []),
            ],
            rng,
          )
        : plannedBuys({ stock, loadout }, tier === 'smart')

    const buys = affordable(plan, loadout)

    if (log !== null) {
      log.shopVisits++
      if (log.drifterBoughtAfterRound === null && buys.some((p) => p.kind === 'drifter')) {
        log.drifterBoughtAfterRound = log.shopVisits
      }
    }
    return buys
  }
}

// -------------------------------------------------------------------- tiers

export interface PlayerProfile {
  readonly place: PlacementPolicy
  readonly shop: ShopPolicy
  readonly wagerAccuracy: number
  readonly oracleAccuracy: number
}

export interface PlayerOptions {
  /** Overrides the WAGER rate only, leaving DRIFT ORACLE at the tier default (GDD 13-2 ②). */
  readonly wagerAccuracy?: number
  /** Full search instead of the pruned one, for the calibration run. */
  readonly exhaustive?: boolean
}

export function makePlayer(tier: Tier, log: RunLog | null, opts: PlayerOptions = {}): PlayerProfile {
  const exhaustive = opts.exhaustive ?? false
  const place: PlacementPolicy =
    tier === 'random'
      ? randomPlacements
      : (view) => greedySearch(view, tier === 'smart', log, exhaustive)

  return {
    place,
    shop: makeShopPolicy(tier, log),
    wagerAccuracy: opts.wagerAccuracy ?? ACCURACY[tier],
    oracleAccuracy: ACCURACY[tier],
  }
}
