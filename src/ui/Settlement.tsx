// The settlement, walked one step at a time in the order of the pseudocode in
// GDD 5-1: suit by suit, line by line, each line's contribution landing on the
// running total.
//
// A number that changes tells the player nothing about why it changed. This is
// the screen where the scoring rules are actually taught, so it is worth the
// time it takes — and worth a skip button, because it is not worth it twice.

import { useEffect, useMemo, useState } from 'react'
import { BASE_CHIP_SCORE, CONSTELLATION_NAMES } from '../core/config'
import { resolveSuits } from '../core/scoring'
import { SUIT_ORDER } from '../core/types'
import type { Position, ScoredLine, SuitId } from '../core/types'
import { CHIP_COLOURS, PALETTE } from '../assets/palette'
import type { Settlement as SettlementData } from '../store/gameStore'

const SPEEDS = [
  { label: '0.5×', ms: 1600 },
  { label: '1×', ms: 800 },
  { label: '2×', ms: 400 },
] as const

const SUIT_LABELS: Readonly<Record<SuitId, string>> = {
  GAC: 'Gacrux',
  IMA: 'Imai',
  GIN: 'Ginan',
  MIM: 'Mimosa',
  ACR: 'Acrux',
}

export interface Step {
  /** `null` on the closing step, which sweeps up every chip that formed no line. */
  readonly suit: SuitId | null
  readonly positions: readonly Position[]
  readonly constellations: readonly string[]
  readonly multiplier: number
  readonly points: number
}

/**
 * Which suit a line was scored as. `scoreBoard` emits lines in suit order but
 * does not label them, so the suit is recovered by intersecting the suits of the
 * cells the line covers — core's own reading of the board, not a second opinion
 * about it. It decides presentation order only; no score depends on it.
 */
function suitOfLine(data: SettlementData, line: ScoredLine): SuitId | null {
  const suits = resolveSuits(data.board, (adjacent) => adjacent.slice(0, 3))
  let shared: SuitId[] | null = null

  for (const pos of line.positions) {
    const cell = suits[pos.row][pos.col]
    if (cell === null) continue
    shared = shared === null ? [...cell] : shared.filter((suit) => cell.has(suit))
  }
  if (shared === null || shared.length === 0) return null
  return [...shared].sort((a, b) => SUIT_ORDER.indexOf(a) - SUIT_ORDER.indexOf(b))[0]
}

export function stepsOf(data: SettlementData): Step[] {
  const lines = data.result.lines.map((line): Step => {
    const points = line.positions.length * BASE_CHIP_SCORE * line.multiplier
    return {
      suit: suitOfLine(data, line),
      positions: line.positions,
      constellations: line.constellations,
      multiplier: line.multiplier,
      points: Math.round(points),
    }
  })

  // Whatever the lines did not account for is the flat base every chip earns
  // (GDD 5-1). Taking it as the remainder keeps this display honest about core's
  // total rather than recomputing it.
  const fromLines = lines.reduce((total, step) => total + step.points, 0)
  const flat = data.result.total - fromLines
  if (flat === 0) return lines

  return [...lines, { suit: null, positions: [], constellations: [], multiplier: 1, points: flat }]
}

export const litCells = (step: Step | undefined): Set<string> =>
  new Set((step?.positions ?? []).map((pos) => `${pos.row},${pos.col}`))

interface Props {
  readonly data: SettlementData
  readonly steps: readonly Step[]
  readonly index: number
  readonly onIndex: (index: number) => void
  readonly onDone: () => void
}

export function Settlement({ data, steps, index, onIndex, onDone }: Props) {
  const [speed, setSpeed] = useState(1)
  const running = index < steps.length

  useEffect(() => {
    if (!running) return
    const timer = setTimeout(() => onIndex(index + 1), SPEEDS[speed].ms)
    return () => clearTimeout(timer)
  }, [index, running, speed, onIndex])

  const shown = useMemo(
    () => steps.slice(0, Math.min(index + 1, steps.length)),
    [steps, index],
  )
  const runningTotal = shown.reduce((total, step) => total + step.points, 0)

  return (
    <section
      className="flex w-80 flex-col gap-3 rounded p-4"
      style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-bold" style={{ color: PALETTE.starWhite }}>
          정산
        </h2>
        <div className="flex gap-1">
          {SPEEDS.map((option, i) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setSpeed(i)}
              className="rounded px-2 py-0.5 text-[10px]"
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

      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
        {shown.length === 0 && (
          <span className="text-[11px]" style={{ color: PALETTE.starGlow }}>
            발동한 라인이 없습니다.
          </span>
        )}
        {shown.map((step, i) => (
          <div
            key={i}
            className="flex items-baseline justify-between gap-2 rounded px-2 py-1 text-[11px]"
            style={{
              background: i === index ? PALETTE.nebulaDeep : 'transparent',
              color: PALETTE.starGlow,
            }}
          >
            <span className="flex-1">
              {step.suit === null ? (
                <span>라인 미형성 칩 · 기본 점수</span>
              ) : (
                <>
                  <span
                    className="font-bold"
                    style={{ color: CHIP_COLOURS[step.suit].edge }}
                  >
                    {SUIT_LABELS[step.suit]}
                  </span>
                  {step.constellations.length > 0 && (
                    <span>
                      {' · '}
                      {step.constellations
                        .map((id) => CONSTELLATION_NAMES[id as keyof typeof CONSTELLATION_NAMES])
                        .join(' + ')}
                      {` ×${step.multiplier.toFixed(1)}`}
                    </span>
                  )}
                  <span style={{ color: PALETTE.starLink }}>{` (${step.positions.length}칸)`}</span>
                </>
              )}
            </span>
            <span className="tabular-nums font-bold" style={{ color: PALETTE.starWhite }}>
              +{step.points.toLocaleString('ko-KR')}
            </span>
          </div>
        ))}
      </div>

      <div
        className="flex items-baseline justify-between border-t pt-2"
        style={{ borderColor: PALETTE.panelEdge }}
      >
        <span className="text-[11px]" style={{ color: PALETTE.starGlow }}>
          {running ? '누적' : '이번 턴 획득'}
        </span>
        <span className="text-xl font-bold tabular-nums" style={{ color: PALETTE.nebulaTeal }}>
          {(running ? runningTotal : data.awarded).toLocaleString('ko-KR')}
        </span>
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
