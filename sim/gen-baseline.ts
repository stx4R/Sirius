// Regenerates tests/fixtures/baseline-curve.json — the pre-P4-B recording of what
// the shipped rules score (GDD 13-6).
//
// ★ DELIBERATELY NOT AN npm SCRIPT. Run it by hand:
//
//     npx tsx sim/gen-baseline.ts
//
// The fixture is a seal, and a seal that regenerates itself is not one. If this
// were `npm run gen-baseline` it would eventually be run to "fix" a red test,
// which silently rewrites the very thing the test exists to protect. Regenerating
// is a decision, so it costs a deliberate command.
//
// The loop is core's (`playGame`) — this file only supplies policies and records
// what comes back, so the fixture describes the shipped game and not a second
// implementation of it (CLAUDE.md §5).

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MULTIPLIER_STACK_MODE, STARTING_CONSTELLATION_CHOICES } from '../src/core/config'
import { playGame } from '../src/core/game'
import { mulberry32 } from '../src/core/rng'
import { createStartingLoadout } from '../src/core/shop'
import type { GameMode } from '../src/core/types'
import { TIERS, makePlayer, newRunLog } from './player'
import type { Tier } from './player'

/** GDD 13-6 seeds the P2-B study at 20260101; this takes the first 20. */
const SEEDS = Array.from({ length: 20 }, (_, i) => 20260101 + i)

/** GDD 12-3: booth is 3 rounds, full is 8. */
const VERSIONS: readonly GameMode[] = ['booth', 'full']

export interface BaselineGame {
  readonly seed: number
  readonly tier: Tier
  readonly version: GameMode
  /** Cumulative round score at the end of each round actually played. */
  readonly roundScores: readonly number[]
  /** What each turn's settlement added, grouped by round. `[round][turn]`. */
  readonly turnScores: readonly (readonly number[])[]
  /** How many rounds the run reached, cleared or not. */
  readonly reachedRound: number
  readonly result: 'clear' | 'gameover'
}

/**
 * Mirrors `runOnce` in ./run.ts, which cannot be used here: it does not forward
 * `onTurnSettled`, and P4-B-0b may not edit it. The starting rng draw below is
 * the one `runOnce` spends picking a starting constellation (GDD 13-5) — drop it
 * and every seed plays a different game.
 *
 * That this really is the same run is not assumed: the regenerated `roundScores`
 * are compared against the previous fixture before it is accepted.
 */
function record(seed: number, tier: Tier, version: GameMode): BaselineGame {
  const rng = mulberry32(seed)
  const pick =
    STARTING_CONSTELLATION_CHOICES[Math.floor(rng() * STARTING_CONSTELLATION_CHOICES.length)]
  const player = makePlayer(tier, newRunLog())

  const turnScores: number[][] = []
  const result = playGame(createStartingLoadout(pick), {
    mode: version,
    stackMode: MULTIPLIER_STACK_MODE,
    place: player.place,
    shop: player.shop,
    answerWager: () => rng() < player.wagerAccuracy,
    answerOracle: () => rng() < player.oracleAccuracy,
    onTurnSettled: (round, turn, score) => {
      while (turnScores.length < round) turnScores.push([])
      turnScores[round - 1][turn - 1] = score
    },
    rng,
  })

  return {
    seed,
    tier,
    version,
    roundScores: result.roundScores,
    turnScores,
    reachedRound: result.roundScores.length,
    result: result.clearedAll ? 'clear' : 'gameover',
  }
}

export interface BaselineFixture {
  readonly meta: {
    /** Bumped by hand when the schema changes, so a stale fixture is loud. */
    readonly schema: number
    readonly stackMode: string
    readonly seeds: readonly number[]
    readonly tiers: readonly string[]
    readonly versions: readonly string[]
  }
  readonly games: readonly BaselineGame[]
}

function generate(): BaselineFixture {
  const games: BaselineGame[] = []

  for (const version of VERSIONS) {
    for (const tier of TIERS) {
      for (const seed of SEEDS) games.push(record(seed, tier, version))
    }
  }

  return {
    meta: {
      schema: 2,
      stackMode: MULTIPLIER_STACK_MODE,
      seeds: SEEDS,
      tiers: TIERS,
      versions: VERSIONS,
    },
    games,
  }
}

/** One game per line: the fixture is read by diff far more often than by eye. */
function render(fixture: BaselineFixture): string {
  const body = fixture.games.map((game) => `    ${JSON.stringify(game)}`).join(',\n')
  return `{\n  "meta": ${JSON.stringify(fixture.meta, null, 2).replace(/\n/g, '\n  ')},\n  "games": [\n${body}\n  ]\n}\n`
}

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../tests/fixtures/baseline-curve.json')

const fixture = generate()
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, render(fixture), 'utf8')

const clears = new Map<string, number>()
let turns = 0
for (const game of fixture.games) {
  const key = `${game.tier} ${game.version}`
  clears.set(key, (clears.get(key) ?? 0) + (game.result === 'clear' ? 1 : 0))
  for (const round of game.turnScores) turns += round.length
}

console.log(`wrote ${out}`)
console.log(`games: ${fixture.games.length}  turns sealed: ${turns}  stackMode: ${fixture.meta.stackMode}`)
for (const [key, count] of clears) {
  console.log(`  ${key.padEnd(14)} ${count}/${SEEDS.length}  (${((count / SEEDS.length) * 100).toFixed(1)}%)`)
}
