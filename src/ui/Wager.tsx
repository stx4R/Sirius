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
//
// ★ A correct answer outside the tutorial window shows no explanation (GDD 8-2,
// BOOTH-6b). GDD 8-2 asks for a popup "오답 시"; showing one on a hit as well was
// this file's addition, and BOOTH-6a measured the wager at 44% of the booth's
// 20-minute budget. See `showsExplanation`.
//
// ★ The counts the question is about are printed on it (GDD 8-1, BOOTH-6c). The
// scrim behind this panel hides STAR-CHART, and the question text never carried
// the counts, so before this the figures needed to answer were nowhere on screen.
// See `Basis` — and note what it is not given.

import { motion } from 'framer-motion'
import { FORCED_WAGER_COUNT, STARDUST_REWARDS, SUIT_STAR_NAMES } from '../core/config'
import type { WagerBasis, WagerChoice, WagerQuestion, WagerRecord } from '../core/types'
import { suitGlyph } from '../assets/compose'
import { PALETTE, SUIT_INK } from '../assets/palette'
import { PixelSprite } from './PixelSprite'

/** GDD 8-2: YES / NO / 기권, in that order. */
const CHOICES: readonly { readonly choice: WagerChoice; readonly label: string }[] = [
  { choice: 'yes', label: 'YES' },
  { choice: 'no', label: 'NO' },
  { choice: 'abstain', label: '기권' },
]

/**
 * Whether the explanation is shown at all (GDD 8-2, BOOTH-6b).
 *
 * A wrong answer and an abstention always get it — that is the case GDD 8-2 asks
 * for by name, and the reason the popup exists. A correct one gets it only inside
 * the tutorial window, where the point is the reasoning rather than the score.
 *
 * `answered` is how many wagers core has recorded, which is what its own
 * `wagerIsForced` counts. It is passed rather than read off a game here because
 * by the time a result is on screen core has already recorded it: the wager just
 * answered is the `answered`-th, so the window it falls in is `<=` and not `<`.
 */
export function showsExplanation(record: WagerRecord, answered: number): boolean {
  return !record.correct || answered <= FORCED_WAGER_COUNT
}

/**
 * The counts the question is about (GDD 8-1, BOOTH-6c).
 *
 * ★ This is why the panel is answerable at all. The wager is a modal over the play
 * screen and its scrim is 85% opaque, so STAR-CHART — where a player would
 * otherwise read these — is behind it for as long as the question is open. The
 * question text carries no counts either; they were only ever in the explanation,
 * which arrives after the answer. So the figures come with the question instead
 * (`WagerBasis`), and only the ones it names.
 *
 * ★ Counts, never a percentage. Core does not hand one over — see `WagerBasis` —
 * because the comparison tier's answer is the order of the two chances, and a
 * strip showing them would answer the question for the player. The step from
 * "twelve chips against ten" to "so it is likelier" is Ⅱ-1, and it is the player's.
 */
function Basis({ basis }: { readonly basis: WagerBasis }) {
  return (
    <div className="flex items-center gap-3 whitespace-nowrap text-[11px]">
      <span className="text-[9px]" style={{ color: PALETTE.starGlow }}>
        남은 장수
      </span>
      <span className="tabular-nums" style={{ color: PALETTE.starGlow }}>
        공허 {basis.deckSize}장
      </span>
      {basis.counts.map(({ suit, count }) => (
        <span key={suit} className="flex items-center gap-1">
          {/* The suit's own symbol, the same one on its chips — so the row is tied
              to what is on the board and not only to a name (GDD 5-1's headers do
              the same). */}
          <PixelSprite pixels={suitGlyph(suit)} scale={1} alt="" />
          <span className="tabular-nums" style={{ color: SUIT_INK[suit] }}>
            {SUIT_STAR_NAMES[suit]} {count}장
          </span>
        </span>
      ))}
    </div>
  )
}

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
          ? `St4RDu3t +${STARDUST_REWARDS.wagerCorrect}`
          : `정답은 ${record.question.answer ? 'YES' : 'NO'}`}
      </span>
    </div>
  )
}

export function WagerPanel({
  question,
  result,
  forced,
  answered,
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
  /** How many wagers core has recorded. See `showsExplanation`. */
  readonly answered: number
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
      // Whether the explanation is on this frame, so `npm run shot` can name the
      // two verdict states apart — a hit inside the tutorial window looks nothing
      // like a hit after it, and both have to be reviewable (BOOTH-6b).
      data-explained={result === null ? undefined : String(showsExplanation(result, answered))}
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

      <Basis basis={asked.basis} />

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
              : `맞히면 St4RDu3t +${STARDUST_REWARDS.wagerCorrect}, 틀려도 잃는 것은 없습니다.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-3">
          <Verdict record={result} />
          {showsExplanation(result, answered) && (
            <p className="text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
              {result.question.explanation}
            </p>
          )}
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
