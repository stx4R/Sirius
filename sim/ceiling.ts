// Mechanical ceiling on a round's score — the reference GDD 13-3 condition 3
// measures target scores against.
//
// "Mechanical" means bounded by the rules, not by likely play or shop luck:
//   · one suit everywhere, so every chip feeds every line
//   · the board filled in whichever direction scores highest
//   · the strongest constellation set the rules allow at that round
//   · basic chips only
//
// Basics-only is deliberate. Specials count as two suits and exactly double the
// figure, but they have to be bought, so a curve capped against an all-special
// deck would be capped against shop luck the player cannot count on.

import { createEmptyBoard, placeChip, position } from '../src/core/board'
import {
  BOARD_SIZE,
  CONSTELLATION_MULTIPLIERS,
  MAX_PLACEMENTS_PER_TURN,
  OWNED_CONSTELLATION_LIMIT,
  STARTING_CONSTELLATION_CHOICES,
  TURNS_PER_ROUND,
} from '../src/core/config'
import type { MultiplierStackMode } from '../src/core/config'
import { scoreBoard } from '../src/core/scoring'
import type { Board, ConstellationId } from '../src/core/types'

const ALL = Object.keys(CONSTELLATION_MULTIPLIERS) as ConstellationId[]

/** Row-major and column-major floods. Which one wins depends on the axis owned. */
const FILL_ORDERS = ['rows', 'columns'] as const

function floodScore(
  owned: readonly ConstellationId[],
  stackMode: MultiplierStackMode,
  order: (typeof FILL_ORDERS)[number],
): number {
  let board: Board = createEmptyBoard()
  let placed = 0
  let total = 0

  for (let turn = 0; turn < TURNS_PER_ROUND; turn++) {
    for (let i = 0; i < MAX_PLACEMENTS_PER_TURN; i++, placed++) {
      const major = Math.floor(placed / BOARD_SIZE)
      const minor = placed % BOARD_SIZE
      if (major >= BOARD_SIZE) break
      const cell = order === 'rows' ? position(major, minor) : position(minor, major)
      board = placeChip(board, cell, { id: `c${placed}`, kind: 'basic', suit: 'GAC' })
    }
    total += scoreBoard(board, {
      owned,
      stackMode,
      // No drifter is placed, so this never runs; it only satisfies the context.
      chooseDrifterDirections: (adjacent) => adjacent,
    }).total
  }
  return total
}

function* subsets(
  pool: readonly ConstellationId[],
  size: number,
  from = 0,
  acc: ConstellationId[] = [],
): Generator<readonly ConstellationId[]> {
  if (acc.length === size) {
    yield [...acc]
    return
  }
  for (let i = from; i < pool.length; i++) {
    acc.push(pool[i])
    yield* subsets(pool, size, i + 1, acc)
    acc.pop()
  }
}

const best = (
  loadouts: Iterable<readonly ConstellationId[]>,
  stackMode: MultiplierStackMode,
): number => {
  let top = 0
  for (const owned of loadouts) {
    for (const order of FILL_ORDERS) top = Math.max(top, floodScore(owned, stackMode, order))
  }
  return top
}

/**
 * Round 1 is capped by the single starting constellation, since the shop only
 * opens after a round is cleared (GDD 13-5). Every later round is capped by the
 * full holding limit — what the economy actually affords is a separate question.
 */
export function roundCeiling(round: number, stackMode: MultiplierStackMode): number {
  if (round === 1) {
    return best(
      STARTING_CONSTELLATION_CHOICES.map((id) => [id as ConstellationId]),
      stackMode,
    )
  }
  return best(subsets(ALL, OWNED_CONSTELLATION_LIMIT), stackMode)
}

/** One entry per round. The later rounds share a value, so it is computed once. */
export function ceilings(rounds: number, stackMode: MultiplierStackMode): number[] {
  const later = rounds > 1 ? roundCeiling(2, stackMode) : 0
  return Array.from({ length: rounds }, (_, i) => (i === 0 ? roundCeiling(1, stackMode) : later))
}
