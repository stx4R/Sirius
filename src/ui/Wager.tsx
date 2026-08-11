// ORION'S WAGER — the question put before every draw (GDD 8-2).
//
// The screen decides nothing about it. Core generates the sentence from the deck
// (`src/core/wager.ts`), core scores the answer and core keeps the record
// (`resolveWager`); this file shows what came back and hands three buttons to the
// player (CLAUDE.md §5). Even "기권 is not available yet" is core's rule — the
// button is disabled from `wagerIsForced`, and core refuses the choice anyway.
//
// It is a modal because the draw is behind it: GDD 8-2 puts the prediction before
// the hand exists, so there is nothing else to be doing while it is up. The
// explanation replaces the buttons in the same box rather than opening a second
// one, so the question stays on screen next to the reason.

import { motion } from 'framer-motion'
import { FORCED_WAGER_COUNT, STARDUST_REWARDS } from '../core/config'
import type { WagerChoice, WagerQuestion, WagerRecord } from '../core/types'
import { PALETTE } from '../assets/palette'

/** GDD 8-2: YES / NO / 기권, in that order. */
const CHOICES: readonly { readonly choice: WagerChoice; readonly label: string }[] = [
  { choice: 'yes', label: 'YES' },
  { choice: 'no', label: 'NO' },
  { choice: 'abstain', label: '기권' },
]

function Verdict({ record }: { readonly record: WagerRecord }) {
  const [text, colour] =
    record.choice === 'abstain'
      ? ['기권', PALETTE.starGlow]
      : record.correct
        ? ['정답', PALETTE.nebulaTeal]
        : ['오답', PALETTE.nebulaHydrogen]

  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[22px] font-bold" style={{ color: colour }}>
        {text}
      </span>
      <span className="text-[11px]" style={{ color: PALETTE.starGlow }}>
        {record.correct
          ? `스타더스트 +${STARDUST_REWARDS.wagerCorrect}`
          : `정답은 ${record.question.answer ? 'YES' : 'NO'}`}
      </span>
    </div>
  )
}

export function WagerPanel({
  question,
  result,
  forced,
  reduced,
  width,
  height,
  onAnswer,
  onDismiss,
}: {
  /** The question waiting for an answer, or null once one has been given. */
  readonly question: WagerQuestion | null
  /** The answer just scored, or null while the question is still open. */
  readonly result: WagerRecord | null
  readonly forced: boolean
  readonly reduced: boolean
  readonly width: number
  readonly height: number
  readonly onAnswer: (choice: WagerChoice) => void
  readonly onDismiss: () => void
}) {
  const asked = question ?? result?.question ?? null
  if (asked === null) return null

  return (
    <motion.div
      // `npm run shot` measures this box against its own content: the
      // explanation is 2~3 sentences core wrote, and a clipped one is a wrong
      // answer with no visible reason (tools/screenshot.mjs).
      data-panel="wager"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
      className="flex flex-col gap-4 rounded p-5"
      style={{
        width,
        height,
        background: PALETTE.panel,
        outline: `1px solid ${PALETTE.panelEdge}`,
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold tracking-wide" style={{ color: PALETTE.nebulaAmber }}>
          ORION&apos;S WAGER
        </span>
        {/* GDD 2: ORION is the one who reads the sky aloud. иєвυℓα keeps the shop. */}
        <span className="text-[9px]" style={{ color: PALETTE.starGlow }}>
          ORION이 묻는다
        </span>
      </div>

      <p className="text-sm leading-relaxed" style={{ color: PALETTE.starWhite }}>
        {asked.text}
      </p>

      {result === null ? (
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex gap-3">
            {CHOICES.map(({ choice, label }) => {
              const shut = choice === 'abstain' && forced
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={shut}
                  onClick={() => onAnswer(choice)}
                  className="flex-1 rounded py-3 text-[11px] font-bold"
                  style={{
                    background: shut ? PALETTE.panelEdge : PALETTE.nebulaTeal,
                    color: shut ? PALETTE.starGlow : PALETTE.void,
                    cursor: shut ? 'default' : 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <p className="text-[9px]" style={{ color: PALETTE.starGlow }}>
            {forced
              ? `처음 ${FORCED_WAGER_COUNT}번은 튜토리얼이라 기권할 수 없습니다.`
              : `맞히면 스타더스트 +${STARDUST_REWARDS.wagerCorrect}, 틀려도 잃는 것은 없습니다.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <Verdict record={result} />
          <p className="text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
            {result.question.explanation}
          </p>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-auto self-end rounded px-6 py-3 text-[11px] font-bold"
            style={{ background: PALETTE.nebulaAmber, color: PALETTE.void }}
          >
            계속
          </button>
        </div>
      )}
    </motion.div>
  )
}
