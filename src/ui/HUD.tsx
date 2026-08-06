// The readouts along the top of the canvas: stardust, round and turn, and the
// status line that says what the screen is waiting for.
//
// Every value is read straight off core's state. Placement is the canvas's job
// (GDD 11-10), so each piece here is just the content of its box.

import { MODE_PRESETS, TURNS_PER_ROUND } from '../core/config'
import type { Game } from '../core/game'
import { PALETTE } from '../assets/palette'

/** What the player is meant to do or wait for, at all times. */
export type Status = 'shuffling' | 'choosing' | 'placing' | 'settling' | 'settled'

const STATUS_TEXT: Readonly<Record<Status, string>> = {
  shuffling: '칩을 섞는 중…',
  choosing: '칩을 고르세요',
  placing: '원하는 위치에 놓으세요',
  settling: '정산 중입니다',
  settled: '정산 완료',
}

export function Stardust({ value }: { readonly value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] tracking-wide" style={{ color: PALETTE.starGlow }}>
        스타더스트
      </span>
      <span
        className="text-2xl font-bold leading-none tabular-nums"
        style={{ color: PALETTE.nebulaAmber }}
      >
        {value}
      </span>
    </div>
  )
}

/**
 * `turn` is passed in rather than read off the game, because core advances the
 * turn inside `endTurn` — the settlement for turn 1 would otherwise be headed
 * "턴 2". The store snapshots the turn that is being settled and the screen shows
 * that one until the settlement is dismissed; core's transitions are untouched.
 */
export function RoundTurn({ game, turn }: { readonly game: Game; readonly turn: number }) {
  const total = MODE_PRESETS[game.mode].TOTAL_ROUNDS

  return (
    <div className="flex items-baseline justify-center gap-4 whitespace-nowrap text-sm font-bold tabular-nums">
      <span style={{ color: PALETTE.starWhite }}>
        라운드 {game.round}
        <span style={{ color: PALETTE.starLink }}> / {total}</span>
      </span>
      <span style={{ color: PALETTE.starWhite }}>
        턴 {turn}
        <span style={{ color: PALETTE.starLink }}> / {TURNS_PER_ROUND}</span>
      </span>
    </div>
  )
}

/**
 * Deliberately unanimated.
 *
 * This line is the one thing on screen that must always be readable — it is what
 * tells the player whose turn it is to act (spec: 상시 표시). An earlier version
 * crossfaded it through `AnimatePresence mode="wait"`, which waits for the old
 * line to finish exiting before mounting the new one. If a frame is ever dropped
 * mid-exit the new line never mounts and the old one is left at opacity 0 — the
 * status line goes blank exactly when it matters. A booth machine left running
 * all day is not the place to bet on every frame landing.
 */
export function StatusLine({ status }: { readonly status: Status }) {
  return (
    <div className="flex justify-center whitespace-nowrap">
      <span className="text-[11px]" style={{ color: PALETTE.starGlow }}>
        {STATUS_TEXT[status]}
      </span>
    </div>
  )
}
