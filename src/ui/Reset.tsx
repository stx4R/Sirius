// The mid-run reset (GDD 12-2 ④, BOOTH-7).
//
// GDD 12-2 ④ asks for a one-click reset for the next participant, and until now
// the only one was on the end-of-run banner. A run is 28 minutes (GDD 12-1) and
// a participant who gives up halfway leaves the machine sitting on a board with
// their chips on it — which, with one operator for the whole booth, means the
// operator has to walk over and press F5. This is that walk removed.
//
// A run can be abandoned on either screen and the operator's problem is the same
// one, so both have a way out: the shop has the corner button below, and the play
// screen has the pause window it moved into at BOOTH-9c.
//
// ★ It asks first, and from BOOTH-9c three things ask. The confirmation card is one
// box with one short question and two named buttons; what changes between the three
// is only the words, which is why they are all declared here and the card takes
// whichever it is given.

import { motion } from 'framer-motion'
import { PALETTE } from '../assets/palette'
import { At, CANVAS_HEIGHT, CANVAS_WIDTH, LAYOUT, SHOP_LAYOUT } from './Canvas'

/**
 * One confirmation's words. Three of them exist now (BOOTH-9c) and they all live
 * in this file, which is what GDD 12-2-c means by 문구는 이 한 곳에만 쓴다.
 */
export interface ConfirmCopy {
  /** `data-panel`, so a screenshot names which of the three it caught. */
  readonly panel: string
  readonly title: string
  readonly note: string
  readonly cancel: string
  readonly confirm: string
}

/**
 * What the reset says, in one place.
 *
 * Short on purpose (GDD 12-2 asks the screen to be read unaided): a middle
 * schooler standing at a booth decides on the question and the two button names,
 * not on a paragraph. `note` states the one consequence that matters and nothing
 * else — what is lost, and that it does not come back.
 *
 * The confirm button repeats the opening button's own label rather than saying
 * 확인, so the thing being agreed to is named on the button that does it.
 */
export const RESET_CONFIRM = {
  panel: 'reset',
  button: '처음으로',
  title: '처음으로 돌아갈까요?',
  note: '지금 판은 사라집니다. 되돌릴 수 없습니다.',
  cancel: '계속하기',
  confirm: '처음으로',
} as const

/**
 * 다시 시작 (BOOTH-9c) — the pause window's, and **not** the same action as the one
 * above.
 *
 * This one keeps the mode and the starting constellation the title screen was
 * given and deals a new run straight away; the one above puts the next
 * participant back in front of those two questions. They cost the same thing — the
 * run on screen — so the notes say the same sentence, which BOOTH-7 already wrote
 * and which is true of both. **The titles are where they differ**, because that is
 * where they actually differ: what the question names is what is about to happen.
 */
export const RESTART_CONFIRM: ConfirmCopy = {
  panel: 'restart',
  title: '같은 설정으로 다시 시작할까요?',
  note: '지금 판은 사라집니다. 되돌릴 수 없습니다.',
  cancel: '계속하기',
  confirm: '다시 시작',
}

/**
 * 처음 화면으로 (BOOTH-9c) — the same *action* as `RESET_CONFIRM`, asked from the
 * pause window instead of from the shop's corner button.
 *
 * It is separate copy rather than a reuse because the two surfaces name the action
 * differently and the confirm button has to repeat the label that was pressed
 * (BOOTH-7's rule, above). In the shop that label is 처음으로, which is unambiguous
 * beside a shelf; in the pause window it sits directly under 다시 시작, where
 * 처음으로 would read as a second way of saying the same thing.
 */
export const TITLE_CONFIRM: ConfirmCopy = {
  panel: 'to-title',
  title: '처음 화면으로 돌아갈까요?',
  note: '지금 판은 사라지고 시작 화면이 열립니다.',
  cancel: '계속하기',
  confirm: '처음 화면으로',
}

/**
 * The corner button (GDD 12-2 ④).
 *
 * ★ Only the shop has one. BOOTH-9b took the play screen's copy away to make room
 * for STAR-CHART and BOOTH-9c gave that screen the ESC pause window instead — so
 * the size is read off `SHOP_LAYOUT.reset`, which is the one placement still
 * standing, rather than off the play-screen entry that no longer exists.
 */
export function ResetButton({ onOpen }: { readonly onOpen: () => void }) {
  return (
    <button
      type="button"
      data-reset="open"
      onClick={onOpen}
      className="rounded text-[11px] font-bold"
      style={{
        width: SHOP_LAYOUT.reset.w,
        height: SHOP_LAYOUT.reset.h,
        background: PALETTE.panel,
        color: PALETTE.starGlow,
        outline: `1px solid ${PALETTE.panelEdge}`,
        cursor: 'pointer',
      }}
    >
      {RESET_CONFIRM.button}
    </button>
  )
}

/**
 * The confirmation (GDD 12-2 ④), for whichever of the three is being asked.
 *
 * 계속하기 is the lit button and the other one is plain, which is the way round
 * that matches what each costs: carrying on costs nothing, and the other one ends
 * a run. The destructive answer is still plainly labelled and one click away —
 * this is about which one the eye lands on, not about hiding it.
 *
 * `copy` defaults to the reset because the shop's corner button is the caller that
 * predates the other two; the pause window names the one it is asking (BOOTH-9c).
 * The card is the same box either way — it draws at z 80, so it lands above the
 * pause window as well as above the play screen.
 */
export function ResetConfirm({
  copy = RESET_CONFIRM,
  reduced,
  onCancel,
  onConfirm,
}: {
  readonly copy?: ConfirmCopy
  readonly reduced: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  const card = LAYOUT.resetCard

  return (
    <>
      <At x={0} y={0} w={CANVAS_WIDTH} h={CANVAS_HEIGHT} z={80}>
        <button
          type="button"
          aria-label={copy.cancel}
          onClick={onCancel}
          className="h-full w-full"
          style={{ background: `${PALETTE.void}E8`, cursor: 'pointer' }}
        />
      </At>
      <At x={card.x} y={card.y} w={card.w} h={card.h} z={81}>
        <motion.div
          data-panel={copy.panel}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className="flex h-full w-full flex-col gap-3 rounded p-5"
          style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
        >
          <span className="text-sm font-bold" style={{ color: PALETTE.starWhite }}>
            {copy.title}
          </span>
          <p className="flex-1 text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
            {copy.note}
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded py-3 text-[11px] font-bold"
              style={{ background: PALETTE.nebulaAmber, color: PALETTE.void }}
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              data-reset="confirm"
              onClick={onConfirm}
              className="flex-1 rounded py-3 text-[11px] font-bold"
              style={{
                background: PALETTE.panelEdge,
                color: PALETTE.ginanEdge,
                outline: `1px solid ${PALETTE.ginanShade}`,
              }}
            >
              {copy.confirm}
            </button>
          </div>
        </motion.div>
      </At>
    </>
  )
}
