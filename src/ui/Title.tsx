// The screen the game opens on, and the one a finished run comes back to
// (GDD 12-2 ④).
//
// ★ BOOTH-9d rebuilt it from `docs/brand/title-screen-mock-1120x630.png`. It used to
// be one column that asked both of a run's questions at once — which mode, and which
// constellation to start holding — and it is now the mock: the symbol, the wordmark,
// and four rows. The mock is 1120×630, the same plane the game is drawn on, so its
// pixels are these pixels and every figure in `TITLE_LAYOUT` is measured off it.
//
// The four rows are three destinations and one page of its own:
//
//     게임 시작   → the starting-constellation page, then a full run   (GDD 12-3)
//     부스 모드   → the same page, then a booth run
//     도감       → `Codex.tsx`
//     설정       → the pause window's settings page, unchanged (GDD 12-2-d)
//
// ★ THE STARTING CONSTELLATION DID NOT GO AWAY, it moved. GDD 13-5 introduced it
// because round 1 is otherwise identical for every player — no constellation means
// no line fires and the score is occupancy × 10 — so dropping it to fit the mock
// would put that back. It is the second page now, with a way back.
//
// Neither answer is invented here. The rounds and the target come from MODE_PRESETS
// and the choices from STARTING_CONSTELLATION_CHOICES, so this screen cannot
// disagree with what the run is actually built from (CLAUDE.md §5).

import { useEffect, useState } from 'react'
import {
  CONSTELLATION_RULES,
  MODE_PRESETS,
  STARTING_CONSTELLATION_CHOICES,
} from '../core/config'
import type { ConstellationId, GameMode, LineAxis } from '../core/types'
import { PALETTE } from '../assets/palette'
import { useGame } from '../store/gameStore'
import { At, CANVAS_HEIGHT, CANVAS_WIDTH, CODEX_LAYOUT, Canvas, TITLE_LAYOUT } from './Canvas'
import { Codex, CODEX_TEXT } from './Codex'
import { ConstellationCard } from './ConstellationCard'
import { MenuRow, StarField } from './Menu'
import { SETTINGS_TEXT, SettingsPage } from './Settings'
import { SiriusSymbol } from './Sirius'
import { useReducedMotion } from './motion'

/**
 * The tagline under the wordmark (GDD 2, 11-10).
 *
 * 'STAR' is in Latin capitals and stays that way: it is the game's own word for a
 * constellation piece, and the quotes are what make it read as a name rather than as
 * the English noun.
 */
const TAGLINE = "당신의 운명을 'STAR'로 결정하세요."

/** Which page of the title is up. `menu` is the main page. */
export type TitlePage = 'menu' | 'starting' | 'codex' | 'settings'

/**
 * Which modes this build offers, and in what order (GDD 12-2 ③).
 *
 * Booth first everywhere: it is the default, and a booth machine is what this
 * screen is mostly read on. The order is the reading order, not config's.
 *
 * ★ A production build offers booth *only* (BOOTH-7). The full version is eight
 * rounds against a booth run's three (GDD 12-3), so a participant who picks it
 * holds a seat for something like forty minutes — and GDD 12-1 makes throughput
 * the score, at 1.8 participants an hour per laptop. One participant choosing the
 * long game costs the booth roughly one vote, and nothing on this screen tells
 * them that.
 *
 * Nothing is removed to achieve it. The choice is decided at build time by
 * `import.meta.env.PROD`, which is what the booth laptops run and what a `npm run
 * dev` session is not, so development and the screenshot tool keep both modes
 * with no flag to remember. `?mode=full` re-opens it on a production build for a
 * demo — the same escape hatch `?seed=` already is (gameStore.ts), and one no
 * participant types by accident.
 *
 * ★ THIS FUNCTION IS THE WHOLE GATE, AND ITS BODY IS ONE LINE. BOOTH-9d turned the
 * mode row into two menu items, so what used to hide a card now greys a row — but
 * the decision is still made here and nowhere else. To open the full version to
 * everybody, return `['booth', 'full']` unconditionally; that one edit unlocks the
 * row, its label, and the run behind it, and `tests/booth.test.ts` is what says so.
 */
export function modeOrder(prod: boolean, unlocked: boolean): readonly GameMode[] {
  return prod && !unlocked ? ['booth'] : ['booth', 'full']
}

/**
 * `?mode=full`. Read once at module load for the reason `pinnedSeed` is: the
 * query cannot change without a reload.
 */
function fullUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('mode') === 'full'
}

const MODE_ORDER = modeOrder(import.meta.env.PROD, fullUnlocked())

/**
 * The name and the wall-clock estimate — the two things about a mode that are
 * not derivable from its preset. Everything numeric comes from MODE_PRESETS
 * instead, so a retuned curve cannot leave stale figures here.
 *
 * ★ The booth figure is measured, not the round count times a guess (GDD 12-1,
 * BOOTH-6b). It used to say 20, which was 12-1's *총 체류 시간* — a figure that
 * includes the rule explanation and the seat change — printed where a player reads
 * it as how long they will be playing. BOOTH-6a measured a student's play at
 * 32.4분; BOOTH-6b's cuts brought it to 27.6분, which is what 28 rounds to.
 *
 * The full version's 40 is untouched: nobody has measured it, and inventing a
 * figure here is the mistake this comment exists to record.
 */
const MODE_TEXT: Readonly<Record<GameMode, { readonly name: string; readonly minutes: number }>> = {
  booth: { name: '부스판', minutes: 28 },
  full: { name: '풀버전', minutes: 40 },
}

/**
 * The main page's four rows. The two that start a run carry the mode they start.
 *
 * The labels are the mock's, and they are not the mode names: `게임 시작` is the full
 * version and `부스 모드` is the booth one. The card that used to spell out
 * "부스판 · 3주기 · 최종 목표 2,000점 · 약 28분" is gone with the mode row, so the page
 * that follows says it instead (see `hintFor`).
 */
export const TITLE_MENU = [
  { id: 'full', label: '게임 시작' },
  { id: 'booth', label: '부스 모드' },
  { id: 'codex', label: CODEX_TEXT.heading },
  { id: 'settings', label: SETTINGS_TEXT.heading },
] as const

/** Why the row is shut, on the row itself (GDD 12-2-b). */
export const LOCKED_NOTE = '부스에서는 잠깁니다'

/**
 * What an axis means, in words a player who has never seen the board can act on.
 *
 * Keyed by axis rather than by constellation id, so the two options stay whatever
 * STARTING_CONSTELLATION_CHOICES says they are. The card above already prints the
 * condition ("세로 3연속 이상"); what it cannot say is which way that is on a board
 * the player is looking at for the first time, and that is the whole of the choice
 * GDD 13-5 asks them to make.
 */
const AXIS_BLURB: Readonly<Record<LineAxis, string>> = {
  vertical: '↓ 세로형. 같은 문양을 위에서 아래로 이어 놓으면 배율이 터집니다.',
  horizontal: '→ 가로형. 같은 문양을 왼쪽에서 오른쪽으로 이어 놓으면 배율이 터집니다.',
  diagonal: '↘ 대각형. 같은 문양을 비스듬히 이어 놓으면 배율이 터집니다.',
  shape_A: 'ㅅ자형. 꼭짓점에서 양쪽으로 뻗어 나가게 놓으면 배율이 터집니다.',
  shape_T: 'ㅗ자형. 가로 줄 가운데에서 위로 뻗어 나가게 놓으면 배율이 터집니다.',
  global: '성단에 가장 많이 놓인 문양 전체에 배율이 붙습니다.',
}

/**
 * The line under the start button. It carries what the mode card used to say, since
 * BOOTH-9d's menu row has room for a name and nothing else.
 */
export function hintFor(mode: GameMode, chosen: boolean): string {
  if (!chosen) return '시작 별자리를 골라야 시작할 수 있습니다'
  const preset = MODE_PRESETS[mode]
  const text = MODE_TEXT[mode]
  const finalTarget = preset.TARGET_SCORES[preset.TOTAL_ROUNDS - 1]

  return (
    `${text.name} · ${preset.TOTAL_ROUNDS}주기 · ` +
    `최종 목표 ${finalTarget.toLocaleString('ko-KR')}점 · 약 ${text.minutes}분`
  )
}

/** The frame around one option, lit when it is the one chosen. */
function optionStyle(chosen: boolean) {
  return {
    background: chosen ? PALETTE.panelEdge : PALETTE.panel,
    outline: `${chosen ? 2 : 1}px solid ${chosen ? PALETTE.nebulaTeal : PALETTE.panelEdge}`,
  }
}

/** Top-left on every sub-page, in one place so it never moves between them. */
function BackButton({ onBack }: { readonly onBack: () => void }) {
  const box = TITLE_LAYOUT.back

  return (
    <At x={box.x} y={box.y} w={box.w} h={box.h}>
      <button
        type="button"
        data-title="back"
        onClick={onBack}
        className="h-full w-full rounded text-[11px]"
        style={{
          background: PALETTE.panel,
          color: PALETTE.starGlow,
          outline: `1px solid ${PALETTE.panelEdge}`,
          cursor: 'pointer',
        }}
      >
        ← 뒤로
      </button>
    </At>
  )
}

function Heading({ text, y }: { readonly text: string; readonly y: number }) {
  return (
    <At x={CANVAS_WIDTH / 2} y={y} centre>
      <span
        className="whitespace-nowrap text-[22px] font-bold leading-none"
        style={{ color: PALETTE.starWhite }}
      >
        {text}
      </span>
    </At>
  )
}

export function Title() {
  const startRun = useGame((state) => state.startRun)
  const reduced = useReducedMotion()

  const [page, setPage] = useState<TitlePage>('menu')
  /** Which run the starting page will begin. Set by the row that opened it. */
  const [mode, setMode] = useState<GameMode>('booth')
  const [starting, setStarting] = useState<ConstellationId | null>(null)

  const fullOpen = MODE_ORDER.includes('full')
  const choices = TITLE_LAYOUT.starting

  // ESC steps back to the menu, the way it does inside the pause window
  // (GDD 12-2-d). On the menu there is nothing behind, so it does nothing.
  useEffect(() => {
    if (page === 'menu') return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPage('menu')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page])

  const openRun = (id: GameMode) => {
    setMode(id)
    setStarting(null)
    setPage('starting')
  }

  return (
    <Canvas>
      {/* The sky both menu screens sit on (`Menu.tsx`), under everything. */}
      <At x={0} y={0} w={CANVAS_WIDTH} h={CANVAS_HEIGHT}>
        <div className="h-full w-full overflow-hidden" style={{ position: 'relative' }}>
          <StarField />
        </div>
      </At>

      {page === 'menu' ? (
        <>
          {/* The vertical lockup (GDD 11-10, logo sheet ①). The symbol is drawn from
              geometry rather than cut out of the sheet — GDD 11-1's first rule is
              that no image files are made, and `siriusSymbol` takes its four tones
              from the palette instead of baking them in. */}
          <At x={CANVAS_WIDTH / 2} y={TITLE_LAYOUT.symbol.y} centre>
            <SiriusSymbol scale={TITLE_LAYOUT.symbol.scale} />
          </At>

          <At x={TITLE_LAYOUT.wordmark.x} y={TITLE_LAYOUT.wordmark.y} w={TITLE_LAYOUT.wordmark.w}>
            {/* 126px = Galmuri14 × 9 (index.css maps size → face). Not bold: Galmuri14
                ships no bold and `font-synthesis: none` means asking for one changes
                nothing.

                `paddingLeft` matches `letterSpacing` on purpose. CSS adds the spacing
                after the last glyph too, so a centred line with 16px of tracking sits
                8px left of centre; the same 16px on the leading edge puts the ink back
                on the middle of the plane. */}
            <h1
              className="text-center text-[126px] leading-none"
              style={{
                color: PALETTE.starWhite,
                letterSpacing: TITLE_LAYOUT.wordmark.tracking,
                paddingLeft: TITLE_LAYOUT.wordmark.tracking,
              }}
            >
              Sirius
            </h1>
          </At>

          <At x={TITLE_LAYOUT.menu.x} y={TITLE_LAYOUT.menu.y} w={TITLE_LAYOUT.menu.w}>
            <div className="flex flex-col" style={{ gap: TITLE_LAYOUT.menu.gap }}>
              {TITLE_MENU.map((item) => {
                const locked = item.id === 'full' && !fullOpen

                return (
                  <MenuRow
                    key={item.id}
                    label={item.label}
                    note={locked ? LOCKED_NOTE : undefined}
                    disabled={locked}
                    reduced={reduced}
                    width={TITLE_LAYOUT.menu.w}
                    height={TITLE_LAYOUT.menu.h}
                    onPick={() =>
                      item.id === 'full' || item.id === 'booth'
                        ? openRun(item.id)
                        : setPage(item.id)
                    }
                  />
                )
              })}
            </div>
          </At>

          <At x={CANVAS_WIDTH / 2} y={TITLE_LAYOUT.tagline.y} centre>
            <span className="whitespace-nowrap text-[11px]" style={{ color: PALETTE.starGlow }}>
              {TAGLINE}
            </span>
          </At>
        </>
      ) : (
        // Not on the settings page: it carries its own 돌아가기 (`Settings.tsx`), and
        // two controls doing the same thing on one screen is one too many.
        page !== 'settings' && <BackButton onBack={() => setPage('menu')} />
      )}

      {/* ------------------------------------------ GDD 13-5, on its own page */}
      {page === 'starting' && (
        <>
          <Heading text="시작 별자리를 고르세요" y={choices.heading.y} />

          <At x={CANVAS_WIDTH / 2} y={choices.note.y} centre>
            {/* 주기's one 한자 (GDD 2-3). It travelled with the line it has always been
                on: this page is still the one surface every participant passes exactly
                once, which is the reason 2-3 put the 병기 here. */}
            <span className="whitespace-nowrap text-[11px]" style={{ color: PALETTE.starGlow }}>
              첫 주기(週期)부터 이 배율로 점수가 붙습니다
            </span>
          </At>

          <At x={choices.x} y={choices.y} w={choices.w} h={choices.h}>
            <div className="flex" style={{ gap: choices.gap }}>
              {STARTING_CONSTELLATION_CHOICES.map((id) => {
                const chosen = starting === id

                return (
                  <button
                    key={id}
                    type="button"
                    data-choice="starting"
                    onClick={() => setStarting(id)}
                    aria-pressed={chosen}
                    className="flex flex-col items-start gap-2 rounded p-3 text-left"
                    style={{ width: choices.entry, height: choices.h, ...optionStyle(chosen) }}
                  >
                    {/* GDD 11-5: the card never appears without its name, condition
                        and multiplier, and ConstellationCard is what guarantees that. */}
                    <ConstellationCard id={id} scale={2} layout="row" />
                    <span
                      className="text-[11px] leading-relaxed"
                      style={{ color: PALETTE.starGlow }}
                    >
                      {AXIS_BLURB[CONSTELLATION_RULES[id].axis]}
                    </span>
                  </button>
                )
              })}
            </div>
          </At>

          <At
            x={TITLE_LAYOUT.start.x}
            y={TITLE_LAYOUT.start.y}
            w={TITLE_LAYOUT.start.w}
            h={TITLE_LAYOUT.start.h}
          >
            <button
              type="button"
              onClick={() => starting !== null && startRun({ mode, starting })}
              disabled={starting === null}
              className="h-full w-full rounded text-[22px] font-bold"
              style={{
                background: starting === null ? PALETTE.panelEdge : PALETTE.nebulaTeal,
                color: starting === null ? PALETTE.starGlow : PALETTE.void,
                cursor: starting === null ? 'default' : 'pointer',
              }}
            >
              시작
            </button>
          </At>

          <At x={CANVAS_WIDTH / 2} y={TITLE_LAYOUT.hint.y} centre>
            <span className="whitespace-nowrap text-[11px]" style={{ color: PALETTE.starGlow }}>
              {hintFor(mode, starting !== null)}
            </span>
          </At>
        </>
      )}

      {page === 'codex' && (
        <>
          <Heading text={CODEX_TEXT.heading} y={CODEX_LAYOUT.heading.y} />
          <Codex />
        </>
      )}

      {page === 'settings' && (
        <>
          <Heading text={SETTINGS_TEXT.heading} y={TITLE_LAYOUT.settings.heading.y} />
          <SettingsPage
            box={TITLE_LAYOUT.settings}
            rowWidth={TITLE_LAYOUT.menu.w}
            reduced={reduced}
            onBack={() => setPage('menu')}
          />
          <At x={CANVAS_WIDTH / 2} y={TITLE_LAYOUT.settingsHint.y} centre>
            <span className="whitespace-nowrap text-[11px]" style={{ color: PALETTE.starGlow }}>
              {SETTINGS_TEXT.hint}
            </span>
          </At>
        </>
      )}
    </Canvas>
  )
}
