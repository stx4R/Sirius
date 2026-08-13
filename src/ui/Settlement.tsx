// The settlement, walked one suit at a time in the fixed order of GDD 3-1:
// Gacrux → Imai → Ginan → Mimosa → Acrux.
//
// A number that changes tells the player nothing about why it changed. This is
// the screen where the scoring rules are actually taught, so each suit gets its
// own beat — its chips light up on the board, its constellations fire, its column
// counts up — and the columns then read off as the equation they already are.
//
// Every figure here is core's (`ScoreResult.bySuit`). This file does no scoring:
// `Σ bySuit[].total === total` is pinned by scoring.test.ts, so the equation is
// core's arithmetic laid out, not a second opinion about it (CLAUDE.md §5).
//
// The three pieces are placed separately on the canvas (GDD 11-10) and are all
// on screen at all times — the panel showing zeroes between turns is what makes
// the right half of the board stop looking empty.

import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { CONSTELLATION_NAMES } from '../core/config'
import type { SuitBreakdown } from '../core/scoring'
import { SUIT_ORDER } from '../core/types'
import type { SuitId } from '../core/types'
import { suitGlyph } from '../assets/compose'
import { PALETTE, SUIT_INK } from '../assets/palette'
import { SUIT_STEP_MS } from './motion'
import { PixelSprite } from './PixelSprite'
import type { Settlement as SettlementData } from '../store/gameStore'

/** GDD 5-1 runs five suits; at 1× the whole settlement lands inside three seconds. */
const SPEEDS = [
  { label: '1×', ms: SUIT_STEP_MS },
  { label: '2×', ms: SUIT_STEP_MS / 2 },
  { label: '즉시', ms: 0 },
] as const

/** The suits that scored, in order. Core omits the ones worth nothing. */
export const stepsOf = (data: SettlementData): readonly SuitBreakdown[] => data.result.bySuit

/** Which board cells the current suit's beat lights up, as "row,col". */
export const litCells = (step: SuitBreakdown | undefined): Set<string> =>
  new Set((step?.cells ?? []).map((pos) => `${pos.row},${pos.col}`))

export function CountUp({
  value,
  ms,
  className,
  colour,
}: {
  readonly value: number
  readonly ms: number
  readonly className?: string
  readonly colour: string
}) {
  const count = useMotionValue(0)
  const text = useTransform(count, (n) => Math.round(n).toLocaleString('ko-KR'))

  useEffect(() => {
    const controls = animate(count, value, { duration: ms / 1000, ease: 'easeOut' })
    return () => controls.stop()
  }, [count, value, ms])

  return (
    <motion.span className={className} style={{ color: colour }}>
      {text}
    </motion.span>
  )
}

/**
 * One suit's column: its symbol, what it scored, and the multipliers that got it
 * there.
 *
 * The multipliers are listed one per firing line rather than combined into a
 * single figure for the suit. GDD 5-2 stacks multipliers *within* a line and
 * nowhere else, so a suit with a ×2.5 line and a ×1.2 line has no one multiplier
 * — inventing an average would teach a rule the game does not have.
 */
function SuitColumn({
  suit,
  step,
  active,
  revealed,
  ms,
  width,
}: {
  readonly suit: SuitId
  readonly step: SuitBreakdown | undefined
  readonly active: boolean
  readonly revealed: boolean
  readonly ms: number
  readonly width: number
}) {
  const ink = SUIT_INK[suit]
  const multipliers = step?.lines.map((line) => line.multiplier) ?? []

  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-1 rounded py-1"
      style={{ width }}
      animate={{
        background: active ? PALETTE.nebulaDeep : 'rgba(0,0,0,0)',
        scale: active ? 1.06 : 1,
      }}
      transition={{ duration: ms === 0 ? 0 : 0.2 }}
    >
      <PixelSprite pixels={suitGlyph(suit)} scale={2} alt="" />

      <span className="text-[22px] font-bold leading-none tabular-nums">
        {revealed && step !== undefined ? (
          <CountUp value={step.total} ms={ms} colour={ink} />
        ) : (
          <span style={{ color: PALETTE.starLink }}>0</span>
        )}
      </span>

      <span className="flex h-3 flex-wrap justify-center gap-1 text-[11px] leading-3">
        {revealed &&
          multipliers.map((value, i) => (
            <motion.span
              key={i}
              initial={ms === 0 ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: ms === 0 ? 0 : 0.25, delay: ms === 0 ? 0 : i * 0.06 }}
              className="font-bold tabular-nums"
              style={{ color: PALETTE.nebulaAmber }}
            >
              ×{value.toFixed(1)}
            </motion.span>
          ))}
      </span>
    </motion.div>
  )
}

export interface PanelProps {
  readonly data: SettlementData | null
  readonly steps: readonly SuitBreakdown[]
  readonly index: number
  readonly onIndex: (index: number) => void
  readonly onDone: () => void
  readonly reduced: boolean
  readonly speed: number
  readonly onSpeed: (speed: number) => void
  readonly width: number
  readonly height: number
}

/** How far the walk has got, shared by all three pieces. */
export function revealedOf(steps: readonly SuitBreakdown[], index: number) {
  const shown = steps.slice(0, index + 1)
  return {
    shown,
    suits: new Set(shown.map((step) => step.suit)),
    scored: shown.reduce((total, step) => total + step.total, 0),
    current: steps[index],
    running: index < steps.length,
  }
}

export function SettlementPanel({
  data,
  steps,
  index,
  onIndex,
  onDone,
  reduced,
  speed,
  onSpeed,
  width,
  height,
}: PanelProps) {
  const ms = reduced ? 0 : SPEEDS[speed].ms
  const { suits, current, running } = revealedOf(steps, index)
  const active = data !== null && running

  useEffect(() => {
    if (data === null || !running) return
    // '즉시' and reduced motion both land on the finished state in one hop; the
    // suit-by-suit reveal is the animation, so there is nothing left to pace.
    if (ms === 0) {
      onIndex(steps.length)
      return
    }
    const timer = setTimeout(() => onIndex(index + 1), ms)
    return () => clearTimeout(timer)
  }, [data, index, running, ms, steps.length, onIndex])

  const byId = new Map(steps.map((step) => [step.suit, step]))
  const firing = [...new Set((current?.lines ?? []).flatMap((line) => line.constellations))]
  const column = (width - 16) / SUIT_ORDER.length

  return (
    <section
      className="flex flex-col rounded px-2 py-1.5"
      style={{
        width,
        height,
        background: PALETTE.panel,
        outline: `1px solid ${PALETTE.panelEdge}`,
      }}
    >
      <header className="flex items-center justify-between">
        {/* 융합's one 한자 (BOOTH-9a). This panel is where the word is defined by
            demonstration — it is the thing the player watches happen — so it is the
            heading that carries it, and every other mention of 융합 is 한글 only.
            Unlike the coach's two, this heading returns each turn; there is no
            once-only surface that names 융합 at all. */}
        <h2 className="text-[11px] font-bold" style={{ color: PALETTE.starWhite }}>
          융합(融合)
        </h2>

        <div className="flex items-center gap-1">
          {SPEEDS.map((option, i) => (
            <button
              key={option.label}
              type="button"
              onClick={() => onSpeed(i)}
              className="rounded px-1.5 py-0.5 text-[11px]"
              style={{
                background: i === speed ? PALETTE.panelEdge : 'transparent',
                color: i === speed ? PALETTE.starWhite : PALETTE.starGlow,
              }}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={active ? () => onIndex(steps.length) : onDone}
            disabled={data === null}
            className="ml-1 rounded px-2 py-0.5 text-[11px] font-bold"
            style={{
              background: data === null ? PALETTE.panelEdge : PALETTE.nebulaTeal,
              color: data === null ? PALETTE.starLink : PALETTE.void,
              cursor: data === null ? 'default' : 'pointer',
            }}
          >
            {active ? '건너뛰기' : '다음 턴'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 items-center">
        {SUIT_ORDER.map((suit) => (
          <SuitColumn
            key={suit}
            suit={suit}
            step={byId.get(suit)}
            active={active && current?.suit === suit}
            revealed={data !== null && suits.has(suit)}
            ms={ms}
            width={column}
          />
        ))}
      </div>

      <div className="flex h-3 items-center justify-center text-[11px]">
        {firing.length > 0 && (
          <motion.span
            key={firing.join()}
            initial={ms === 0 ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ color: PALETTE.nebulaAmber }}
          >
            {firing
              .map((id) => CONSTELLATION_NAMES[id as keyof typeof CONSTELLATION_NAMES])
              .join(' · ')}{' '}
            발동
          </motion.span>
        )}
      </div>
    </section>
  )
}

/** `30 + 80 + 15 + 0 + 40 = 165`, right-aligned under the panel. */
export function SettlementEquation({
  data,
  steps,
  index,
}: {
  readonly data: SettlementData | null
  readonly steps: readonly SuitBreakdown[]
  readonly index: number
}) {
  const { suits, scored } = revealedOf(steps, index)
  const byId = new Map(steps.map((step) => [step.suit, step]))
  const shown = (suit: SuitId) => (data !== null && suits.has(suit) ? (byId.get(suit)?.total ?? 0) : 0)

  return (
    <div className="flex items-baseline justify-end gap-1 text-sm tabular-nums">
      {SUIT_ORDER.map((suit, i) => (
        <span key={suit} className="flex items-baseline gap-1">
          {i > 0 && <span style={{ color: PALETTE.starLink }}>+</span>}
          <span
            style={{ color: data !== null && suits.has(suit) ? SUIT_INK[suit] : PALETTE.starLink }}
          >
            {shown(suit)}
          </span>
        </span>
      ))}
      <span style={{ color: PALETTE.starLink }}>=</span>
      <span className="text-[22px] font-bold" style={{ color: PALETTE.starWhite }}>
        {(data === null ? 0 : scored).toLocaleString('ko-KR')}
      </span>
    </div>
  )
}

/** The big amber figure: what this round has banked, and what it needs. */
export function RoundTotal({
  value,
  target,
  ms,
}: {
  readonly value: number
  readonly target: number
  readonly ms: number
}) {
  const reached = value >= target
  const progress = Math.min(1, target === 0 ? 1 : value / target)

  return (
    <div className="flex w-64 flex-col items-center gap-1">
      <span className="text-[11px] tracking-wide" style={{ color: PALETTE.starGlow }}>
        이번 주기 누적
      </span>
      <CountUp
        value={value}
        ms={ms}
        className="text-[44px] font-bold leading-none tabular-nums"
        colour={reached ? PALETTE.nebulaTeal : PALETTE.nebulaAmber}
      />
      <div className="mt-1 h-1.5 w-full rounded" style={{ background: PALETTE.panelEdge }}>
        {/* `initial={false}` so the bar starts at its real width. A block div
            with no width is 100% wide, and animating in from that flashed a full
            bar on the first frame of every mount. */}
        <motion.div
          className="h-full rounded"
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: ms === 0 ? 0 : 0.5 }}
          style={{ background: reached ? PALETTE.nebulaTeal : PALETTE.nebulaAmber }}
        />
      </div>
      <span className="text-[11px] tabular-nums" style={{ color: PALETTE.starGlow }}>
        목표 {target.toLocaleString('ko-KR')}
        {reached && ' · 달성'}
      </span>
    </div>
  )
}

/** GDD 3-3: the drifter's roll can make the shown breakdown differ from the award. */
export function DrifterNote({ data }: { readonly data: SettlementData }) {
  return (
    <p className="text-[11px] leading-snug" style={{ color: PALETTE.nebulaAmber }}>
      떠돌이 조각은 융합 순간 인접 3방향을 굴려 정합니다(GDD 3-3). 위 분해는 한 가지 결과이고,
      실제 획득은 {data.awarded.toLocaleString('ko-KR')}점입니다.
    </p>
  )
}
