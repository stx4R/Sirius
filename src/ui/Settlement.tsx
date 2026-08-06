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

function CountUp({
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
}: {
  readonly suit: SuitId
  readonly step: SuitBreakdown | undefined
  readonly active: boolean
  readonly revealed: boolean
  readonly ms: number
}) {
  const ink = SUIT_INK[suit]
  const multipliers = step?.lines.map((line) => line.multiplier) ?? []

  return (
    <motion.div
      className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded py-1.5"
      animate={{
        background: active ? PALETTE.nebulaDeep : 'rgba(0,0,0,0)',
        scale: active ? 1.06 : 1,
      }}
      transition={{ duration: ms === 0 ? 0 : 0.2 }}
    >
      <PixelSprite pixels={suitGlyph(suit)} scale={2} alt="" />

      <span className="text-sm font-bold tabular-nums">
        {revealed && step !== undefined ? (
          <CountUp value={step.total} ms={ms} colour={ink} />
        ) : (
          <span style={{ color: PALETTE.starLink }}>0</span>
        )}
      </span>

      <span className="flex h-3 flex-wrap justify-center gap-0.5 text-[9px] leading-3">
        {revealed &&
          multipliers.map((value, i) => (
            <motion.span
              key={i}
              initial={ms === 0 ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: ms === 0 ? 0 : 0.25, delay: ms === 0 ? 0 : i * 0.06 }}
              className="tabular-nums font-bold"
              style={{ color: PALETTE.nebulaAmber }}
            >
              ×{value.toFixed(1)}
            </motion.span>
          ))}
      </span>
    </motion.div>
  )
}

interface Props {
  readonly data: SettlementData
  readonly steps: readonly SuitBreakdown[]
  readonly index: number
  readonly onIndex: (index: number) => void
  readonly onDone: () => void
  /** Round score before this turn, so the big figure counts from where it was. */
  readonly roundScoreBefore: number
  readonly reduced: boolean
  readonly speed: number
  readonly onSpeed: (speed: number) => void
}

export function Settlement({
  data,
  steps,
  index,
  onIndex,
  onDone,
  roundScoreBefore,
  reduced,
  speed,
  onSpeed,
}: Props) {
  const running = index < steps.length
  const ms = reduced ? 0 : SPEEDS[speed].ms

  useEffect(() => {
    if (!running) return
    // '즉시' and reduced motion both land on the finished state in one hop; the
    // suit-by-suit reveal is the animation, so there is nothing left to pace.
    if (ms === 0) {
      onIndex(steps.length)
      return
    }
    const timer = setTimeout(() => onIndex(index + 1), ms)
    return () => clearTimeout(timer)
  }, [index, running, ms, steps.length, onIndex])

  const shown = steps.slice(0, index + 1)
  const scoredSoFar = shown.reduce((total, step) => total + step.total, 0)
  const byId = new Map(steps.map((step) => [step.suit, step]))
  const revealedSuits = new Set(shown.map((step) => step.suit))
  const current = steps[index]

  // Constellations that fired for the suit whose beat is running, named so the
  // card lighting up on the left has a label here (GDD 11-5: never a card alone).
  const firing = [
    ...new Set((current?.lines ?? []).flatMap((line) => line.constellations)),
  ]

  return (
    <section
      className="flex flex-col gap-3 rounded p-3"
      style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-bold" style={{ color: PALETTE.starWhite }}>
          정산
        </h2>
        <div className="flex gap-1">
          {SPEEDS.map((option, i) => (
            <button
              key={option.label}
              type="button"
              onClick={() => onSpeed(i)}
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{
                background: i === speed ? PALETTE.panelEdge : 'transparent',
                color: i === speed ? PALETTE.starWhite : PALETTE.starGlow,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex gap-0.5">
        {SUIT_ORDER.map((suit) => (
          <SuitColumn
            key={suit}
            suit={suit}
            step={byId.get(suit)}
            active={running && current?.suit === suit}
            revealed={revealedSuits.has(suit)}
            ms={ms}
          />
        ))}
      </div>

      <div
        className="flex flex-wrap items-baseline justify-center gap-x-1 border-t pt-2 text-[11px] tabular-nums"
        style={{ borderColor: PALETTE.panelEdge }}
      >
        {SUIT_ORDER.map((suit, i) => (
          <span key={suit}>
            {i > 0 && <span style={{ color: PALETTE.starLink }}> + </span>}
            <span
              style={{
                color: revealedSuits.has(suit) ? SUIT_INK[suit] : PALETTE.starLink,
              }}
            >
              {revealedSuits.has(suit) ? (byId.get(suit)?.total ?? 0) : 0}
            </span>
          </span>
        ))}
        <span style={{ color: PALETTE.starLink }}> = </span>
        <span className="font-bold" style={{ color: PALETTE.starWhite }}>
          {scoredSoFar.toLocaleString('ko-KR')}
        </span>
      </div>

      <div className="flex h-4 items-center justify-center text-[10px]">
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

      <div className="flex flex-col items-center gap-0.5 border-t pt-2" style={{ borderColor: PALETTE.panelEdge }}>
        <span className="text-[10px]" style={{ color: PALETTE.starGlow }}>
          이번 라운드 누적
        </span>
        <CountUp
          value={roundScoreBefore + (running ? scoredSoFar : data.awarded)}
          ms={ms === 0 ? 0 : ms}
          className="text-3xl font-bold tabular-nums"
          colour={PALETTE.nebulaAmber}
        />
      </div>

      {!data.exact && !running && (
        <p className="text-[10px] leading-snug" style={{ color: PALETTE.nebulaAmber }}>
          떠돌이 조각은 정산 순간 인접 3방향을 굴려 정합니다(GDD 3-3). 위 분해는 한 가지 결과를
          보여준 것이고, 실제 획득 점수는 굴림 결과인 {data.awarded.toLocaleString('ko-KR')}점입니다.
        </p>
      )}

      <button
        type="button"
        onClick={running ? () => onIndex(steps.length) : onDone}
        className="rounded py-2 text-xs font-bold"
        style={{ background: PALETTE.nebulaTeal, color: PALETTE.void }}
      >
        {running ? '건너뛰기' : '다음 턴'}
      </button>
    </section>
  )
}
