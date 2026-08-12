// The mid-run reset (GDD 12-2 ④, BOOTH-7).
//
// GDD 12-2 ④ asks for a one-click reset for the next participant, and until now
// the only one was on the end-of-run banner. A run is 28 minutes (GDD 12-1) and
// a participant who gives up halfway leaves the machine sitting on a board with
// their chips on it — which, with one operator for the whole booth, means the
// operator has to walk over and press F5. This is that walk removed.
//
// It is on both the play screen and the shop, at the same coordinate, because a
// run can be abandoned on either and the operator's problem is the same one.
//
// ★ It asks first. The button sits next to the ? a lost participant is meant to
// press, so a misclick is not a remote possibility — and a misclick here costs
// twenty minutes of somebody's play. The confirmation is one short question with
// two named buttons: nothing to read, nothing to interpret.

import { motion } from 'framer-motion'
import { PALETTE } from '../assets/palette'
import { At, CANVAS_HEIGHT, CANVAS_WIDTH, LAYOUT } from './Canvas'

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
  button: '처음으로',
  title: '처음으로 돌아갈까요?',
  note: '지금 판은 사라집니다. 되돌릴 수 없습니다.',
  cancel: '계속하기',
  confirm: '처음으로',
} as const

/** The corner button, beside the ? (GDD 12-2 ④). */
export function ResetButton({ onOpen }: { readonly onOpen: () => void }) {
  return (
    <button
      type="button"
      data-reset="open"
      onClick={onOpen}
      className="rounded text-[11px] font-bold"
      style={{
        width: LAYOUT.reset.w,
        height: LAYOUT.reset.h,
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
 * The confirmation (GDD 12-2 ④).
 *
 * 계속하기 is the lit button and 처음으로 is the plain one, which is the way round
 * that matches what each costs: carrying on costs nothing, and the other one ends
 * a run. The destructive answer is still plainly labelled and one click away —
 * this is about which one the eye lands on, not about hiding it.
 */
export function ResetConfirm({
  reduced,
  onCancel,
  onConfirm,
}: {
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
          aria-label={RESET_CONFIRM.cancel}
          onClick={onCancel}
          className="h-full w-full"
          style={{ background: `${PALETTE.void}E8`, cursor: 'pointer' }}
        />
      </At>
      <At x={card.x} y={card.y} w={card.w} h={card.h} z={81}>
        <motion.div
          data-panel="reset"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          className="flex h-full w-full flex-col gap-3 rounded p-5"
          style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
        >
          <span className="text-sm font-bold" style={{ color: PALETTE.starWhite }}>
            {RESET_CONFIRM.title}
          </span>
          <p className="flex-1 text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
            {RESET_CONFIRM.note}
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded py-3 text-[11px] font-bold"
              style={{ background: PALETTE.nebulaAmber, color: PALETTE.void }}
            >
              {RESET_CONFIRM.cancel}
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
              {RESET_CONFIRM.confirm}
            </button>
          </div>
        </motion.div>
      </At>
    </>
  )
}
