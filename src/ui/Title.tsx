// The screen the game opens on, and the one a finished run comes back to
// (GDD 12-2 ④). It asks the two questions a run cannot start without — which
// mode, and which constellation to start holding — and then hands both to the
// store.
//
// Neither answer is invented here. The rounds and the target come from
// MODE_PRESETS and the choices from STARTING_CONSTELLATION_CHOICES, so this
// screen cannot disagree with what the run is actually built from (CLAUDE.md §5).
//
// The mode defaults; the constellation deliberately does not. GDD 13-5 introduced
// the pick to give round 1 a decision and a score that answers to placement, and
// a default would let a booth participant walk past the only decision R1 has.

import { useState } from 'react'
import {
  CONSTELLATION_RULES,
  MODE_PRESETS,
  STARTING_CONSTELLATION_CHOICES,
} from '../core/config'
import type { ConstellationId, GameMode, LineAxis } from '../core/types'
import { PALETTE } from '../assets/palette'
import { useGame } from '../store/gameStore'
import { At, CANVAS_WIDTH, Canvas, TITLE_LAYOUT } from './Canvas'
import { ConstellationCard } from './ConstellationCard'

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
 * not derivable from its preset. Everything numeric on the card comes from
 * MODE_PRESETS instead, so a retuned curve cannot leave stale figures here.
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
  global: '보드에 가장 많이 놓인 문양 전체에 배율이 붙습니다.',
}

/** The frame around one option, lit when it is the one chosen. */
function optionStyle(chosen: boolean) {
  return {
    background: chosen ? PALETTE.panelEdge : PALETTE.panel,
    outline: `${chosen ? 2 : 1}px solid ${chosen ? PALETTE.nebulaTeal : PALETTE.panelEdge}`,
  }
}

function Label({ text }: { readonly text: string }) {
  return (
    <span className="text-[11px] tracking-wide" style={{ color: PALETTE.starGlow }}>
      {text}
    </span>
  )
}

export function Title() {
  const startRun = useGame((state) => state.startRun)

  const [mode, setMode] = useState<GameMode>(MODE_ORDER[0])
  const [starting, setStarting] = useState<ConstellationId | null>(null)

  const modes = TITLE_LAYOUT.mode
  const choices = TITLE_LAYOUT.starting

  return (
    <Canvas>
      <At x={TITLE_LAYOUT.title.x} y={TITLE_LAYOUT.title.y} w={TITLE_LAYOUT.title.w}>
        <h1
          className="text-center text-[44px] font-bold leading-none tracking-[0.2em]"
          style={{ color: PALETTE.starWhite }}
        >
          Sirius
        </h1>
      </At>

      <At x={modes.label.x} y={modes.label.y}>
        {/* A booth build has one mode, so there is nothing to choose and the card
            below is telling the participant how long this will take instead. A
            label that asked them to pick would be asking about a row with one
            entry in it. */}
        <Label text={MODE_ORDER.length > 1 ? '모드를 고르세요' : '진행 모드'} />
      </At>

      {/* Centred rather than left-aligned, so the single card of a booth build
          sits under the title like everything else on this screen. With both
          modes the row fills its width exactly and this changes nothing. */}
      <At x={modes.x} y={modes.y} w={modes.w} h={modes.h}>
        <div className="flex justify-center" style={{ gap: modes.gap }}>
          {MODE_ORDER.map((id) => {
            const preset = MODE_PRESETS[id]
            const text = MODE_TEXT[id]
            const chosen = mode === id
            // The last round's target is the one that decides the run, so it is
            // the figure worth showing before anyone commits to the length.
            const finalTarget = preset.TARGET_SCORES[preset.TOTAL_ROUNDS - 1]

            return (
              <button
                key={id}
                type="button"
                data-choice="mode"
                onClick={() => setMode(id)}
                aria-pressed={chosen}
                className="flex flex-col items-start gap-1 rounded px-3 py-2 text-left"
                style={{ width: modes.entry, height: modes.h, ...optionStyle(chosen) }}
              >
                <span
                  className="text-sm font-bold"
                  style={{ color: chosen ? PALETTE.nebulaTeal : PALETTE.starWhite }}
                >
                  {text.name} · {preset.TOTAL_ROUNDS}라운드
                </span>
                <span className="text-[11px] tabular-nums" style={{ color: PALETTE.starGlow }}>
                  최종 목표 {finalTarget.toLocaleString('ko-KR')}점 · 약 {text.minutes}분
                </span>
              </button>
            )
          })}
        </div>
      </At>

      <At x={choices.label.x} y={choices.label.y}>
        <Label text="시작 별자리를 고르세요 — 첫 라운드부터 이 배율로 점수가 붙습니다" />
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
                <span className="text-[11px] leading-relaxed" style={{ color: PALETTE.starGlow }}>
                  {AXIS_BLURB[CONSTELLATION_RULES[id].axis]}
                </span>
              </button>
            )
          })}
        </div>
      </At>

      <At x={TITLE_LAYOUT.start.x} y={TITLE_LAYOUT.start.y} w={TITLE_LAYOUT.start.w} h={TITLE_LAYOUT.start.h}>
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
          {starting === null
            ? '시작 별자리를 골라야 시작할 수 있습니다'
            : `${MODE_TEXT[mode].name}으로 시작합니다`}
        </span>
      </At>
    </Canvas>
  )
}
