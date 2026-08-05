// Monte Carlo balance study: every player tier against every multiplier stack mode.
// Writes sim/out/results.md, which is meant to be copied and shared as-is.
//
//   npm run sim                        2000 runs per combination
//   npm run sim -- --runs 100          timing probe
//   npm run sim -- --compare-search    pruned vs exhaustive placement search

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODE_PRESETS } from '../src/core/config'
import type { MultiplierStackMode } from '../src/core/config'
import type { GameMode } from '../src/core/types'
import { ceilings } from './ceiling'
import { TIERS } from './player'
import type { Tier } from './player'
import { MINUTES_PER_TURN, runOnce } from './run'

const STACK_MODES: readonly MultiplierStackMode[] = ['sum', 'product', 'additive_delta']
const RATIO_EDGES = [0.5, 1, 1.5, 2, 3] as const
const RATIO_LABELS = ['<0.5×', '0.5–1×', '1–1.5×', '1.5–2×', '2–3×', '≥3×']

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'out')

// ------------------------------------------------------------------- stats

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))
  return sorted[index]
}

function sd(xs: readonly number[]): number {
  if (xs.length === 0) return 0
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

const bucketOf = (ratio: number) => {
  for (let i = 0; i < RATIO_EDGES.length; i++) if (ratio < RATIO_EDGES[i]) return i
  return RATIO_EDGES.length
}

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
  readonly runs: number
  readonly rounds: readonly RoundStats[]
  /** Raw per-round scores, kept so targets can be back-solved from percentiles. */
  readonly scores: readonly (readonly number[])[]
  readonly clearRate: number
  readonly ratioHistogram: readonly number[]
  readonly meanTurns: number
  /** Mean marginal points of the drifter cell per settlement it took part in. */
  readonly drifterPointsPerTurn: number
  readonly seconds: number
}

interface MeasureOptions {
  readonly tier: Tier
  readonly stackMode: MultiplierStackMode
  readonly mode: GameMode
  readonly runs: number
  readonly seed: number
  readonly wagerAccuracy?: number
  readonly exhaustive?: boolean
  readonly startingConstellation?: boolean
  readonly targets?: readonly number[]
}

function measure(opts: MeasureOptions): Summary {
  const preset = MODE_PRESETS[opts.mode]
  const targets = opts.targets ?? preset.TARGET_SCORES
  const scores: number[][] = targets.map(() => [])
  const clears = targets.map(() => 0)
  const histogram = new Array<number>(RATIO_EDGES.length + 1).fill(0)

  let clearedAll = 0
  let turns = 0
  let drifterPoints = 0
  let drifterTurns = 0

  const started = performance.now()
  for (let i = 0; i < opts.runs; i++) {
    const { result, log } = runOnce({
      seed: opts.seed + i,
      tier: opts.tier,
      stackMode: opts.stackMode,
      mode: opts.mode,
      wagerAccuracy: opts.wagerAccuracy,
      exhaustive: opts.exhaustive,
      startingConstellation: opts.startingConstellation,
      targets: opts.targets,
    })

    result.roundScores.forEach((score, index) => {
      scores[index].push(score)
      if (score >= result.targets[index]) clears[index]++
      histogram[bucketOf(score / result.targets[index])]++
    })
    if (result.clearedAll) clearedAll++
    turns += result.turnsPlayed

    drifterPoints += log.drifterPoints
    drifterTurns += log.drifterTurns
  }

  return {
    tier: opts.tier,
    stackMode: opts.stackMode,
    runs: opts.runs,
    scores,
    rounds: scores.map((round, index) => ({
      reached: round.length,
      cleared: clears[index],
      mean: mean(round),
      median: quantile(round, 0.5),
      sd: sd(round),
      max: round.length ? Math.max(...round) : 0,
    })),
    clearRate: clearedAll / opts.runs,
    ratioHistogram: histogram,
    meanTurns: turns / opts.runs,
    drifterPointsPerTurn: drifterTurns ? drifterPoints / drifterTurns : 0,
    seconds: (performance.now() - started) / 1000,
  }
}

// ----------------------------------------------------------------- markdown

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const num = (x: number) => Math.round(x).toLocaleString('en-US')

function roundTable(summary: Summary, targets: readonly number[]): string {
  const head = '| R | 목표 | 도달 | 클리어율 | 평균 | 중앙값 | 표준편차 | 최댓값 |\n|--:|--:|--:|--:|--:|--:|--:|--:|'
  const rows = summary.rounds.map((round, i) => {
    const rate = round.reached === 0 ? 0 : round.cleared / round.reached
    return `| ${i + 1} | ${num(targets[i])} | ${round.reached} | ${pct(rate)} | ${num(round.mean)} | ${num(round.median)} | ${num(round.sd)} | ${num(round.max)} |`
  })
  return [head, ...rows].join('\n')
}

function ratioTable(summary: Summary): string {
  const total = summary.ratioHistogram.reduce((a, b) => a + b, 0) || 1
  return [
    `| ${RATIO_LABELS.join(' | ')} |`,
    `|${RATIO_LABELS.map(() => '--:').join('|')}|`,
    `| ${summary.ratioHistogram.map((n) => pct(n / total)).join(' | ')} |`,
  ].join('\n')
}

// ------------------------------------------------------- target back-solving
// GDD 13-3. The curve is not drawn by hand: each round's target is read off the
// score distribution actually observed at that round.
//
// Naively that distribution is biased — with a curve in force, the runs still
// alive at round 6 are the lucky ones, so their scores are not what a fresh run
// would produce. Rather than try to remove the bias, the search takes it as part
// of the answer: propose a curve, measure the distribution it produces, re-read
// the targets off that distribution, repeat. The fixed point is a curve whose
// targets match the play it causes.
//
// One knob per phase: `pass`, the per-round clear probability being aimed at.
// Higher pass → lower targets → higher clear rate, so it bisects cleanly.

const SOLVE_STACK_MODE: MultiplierStackMode = 'sum'
const SOLVE_ITERATIONS = 10
/** Targets are rounded to this so the published curve reads as designed numbers. */
const TARGET_ROUNDING = 10

const roundTo = (x: number, step: number) => Math.max(step, Math.round(x / step) * step)

/** Targets for the rounds in `range`, read off the distribution `summary` observed there. */
function targetsFrom(summary: Summary, range: readonly number[], pass: number): number[] {
  return range.map((r) => roundTo(quantile(summary.scores[r], 1 - pass), TARGET_ROUNDING))
}

interface SolvePhase {
  readonly label: string
  readonly tier: Tier
  readonly mode: GameMode
  /** 0-based round indices this phase sets. */
  readonly range: readonly number[]
  readonly goal: number
  readonly band: readonly [number, number]
}

/**
 * Bisects `pass` until the phase's clear rate lands in its band, re-reading the
 * targets from the freshly measured distribution at every step.
 */
function solvePhase(
  phase: SolvePhase,
  curve: number[],
  runs: number,
  seed: number,
  log: (text: string) => void,
): { curve: number[]; clearRate: number } {
  let low = 0.5
  let high = 0.999
  let bestCurve = [...curve]
  let bestRate = 0
  let bestGap = Number.POSITIVE_INFINITY

  for (let step = 0; step < SOLVE_ITERATIONS; step++) {
    const pass = (low + high) / 2
    const trial = [...curve]
    // Two passes: the first proposes targets from the current curve's play, the
    // second re-reads them under those proposed targets so the pair is consistent.
    for (let refine = 0; refine < 2; refine++) {
      const summary = measure({
        tier: phase.tier,
        stackMode: SOLVE_STACK_MODE,
        mode: phase.mode,
        runs,
        seed,
        targets: trial.slice(0, MODE_PRESETS[phase.mode].TOTAL_ROUNDS),
      })
      const solved = targetsFrom(summary, phase.range, pass)
      phase.range.forEach((r, i) => {
        trial[r] = solved[i]
      })
    }

    const check = measure({
      tier: phase.tier,
      stackMode: SOLVE_STACK_MODE,
      mode: phase.mode,
      runs,
      seed,
      targets: trial.slice(0, MODE_PRESETS[phase.mode].TOTAL_ROUNDS),
    })
    const gap = Math.abs(check.clearRate - phase.goal)
    if (gap < bestGap) {
      bestGap = gap
      bestRate = check.clearRate
      bestCurve = [...trial]
    }
    log(
      `    pass ${pass.toFixed(3)} → ${phase.label} 클리어율 ${pct(check.clearRate)} ` +
        `[${phase.range.map((r) => trial[r]).join(', ')}]`,
    )
    if (check.clearRate >= phase.band[0] && check.clearRate <= phase.band[1]) {
      return { curve: trial, clearRate: check.clearRate }
    }
    if (check.clearRate < phase.goal) low = pass
    else high = pass
  }
  return { curve: bestCurve, clearRate: bestRate }
}

// --------------------------------------------------------------------- cli

function parseArgs(argv: readonly string[]) {
  const value = (flag: string, fallback: string) => {
    const at = argv.indexOf(flag)
    return at >= 0 && at + 1 < argv.length ? argv[at + 1] : fallback
  }
  return {
    runs: Number(value('--runs', '2000')),
    seed: Number(value('--seed', '20260101')),
    compareSearch: argv.includes('--compare-search'),
    solve: argv.includes('--solve'),
  }
}

/** GDD 13-3: condition 2 first, because a failed booth run is a lost vote. */
function solveCurve(runs: number, seed: number): number[] {
  const log = (text: string) => process.stderr.write(`${text}\n`)
  let curve = [...MODE_PRESETS.full.TARGET_SCORES]

  log('  조건 2 (greedy 부스판 ≥70%) — R1~R3')
  const booth = solvePhase(
    { label: '부스판', tier: 'greedy', mode: 'booth', range: [0, 1, 2], goal: 0.72, band: [0.7, 0.8] },
    curve,
    runs,
    seed,
    log,
  )
  curve = booth.curve

  log('  조건 1 (smart 풀버전 20~30%) — R4~R8')
  const full = solvePhase(
    {
      label: '풀버전',
      tier: 'smart',
      mode: 'full',
      range: [3, 4, 5, 6, 7],
      goal: 0.25,
      band: [0.2, 0.3],
    },
    curve,
    runs,
    seed,
    log,
  )
  curve = full.curve

  // Condition 3 is a cap, so it is applied after the search rather than inside it.
  // It binds only on R1, whose ceiling (one ×1.2 constellation, no shop yet) sits
  // barely above the flat base every board scores anyway. Lowering R1 under the cap
  // changes no clear rate — nothing can score below the base — so the search result
  // survives intact.
  const caps = ceilings(curve.length, SOLVE_STACK_MODE)
  curve = curve.map((target, i) =>
    Math.min(target, Math.floor((caps[i] * 0.7) / TARGET_ROUNDING) * TARGET_ROUNDING),
  )

  // A target curve must rise; a dip would let a later round be easier than an
  // earlier one, which the quantile search has no reason to prevent on its own.
  for (let i = 1; i < curve.length; i++) curve[i] = Math.max(curve[i], curve[i - 1])
  return curve
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const lines: string[] = []
  const say = (text = '') => {
    lines.push(text)
    console.log(text)
  }

  if (args.solve) {
    const curve = solveCurve(args.runs, args.seed)
    const caps = ceilings(MODE_PRESETS.full.TOTAL_ROUNDS, SOLVE_STACK_MODE)

    console.log('\n역산된 목표 곡선')
    console.log('| R | 목표 | 기계적 상한 | 상한 대비 | 조건 3 |')
    console.log('|--:|--:|--:|--:|:--|')
    curve.forEach((target, i) => {
      const share = target / caps[i]
      console.log(
        `| ${i + 1} | ${num(target)} | ${num(caps[i])} | ${pct(share)} | ${share <= 0.7 ? '✅' : '❌'} |`,
      )
    })

    console.log('\n검증')
    for (const tier of TIERS) {
      const f = measure({ tier, stackMode: SOLVE_STACK_MODE, mode: 'full', runs: args.runs, seed: args.seed, targets: curve })
      const b = measure({ tier, stackMode: SOLVE_STACK_MODE, mode: 'booth', runs: args.runs, seed: args.seed, targets: curve.slice(0, 3) })
      console.log(`  ${tier.padEnd(7)} 풀버전 ${pct(f.clearRate)}  부스판 ${pct(b.clearRate)}  평균 ${f.meanTurns.toFixed(1)}턴`)
    }
    console.log(`\nTARGET_SCORES: [${curve.join(', ')}]`)
    return
  }

  if (args.compareSearch) {
    console.log('가지치기 탐색 vs 전수 탐색 (smart × sum, full)')
    for (const exhaustive of [false, true]) {
      const s = measure({
        tier: 'smart',
        stackMode: 'sum',
        mode: 'full',
        runs: args.runs,
        seed: args.seed,
        exhaustive,
      })
      console.log(
        `  ${exhaustive ? '전수  ' : '가지치기'}  R1평균 ${num(s.rounds[0].mean)}  ` +
          `R2평균 ${num(s.rounds[1].mean)}  R3평균 ${num(s.rounds[2].mean)}  ` +
          `클리어율 ${pct(s.clearRate)}  ${s.seconds.toFixed(1)}s`,
      )
    }
    return
  }

  say(`# STA-mble 밸런스 시뮬레이션 결과`)
  say()
  say(
    `조합당 ${args.runs.toLocaleString('en-US')}회 · 시드 ${args.seed} · ` +
      `동반성 비활성(P4 이전, GDD 7-1-b) → **모든 클리어율은 하한선이다.**`,
  )
  say()
  say(`목표 곡선 \`[${MODE_PRESETS.full.TARGET_SCORES.join(', ')}]\` · 떠돌이 조각 첫 상점 무상 지급(GDD 13-4)`)
  say()

  // --- condition 3 (GDD 13-3)
  const caps = ceilings(MODE_PRESETS.full.TOTAL_ROUNDS, 'sum')
  say('## 0. 기계적 상한 대비 목표치 (GDD 13-3 조건 3)')
  say()
  say('상한 = 한 문양 도배 + 그 라운드에 규칙상 보유 가능한 최강 별자리 + 기본 조각. R1은 상점 이전이라 시작 별자리 1개로 묶인다.')
  say()
  say('| R | 목표 | 기계적 상한 | 상한 대비 | ≤70% |')
  say('|--:|--:|--:|--:|:--|')
  MODE_PRESETS.full.TARGET_SCORES.forEach((target, i) => {
    const share = target / caps[i]
    say(`| ${i + 1} | ${num(target)} | ${num(caps[i])} | ${pct(share)} | ${share <= 0.7 ? '✅' : '❌'} |`)
  })
  say()

  const full = new Map<string, Summary>()
  const booth = new Map<string, Summary>()
  const baseFull = new Map<string, Summary>()
  const baseBooth = new Map<string, Summary>()

  for (const tier of TIERS) {
    for (const stackMode of STACK_MODES) {
      const key = `${tier}|${stackMode}`
      const shared = { tier, stackMode, runs: args.runs, seed: args.seed } as const
      full.set(key, measure({ ...shared, mode: 'full' }))
      booth.set(key, measure({ ...shared, mode: 'booth' }))
      baseFull.set(key, measure({ ...shared, mode: 'full', startingConstellation: false }))
      baseBooth.set(key, measure({ ...shared, mode: 'booth', startingConstellation: false }))
      process.stderr.write(`  done ${key}\n`)
    }
  }

  /** GDD 13-5 changed the opening loadout, so both rulesets are reported side by side. */
  const comparison = (
    now: ReadonlyMap<string, Summary>,
    before: ReadonlyMap<string, Summary>,
  ): string[] => {
    const head = STACK_MODES.flatMap((m) => [`${m} 기준선`, `${m} 13-5`])
    return [
      `| tier | ${head.join(' | ')} |`,
      `|:--|${head.map(() => '--:').join('|')}|`,
      ...TIERS.map(
        (tier) =>
          `| ${tier} | ${STACK_MODES.flatMap((m) => [
            pct(before.get(`${tier}|${m}`)!.clearRate),
            pct(now.get(`${tier}|${m}`)!.clearRate),
          ]).join(' | ')} |`,
      ),
    ]
  }

  // --- overview
  say('## 1. 전체 클리어율 (풀버전 8라운드)')
  say()
  say(
    '**기준선** = 시작 별자리 없음 · **13-5** = 시작 별자리 1개 지급. ' +
      '두 열 모두 떠돌이 무상 지급을 쓰므로, 차이는 시작 별자리 하나뿐이다.',
  )
  say()
  comparison(full, baseFull).forEach(say)
  say()
  say('## 2. 부스판 클리어율 (3라운드)')
  say()
  comparison(booth, baseBooth).forEach(say)
  say()
  say('## 2-b. 시작 별자리가 R1에 미친 영향 (sum 기준)')
  say()
  say('| tier | R1 평균 (기준선) | R1 평균 (13-5) | R1 표준편차 (기준선) | R1 표준편차 (13-5) |')
  say('|:--|--:|--:|--:|--:|')
  for (const tier of TIERS) {
    const b = baseFull.get(`${tier}|sum`)!.rounds[0]
    const n = full.get(`${tier}|sum`)!.rounds[0]
    say(`| ${tier} | ${num(b.mean)} | ${num(n.mean)} | ${num(b.sd)} | ${num(n.sd)} |`)
  }
  say()

  // --- per combination
  say('## 3. 조합별 상세 (풀버전)')
  for (const tier of TIERS) {
    for (const stackMode of STACK_MODES) {
      const s = full.get(`${tier}|${stackMode}`)!
      say()
      say(`### ${tier} × ${stackMode}`)
      say()
      say(
        `전체 클리어율 **${pct(s.clearRate)}** · 평균 ${s.meanTurns.toFixed(1)}턴 ` +
          `(약 ${Math.round(s.meanTurns * MINUTES_PER_TURN)}분) · ${s.seconds.toFixed(1)}s`,
      )
      say()
      say(roundTable(s, MODE_PRESETS.full.TARGET_SCORES))
      say()
      say('목표치 대비 달성 배수 분포')
      say()
      say(ratioTable(s))
    }
  }
  say()

  // --- tier gap (Q6)
  say('## 4. 등급별 라운드 평균 점수와 격차 (sum 기준)')
  say()
  say('| R | 목표 | random | greedy | smart | greedy/random | smart/random |')
  say('|--:|--:|--:|--:|--:|--:|--:|')
  const bySum = (tier: Tier) => full.get(`${tier}|sum`)!
  for (let i = 0; i < MODE_PRESETS.full.TOTAL_ROUNDS; i++) {
    const r = bySum('random').rounds[i]
    const g = bySum('greedy').rounds[i]
    const s = bySum('smart').rounds[i]
    const ratio = (a: number, b: number) => (b > 0 ? `${(a / b).toFixed(2)}×` : '—')
    say(
      `| ${i + 1} | ${num(MODE_PRESETS.full.TARGET_SCORES[i])} | ${num(r.mean)} | ${num(g.mean)} | ` +
        `${num(s.mean)} | ${ratio(g.mean, r.mean)} | ${ratio(s.mean, r.mean)} |`,
    )
  }
  say()

  // --- back-solved booth targets (Q6)
  say('## 5. 부스판 목표치 역산 — greedy가 70% 클리어하려면')
  say()
  say(
    '3라운드 클리어는 세 라운드를 모두 넘어야 하므로, 각 라운드 통과율 0.70^(1/3) ≈ 88.8% 지점 ' +
      '— 즉 해당 라운드 점수 분포의 11.2 백분위수를 목표치로 잡아야 한다.',
  )
  say()
  say('| tier | R1 | R2 | R3 | 현행 목표 | 현행 클리어율 |')
  say('|:--|--:|--:|--:|:--|--:|')
  const perRound = Math.pow(0.7, 1 / 3)
  for (const tier of TIERS) {
    const s = booth.get(`${tier}|sum`)!
    const solved = s.scores.map((round) => quantile(round, 1 - perRound))
    say(
      `| ${tier} | ${num(solved[0])} | ${num(solved[1])} | ${num(solved[2])} | ` +
        `${MODE_PRESETS.booth.TARGET_SCORES.join(' / ')} | ${pct(s.clearRate)} |`,
    )
  }
  say()

  // --- drifter (Q5)
  say('## 6. 떠돌이 조각의 실제 기여')
  say()
  say(
    'GDD 13-4에 따라 첫 상점에서 무상 지급된다. 따라서 구매율은 더 이상 측정 대상이 아니고, ' +
      '남는 질문은 그 칸이 실제로 얼마를 버느냐다. 값은 떠돌이 칸을 비웠을 때와의 차이다.',
  )
  say()
  say(`| tier | ${STACK_MODES.join(' | ')} |`)
  say(`|:--|${STACK_MODES.map(() => '--:').join('|')}|`)
  for (const tier of TIERS) {
    say(
      `| ${tier} | ${STACK_MODES.map((m) => `${full.get(`${tier}|${m}`)!.drifterPointsPerTurn.toFixed(1)}점/턴`).join(' | ')} |`,
    )
  }
  say()

  // --- wager sensitivity (Q7)
  say('## 7. WAGER 정답률 민감도 (GDD 12-5)')
  say()
  say(
    'WAGER 정답률만 고정하고 DRIFT ORACLE은 등급 기본값을 유지한다. ' +
      '부스판은 **정답률 0%에서도 greedy가 70% 이상**이어야 한다 — 확률을 못 맞혀도 탈락시키지 않는다는 원칙(12-5절).',
  )
  say()
  for (const mode of ['booth', 'full'] as const) {
    say(`### ${mode === 'booth' ? '부스판 (3라운드)' : '풀버전 (8라운드)'}`)
    say()
    say('| tier (sum) | WAGER 0% | WAGER 50% | WAGER 100% | 0%→100% |')
    say('|:--|--:|--:|--:|--:|')
    for (const tier of TIERS) {
      const at = (wagerAccuracy: number) =>
        measure({ tier, stackMode: 'sum', mode, runs: args.runs, seed: args.seed, wagerAccuracy })
      const [low, mid, high] = [at(0), at(0.5), at(1)]
      const verdict = mode === 'booth' && tier === 'greedy' ? (low.clearRate >= 0.7 ? ' ✅' : ' ❌') : ''
      say(
        `| ${tier}${verdict} | ${pct(low.clearRate)} | ${pct(mid.clearRate)} | ${pct(high.clearRate)} | ` +
          `${((high.clearRate - low.clearRate) * 100).toFixed(1)}%p |`,
      )
    }
    say()
  }

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(resolve(OUT_DIR, 'results.md'), `${lines.join('\n')}\n`, 'utf8')
  process.stderr.write(`\nwrote ${resolve(OUT_DIR, 'results.md')}\n`)
}

main()
