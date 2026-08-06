// The top bar: stardust on the left, round and turn in the middle, and under
// them the status line that says what the screen is waiting for.
//
// Every value is read straight off core's state.

import { AnimatePresence, motion } from 'framer-motion'
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

export function HUD({
  game,
  status,
  reduced,
}: {
  readonly game: Game
  readonly status: Status
  readonly reduced: boolean
}) {
  const total = MODE_PRESETS[game.mode].TOTAL_ROUNDS
  const reached = game.roundScore >= game.targetScore
  const progress = Math.min(1, game.targetScore === 0 ? 1 : game.roundScore / game.targetScore)

  return (
    <header className="flex items-start justify-between gap-6">
      <div className="flex w-40 flex-col gap-0.5">
        <span className="text-[10px] tracking-wide" style={{ color: PALETTE.starGlow }}>
          스타더스트
        </span>
        <span
          className="text-2xl font-bold tabular-nums leading-none"
          style={{ color: PALETTE.nebulaAmber }}
        >
          {game.stardust}
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="flex items-baseline gap-4 text-sm font-bold tabular-nums">
          <span style={{ color: PALETTE.starWhite }}>
            라운드 {game.round}
            <span style={{ color: PALETTE.starLink }}> / {total}</span>
          </span>
          <span style={{ color: PALETTE.starWhite }}>
            턴 {game.turn}
            <span style={{ color: PALETTE.starLink }}> / {TURNS_PER_ROUND}</span>
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.span
            key={status}
            initial={reduced ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: 4 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            className="text-[11px]"
            style={{ color: PALETTE.starGlow }}
          >
            {STATUS_TEXT[status]}
          </motion.span>
        </AnimatePresence>
      </div>

      <div className="flex w-40 flex-col gap-1">
        <div className="flex items-baseline justify-between text-[10px]">
          <span style={{ color: PALETTE.starGlow }}>라운드 점수</span>
          <span
            className="text-sm font-bold tabular-nums"
            style={{ color: reached ? PALETTE.nebulaTeal : PALETTE.starWhite }}
          >
            {game.roundScore.toLocaleString('ko-KR')}
          </span>
        </div>
        <div className="h-1.5 w-full rounded" style={{ background: PALETTE.panelEdge }}>
          <motion.div
            className="h-full rounded"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: reduced ? 0 : 0.5 }}
            style={{ background: reached ? PALETTE.nebulaTeal : PALETTE.nebulaAmber }}
          />
        </div>
        <span className="text-right text-[10px] tabular-nums" style={{ color: PALETTE.starGlow }}>
          목표 {game.targetScore.toLocaleString('ko-KR')}
          {reached && ' · 달성'}
        </span>
      </div>
    </header>
  )
}
