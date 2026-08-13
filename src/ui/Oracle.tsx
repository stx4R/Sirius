// DRIFT ORACLE — the expected-value question asked over a board with a drifter
// on it, just before that board settles (GDD 8-3).
//
// The screen computes nothing. Core enumerates the readings, settles each one to
// get its score, weights them into an expectation and writes the three choices
// and the reason (`src/core/oracle.ts`); this file draws the table core built and
// hands over three buttons (CLAUDE.md §5). Even the wording of the question is
// core's, because whether the reading is forced changes what is being asked.
//
// It is a modal for the same reason the wager is: GDD 8-3 puts it *before* the
// settlement, so the score it asks about does not exist yet and there is nothing
// to be doing behind it. The table stays up beside the explanation rather than
// being replaced by it — the reason is about those numbers.

import { motion } from 'framer-motion'
import { STARDUST_REWARDS } from '../core/config'
import { particleFor } from '../core/oracle'
import type { OracleQuestion, OracleRecord } from '../core/oracle'
import { PALETTE } from '../assets/palette'

function Table({ question, row }: { readonly question: OracleQuestion; readonly row: number }) {
  const forced = question.cases.length === 1

  return (
    <div className="flex flex-col">
      <div
        className="flex text-[9px]"
        style={{ color: PALETTE.starGlow, height: 18 }}
      >
        <span className="w-[92px]">선택된 방향</span>
        <span className="flex-1">판정 문양</span>
        <span className="w-[64px] text-right">점수</span>
        <span className="w-[72px] text-right">확률</span>
      </div>

      {question.cases.map((entry) => (
        <div
          key={entry.label}
          className="flex items-center text-[11px]"
          style={{ height: row, color: PALETTE.starWhite }}
        >
          <span className="w-[92px]">{entry.label}</span>
          <span className="flex-1" style={{ color: PALETTE.nebulaTeal }}>
            {entry.suits.join(', ')}
          </span>
          <span className="w-[64px] text-right">{entry.score}</span>
          <span className="w-[72px] text-right" style={{ color: PALETTE.starGlow }}>
            {forced ? '1' : `1/${question.cases.length}`}
          </span>
        </div>
      ))}
    </div>
  )
}

function Verdict({ record }: { readonly record: OracleRecord }) {
  const [text, colour] = record.correct
    ? ['정답', PALETTE.nebulaTeal]
    : ['오답', PALETTE.nebulaHydrogen]

  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[22px] font-bold" style={{ color: colour }}>
        {text}
      </span>
      <span className="text-[9px]" style={{ color: PALETTE.starGlow }}>
        {record.correct
          ? `St4RDu3t +${STARDUST_REWARDS.oracleCorrect}`
          : `${record.choice}${particleFor(record.choice, '를', '을')} 골랐습니다. 정답은 ${record.question.answer}입니다.`}
      </span>
    </div>
  )
}

export function OraclePanel({
  question,
  result,
  reduced,
  width,
  height,
  row,
  onAnswer,
  onDismiss,
}: {
  /** The question waiting for an answer, or null once one has been given. */
  readonly question: OracleQuestion | null
  /** The answer just scored, or null while the question is still open. */
  readonly result: OracleRecord | null
  readonly reduced: boolean
  readonly width: number
  readonly height: number
  readonly row: number
  readonly onAnswer: (choice: number) => void
  readonly onDismiss: () => void
}) {
  const asked = question ?? result?.question ?? null
  if (asked === null) return null

  return (
    <motion.div
      // `npm run shot` measures this box against its own content: the table is
      // four rows at its widest and the explanation runs to several lines, and a
      // clipped one is a wrong answer with no visible reason.
      data-panel="oracle"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
      className="flex flex-col gap-3 rounded p-5"
      style={{
        width,
        height,
        background: PALETTE.panel,
        outline: `1px solid ${PALETTE.panelEdge}`,
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold tracking-wide" style={{ color: PALETTE.nebulaAmber }}>
          DRIFT ORACLE
        </span>
        {/* GDD 2: ORION reads the sky. иєвυℓα keeps the shop and is not here. */}
        <span className="text-[9px]" style={{ color: PALETTE.starGlow }}>
          ORION이 묻는다
        </span>
      </div>

      <p className="text-sm leading-relaxed" style={{ color: PALETTE.starWhite }}>
        {asked.text}
      </p>

      <Table question={asked} row={row} />

      {result === null ? (
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex gap-3">
            {asked.choices.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => onAnswer(choice)}
                className="flex-1 rounded py-3 text-[11px] font-bold"
                style={{ background: PALETTE.nebulaTeal, color: PALETTE.void, cursor: 'pointer' }}
              >
                {choice}
              </button>
            ))}
          </div>
          <p className="text-[9px]" style={{ color: PALETTE.starGlow }}>
            맞히면 St4RDu3t +{STARDUST_REWARDS.oracleCorrect}, 틀려도 잃는 것은 없습니다.
          </p>
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-3">
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
            융합으로
          </button>
        </div>
      )}
    </motion.div>
  )
}
