// The ESC pause window (GDD 12-2 ①④, 12-2-c, 11-10 — BOOTH-9c).
//
// BOOTH-9b gave the top right of the play screen to STAR-CHART and took the ?
// and 처음으로 buttons off it. Neither *function* went away, but a keyboard binding
// nobody can see satisfies neither GDD 12-2 ① (a permanent way back into the
// tutorial) nor 12-2 ④ (a participant abandoning a run unaided). This window is
// where both of them live now, together with the one setting the game can honestly
// offer, and it is the only thing ESC does.
//
// ★ It is the plane, not a card. Every other overlay in this game is a panel over a
// game the player is still inside; this one is the game stood down. So it fills
// 1120×630 in the void colour with a star field over it and a single centred
// column, which is `docs/brand/title-screen-mock-1120x630.png` — the mood the mock
// was drawn for, used on the screen that actually wanted it.
//
// ★ The wordmark is not here, and that is a decision rather than an omission. One
// of the five items goes to the title screen; a window that opened with the same
// 42px Sirius the title screen opens with would make 처음 화면으로 look like it did
// nothing, and 계속하기 look like it started a game. The symbol alone gives the
// column a head and says whose window this is without claiming to be the title.
//
// ★ Nothing here reaches into the game. The window is opened by `Game.tsx`, which
// is what holds the settlement timer while it is up (`autoAdvances`), and the two
// destructive items call the store actions the end-of-run banner already calls.

import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { mulberry32 } from '../core/rng'
import type { ConstellationId } from '../core/types'
import { PALETTE } from '../assets/palette'
import { At, CANVAS_HEIGHT, CANVAS_WIDTH, LAYOUT } from './Canvas'
import { HelpCard } from './Coach'
import { RESTART_CONFIRM, ResetConfirm, TITLE_CONFIRM } from './Reset'
import { SiriusSymbol } from './Sirius'
import { setAnimations, useAnimations } from './motion'

/**
 * Which page of the window is up. `menu` is the window itself; the other four are
 * things opened from it, and ESC steps back from any of them to `menu`.
 *
 * `help`, `restart` and `title` draw their own card above the window rather than
 * replacing its body, so the menu stays visible behind them and backing out of one
 * is visibly a return rather than a new screen.
 */
export type PausePage = 'menu' | 'help' | 'settings' | 'restart' | 'title'

/**
 * The five items, in the order a stuck participant needs them: carry on, be told
 * what to do, start over, leave, and only then the setting.
 *
 * ★ `다시 시작` and `처음 화면으로` are different actions and are named to say so.
 * The first keeps the mode and the starting constellation this run was built from
 * and deals a new one; the second puts the next participant in front of those two
 * questions (GDD 12-2 ④). Both throw the run away, so both ask first, and the two
 * questions differ (`Reset.tsx`).
 */
export const PAUSE_MENU = [
  { id: 'resume', label: '계속하기' },
  { id: 'help', label: '튜토리얼 시작' },
  { id: 'restart', label: '다시 시작' },
  { id: 'title', label: '처음 화면으로' },
  { id: 'settings', label: '설정' },
] as const satisfies readonly { readonly id: 'resume' | PausePage; readonly label: string }[]

/**
 * Everything the window says, in one place, for the same reason `RESET_CONFIRM` is
 * in one place: a booth participant reads this unaided (GDD 12-2) and the wording
 * is the whole interface.
 */
export const PAUSE_TEXT = {
  heading: '일시 정지',
  hint: 'ESC 키로 이 창을 열고 닫습니다',
  settings: '설정',
  settingsHint: 'ESC 키로 메뉴로 돌아갑니다',
  animations: '애니메이션',
  on: '켜기',
  off: '끄기',
  animationsNote:
    '끄면 융합 걷기와 카드 발동 연출을 건너뜁니다. 점수는 그대로이고 턴이 더 빨리 넘어갑니다.',
  back: '돌아가기',
} as const

/**
 * The star field behind the column.
 *
 * ★ Seeded, not `Math.random()` (CLAUDE.md §8). The rule is there so the simulator
 * and the tests reproduce, and it applies to decoration for a third reason: every
 * `npm run shot` has to photograph the same sky, or the duplicate check at the end
 * of the screenshot tool is comparing two pictures that were never the same.
 *
 * The tones come off the palette and land where GDD 11-7 already puts them —
 * `panelEdge` is named "the faint specks behind a star chart", so most of the sky
 * is that, and the handful of `starWhite` ones are the only 2px dots.
 */
const FIELD_SEED = 9031
const FIELD_STARS = 120

interface Star {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly ink: string
}

function starField(): readonly Star[] {
  const rng = mulberry32(FIELD_SEED)
  const stars: Star[] = []

  for (let i = 0; i < FIELD_STARS; i++) {
    // Whole pixels, so a 1px dot is a dot rather than two grey ones (CLAUDE.md §7).
    const x = Math.floor(rng() * CANVAS_WIDTH)
    const y = Math.floor(rng() * CANVAS_HEIGHT)
    const tone = rng()
    const ink =
      tone < 0.08
        ? PALETTE.starWhite
        : tone < 0.3
          ? PALETTE.starGlow
          : tone < 0.65
            ? PALETTE.starLink
            : PALETTE.panelEdge

    stars.push({ x, y, size: tone < 0.08 ? 2 : 1, ink })
  }

  return stars
}

/**
 * One row of the menu.
 *
 * Plain text on the sky rather than a filled button, which is the mock's list and
 * also the honest shape: five equally weighted choices, none of them the one the
 * window is pushing. The lit state is on hover and on focus, so a keyboard tab
 * shows the same thing a mouse does.
 */
function MenuRow({
  label,
  reduced,
  onPick,
}: {
  readonly label: string
  readonly reduced: boolean
  readonly onPick: () => void
}) {
  const row = LAYOUT.pause.menu

  return (
    <motion.button
      type="button"
      data-pause={label}
      onClick={onPick}
      className="rounded text-sm"
      style={{ width: row.w, height: row.h, cursor: 'pointer' }}
      initial={false}
      animate={{ backgroundColor: 'rgba(0,0,0,0)', color: PALETTE.starGlow }}
      whileHover={{ backgroundColor: PALETTE.panel, color: PALETTE.starWhite }}
      whileFocus={{ backgroundColor: PALETTE.panel, color: PALETTE.starWhite }}
      transition={{ duration: reduced ? 0 : 0.12 }}
    >
      {label}
    </motion.button>
  )
}

/** The lit / plain pair the setting is chosen with. */
function Choice({
  label,
  chosen,
  onPick,
}: {
  readonly label: string
  readonly chosen: boolean
  readonly onPick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onPick}
      className="rounded text-[11px] font-bold"
      style={{
        width: LAYOUT.pause.settings.control,
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
 * The settings page (BOOTH-9c).
 *
 * ★ One row, because one row is all the game can honestly offer. Volume is not here
 * — Howler is installed and imported nowhere in `src/`, so there is no sound to turn
 * down and a slider would be a control over nothing. Resolution is not here either:
 * GDD 11-10 makes the 1120×630 canvas an absolute rule and the window already picks
 * the integer scale that fits, so there is nothing left to choose. Both are recorded
 * in GDD 12-2-d rather than left as an unexplained absence.
 */
function Settings({ reduced, onBack }: { readonly reduced: boolean; readonly onBack: () => void }) {
  const box = LAYOUT.pause.settings
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
            {PAUSE_TEXT.animations}
          </span>
          <div className="flex gap-2" data-setting="animations">
            <Choice label={PAUSE_TEXT.on} chosen={on} onPick={() => setAnimations(true)} />
            <Choice label={PAUSE_TEXT.off} chosen={!on} onPick={() => setAnimations(false)} />
          </div>
        </div>

        <p className="text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
          {PAUSE_TEXT.animationsNote}
        </p>

        <div className="flex-1" />

        <div className="flex justify-center">
          <MenuRow label={PAUSE_TEXT.back} reduced={reduced} onPick={onBack} />
        </div>
      </div>
    </At>
  )
}

export function PauseWindow({
  page,
  starting,
  target,
  reduced,
  onPage,
  onResume,
  onRestart,
  onTitle,
}: {
  readonly page: PausePage
  /** The constellation the run opened holding, for the summary (GDD 12-2 ①). */
  readonly starting: ConstellationId | null
  readonly target: number
  readonly reduced: boolean
  readonly onPage: (page: PausePage) => void
  readonly onResume: () => void
  readonly onRestart: () => void
  readonly onTitle: () => void
}) {
  const spot = LAYOUT.pause
  // Built once for the life of the page: nothing varies the sky, and rebuilding
  // 120 stars every time the window opens would be 120 new dots each time.
  const stars = useMemo(starField, [])
  const settings = page === 'settings'

  return (
    <>
      <At x={0} y={0} w={CANVAS_WIDTH} h={CANVAS_HEIGHT} z={65}>
        <motion.div
          data-panel="pause"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
          className="h-full w-full overflow-hidden"
          // Opaque, not a scrim. The game is stood down, so it is not behind this
          // waiting to be read — and a settlement half visible through a scrim is a
          // settlement the player is trying to watch while the window holds it.
          style={{ position: 'relative', background: PALETTE.void }}
        >
          {stars.map((star, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: star.x,
                top: star.y,
                width: star.size,
                height: star.size,
                background: star.ink,
              }}
            />
          ))}

          <At x={CANVAS_WIDTH / 2} y={spot.symbol.y} centre>
            <SiriusSymbol />
          </At>

          <At x={CANVAS_WIDTH / 2} y={spot.heading.y} centre>
            <span
              className="whitespace-nowrap text-[22px] font-bold leading-none"
              style={{ color: PALETTE.starWhite }}
            >
              {settings ? PAUSE_TEXT.settings : PAUSE_TEXT.heading}
            </span>
          </At>

          {settings ? (
            <Settings reduced={reduced} onBack={() => onPage('menu')} />
          ) : (
            <At x={spot.menu.x} y={spot.menu.y} w={spot.menu.w}>
              <div className="flex flex-col" style={{ gap: spot.menu.gap }}>
                {PAUSE_MENU.map((item) => (
                  <MenuRow
                    key={item.id}
                    label={item.label}
                    reduced={reduced}
                    onPick={item.id === 'resume' ? onResume : () => onPage(item.id)}
                  />
                ))}
              </div>
            </At>
          )}

          <At x={CANVAS_WIDTH / 2} y={spot.hint.y} centre>
            {/* starGlow, not the dimmer starLink this first used. It is the only
                line on the screen that says how to get back out, and at 11px on the
                void `starLink` measures about 2.5:1 — the same colour the title
                screen's hint uses reads at nearly 8:1. */}
            <span className="whitespace-nowrap text-[11px]" style={{ color: PALETTE.starGlow }}>
              {settings ? PAUSE_TEXT.settingsHint : PAUSE_TEXT.hint}
            </span>
          </At>
        </motion.div>
      </At>

      {/* GDD 12-2 ①'s way back into the tutorial. The same card the ? button opened
          before BOOTH-9b, unchanged — it is still one still page rather than a
          replay, for the reason GDD 12-2-a gives: three of the five steps cannot be
          re-staged, and a player who lost the thread wants to know what to do now. */}
      {page === 'help' && (
        <HelpCard
          starting={starting}
          target={target}
          reduced={reduced}
          onClose={() => onPage('menu')}
        />
      )}

      {page === 'restart' && (
        <ResetConfirm
          copy={RESTART_CONFIRM}
          reduced={reduced}
          onCancel={() => onPage('menu')}
          onConfirm={onRestart}
        />
      )}

      {page === 'title' && (
        <ResetConfirm
          copy={TITLE_CONFIRM}
          reduced={reduced}
          onCancel={() => onPage('menu')}
          onConfirm={onTitle}
        />
      )}
    </>
  )
}
