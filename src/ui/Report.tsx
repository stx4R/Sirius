// CONSTELLATION LOG — the round-end statistics report (GDD 8-4).
//
// The screen counts nothing. Core tallies the round off the ledgers it already
// keeps (`src/core/report.ts`) and hands over actuals, expectations and the
// spread around them; this file draws bars (CLAUDE.md §5).
//
// ★ Every figure here is in **cards**: how many drawn cards carried a suit. The
// shop and STAR-CHART show a different statistic in the same colours — what
// share of *hands* held at least one (GDD 8-1, `observedChances`) — and the two
// must not be read as one series, so the unit is printed on the panel and the
// hand-level figure never appears on it.
//
// It is a modal between the round and the shop (GDD 4-1). Nothing is happening
// behind it: the shop has not been rolled yet, because rolling it hands over the
// drifter and would edit the deck this report is about (GDD 13-4).

import { motion } from 'framer-motion'
import { WAGER_GUESS_RATE } from '../core/config'
import type { ConvergencePoint, RoundReport, SuitTally, Tally } from '../core/report'
import { PALETTE, SUIT_INK } from '../assets/palette'

const percent = (value: number): string => `${Math.round(value * 100)}%`
/** One decimal, since an expectation is rarely a whole number of cards. */
const cards = (value: number): string => value.toFixed(1)

/** Whole pixels, and never zero while there is anything to show (CLAUDE.md §7). */
function span(value: number, scale: number, track: number): number {
  if (value <= 0 || scale <= 0) return 0
  return Math.max(1, Math.round((value / scale) * track))
}

const TRACK = 240

/**
 * One suit: how many cards carried it, against how many the deck predicted.
 *
 * The band is the point of the row. A bar that overshoots its tick looks like an
 * error until you can see that the overshoot is ordinary, and a middle schooler
 * has no reason to assume it is — so the range a sample this size usually lands
 * in is drawn first, underneath, and the tick and the bar sit on top of it.
 */
function SuitRow({ entry, scale, height }: {
  readonly entry: SuitTally
  readonly scale: number
  readonly height: number
}) {
  const inside = Math.abs(entry.actual - entry.expected) <= entry.spread
  const low = Math.max(0, entry.expected - entry.spread)
  const high = entry.expected + entry.spread

  return (
    <div className="flex items-center gap-2" style={{ height }}>
      <span className="w-9 text-[11px] font-bold" style={{ color: SUIT_INK[entry.suit] }}>
        {entry.suit}
      </span>

      <div className="relative" style={{ width: TRACK, height: 14 }}>
        {/* 흔한 범위 */}
        <div
          className="absolute top-0 rounded-sm"
          style={{
            left: span(low, scale, TRACK),
            width: Math.max(1, span(high, scale, TRACK) - span(low, scale, TRACK)),
            height: 14,
            background: PALETTE.panelEdge,
          }}
        />
        {/* 실제 */}
        <div
          className="absolute rounded-sm"
          style={{
            left: 0,
            top: 4,
            width: span(entry.actual, scale, TRACK),
            height: 6,
            background: SUIT_INK[entry.suit],
          }}
        />
        {/* 기댓값 */}
        <div
          className="absolute top-0"
          style={{
            left: span(entry.expected, scale, TRACK),
            width: 1,
            height: 14,
            background: PALETTE.starWhite,
          }}
        />
      </div>

      <span
        className="w-24 text-right text-[11px] tabular-nums"
        style={{ color: inside ? PALETTE.starGlow : PALETTE.nebulaAmber }}
      >
        {entry.actual} / {cards(entry.expected)}
      </span>
    </div>
  )
}

/**
 * The convergence list (GDD 8-4, 큰수의법칙 Ⅲ-3), one row per round played.
 *
 * `typical` is drawn as a zone and `gap` as a bar inside it, on one scale across
 * every row — so the zone visibly narrows round by round even when the bar does
 * not. That is deliberate: three booth rounds are too few for the bar alone to
 * settle, and the narrowing zone is the part of the law that always shows.
 */
function Series({ points, height }: {
  readonly points: readonly ConvergencePoint[]
  readonly height: number
}) {
  const scale = Math.max(...points.map((point) => Math.max(point.gap, point.typical)), 0.0001)

  return (
    <div className="flex flex-col">
      <div className="flex text-[9px]" style={{ color: PALETTE.starGlow, height: 16 }}>
        <span className="w-8">라운드</span>
        <span className="w-14 text-right">표본</span>
        <span className="flex-1 pl-3">비율 차이 · 띠는 흔한 차이</span>
      </div>

      {points.map((point) => (
        <div key={point.round} className="flex items-center text-[9px]" style={{ height }}>
          <span className="w-8" style={{ color: PALETTE.starWhite }}>
            R{point.round}
          </span>
          <span className="w-14 text-right tabular-nums" style={{ color: PALETTE.starGlow }}>
            {point.cards}장
          </span>
          <div className="relative flex-1 pl-3">
            <div className="relative" style={{ height: 10 }}>
              <div
                className="absolute top-0 rounded-sm"
                style={{
                  left: 0,
                  width: span(point.typical, scale, 150),
                  height: 10,
                  background: PALETTE.panelEdge,
                }}
              />
              <div
                className="absolute rounded-sm"
                style={{
                  left: 0,
                  top: 3,
                  width: span(point.gap, scale, 150),
                  height: 4,
                  background: PALETTE.nebulaTeal,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Wager({ tally }: { readonly tally: Tally['wager'] }) {
  const guessLow = WAGER_GUESS_RATE - tally.spread
  const guessHigh = WAGER_GUESS_RATE + tally.spread
  const beating = tally.rate !== null && tally.rate > guessHigh

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px]" style={{ color: PALETTE.starGlow }}>
        ORION&apos;S WAGER — 누적
      </span>

      {tally.rate === null ? (
        <span className="text-[11px]" style={{ color: PALETTE.starGlow }}>
          답한 문항이 없습니다. 기권 {tally.abstained}회.
        </span>
      ) : (
        <>
          {/* The count first and the rate after it: a rate with no sample size
              behind it is the thing this screen is trying to stop being read. */}
          <span className="text-[14px]" style={{ color: PALETTE.starWhite }}>
            {tally.answered}문항 중 {tally.correct}문항
            <span style={{ color: beating ? PALETTE.nebulaTeal : PALETTE.starGlow }}>
              {' '}
              ({percent(tally.rate)})
            </span>
          </span>
          <span className="text-[9px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
            찍어서 맞히면 이 표본에서는 보통 {percent(guessLow)}~{percent(guessHigh)}에 들어옵니다.
            {tally.abstained > 0 && ` 기권 ${tally.abstained}회는 세지 않았습니다.`}
          </span>
        </>
      )}
    </div>
  )
}

export function ReportPanel({
  report,
  reduced,
  width,
  height,
  row,
  series,
  onDismiss,
}: {
  readonly report: RoundReport
  readonly reduced: boolean
  readonly width: number
  readonly height: number
  readonly row: number
  readonly series: number
  readonly onDismiss: () => void
}) {
  const { cumulative, population } = report
  const scale = Math.max(
    1,
    ...cumulative.bySuit.map((entry) => Math.max(entry.actual, entry.expected + entry.spread)),
  )

  return (
    <motion.div
      // `npm run shot` measures this box against its own content: the suit rows
      // and the convergence list both grow with the run, and a clipped report is
      // a lesson with its conclusion cut off.
      data-panel="report"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
      className="flex flex-col gap-3 rounded p-5"
      style={{
        width,
        height,
        background: PALETTE.panel,
        outline: `1px solid ${PALETTE.panelEdge}`,
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold tracking-wide" style={{ color: PALETTE.nebulaAmber }}>
          CONSTELLATION LOG
        </span>
        <span className="text-[9px]" style={{ color: PALETTE.starGlow }}>
          라운드 {report.round} 기록
        </span>
      </div>

      <div className="flex flex-1 gap-5">
        {/* ------------------------------------------------------------ left */}
        <div className="flex w-[360px] flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px]" style={{ color: PALETTE.starGlow }}>
              이번 라운드
            </span>
            <span className="text-[22px] font-bold" style={{ color: PALETTE.starWhite }}>
              {report.score.toLocaleString('ko-KR')}점
            </span>
            <span className="text-[9px]" style={{ color: PALETTE.nebulaTeal }}>
              목표 {report.target.toLocaleString('ko-KR')}점 달성 · {report.thisRound.hands}번 뽑아
              카드 {report.thisRound.cards}장
            </span>
          </div>

          <Wager tally={cumulative.wager} />

          {/* GDD 1-4: 큰수의법칙 is written closed up, and 비복원추출 belongs to
              모집단과 표본 (Ⅲ-5) rather than to conditional probability. Nothing
              here narrates one draw following another — the third line is about
              how big the sample is, not about what happened when. */}
          <div className="mt-auto flex flex-col gap-2">
            <p className="text-[9px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
              <b style={{ color: PALETTE.starWhite }}>모집단과 표본.</b> 덱 {population.size}장
              전체가 모집단이고, 거기서 뽑은 카드가 표본입니다.
            </p>
            <p className="text-[9px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
              <b style={{ color: PALETTE.starWhite }}>차이는 정상입니다.</b> 실제가 기댓값과 딱
              맞는 쪽이 오히려 드뭅니다. 띠 안에 들어오면 흔히 나오는 차이입니다.
            </p>
            <p className="text-[9px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
              <b style={{ color: PALETTE.starWhite }}>큰수의법칙.</b> 표본이 커질수록 비율의 차이는
              줄어듭니다. 지금 어긋나 보인다면 이론이 틀린 것이 아니라 표본이 아직 적은 것입니다.
            </p>
          </div>
        </div>

        {/* ----------------------------------------------------------- right */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col">
            <div className="flex items-baseline justify-between" style={{ height: 16 }}>
              <span className="text-[9px]" style={{ color: PALETTE.starGlow }}>
                문양별 실제 / 기댓값 — 뽑은 카드 {cumulative.cards}장 기준 (누적)
              </span>
              <span className="text-[9px]" style={{ color: PALETTE.starLink }}>
                ┃기댓값 ▬실제
              </span>
            </div>
            {cumulative.bySuit.map((entry) => (
              <SuitRow key={entry.suit} entry={entry} scale={scale} height={row} />
            ))}
          </div>

          <Series points={report.series} height={series} />
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="self-end rounded px-6 py-3 text-[11px] font-bold"
        style={{ background: PALETTE.nebulaAmber, color: PALETTE.void }}
      >
        계속
      </button>
    </motion.div>
  )
}
