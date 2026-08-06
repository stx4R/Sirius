// The playable screen. Assembles the pieces and drives the turn; every rule it
// appears to enforce is really core's, called through the store (CLAUDE.md §5).
//
// Laid out to fit 1366×768 without scrolling — a booth machine is what this runs
// on, and a scrollbar there costs a participant (GDD 12).
//
//   ┌ stardust ───── round · turn ───────── round score ┐
//   │ board 5×5   held constellations   settlement      │
//   │             [end turn]            round total     │
//   └ hand (fanned) ─────────────────── ORION ──────────┘
//
// Two things are timed here rather than in the store: the shuffle beat, which
// core has no notion of because its shuffle is instantaneous, and the settlement
// step index. Both are presentation, and the store owns no timers.

import { useEffect, useMemo, useRef, useState } from 'react'
import { MODE_PRESETS, OWNED_CONSTELLATION_LIMIT, TURNS_PER_ROUND } from '../core/config'
import { PALETTE } from '../assets/palette'
import { useGame } from '../store/gameStore'
import { Board } from './Board'
import { ConstellationCard } from './ConstellationCard'
import { DEV_TOOLS, DevPanel } from './DevPanel'
import { HUD } from './HUD'
import type { Status } from './HUD'
import { Hand } from './Hand'
import { OrionBubble, useOrion } from './Orion'
import { usePrefersReducedMotion } from './motion'
import { Settlement, litCells, stepsOf } from './Settlement'

/** How long "칩을 섞는 중…" holds before the hand flies in. */
const SHUFFLE_MS = 550

function Banner({ title, note, action }: { title: string; note: string; action: () => void }) {
  return (
    <div
      className="flex flex-col gap-3 rounded p-6 text-center"
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
  const seed = useGame((state) => state.seed)
  const { select, placeAt, commitTurn, dismissSettlement, newGame } = useGame.getState()
  const devSet = useGame((state) => state.devSet)

  const reduced = usePrefersReducedMotion()
  const orion = useOrion(seed)

  const [step, setStep] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [shuffling, setShuffling] = useState(false)

  const steps = useMemo(() => (settlement === null ? [] : stepsOf(settlement)), [settlement])
  const lit = useMemo(() => litCells(steps[step]), [steps, step])

  const board = settlement?.board ?? game.board
  const over = game.status !== 'playing'
  const cleared = game.status === 'cleared'
  const settling = settlement !== null && step < steps.length

  // A new hand means the deck was just reshuffled (GDD 4-2). Core does that in
  // one call, so the beat that makes it legible is added here.
  const handStamp = `${game.round}-${game.turn}`
  useEffect(() => {
    if (settlement !== null || over) return
    setShuffling(true)
    const timer = setTimeout(() => setShuffling(false), reduced ? 0 : SHUFFLE_MS)
    return () => clearTimeout(timer)
  }, [handStamp, settlement, over, reduced])

  useEffect(() => setStep(0), [settlement])

  // ORION reacts to what just happened. `speak` is stable and the beats are keyed
  // off state that only moves forward, so each one fires once.
  const { speak } = orion
  useEffect(() => {
    if (settlement === null && !over) speak('turnStart')
  }, [handStamp, settlement, over, speak])

  useEffect(() => {
    if (settlement !== null) speak('settling')
  }, [settlement, speak])

  const settledOnce = useRef<object | null>(null)
  useEffect(() => {
    if (settlement === null || settling || settledOnce.current === settlement) return
    settledOnce.current = settlement

    // "Big" and "close" are measured against the round's own pace — one turn's
    // share of the target — so no threshold is invented here (CLAUDE.md §5).
    const pace = game.targetScore / TURNS_PER_ROUND
    if (settlement.awarded >= pace) speak('bigScore')
    else if (game.roundScore < game.targetScore && game.targetScore - game.roundScore <= pace) {
      speak('nearTarget')
    }
  }, [settlement, settling, game.targetScore, game.roundScore, speak])

  useEffect(() => {
    if (game.status === 'cleared') speak('roundClear')
    if (game.status === 'gameOver') speak('gameOver')
  }, [game.status, speak])

  const status: Status = over
    ? 'settled'
    : settlement !== null
      ? settling
        ? 'settling'
        : 'settled'
      : shuffling
        ? 'shuffling'
        : selected === null
          ? 'choosing'
          : 'placing'

  // Constellations lighting up on the suit whose beat is running (GDD 5-1 step 2).
  const firing = new Set((steps[step]?.lines ?? []).flatMap((line) => line.constellations))

  return (
    <main
      className="flex h-screen flex-col gap-3 p-4 font-mono"
      style={{ background: PALETTE.void, color: PALETTE.starWhite }}
    >
      <HUD game={game} status={status} reduced={reduced} />

      {/* `items-center` splits the slack a 768px screen leaves above and below the
          board, instead of pooling all of it between the board and the hand. */}
      <div className="flex flex-1 items-center justify-center gap-5">
        <Board
          board={board}
          holding={settlement === null && !over && !shuffling ? selected : null}
          lit={lit}
          dim={shuffling || settling}
          reduced={reduced}
          onPlace={placeAt}
        />

        <div className="flex w-36 flex-col gap-2">
          <span className="text-[10px] tracking-wide" style={{ color: PALETTE.starGlow }}>
            보유 별자리 {game.ownedConstellations.length} / {OWNED_CONSTELLATION_LIMIT}
          </span>
          {game.ownedConstellations.map((id) => (
            <ConstellationCard
              key={id}
              id={id}
              scale={1}
              layout="row"
              firing={firing.has(id)}
              reduced={reduced}
            />
          ))}

          <button
            type="button"
            onClick={commitTurn}
            disabled={settlement !== null || over || shuffling}
            className="mt-auto rounded py-2 text-xs font-bold"
            style={{
              background: settlement !== null || over ? PALETTE.panelEdge : PALETTE.nebulaAmber,
              color: settlement !== null || over ? PALETTE.starGlow : PALETTE.void,
              cursor: settlement !== null || over ? 'default' : 'pointer',
            }}
          >
            {settlement !== null ? '대기 중' : '턴 종료'}
          </button>
        </div>

        <div className="flex w-72 flex-col gap-3">
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
              roundScoreBefore={game.roundScore - settlement.awarded}
              reduced={reduced}
              speed={speed}
              onSpeed={setSpeed}
            />
          ) : (
            <section
              className="flex flex-col gap-2 rounded p-3"
              style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
            >
              <p className="text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
                손패에서 조각을 고르고 성도의 빈칸에 놓습니다. 고른 조각을 다시 누르면 선택이
                풀립니다. 놓은 조각은 되돌릴 수 없습니다.
              </p>
              <p className="text-[10px]" style={{ color: PALETTE.starLink }}>
                배치하지 않은 손패는 덱으로 돌아가 다시 섞입니다.
              </p>
            </section>
          )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-6">
        {/* The hand is empty between the settlement and the next draw — core has
            already returned it to the deck (GDD 4-2) — so the fan stands down
            rather than reporting "손패 0장". */}
        {over || settlement !== null ? (
          <div />
        ) : (
          <Hand
            hand={shuffling ? [] : game.hand}
            selected={selected}
            placedThisTurn={staged.length}
            reduced={reduced}
            onSelect={select}
          />
        )}
        <OrionBubble line={orion.line} reduced={reduced} />
      </div>

      {DEV_TOOLS && <DevPanel game={game} onPatch={devSet} onRestart={() => newGame()} />}
    </main>
  )
}
