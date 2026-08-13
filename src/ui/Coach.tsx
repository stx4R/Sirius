// The first-round coach marks and the ? summary (GDD 12-2 ①).
//
// GDD 12-2 ① asks for a tutorial a booth participant can start on unaided, and
// BOOTH-6a chose the form: no separate practice round, no "다음" button, no wall of
// text. Five captions appear over the real first round, each teaching exactly one
// thing, and each one is dismissed by *doing* the thing rather than by
// acknowledging it. A player who reads none of them plays an ordinary game — the
// captions are `pointer-events-none` and block nothing.
//
// ★ There is no tutorial state. Which step is showing is a pure function of the
// state the game is already in (`coachStep`), so the coach cannot desynchronise
// from the game and core did not have to learn about it (CLAUDE.md §5).
//
// ★ The board step's wording comes from the constellation the player chose on the
// title screen, through the same two helpers the card itself prints
// (`conditionOf` / `multiplierOf`). Hardcoding "세로로 3개" would teach the wrong
// axis to half of the players, since GDD 13-5's two starting choices differ in
// exactly that.

import { motion } from 'framer-motion'
import { MAX_PLACEMENTS_PER_TURN, TURNS_PER_ROUND } from '../core/config'
import type { ConstellationId } from '../core/types'
import { PALETTE } from '../assets/palette'
import { At, CANVAS_HEIGHT, CANVAS_WIDTH, LAYOUT } from './Canvas'
import { conditionOf, multiplierOf } from './ConstellationCard'

/** The five steps of GDD 12-2 ①, in the order a first round meets them. */
export type CoachStep = keyof typeof LAYOUT.coach.steps

export const COACH_ORDER: readonly CoachStep[] = ['wager', 'hand', 'board', 'limit', 'target']

/**
 * What the screen knows that decides which step is up. Everything here is already
 * on screen for its own reasons; nothing was added to the store for the coach.
 */
export interface CoachView {
  readonly round: number
  readonly turn: number
  /** True while the deck is being shuffled and the hand is not on screen yet. */
  readonly shuffling: boolean
  /** A wager question waiting for an answer. */
  readonly pendingWager: boolean
  /** The wager modal is up at all — question or explanation. */
  readonly wagerOpen: boolean
  /** The oracle modal is up at all. */
  readonly oracleOpen: boolean
  /** CONSTELLATION LOG is up. */
  readonly reportOpen: boolean
  /** How many wagers core has recorded. */
  readonly answered: number
  /** A chip is being held. */
  readonly holding: boolean
  /** Placements made this turn. */
  readonly placed: number
  /** The turn a settlement on screen is for, or null when there is none. */
  readonly settlingTurn: number | null
}

/**
 * Which step is showing, or null.
 *
 * Every step is round 1 only, and steps 2 to 5 are its first turn only: this is
 * the tutorial, not a permanent hint layer, and the ? button is what a player who
 * wants it back later presses.
 *
 * Each condition is the *absence* of the action the caption asks for, so
 * performing that action is what ends the step — there is nothing to acknowledge
 * and nothing to skip.
 */
export function coachStep(view: CoachView): CoachStep | null {
  if (view.round !== 1) return null

  // The first wager of the run, which is the first thing a run shows at all: the
  // hand is not dealt until it is answered (GDD 8-2).
  if (view.pendingWager && view.answered === 0) return 'wager'

  // Nothing else shows while a modal is up. The captions draw above the modals so
  // that the wager step can sit on its own, which means every other step would
  // cover the thing being read.
  if (view.wagerOpen || view.oracleOpen || view.reportOpen) return null

  // Before the turn check: core advances the counter inside `endTurn`, so during
  // turn 1's settlement the game already says turn 2 (GDD 4-1).
  if (view.settlingTurn === 1) return 'target'
  if (view.turn !== 1 || view.shuffling) return null
  if (view.placed === 0) return view.holding ? 'board' : 'hand'
  return 'limit'
}

/**
 * The caption for a step. `starting` is the constellation the player is holding,
 * which at round 1 turn 1 is the one they chose (GDD 13-5).
 *
 * Every figure is read from config, so a retuned turn length or placement cap
 * cannot leave a caption saying the old number.
 */
/**
 * ★ NO 한자 IN A CAPTION. BOOTH-9a writes 공허 · 주기 · 융합 · 성단 with their 한자 on
 * first appearance, and the coach looks like the natural place for it — it is round 1
 * and nothing else, so a term introduced here never repeats itself.
 *
 * It does not fit. BOOTH-6a's budget is 30 characters, because a caption that wraps
 * past its 40px box is clipped rather than shortened, and 병기 costs four characters a
 * term: the wager line goes to 35 and the target line to 32. Both are held by
 * `tests/coach.test.ts`, which is what caught it. So all four 한자 live at roomier
 * surfaces — the title screen, CONSTELLATION LOG, the settlement panel and ORION's
 * opening line — and the captions say the terms in 한글 only.
 *
 * ★ The wager line was re-cut for length, not for taste. 덱 → 공허 is one character to
 * two, which put the original at 31, and '잃는 건 없습니다' → '잃지 않습니다' is the three
 * characters that buys back.
 */
export function coachLine(step: CoachStep, starting: ConstellationId | null, target: number): string {
  switch (step) {
    case 'wager':
      return '공허에 남은 장수로 답합니다. 틀려도 잃지 않습니다.'
    case 'hand':
      return '칩을 하나 골라 보세요.'
    case 'board':
      return starting === null
        ? '같은 문양을 이어 놓으면 배율이 붙습니다.'
        : `같은 문양 ${conditionOf(starting)}이면 ${multiplierOf(starting)}`
    case 'limit':
      return `한 턴에 ${MAX_PLACEMENTS_PER_TURN}장까지. 다 놓으면 턴 종료.`
    case 'target':
      return `${TURNS_PER_ROUND}턴 안에 목표 ${target.toLocaleString('ko-KR')}점을 넘겨야 다음 주기입니다.`
  }
}

const CARET: Readonly<Record<'up' | 'down', string>> = { up: '▲', down: '▼' }

/** One caption, at its step's coordinates. */
export function CoachTip({
  step,
  line,
  reduced,
}: {
  readonly step: CoachStep
  readonly line: string
  readonly reduced: boolean
}) {
  const spot = LAYOUT.coach.steps[step]

  return (
    <At x={spot.x} y={spot.y} w={spot.w} h={LAYOUT.coach.h} z={56}>
      <motion.div
        // `npm run shot` reaches for each step by this, so all five are
        // photographed rather than whichever one a run happened to reach.
        data-coach={step}
        initial={reduced ? false : { opacity: 0, y: spot.caret === 'up' ? -6 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.2 }}
        // It points at what it is about and must never come between the player
        // and it — a caption that swallowed a click on the hand would be worse
        // than no caption (GDD 12-2 ①).
        className="pointer-events-none flex h-full items-center gap-2 rounded px-3"
        style={{
          background: PALETTE.nebulaDeep,
          outline: `1px solid ${PALETTE.nebulaAmber}`,
        }}
      >
        <span className="text-[11px] leading-none" style={{ color: PALETTE.nebulaAmber }}>
          {CARET[spot.caret]}
        </span>
        <span className="text-[11px] leading-tight" style={{ color: PALETTE.starWhite }}>
          {line}
        </span>
      </motion.div>
    </At>
  )
}

/**
 * The tutorial summary (GDD 12-2 ①). The same five lines at rest.
 *
 * It does not replay the coach marks. A player who has lost the thread wants to
 * know what to do *now*, and three of the five steps cannot be re-staged — the
 * first wager is answered and the first settlement is over. One still page
 * answers the question the replay would not.
 */
export function HelpCard({
  starting,
  target,
  reduced,
  onClose,
}: {
  readonly starting: ConstellationId | null
  readonly target: number
  readonly reduced: boolean
  readonly onClose: () => void
}) {
  const card = LAYOUT.helpCard

  return (
    <>
      <At x={0} y={0} w={CANVAS_WIDTH} h={CANVAS_HEIGHT} z={70}>
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="h-full w-full"
          style={{ background: `${PALETTE.void}E8`, cursor: 'pointer' }}
        />
      </At>
      <At x={card.x} y={card.y} w={card.w} h={card.h} z={71}>
        <motion.div
          data-panel="help"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className="flex h-full w-full flex-col gap-3 rounded p-5"
          style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
        >
          <span
            className="text-[11px] font-bold tracking-wide"
            style={{ color: PALETTE.nebulaAmber }}
          >
            이렇게 합니다
          </span>

          <ol className="flex flex-1 flex-col gap-2">
            {COACH_ORDER.map((step, i) => (
              <li key={step} className="flex gap-2 text-[11px] leading-relaxed">
                <span className="tabular-nums" style={{ color: PALETTE.nebulaAmber }}>
                  {i + 1}
                </span>
                <span style={{ color: PALETTE.starGlow }}>{coachLine(step, starting, target)}</span>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={onClose}
            className="self-end rounded px-6 py-3 text-[11px] font-bold"
            style={{ background: PALETTE.nebulaAmber, color: PALETTE.void }}
          >
            닫기
          </button>
        </motion.div>
      </At>
    </>
  )
}

// The always-there ? button in the corner is gone (BOOTH-9b): its coordinate is
// where STAR-CHART now sits. `HelpCard` above is untouched — what changed is who
// opens it, which since BOOTH-9c is the ESC pause window's 튜토리얼 시작 (`Pause.tsx`).
//
// GDD 12-2 ① asks for a permanent way back in. The card is permanently reachable
// again; what it does not have is a permanently *visible* control, because the
// plane has no room left for one — see GDD 12-2-d.
