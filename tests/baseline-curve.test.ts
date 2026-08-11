import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MULTIPLIER_STACK_MODE,
  STARTING_CONSTELLATION_CHOICES,
} from '../src/core/config'
import { playGame } from '../src/core/game'
import { mulberry32 } from '../src/core/rng'
import { createStartingLoadout } from '../src/core/shop'
import type { GameMode } from '../src/core/types'
import { makePlayer, newRunLog } from '../sim/player'
import type { Tier } from '../sim/player'

// The pre-P4-B recording of what the shipped rules score, seed by seed and turn
// by turn.
//
// P4-B-1 opens `settle()` to make room for companion effects. The risk is not
// that it crashes — the other tests cover that — but that it shifts a score by a
// few points somewhere, which moves the GDD 13-6 target curve without anything
// going red. This re-plays 120 recorded games and demands the same numbers back.
//
// ★ NOT a snapshot. `toMatchSnapshot()` would let `vitest -u` rewrite the very
// thing being protected, and the one command everyone reaches for when a test
// goes red is the one that must not work here. The fixture is data, checked in,
// and regenerated only by running `npx tsx sim/gen-baseline.ts` on purpose.
//
// Turn scores matter as much as round scores: two turns can move in opposite
// directions and leave their round total untouched, which is exactly the kind of
// slip a refactor makes and a round-level seal misses.

interface BaselineGame {
  readonly seed: number
  readonly tier: Tier
  readonly version: GameMode
  readonly roundScores: readonly number[]
  readonly turnScores: readonly (readonly number[])[]
  readonly reachedRound: number
  readonly result: 'clear' | 'gameover'
}

interface BaselineFixture {
  readonly meta: {
    readonly schema: number
    readonly stackMode: string
    readonly seeds: readonly number[]
    readonly tiers: readonly string[]
    readonly versions: readonly string[]
  }
  readonly games: readonly BaselineGame[]
}

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(resolve(here, 'fixtures/baseline-curve.json'), 'utf8'),
) as BaselineFixture

/**
 * Replays one recorded game. Mirrors `sim/gen-baseline.ts`, including the rng
 * draw spent on the starting constellation (GDD 13-5) before the game begins.
 */
function replay(seed: number, tier: Tier, version: GameMode) {
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
    roundScores: result.roundScores,
    turnScores,
    reachedRound: result.roundScores.length,
    result: result.clearedAll ? 'clear' : ('gameover' as const),
  }
}

/** Every way one replay can disagree with what was recorded. */
function diff(expected: BaselineGame, actual: ReturnType<typeof replay>) {
  const where = `seed ${expected.seed} · ${expected.tier} · ${expected.version}`
  const out: string[] = []
  const delta = (want: number, got: number) => `${got - want > 0 ? '+' : ''}${got - want}`

  if (actual.reachedRound !== expected.reachedRound) {
    out.push(`${where}: reached round ${actual.reachedRound}, expected ${expected.reachedRound}`)
  }
  if (actual.result !== expected.result) {
    out.push(`${where}: result "${actual.result}", expected "${expected.result}"`)
  }

  const rounds = Math.max(expected.roundScores.length, actual.roundScores.length)
  for (let r = 0; r < rounds; r++) {
    const want = expected.roundScores[r]
    const got = actual.roundScores[r]
    if (want !== got) {
      const suffix = want === undefined || got === undefined ? '' : ` (${delta(want, got)})`
      out.push(`${where}: round ${r + 1} total ${got ?? '—'}, expected ${want ?? '—'}${suffix}`)
    }

    // Turn level. Reported even when the round total agrees — that is the case
    // this exists for.
    const wantTurns = expected.turnScores[r] ?? []
    const gotTurns = actual.turnScores[r] ?? []
    const turns = Math.max(wantTurns.length, gotTurns.length)
    for (let t = 0; t < turns; t++) {
      const wt = wantTurns[t]
      const gt = gotTurns[t]
      if (wt !== gt) {
        const suffix = wt === undefined || gt === undefined ? '' : ` (${delta(wt, gt)})`
        out.push(
          `${where}: round ${r + 1} turn ${t + 1} scored ${gt ?? '—'}, expected ${wt ?? '—'}${suffix}`,
        )
      }
    }
  }

  return out
}

// 30s, not the 5s default: each case replays 20 recorded games end to end, and
// under a parallel run these share cores with every other file. The work is
// deterministic, so a timeout here is never the test finding anything — it is
// only the suite losing a race against its neighbours.
describe('baseline curve (GDD 13-6)', () => {
  it('is the fixture this test was written against', () => {
    expect(fixture.meta.schema).toBe(2)
    expect(fixture.games).toHaveLength(
      fixture.meta.seeds.length * fixture.meta.tiers.length * fixture.meta.versions.length,
    )
  })

  // The fixture was recorded under one stack mode. GDD 13 #3 keeps it at 'sum'
  // pending re-measurement, and changing it silently would make every score below
  // meaningless rather than merely wrong, so it is checked before any of them.
  it('was recorded under the stack mode the game still ships', () => {
    expect(fixture.meta.stackMode).toBe(MULTIPLIER_STACK_MODE)
  })

  // A round total is the sum of its turns. Checked against the fixture itself so
  // that a fixture regenerated by a broken observer cannot quietly become the new
  // reference.
  it('records turns that add up to the rounds they belong to', () => {
    const broken: string[] = []
    for (const game of fixture.games) {
      expect(game.turnScores).toHaveLength(game.roundScores.length)
      game.turnScores.forEach((round, i) => {
        const sum = round.reduce((total, score) => total + score, 0)
        if (sum !== game.roundScores[i]) {
          broken.push(
            `seed ${game.seed} · ${game.tier} · ${game.version} round ${i + 1}: ` +
              `turns sum to ${sum}, round total is ${game.roundScores[i]}`,
          )
        }
      })
    }
    expect(broken, `\n${broken.join('\n')}\n`).toEqual([])
  })

  // One case per combination rather than per game: a refactor that shifts scoring
  // breaks many seeds at once, and seeing all of them together says far more
  // about what moved than the first failure alone.
  for (const version of ['booth', 'full'] as const) {
    for (const tier of ['random', 'greedy', 'smart'] as const) {
      it(`replays ${tier} ${version} exactly`, () => {
        const recorded = fixture.games.filter(
          (game) => game.tier === tier && game.version === version,
        )
        expect(recorded.length).toBeGreaterThan(0)

        const mismatches: string[] = []
        for (const game of recorded) {
          mismatches.push(...diff(game, replay(game.seed, tier, version)))
        }

        expect(mismatches, `\n${mismatches.join('\n')}\n`).toEqual([])
      })
    }
  }
}, 30_000)
