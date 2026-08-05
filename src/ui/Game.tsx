// The playable screen. Assembles the pieces and drives the turn; every rule it
// appears to enforce is really core's, called through the store (CLAUDE.md §5).
//
// Laid out to fit 1366×768 without scrolling — a booth machine is what this runs
// on, and a scrollbar there costs a participant (GDD 12).

import { useEffect, useMemo, useState } from 'react'
import { MODE_PRESETS } from '../core/config'
import { PALETTE } from '../assets/palette'
import { useGame } from '../store/gameStore'
import { Board } from './Board'
import { DEV_TOOLS, DevPanel } from './DevPanel'
import { HUD } from './HUD'
import { Hand } from './Hand'
import { Settlement, litCells, stepsOf } from './Settlement'

function Banner({ title, note, action }: { title: string; note: string; action: () => void }) {
  return (
    <div
      className="flex w-80 flex-col gap-3 rounded p-6 text-center"
      style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
    >
      <h2 className="text-xl font-bold" style={{ color: PALETTE.starWhite }}>
        {title}
      </h2>
      <p className="text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
        {note}
      </p>
      <button
        type="button"
        onClick={action}
        className="rounded py-2 text-xs font-bold"
        style={{ background: PALETTE.nebulaTeal, color: PALETTE.void }}
      >
        다시 시작
      </button>
    </div>
  )
}

export function Game() {
  const game = useGame((state) => state.game)
  const staged = useGame((state) => state.staged)
  const selected = useGame((state) => state.selected)
  const settlement = useGame((state) => state.settlement)
  const { select, placeAt, commitTurn, dismissSettlement, newGame } = useGame.getState()
  const devSet = useGame((state) => state.devSet)

  const [step, setStep] = useState(0)
  useEffect(() => setStep(0), [settlement])

  const steps = useMemo(() => (settlement === null ? [] : stepsOf(settlement)), [settlement])
  const lit = useMemo(() => litCells(steps[step]), [steps, step])

  const board = settlement?.board ?? game.board
  const over = game.status !== 'playing'
  const cleared = game.status === 'cleared'

  return (
    <main
      className="flex min-h-screen items-center justify-center p-6 font-mono"
      style={{ background: PALETTE.void, color: PALETTE.starWhite }}
    >
      <div className="flex items-start gap-8">
        <HUD game={game} />

        <div className="flex flex-col gap-3">
          <Board
            board={board}
            holding={settlement === null && !over ? selected : null}
            lit={lit}
            onPlace={placeAt}
          />
          <Hand
            hand={game.hand}
            selected={selected}
            placedThisTurn={staged.length}
            onSelect={select}
          />
        </div>

        <div className="flex w-80 flex-col gap-3">
          {over ? (
            <Banner
              title={cleared ? '전 라운드 클리어' : '게임 오버'}
              note={
                cleared
                  ? `${MODE_PRESETS[game.mode].TOTAL_ROUNDS}라운드를 모두 넘겼습니다.`
                  : `라운드 ${game.round}에서 목표 ${game.targetScore.toLocaleString('ko-KR')}점에 ` +
                    `${game.roundScore.toLocaleString('ko-KR')}점으로 미달했습니다.`
              }
              action={() => newGame()}
            />
          ) : settlement !== null ? (
            <Settlement
              data={settlement}
              steps={steps}
              index={step}
              onIndex={setStep}
              onDone={dismissSettlement}
            />
          ) : (
            <section
              className="flex flex-col gap-3 rounded p-4"
              style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
            >
              <h2 className="text-sm font-bold" style={{ color: PALETTE.starWhite }}>
                턴 {game.turn}
              </h2>
              <p className="text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
                손패에서 조각을 고르고 성도의 빈칸에 놓습니다. 고른 조각을 다시 누르면 선택이
                풀립니다. 놓은 조각은 되돌릴 수 없습니다.
              </p>
              <button
                type="button"
                onClick={commitTurn}
                className="rounded py-2 text-xs font-bold"
                style={{ background: PALETTE.nebulaAmber, color: PALETTE.void }}
              >
                턴 종료 · 정산
              </button>
              <p className="text-[10px]" style={{ color: PALETTE.starLink }}>
                배치하지 않은 손패는 덱으로 돌아가 다시 섞입니다.
              </p>
            </section>
          )}
        </div>
      </div>

      {DEV_TOOLS && <DevPanel game={game} onPatch={devSet} onRestart={() => newGame()} />}
    </main>
  )
}
