// Monte Carlo balance study: every player tier against every multiplier stack mode.
//
//   npm run sim -- --runs 10000 --mode full

import { MODE_PRESETS } from '../src/core/config'
import type { MultiplierStackMode } from '../src/core/config'
import type { GameMode } from '../src/core/types'
import { TIERS } from './player'
import type { Tier } from './player'
import { MINUTES_PER_TURN, runOnce } from './run'

const STACK_MODES: readonly MultiplierStackMode[] = ['sum', 'product', 'additive_delta']

/** Achieved score ÷ target, bucketed for the distribution table. */
const RATIO_BUCKETS = [0.5, 1, 1.5, 2, 3] as const

interface RoundStats {
  readonly reached: number
  readonly cleared: number
  readonly mean: number
  readonly median: number
  readonly sd: number
  readonly max: number
}

interface Summary {
  readonly tier: Tier
  readonly stackMode: MultiplierStackMode
  readonly rounds: readonly RoundStats[]
  readonly clearRate: number
  readonly ratioHistogram: readonly number[]
  readonly meanTurns: number
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

function median(xs: readonly number[]): number {
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function sd(xs: readonly number[]): number {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

function bucketOf(ratio: number): number {
  for (let i = 0; i < RATIO_BUCKETS.length; i++) if (ratio < RATIO_BUCKETS[i]) return i
  return RATIO_BUCKETS.length
}

function measure(
  tier: Tier,
  stackMode: MultiplierStackMode,
  mode: GameMode,
  runs: number,
  baseSeed: number,
): Summary {
  const preset = MODE_PRESETS[mode]
  const scores: number[][] = preset.TARGET_SCORES.map(() => [])
  const clears = preset.TARGET_SCORES.map(() => 0)
  const histogram = new Array<number>(RATIO_BUCKETS.length + 1).fill(0)
  let clearedAll = 0
  let turns = 0

  for (let i = 0; i < runs; i++) {
    const result = runOnce({ seed: baseSeed + i, tier, stackMode, mode })
    result.roundScores.forEach((score, index) => {
      scores[index].push(score)
      if (score >= result.targets[index]) clears[index]++
      histogram[bucketOf(score / result.targets[index])]++
    })
    if (result.clearedAll) clearedAll++
    turns += result.turnsPlayed
  }

  return {
    tier,
    stackMode,
    rounds: scores.map((round, index) => ({
      reached: round.length,
      cleared: clears[index],
      mean: round.length ? mean(round) : 0,
      median: round.length ? median(round) : 0,
      sd: round.length ? sd(round) : 0,
      max: round.length ? Math.max(...round) : 0,
    })),
    clearRate: clearedAll / runs,
    ratioHistogram: histogram,
    meanTurns: turns / runs,
  }
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const num = (x: number) => Math.round(x).toLocaleString('en-US')

function printSummary(summary: Summary, targets: readonly number[]): void {
  console.log(`\n### ${summary.tier} × ${summary.stackMode}`)
  console.log(
    `전체 클리어율 ${pct(summary.clearRate)}   평균 ${summary.meanTurns.toFixed(1)}턴 ` +
      `(약 ${Math.round(summary.meanTurns * MINUTES_PER_TURN)}분)`,
  )
  console.log('R  목표      도달     클리어율  평균        중앙값      표준편차    최댓값')
  summary.rounds.forEach((round, index) => {
    const rate = round.reached === 0 ? 0 : round.cleared / round.reached
    console.log(
      `${String(index + 1).padEnd(2)} ` +
        `${num(targets[index]).padStart(8)}  ` +
        `${String(round.reached).padStart(6)}  ` +
        `${pct(rate).padStart(8)}  ` +
        `${num(round.mean).padStart(10)}  ` +
        `${num(round.median).padStart(10)}  ` +
        `${num(round.sd).padStart(10)}  ` +
        `${num(round.max).padStart(10)}`,
    )
  })

  const labels = ['<0.5×', '0.5–1×', '1–1.5×', '1.5–2×', '2–3×', '≥3×']
  const total = summary.ratioHistogram.reduce((a, b) => a + b, 0)
  console.log(
    '목표 대비 달성 배수  ' +
      labels.map((label, i) => `${label} ${pct(summary.ratioHistogram[i] / total)}`).join('   '),
  )
}

function parseArgs(argv: readonly string[]) {
  const get = (flag: string, fallback: string) => {
    const index = argv.indexOf(flag)
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback
  }
  return {
    runs: Number(get('--runs', '10000')),
    mode: get('--mode', 'full') as GameMode,
    seed: Number(get('--seed', '20260101')),
    tiers: get('--tiers', TIERS.join(',')).split(',') as Tier[],
    modes: get('--stack', STACK_MODES.join(',')).split(',') as MultiplierStackMode[],
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const targets = MODE_PRESETS[args.mode].TARGET_SCORES

  console.log(
    `STA-mble 몬테카를로 — ${args.mode} 모드, 조합당 ${args.runs.toLocaleString('en-US')}회, 시드 ${args.seed}`,
  )

  const summaries: Summary[] = []
  for (const tier of args.tiers) {
    for (const stackMode of args.modes) {
      const started = performance.now()
      const summary = measure(tier, stackMode, args.mode, args.runs, args.seed)
      summaries.push(summary)
      printSummary(summary, targets)
      console.log(`(${((performance.now() - started) / 1000).toFixed(1)}s)`)
    }
  }

  console.log('\n### 전체 클리어율 요약')
  console.log('tier      ' + args.modes.map((m) => m.padStart(16)).join(''))
  for (const tier of args.tiers) {
    const row = args.modes.map((stackMode) => {
      const found = summaries.find((s) => s.tier === tier && s.stackMode === stackMode)
      return (found ? pct(found.clearRate) : '-').padStart(16)
    })
    console.log(tier.padEnd(10) + row.join(''))
  }
}

main()
