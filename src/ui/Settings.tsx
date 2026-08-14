// The settings page (GDD 12-2-d, BOOTH-9c) — one page, two hosts.
//
// It is opened from the ESC pause window and from the main page's `설정`, and it has
// to be the *same* page from both: one component reading one session-level setting
// (`motion.ts`). A second copy on the title screen would be a second switch, and two
// switches over one effect is how a settings screen starts lying.
//
// It moved out of `Pause.tsx` at BOOTH-9d, when the main page became the second
// host. Nothing about it changed except that the box it is drawn in is now a
// parameter — the pause window gives it the band its menu occupies, the main page
// gives it its own column.

import { PALETTE } from '../assets/palette'
import { At } from './Canvas'
import { MenuRow } from './Menu'
import { setAnimations, useAnimations } from './motion'

/**
 * Everything the page says, in one place, for the same reason `RESET_CONFIRM` is in
 * one place: a booth participant reads this unaided (GDD 12-2) and the wording is
 * the whole interface.
 */
export const SETTINGS_TEXT = {
  heading: '설정',
  hint: 'ESC 키로 메뉴로 돌아갑니다',
  animations: '애니메이션',
  on: '켜기',
  off: '끄기',
  animationsNote:
    '끄면 융합 걷기와 카드 발동 연출을 건너뜁니다. 점수는 그대로이고 턴이 더 빨리 넘어갑니다.',
  back: '돌아가기',
} as const

/** Where the page is drawn, and how wide its two controls are. */
export interface SettingsBox {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /** Height of the one setting row. */
  readonly row: number
  /** Width of one of the two choice buttons. */
  readonly control: number
}

/** The lit / plain pair the setting is chosen with. */
function Choice({
  label,
  chosen,
  width,
  onPick,
}: {
  readonly label: string
  readonly chosen: boolean
  readonly width: number
  readonly onPick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onPick}
      className="rounded text-[11px] font-bold"
      style={{
        width,
        height: 32,
        background: chosen ? PALETTE.nebulaTeal : PALETTE.panel,
        color: chosen ? PALETTE.void : PALETTE.starGlow,
        outline: `1px solid ${chosen ? PALETTE.nebulaTeal : PALETTE.panelEdge}`,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

/**
 * ★ One row, because one row is all the game can honestly offer. Volume is not here
 * — Howler is installed and imported nowhere in `src/`, so there is no sound to turn
 * down and a slider would be a control over nothing. Resolution is not here either:
 * GDD 11-10 makes the 1120×630 canvas an absolute rule and the window already picks
 * the integer scale that fits, so there is nothing left to choose. Both are recorded
 * in GDD 12-2-d rather than left as an unexplained absence.
 *
 * The page carries its own way back, so a host does not have to add one.
 */
export function SettingsPage({
  box,
  rowWidth,
  reduced,
  onBack,
}: {
  readonly box: SettingsBox
  /** Width of the 돌아가기 row, so it matches the menu it was opened from. */
  readonly rowWidth: number
  readonly reduced: boolean
  readonly onBack: () => void
}) {
  const on = useAnimations()

  return (
    <At x={box.x} y={box.y} w={box.w} h={box.h}>
      <div className="flex h-full w-full flex-col gap-3">
        <div
          className="flex items-center justify-between rounded px-3"
          style={{
            height: box.row,
            background: PALETTE.panel,
            outline: `1px solid ${PALETTE.panelEdge}`,
          }}
        >
          <span className="text-[11px]" style={{ color: PALETTE.starWhite }}>
            {SETTINGS_TEXT.animations}
          </span>
          <div className="flex gap-2" data-setting="animations">
            <Choice
              label={SETTINGS_TEXT.on}
              chosen={on}
              width={box.control}
              onPick={() => setAnimations(true)}
            />
            <Choice
              label={SETTINGS_TEXT.off}
              chosen={!on}
              width={box.control}
              onPick={() => setAnimations(false)}
            />
          </div>
        </div>

        <p className="text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
          {SETTINGS_TEXT.animationsNote}
        </p>

        <div className="flex-1" />

        <div className="flex justify-center">
          <MenuRow
            label={SETTINGS_TEXT.back}
            reduced={reduced}
            width={rowWidth}
            height={box.row}
            onPick={onBack}
          />
        </div>
      </div>
    </At>
  )
}
