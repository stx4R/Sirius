// The shop's published odds against the shop's actual sampler (GDD 7-1, 9-3).
//
// GDD 7-1's tier table is printed on the shelf, and `CompanionEntry` prints each
// tier's percentage beside its name. That makes the distribution a claim the game
// makes to the player, not an implementation detail. If the sampler disagrees
// with it the result is not a balance bug — it is a game about probability
// telling a student a false thing about a probability, which is the worst defect
// this project can ship.
//
// The specials and the constellations publish their odds by implication rather
// than in a table: every pair carries the same price on the same shelf, so a
// shelf that favoured one pair would be teaching the same lie more quietly.
//
// What prompted it: a screenshot in which all four stocked specials happened to
// contain GIN. Under a uniform sampler that is 1 of the 210 four-subsets, so it
// proves nothing — but nothing in the suite could have told the difference
// between that and a broken sampler, and that gap is what this file closes.
//
// ★ Every tolerance here is computed, never typed. A stocked item is a Bernoulli
// trial per visit, so its count over TRIALS visits is binomial and the band is
// SIGMAS standard deviations wide. Typing a number in instead would freeze
// today's slot counts into the test, and the first change to SHOP_SLOTS would
// leave it asserting an interval that no longer means anything. Expected values
// come from `config.ts` for the same reason (CLAUDE.md §5).
//
// Seeds are fixed (CLAUDE.md §8), so this file either passes or fails. There is
// nothing here to re-run.

import { describe, expect, it } from 'vitest'
import {
  COMPANIONS,
  COMPANION_TIER_WEIGHTS,
  SHOP_SLOTS,
  SPECIAL_SUIT_PAIRS,
} from '../src/core/config'
import { createInitialDeck } from '../src/core/deck'
import { mulberry32 } from '../src/core/rng'
import { ALL_CONSTELLATIONS, rollStock } from '../src/core/shop'
import type { Loadout, SuitPair } from '../src/core/shop'
import type { CompanionTier } from '../src/core/types'

const TRIALS = 4000
/** GDD 13-6's seed, one visit per offset from it. */
const SEED_BASE = 20260101
/**
 * How wide the band is. At 4σ a correct sampler fails about once in 16,000 per
 * check, which over the ~30 checks below is a risk of roughly 1 in 500 — and the
 * seeds are fixed anyway, so the real question is only whether it is tight enough
 * to catch a wrong one. It is: a single tier weight moved by a fifth already
 * lands outside.
 */
const SIGMAS = 4

/** No constellations owned, so all 12 stay in the pool (`rollStock` excludes owned). */
const FRESH: Loadout = {
  deck: createInitialDeck(),
  constellations: [],
  stardust: 0,
  drifterOwned: false,
  nextChipId: 0,
}

const STOCKS = Array.from({ length: TRIALS }, (_, visit) =>
  rollStock(FRESH, mulberry32(SEED_BASE + visit)),
)

const pairKey = (pair: SuitPair) => `${pair[0]}&${pair[1]}`

function tally<T>(items: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return counts
}

/** `count` successes in `n` trials, against Binomial(n, p) at ±SIGMAS. */
function expectShare(label: string, count: number, n: number, p: number): void {
  const expected = n * p
  const spread = SIGMAS * Math.sqrt(n * p * (1 - p))
  const note = `${label}: ${count} of ${n} — expected ${expected.toFixed(1)} ± ${spread.toFixed(1)}`

  expect(count, note).toBeGreaterThanOrEqual(expected - spread)
  expect(count, note).toBeLessThanOrEqual(expected + spread)
}

describe('what the shop stocks matches what the shop says it stocks', () => {
  it('shows each of the 10 specials equally often (GDD 3-2, 9-3)', () => {
    const counts = tally(STOCKS.flatMap((stock) => stock.specials.map(pairKey)))
    const chance = SHOP_SLOTS.specialChips / SPECIAL_SUIT_PAIRS.length

    // Every pair reached a shelf at all. A pair that never appears is uniform
    // over nine, and nine near-equal counts would otherwise pass the band below.
    expect(counts.size).toBe(SPECIAL_SUIT_PAIRS.length)
    for (const pair of SPECIAL_SUIT_PAIRS) {
      expectShare(pairKey(pair), counts.get(pairKey(pair)) ?? 0, TRIALS, chance)
    }
  })

  it('shows each of the 12 constellations equally often (GDD 6)', () => {
    const counts = tally(STOCKS.flatMap((stock) => stock.constellations))
    const chance = SHOP_SLOTS.constellations / ALL_CONSTELLATIONS.length

    expect(counts.size).toBe(ALL_CONSTELLATIONS.length)
    for (const id of ALL_CONSTELLATIONS) {
      expectShare(id, counts.get(id) ?? 0, TRIALS, chance)
    }
  })

  // ★ The table on the shelf. GDD 7-1 publishes 45/27/17/8/3 and the shop prints
  // each of those percentages next to the companion it stocked.
  it('draws companion tiers at the published rates (GDD 7-1)', () => {
    const drawn = STOCKS.flatMap((stock) => stock.companions)

    // Every slot filled. `rollCompanions` gives up on a tier whose pool is empty,
    // which would quietly shrink the denominator — and a rate measured against a
    // denominator that moved is not the rate the shelf printed.
    expect(drawn).toHaveLength(TRIALS * SHOP_SLOTS.companions)

    const total = Object.values(COMPANION_TIER_WEIGHTS).reduce((sum, w) => sum + w, 0)
    // GDD 7-1 prints them as percentages, so they have to be percentages.
    expect(total).toBe(100)

    const counts = tally(drawn.map((id) => COMPANIONS[id].tier))
    for (const [tier, weight] of Object.entries(COMPANION_TIER_WEIGHTS)) {
      expectShare(tier, counts.get(tier as CompanionTier) ?? 0, drawn.length, weight / total)
    }
  })

  it('never puts the same item on the shelf twice', () => {
    const repeated = STOCKS.flatMap((stock, visit) => {
      const distinct =
        new Set(stock.specials.map(pairKey)).size === stock.specials.length &&
        new Set(stock.constellations).size === stock.constellations.length &&
        new Set(stock.companions).size === stock.companions.length
      return distinct ? [] : [SEED_BASE + visit]
    })

    expect(repeated, 'seeds whose shelf held a duplicate').toEqual([])
  })
})
