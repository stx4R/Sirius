// Round, turn, score against target, stardust, and what constellations are held.
// Every value is read straight off core's state.

import { MODE_PRESETS, TURNS_PER_ROUND } from '../core/config'
import type { Game } from '../core/game'
import { PALETTE } from '../assets/palette'
import { ConstellationCard } from './ConstellationCard'

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] tracking-wide" style={{ color: PALETTE.starGlow }}>
        {label}
      </span>
      <span className="text-lg font-bold tabular-nums" style={{ color: tone ?? PALETTE.starWhite }}>
        {value}
      </span>
    </div>
  )
}

export function HUD({ game }: { game: Game }) {
  const total = MODE_PRESETS[game.mode].TOTAL_ROUNDS
  const reached = game.roundScore >= game.targetScore
  const progress = Math.min(1, game.targetScore === 0 ? 1 : game.roundScore / game.targetScore)

  return (
    <aside className="flex w-56 flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="라운드" value={`${game.round} / ${total}`} />
        <Stat label="턴" value={`${game.turn} / ${TURNS_PER_ROUND}`} />
      </div>

      <div className="flex flex-col gap-2">
        <Stat
          label="라운드 점수"
          value={game.roundScore.toLocaleString('ko-KR')}
          tone={reached ? PALETTE.nebulaTeal : PALETTE.starWhite}
        />
        <div className="h-1.5 w-full rounded" style={{ background: PALETTE.panelEdge }}>
          <div
            className="h-full rounded transition-all duration-500"
            style={{
              width: `${progress * 100}%`,
              background: reached ? PALETTE.nebulaTeal : PALETTE.nebulaAmber,
            }}
          />
        </div>
        <span className="text-[11px] tabular-nums" style={{ color: PALETTE.starGlow }}>
          목표 {game.targetScore.toLocaleString('ko-KR')}
          {reached && ' · 달성'}
        </span>
      </div>

      <Stat label="스타더스트" value={String(game.stardust)} tone={PALETTE.nebulaAmber} />

      <div className="flex flex-col gap-2">
        <span className="text-[10px] tracking-wide" style={{ color: PALETTE.starGlow }}>
          보유 별자리 {game.ownedConstellations.length} / 4
        </span>
        {game.ownedConstellations.length === 0 ? (
          <span className="text-[11px]" style={{ color: PALETTE.starLink }}>
            없음 — 모든 칩이 기본 점수만 냅니다
          </span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {game.ownedConstellations.map((id) => (
              <ConstellationCard key={id} id={id} scale={1} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
