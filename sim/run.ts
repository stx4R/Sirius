// One seeded playthrough. Same config, same seed → same result.
// The loop itself lives in core/game.ts; this only supplies policies (CLAUDE.md §5).

import { STARTING_CONSTELLATION_CHOICES } from '../src/core/config'
import type { MultiplierStackMode } from '../src/core/config'
import { createInitialDeck } from '../src/core/deck'
import { playGame } from '../src/core/game'
import type { GameResult } from '../src/core/game'
import { mulberry32 } from '../src/core/rng'
import type { Rng } from '../src/core/rng'
import { createStartingLoadout } from '../src/core/shop'
import type { Loadout } from '../src/core/shop'
import type { GameMode } from '../src/core/types'
import { makePlayer, newRunLog } from './player'
import type { RunLog, Tier } from './player'

export interface RunConfig {
  readonly seed: number
  readonly tier: Tier
  readonly stackMode: MultiplierStackMode
  readonly mode: GameMode
  /** Overrides the WAGER rate only (GDD 13-2 ②). */
  readonly wagerAccuracy?: number
  /** Full placement search, for the search-calibration run only. */
  readonly exhaustive?: boolean
  /** GDD 13-5. `false` reproduces the pre-13-5 baseline for side-by-side reporting. */
  readonly startingConstellation?: boolean
  /** Candidate curve to measure, or an all-zero curve to sample without elimination. */
  readonly targets?: readonly number[]
}

export interface RunOutcome {
  readonly result: GameResult
  readonly log: RunLog
}

/** GDD 4-2: 8 rounds of 5 turns is budgeted at about 40 minutes. */
export const MINUTES_PER_TURN = 1

/**
 * The two starting constellations are ×1.2 over a run of 3 on a square board and
 * differ only in axis, so neither is stronger — every tier just rolls (GDD 13-5).
 */
const startingLoadout = (withStarting: boolean, rng: Rng): Loadout => {
  if (!withStarting) {
    return {
      deck: createInitialDeck(),
      constellations: [],
      stardust: 0,
      drifterOwned: false,
      nextChipId: 0,
    }
  }
  const pick = STARTING_CONSTELLATION_CHOICES[Math.floor(rng() * STARTING_CONSTELLATION_CHOICES.length)]
  return createStartingLoadout(pick)
}

export function runOnce(config: RunConfig): RunOutcome {
  const log = newRunLog()
  const player = makePlayer(config.tier, log, {
    wagerAccuracy: config.wagerAccuracy,
    exhaustive: config.exhaustive,
  })
  const rng = mulberry32(config.seed)
  const loadout = startingLoadout(config.startingConstellation ?? true, rng)

  const result = playGame(loadout, {
    mode: config.mode,
    stackMode: config.stackMode,
    place: player.place,
    shop: player.shop,
    answerWager: () => rng() < player.wagerAccuracy,
    answerOracle: () => rng() < player.oracleAccuracy,
    targets: config.targets,
    rng,
  })

  return { result, log }
}
