// Developer panel. Compiled out of production by DEV_TOOLS.
//
// P3-B has no shop, so nothing can be bought: without this panel every chip is
// worth its flat base and the game cannot be judged. It reaches straight into
// core's state on purpose — it is not implementing a rule, it is standing in for
// the systems that arrive at P4.

import { useState } from 'react'
import {
  ALL_CONSTELLATIONS,
} from '../core/shop'
import {
  CONSTELLATION_NAMES,
  MODE_PRESETS,
  MULTIPLIER_STACK_MODE,
  OWNED_CONSTELLATION_LIMIT,
  SPECIAL_SUIT_PAIRS,
} from '../core/config'
import type { Game } from '../core/game'
import type { Chip, ConstellationId } from '../core/types'
import { PALETTE } from '../assets/palette'
import { previewScore } from '../store/gameStore'

/** Vite replaces this at build time, so the panel drops out of a production bundle. */
export const DEV_TOOLS = import.meta.env.DEV

interface Props {
  readonly game: Game
  readonly onPatch: (patch: (game: Game) => Game) => void
  readonly onRestart: () => void
}

const addChip = (game: Game, chip: Chip): Game => ({
  ...game,
  ownedDeck: [...game.ownedDeck, chip],
  deck: [...game.deck, chip],
  nextChipId: game.nextChipId + 1,
})

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-wide" style={{ color: PALETTE.starGlow }}>
        {label}
      </span>
      {children}
    </div>
  )
}

export function DevPanel({ game, onPatch, onRestart }: Props) {
  const [open, setOpen] = useState(false)
  const preview = previewScore(game)

  const toggle = (id: ConstellationId) =>
    onPatch((current) => ({
      ...current,
      ownedConstellations: current.ownedConstellations.includes(id)
        ? current.ownedConstellations.filter((held) => held !== id)
        : [...current.ownedConstellations, id],
    }))

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded px-3 py-1.5 text-[11px]"
        style={{ background: PALETTE.panel, color: PALETTE.starGlow, outline: `1px solid ${PALETTE.panelEdge}` }}
      >
        DEV ▸
      </button>
    )
  }

  return (
    <aside
      // Anchored to its right edge so it opens leftwards into the canvas rather
      // than off the plane (GDD 11-10 puts the toggle at x=1050 of 1120).
      className="absolute right-0 top-0 flex max-h-[600px] w-64 flex-col gap-4 overflow-y-auto rounded p-4 text-[11px]"
      style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
    >
      <header className="flex items-center justify-between">
        <span className="font-bold" style={{ color: PALETTE.nebulaAmber }}>
          개발자 패널
        </span>
        <button type="button" onClick={() => setOpen(false)} style={{ color: PALETTE.starGlow }}>
          ✕
        </button>
      </header>

      <Row label={`별자리 (보유 ${game.ownedConstellations.length} / ${OWNED_CONSTELLATION_LIMIT})`}>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {ALL_CONSTELLATIONS.map((id) => (
            <label key={id} className="flex items-center gap-1.5" style={{ color: PALETTE.starGlow }}>
              <input
                type="checkbox"
                checked={game.ownedConstellations.includes(id)}
                onChange={() => toggle(id)}
              />
              {CONSTELLATION_NAMES[id]}
            </label>
          ))}
        </div>
      </Row>

      <Row label="덱에 조각 추가">
        <div className="flex flex-wrap gap-1">
          {SPECIAL_SUIT_PAIRS.slice(0, 4).map(([left, right]) => (
            <button
              key={`${left}${right}`}
              type="button"
              onClick={() =>
                onPatch((current) =>
                  addChip(current, {
                    id: `dev-${current.nextChipId}`,
                    kind: 'special',
                    left,
                    right,
                  }),
                )
              }
              className="rounded px-1.5 py-0.5"
              style={{ background: PALETTE.panelEdge, color: PALETTE.starWhite }}
            >
              {left}&{right}
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              onPatch((current) =>
                addChip({ ...current, drifterOwned: true }, {
                  id: `dev-${current.nextChipId}`,
                  kind: 'drifter',
                }),
              )
            }
            className="rounded px-1.5 py-0.5"
            style={{ background: PALETTE.panelEdge, color: PALETTE.starWhite }}
          >
            떠돌이
          </button>
        </div>
      </Row>

      <Row label="라운드 이동">
        <div className="flex flex-wrap gap-1">
          {MODE_PRESETS[game.mode].TARGET_SCORES.map((target, i) => (
            <button
              key={target}
              type="button"
              onClick={() =>
                onPatch((current) => ({
                  ...current,
                  round: i + 1,
                  targetScore: current.targets[i],
                  roundScore: 0,
                }))
              }
              className="rounded px-1.5 py-0.5"
              style={{
                background: game.round === i + 1 ? PALETTE.nebulaTeal : PALETTE.panelEdge,
                color: game.round === i + 1 ? PALETTE.void : PALETTE.starWhite,
              }}
            >
              R{i + 1}
            </button>
          ))}
        </div>
      </Row>

      <Row label="배율 스택 모드">
        <span style={{ color: PALETTE.starWhite }}>
          {game.stackMode}
          {game.stackMode !== MULTIPLIER_STACK_MODE && ' (config 기본값과 다름)'}
        </span>
      </Row>

      <Row label="현재 보드 정산 미리보기">
        <span className="text-base font-bold tabular-nums" style={{ color: PALETTE.nebulaTeal }}>
          {preview.total.toLocaleString('ko-KR')}점
        </span>
        <span style={{ color: PALETTE.starLink }}>발동 라인 {preview.lines.length}개</span>
      </Row>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={onRestart}
          className="flex-1 rounded py-1.5 font-bold"
          style={{ background: PALETTE.panelEdge, color: PALETTE.starWhite }}
        >
          새 게임
        </button>
        <a
          href="#gallery"
          className="flex-1 rounded py-1.5 text-center font-bold"
          style={{ background: PALETTE.panelEdge, color: PALETTE.starWhite }}
        >
          스프라이트
        </a>
      </div>
    </aside>
  )
}
