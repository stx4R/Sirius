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
import { CONSTELLATION_NAMES, SUIT_STEP_MS } from '../core/config'
import type { SuitBreakdown } from '../core/scoring'
import { SUIT_ORDER } from '../core/types'
import type { SuitId } from '../core/types'
import { suitGlyph } from '../assets/compose'
import { PALETTE, SUIT_INK } from '../assets/palette'
import { PixelSprite } from './PixelSprite'
import type { Settlement as SettlementData } from '../store/gameStore'

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
  readonly reduced: boolean
  /**
   * The ESC pause window is up (BOOTH-9c), so the walk stops where it is.
   *
   * The hold timer in `Game.tsx` is not the only clock a settlement runs on: this
   * panel steps itself suit by suit, and the pause window is opaque, so a walk left
   * running behind it plays the explanation of the score to nobody.
   */
  readonly paused: boolean
  readonly width: number
  readonly height: number
}

/**
 * What decides whether the finished settlement may start its hold timer
 * (BOOTH-9b). Every field is already on the play screen for its own reasons —
 * nothing was added to the store for this, the way `coachStep` takes its view.
 *
 * It is a function rather than a condition inlined in the effect so that the modal
 * rule can be enumerated in a test. That rule is the whole risk of making the turn
 * advance on a timer: a modal is the game asking the player to read something, and
 * a timer running behind it takes the answer away from them.
 */
export interface AdvanceView {
  readonly hasSettlement: boolean
  /** The suit-by-suit walk has reached its end. */
  readonly walkDone: boolean
  /** The run is over; the banner owns the screen. */
  readonly over: boolean
  /** ORION'S WAGER is up — question or explanation (GDD 8-2). */
  readonly wagerOpen: boolean
  /** DRIFT ORACLE is up (GDD 8-3). */
  readonly oracleOpen: boolean
  /** CONSTELLATION LOG is up (GDD 8-4). */
  readonly reportOpen: boolean
  /**
   * The ESC pause window is up (GDD 12-2 ①④, BOOTH-9c) — its menu, the tutorial
   * summary, the settings, or one of the two confirmations.
   *
   * It replaces the separate `helpOpen` and `resetOpen` of BOOTH-9b: both of those
   * overlays are now pages of this one window, so there is a single field for
   * "the player has stepped out of the game" rather than two that cannot both be
   * true.
   */
  readonly pauseOpen: boolean
}

export function autoAdvances(view: AdvanceView): boolean {
  if (!view.hasSettlement || !view.walkDone || view.over) return false
  return !(view.wagerOpen || view.oracleOpen || view.reportOpen || view.pauseOpen)
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

/**
 * ★ No speed control and no 다음 턴 button (BOOTH-9b). The walk runs at one fixed
 * pace and `Game.tsx` advances the turn on a timer once it finishes.
 *
 * The buttons were not removed for tidiness. A booth participant meets this panel
 * fifteen times in a run (GDD 12-1) and every one of them was a decision — pick a
 * speed, then press a button — about a screen whose whole job is to be *watched*.
 * Taking the controls away is what makes the settlement something that happens to
 * the player rather than something they operate.
 */
export function SettlementPanel({
  data,
  steps,
  index,
  onIndex,
  reduced,
  paused,
  width,
  height,
}: PanelProps) {
  // With animations off the walk still happens, it just takes no time — that
  // setting is about movement, and the suit-by-suit reveal is the explanation
  // rather than decoration on top of it. The hold in `Game.tsx` paces it either way.
  const ms = reduced ? 0 : SUIT_STEP_MS
  const { suits, current, running } = revealedOf(steps, index)
  const active = data !== null && running

  /**
   * ★ ONE STEP PER TIMER, INCLUDING AT ZERO. This used to short-circuit to
   * `onIndex(steps.length)` when `ms` was 0, and that branch deadlocked the
   * settlement — the screen stuck on 융합 중 and the turn never advanced.
   *
   * Why: `Game.tsx` resets the index to 0 whenever a new settlement arrives, and a
   * child effect commits before its parent's. Setting the index synchronously here
   * meant the parent's reset landed *after* it and put the index back to 0 — at
   * which point none of this effect's dependencies had changed, so it never ran
   * again. The timer never had that problem because it fires after both.
   *
   * It was reachable before BOOTH-9c only through `prefers-reduced-motion`, which is
   * why nothing caught it: a booth laptop with that OS setting on would have frozen
   * on the first settlement of every run. The pause window's animation switch made
   * it reachable by a click, which is how it turned up.
   *
   * A 0ms timer per suit is five macrotasks for a full board — some 20ms, one frame.
   */
  useEffect(() => {
    if (data === null || !running || paused) return
    const timer = setTimeout(() => onIndex(index + 1), ms)
    return () => clearTimeout(timer)
  }, [data, index, running, paused, ms, onIndex])

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

        {/* Where the controls were. It says what the screen is doing instead, because
            a panel that used to hold a button and now holds nothing reads as broken —
            and a player who is no longer pressing anything still has to know that
            something is coming rather than that something is stuck. */}
        <span className="text-[9px] tabular-nums" style={{ color: PALETTE.starLink }}>
          {data === null ? '' : active ? '융합 중' : '곧 다음 턴'}
        </span>
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
