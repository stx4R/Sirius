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
import type { ConstellationId } from '../core/types'
import { PALETTE } from '../assets/palette'
import { At, CANVAS_HEIGHT, CANVAS_WIDTH, LAYOUT } from './Canvas'
import { HelpCard } from './Coach'
import { MenuRow, StarField } from './Menu'
import { RESTART_CONFIRM, ResetConfirm, TITLE_CONFIRM } from './Reset'
import { SETTINGS_TEXT, SettingsPage } from './Settings'
import { SiriusSymbol } from './Sirius'

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
} as const

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
          <StarField />

          <At x={CANVAS_WIDTH / 2} y={spot.symbol.y} centre>
            <SiriusSymbol />
          </At>

          <At x={CANVAS_WIDTH / 2} y={spot.heading.y} centre>
            <span
              className="whitespace-nowrap text-[22px] font-bold leading-none"
              style={{ color: PALETTE.starWhite }}
            >
              {settings ? SETTINGS_TEXT.heading : PAUSE_TEXT.heading}
            </span>
          </At>

          {settings ? (
            <SettingsPage
              box={spot.settings}
              rowWidth={spot.menu.w}
              reduced={reduced}
              onBack={() => onPage('menu')}
            />
          ) : (
            <At x={spot.menu.x} y={spot.menu.y} w={spot.menu.w}>
              <div className="flex flex-col" style={{ gap: spot.menu.gap }}>
                {PAUSE_MENU.map((item) => (
                  <MenuRow
                    key={item.id}
                    label={item.label}
                    reduced={reduced}
                    width={spot.menu.w}
                    height={spot.menu.h}
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
              {settings ? SETTINGS_TEXT.hint : PAUSE_TEXT.hint}
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
