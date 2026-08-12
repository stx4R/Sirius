// The playable screen. Assembles the pieces and drives the turn; every rule it
// appears to enforce is really core's, called through the store (CLAUDE.md §5).
//
// Everything is placed by absolute coordinate on the fixed 1120×630 canvas
// (GDD 11-10). Nothing here reflows: the canvas scales as a whole, so a booth
// laptop and a 2560px monitor show the same picture at different sizes.
//
// Two things are timed here rather than in the store: the shuffle beat, which
// core has no notion of because its shuffle is instantaneous, and the settlement
// step index. Both are presentation, and the store owns no timers.

import { useEffect, useMemo, useRef, useState } from 'react'
import { MODE_PRESETS, OWNED_CONSTELLATION_LIMIT, TURNS_PER_ROUND } from '../core/config'
import { wagerIsForced } from '../core/game'
import { PALETTE } from '../assets/palette'
import { useGame } from '../store/gameStore'
import { Board } from './Board'
import { At, CANVAS_HEIGHT, CANVAS_WIDTH, Canvas, LAYOUT } from './Canvas'
import { ConstellationCard } from './ConstellationCard'
import { DEV_TOOLS, DevPanel } from './DevPanel'
import { RoundTurn, Stardust, StatusLine } from './HUD'
import type { Status } from './HUD'
import { Hand, HandCount } from './Hand'
import { OraclePanel } from './Oracle'
import { OrionBubble, OrionSprite, useOrion } from './Orion'
import { ReportPanel } from './Report'
import { StarChart } from './StarChart'
import { WagerPanel } from './Wager'
import { usePrefersReducedMotion } from './motion'
import {
  DrifterNote,
  RoundTotal,
  SettlementEquation,
  SettlementPanel,
  litCells,
  stepsOf,
} from './Settlement'

/** How long "칩을 섞는 중…" holds before the hand flies in. */
const SHUFFLE_MS = 550

function Banner({ title, note, action }: { title: string; note: string; action: () => void }) {
  return (
    <div
      className="flex w-80 flex-col gap-3 rounded p-5 text-center"
      style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
    >
      <h2 className="text-[22px] font-bold" style={{ color: PALETTE.starWhite }}>
        {title}
      </h2>
      <p className="text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
        {note}
      </p>
      {/* GDD 12-2 ④: one click resets the machine for the next participant. It
          returns to the title rather than restarting in place, because the mode
          and the starting constellation are theirs to choose, not the last
          player's to hand down. */}
      <button
        type="button"
        onClick={action}
        className="rounded py-2 text-[11px] font-bold"
        style={{ background: PALETTE.nebulaTeal, color: PALETTE.void }}
      >
        타이틀로
      </button>
    </div>
  )
}

export function Game() {
  const game = useGame((state) => state.game)
  const staged = useGame((state) => state.staged)
  const selected = useGame((state) => state.selected)
  const settlement = useGame((state) => state.settlement)
  const wagerResult = useGame((state) => state.wagerResult)
  const oracleResult = useGame((state) => state.oracleResult)
  const report = useGame((state) => state.report)
  const seed = useGame((state) => state.seed)
  const {
    select,
    placeAt,
    commitTurn,
    dismissSettlement,
    answerWager,
    dismissWager,
    answerOracle,
    dismissOracle,
    dismissReport,
    newGame,
    toTitle,
  } = useGame.getState()
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

  // The wager stands between a turn and its hand (GDD 8-2), so nothing behind it
  // is happening yet.
  const wagering = game.pendingWager !== null || wagerResult !== null

  // The oracle stands between the end-turn button and the settlement (GDD 8-3):
  // the score it asks about has not been rolled yet either.
  const asking = game.pendingOracle !== null || oracleResult !== null

  // A new hand means the deck was just reshuffled (GDD 4-2). Core does that in
  // one call, so the beat that makes it legible is added here. It waits for the
  // wager: the deal is `dismissWager`'s, and a beat started while the panel was
  // still up would be over before the hand it announces arrived.
  const handStamp = `${game.round}-${game.turn}`
  useEffect(() => {
    if (settlement !== null || over || wagering) return
    setShuffling(true)
    const timer = setTimeout(() => setShuffling(false), reduced ? 0 : SHUFFLE_MS)
    return () => clearTimeout(timer)
  }, [handStamp, settlement, over, wagering, reduced])

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

  // The turn the header names. Core advances the counter inside `endTurn`, so
  // during a settlement the snapshot is the honest answer (GDD 4-1 unchanged).
  const shownTurn = settlement?.turn ?? game.turn

  // The big figure runs from where the round stood to where the walk has got.
  const scoredSoFar = steps.slice(0, step + 1).reduce((total, entry) => total + entry.total, 0)
  const shownTotal =
    settlement === null
      ? game.roundScore
      : settlement.roundScoreBefore + (settling ? scoredSoFar : settlement.awarded)

  const cards = LAYOUT.constellations

  return (
    <Canvas>
      <At x={LAYOUT.stardust.x} y={LAYOUT.stardust.y}>
        <Stardust value={game.stardust} />
      </At>

      <At x={CANVAS_WIDTH / 2} y={LAYOUT.roundTurn.y} centre>
        <RoundTurn game={game} turn={shownTurn} />
      </At>

      <At x={CANVAS_WIDTH / 2} y={LAYOUT.status.y} centre>
        <StatusLine status={status} />
      </At>

      <At x={LAYOUT.board.x} y={LAYOUT.board.y}>
        <Board
          board={board}
          holding={settlement === null && !over && !shuffling ? selected : null}
          lit={lit}
          dim={shuffling || settling}
          reduced={reduced}
          onPlace={placeAt}
        />
      </At>

      <At x={cards.label.x} y={cards.label.y}>
        <span className="text-[11px] tracking-wide" style={{ color: PALETTE.starGlow }}>
          보유 별자리 {game.ownedConstellations.length} / {OWNED_CONSTELLATION_LIMIT}
        </span>
      </At>

      {/* Two by two: four cards with their mandatory text (GDD 11-5) do not fit
          in a column above the end-turn button. See LAYOUT.constellations. */}
      <At x={cards.x} y={cards.y} w={cards.cell * 2 + cards.gap}>
        <div className="flex flex-wrap" style={{ gap: cards.gap }}>
          {game.ownedConstellations.map((id) => (
            <ConstellationCard
              key={id}
              id={id}
              scale={2}
              layout="stack"
              width={cards.cell}
              firing={firing.has(id)}
              reduced={reduced}
            />
          ))}
        </div>
      </At>

      <At x={LAYOUT.endTurn.x} y={LAYOUT.endTurn.y} w={LAYOUT.endTurn.w} h={LAYOUT.endTurn.h}>
        <button
          type="button"
          onClick={commitTurn}
          disabled={settlement !== null || over || shuffling}
          className="h-full w-full rounded text-[11px] font-bold"
          style={{
            background: settlement !== null || over ? PALETTE.panelEdge : PALETTE.nebulaAmber,
            color: settlement !== null || over ? PALETTE.starGlow : PALETTE.void,
            cursor: settlement !== null || over ? 'default' : 'pointer',
          }}
        >
          {settlement !== null ? '대기 중' : '턴 종료'}
        </button>
      </At>

      <At x={LAYOUT.settlement.x} y={LAYOUT.settlement.y}>
        <SettlementPanel
          data={settlement}
          steps={steps}
          index={step}
          onIndex={setStep}
          onDone={dismissSettlement}
          reduced={reduced}
          speed={speed}
          onSpeed={setSpeed}
          width={LAYOUT.settlement.w}
          height={LAYOUT.settlement.h}
        />
      </At>

      <At x={LAYOUT.equation.right} y={LAYOUT.equation.y}>
        <div className="absolute right-0 top-0 whitespace-nowrap">
          <SettlementEquation data={settlement} steps={steps} index={step} />
        </div>
      </At>

      <At x={LAYOUT.roundTotal.centre} y={LAYOUT.roundTotal.y} centre>
        <RoundTotal
          value={shownTotal}
          target={game.targetScore}
          ms={reduced || speed === 2 ? 0 : 400}
        />
      </At>

      {settlement !== null && !settlement.exact && !settling && (
        <At x={LAYOUT.settlement.x} y={LAYOUT.roundTotal.y + 96} w={LAYOUT.settlement.w}>
          <DrifterNote data={settlement} />
        </At>
      )}

      {/* The hand stands down between the settlement and the next draw: core has
          already returned it to the deck (GDD 4-2). */}
      {!over && settlement === null && (
        <>
          <At x={LAYOUT.hand.x} y={LAYOUT.hand.y} z={20}>
            <Hand
              hand={shuffling ? [] : game.hand}
              selected={selected}
              placedThisTurn={staged.length}
              width={LAYOUT.hand.w}
              height={LAYOUT.hand.h}
              reduced={reduced}
              onSelect={select}
            />
          </At>
          <At x={LAYOUT.hand.label.x} y={LAYOUT.hand.label.y}>
            <HandCount hand={game.hand} placedThisTurn={staged.length} />
          </At>
        </>
      )}

      {/* GDD 8-1 asks for this to be up at all times, and the play screen is
          where the pile actually shrinks. The pool is deck plus hand: unplaced
          chips are reshuffled back (GDD 4-2), so placing is what takes a chip out
          of the round for good. */}
      <At
        x={LAYOUT.starChart.x}
        y={LAYOUT.starChart.y}
        w={LAYOUT.starChart.w}
        h={LAYOUT.starChart.h}
      >
        <StarChart
          pool={[...game.deck, ...game.hand]}
          width={LAYOUT.starChart.w}
          height={LAYOUT.starChart.h}
          row={LAYOUT.starChart.row}
          bar={LAYOUT.starChart.bar}
        />
      </At>

      <At x={LAYOUT.bubble.x} y={LAYOUT.bubble.y}>
        <OrionBubble
          line={orion.line}
          reduced={reduced}
          width={LAYOUT.bubble.w}
          height={LAYOUT.bubble.h}
        />
      </At>

      <At x={LAYOUT.orion.x} y={LAYOUT.orion.y}>
        <OrionSprite width={LAYOUT.orion.w} height={LAYOUT.orion.h} />
      </At>

      {/* GDD 8-2: the prediction is made before the draw, so it is a modal —
          the hand it asks about does not exist until it has been answered, and
          the explanation is read in the same box the question was in. */}
      {wagering && (
        <>
          <At x={0} y={0} w={CANVAS_WIDTH} h={CANVAS_HEIGHT} z={50}>
            <div className="h-full w-full" style={{ background: `${PALETTE.void}D8` }} />
          </At>
          <At x={LAYOUT.wager.x} y={LAYOUT.wager.y} w={LAYOUT.wager.w} h={LAYOUT.wager.h} z={51}>
            <WagerPanel
              question={game.pendingWager}
              result={wagerResult}
              forced={wagerIsForced(game)}
              reduced={reduced}
              width={LAYOUT.wager.w}
              height={LAYOUT.wager.h}
              onAnswer={answerWager}
              onDismiss={dismissWager}
            />
          </At>
        </>
      )}

      {/* GDD 8-3: the expected value is asked after the chips are down and
          before the board settles, so it is a modal over the board it is about —
          the score does not exist until it has been answered and read. */}
      {asking && (
        <>
          <At x={0} y={0} w={CANVAS_WIDTH} h={CANVAS_HEIGHT} z={50}>
            <div className="h-full w-full" style={{ background: `${PALETTE.void}D8` }} />
          </At>
          <At
            x={LAYOUT.oracle.x}
            y={LAYOUT.oracle.y}
            w={LAYOUT.oracle.w}
            h={LAYOUT.oracle.h}
            z={51}
          >
            <OraclePanel
              question={game.pendingOracle}
              result={oracleResult}
              reduced={reduced}
              width={LAYOUT.oracle.w}
              height={LAYOUT.oracle.h}
              row={LAYOUT.oracle.row}
              onAnswer={answerOracle}
              onDismiss={dismissOracle}
            />
          </At>
        </>
      )}

      {/* GDD 4-1: CONSTELLATION LOG stands between the round and the shop, and
          GDD 8-4 shows it on a clear. Above the game-over banner's z-index is
          not needed — a run that ended here never builds one. */}
      {report !== null && (
        <>
          <At x={0} y={0} w={CANVAS_WIDTH} h={CANVAS_HEIGHT} z={60}>
            <div className="h-full w-full" style={{ background: `${PALETTE.void}E8` }} />
          </At>
          <At
            x={LAYOUT.report.x}
            y={LAYOUT.report.y}
            w={LAYOUT.report.w}
            h={LAYOUT.report.h}
            z={61}
          >
            <ReportPanel
              report={report}
              reduced={reduced}
              width={LAYOUT.report.w}
              height={LAYOUT.report.h}
              row={LAYOUT.report.row}
              series={LAYOUT.report.series}
              onDismiss={dismissReport}
            />
          </At>
        </>
      )}

      {over && (
        <At x={CANVAS_WIDTH / 2} y={220} centre z={30}>
          <Banner
            title={cleared ? '전 라운드 클리어' : '게임 오버'}
            note={
              cleared
                ? `${MODE_PRESETS[game.mode].TOTAL_ROUNDS}라운드를 모두 넘겼습니다.`
                : `라운드 ${game.round}에서 목표 ${game.targetScore.toLocaleString('ko-KR')}점에 ` +
                  `${game.roundScore.toLocaleString('ko-KR')}점으로 미달했습니다.`
            }
            action={toTitle}
          />
        </At>
      )}

      {DEV_TOOLS && (
        <At x={LAYOUT.dev.x} y={LAYOUT.dev.y} z={40}>
          <DevPanel game={game} onPatch={devSet} onRestart={() => newGame()} />
        </At>
      )}
    </Canvas>
  )
}
