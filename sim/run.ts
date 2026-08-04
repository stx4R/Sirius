// One seeded playthrough. Same seed, same tier, same stack mode → same result.

import type { MultiplierStackMode } from '../src/core/config'
import { createInitialDeck } from '../src/core/deck'
import { mulberry32 } from '../src/core/rng'
import { playGame } from '../src/core/game'
import type { GameResult } from '../src/core/game'
import type { Loadout } from '../src/core/shop'
import type { GameMode } from '../src/core/types'
import { PLAYERS } from './player'
import type { Tier } from './player'

export interface RunConfig {
  readonly seed: number
  readonly tier: Tier
  readonly stackMode: MultiplierStackMode
  readonly mode: GameMode
}

/** GDD 4-2: 8 rounds of 5 turns is budgeted at about 40 minutes. */
export const MINUTES_PER_TURN = 1

function startingLoadout(): Loadout {
  return {
    deck: createInitialDeck(),
    constellations: [],
    stardust: 0,
    drifterOwned: false,
    nextChipId: 0,
  }
}

export function runOnce({ seed, tier, stackMode, mode }: RunConfig): GameResult {
  const player = PLAYERS[tier]
  const rng = mulberry32(seed)
  const answer = () => rng() < player.accuracy

  return playGame(startingLoadout(), {
    mode,
    stackMode,
    place: player.place,
    shop: player.shop,
    answerWager: answer,
    answerOracle: answer,
    rng,
  })
}
