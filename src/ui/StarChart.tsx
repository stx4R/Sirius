// STAR-CHART on the play screen (GDD 8-1), where the deck is actually being drawn
// down and the figures move.
//
// ★ BOOTH-9b turned this from a column into a row and moved it to the top of the
// screen, into the space the 처음으로 · ? · DEV cluster used to hold. It was a
// column because the only gap the plane had left was 108px wide; freeing the top
// right gave it 448, and 448 is enough to stop compressing.
//
// Deliberately still not the shop's `DeckPanel`. That panel is 440 wide and carries
// the educational sentence, the observed column and the buy buttons — the things a
// player weighing a purchase needs and a player mid-turn does not. The two screens
// share the arithmetic — `drawChances` in core, as CLAUDE.md §5 requires — and
// nothing else.
//
// WHAT FITS, MEASURED RATHER THAN GUESSED. Five cells of 88px, against Galmuri's
// own metrics at the sizes this is set in:
//
//     칩 스프라이트  32px (1×)          코드 GAC      23px @11 bold
//     로마자 Mimosa  33px @9 (longest)  남은 장수 10/50  24px @9
//     막대 56px                          확률 100%     24px @9
//
// The chip and the text column are 32 + 2 + 54, and the widest thing the text column
// has to hold is Mimosa's 33 — 21px of slack. The bar row is 56 + 4 + 24 = 84 in a
// cell of 88. So the six things GDD 8-1 asks for all fit and **nothing was dropped**,
// which is what the move was for. The column fitted them too, but with the star name
// set at 9px against a 54px budget and no room to spare anywhere.
//
// The full star name is on both this and the shop from BOOTH-6b (GDD 8-1). It is the
// one thing the two panels had to stop disagreeing about: the wager writes its
// questions with it and neither panel carried it, so the question named something
// the screen did not (BOOTH-6a).

import { HAND_SIZE, SUIT_STAR_NAMES } from '../core/config'
import { countDeck, drawChances } from '../core/deck'
import { SUIT_ORDER } from '../core/types'
import type { Chip } from '../core/types'
import { basicChip } from '../assets/compose'
import { PALETTE, SUIT_INK } from '../assets/palette'
import { PixelSprite } from './PixelSprite'

/**
 * Whole pixels, and never zero while any of the suit is left — a suit down to its
 * last chip has to look different from one that is gone (CLAUDE.md §7).
 *
 * The shop keeps its own copy against its own wider track. Sharing one would mean
 * sharing a track width the two layouts do not agree on.
 */
function barWidth(count: number, poolSize: number, track: number): number {
  if (count <= 0 || poolSize <= 0) return 0
  return Math.max(1, Math.round((count / poolSize) * track))
}

export function StarChart({
  pool,
  width,
  height,
  cell,
  bar,
}: {
  /**
   * Everything that can still be dealt this round — the draw pile plus the hand,
   * which is to say every chip not yet on the board. Unplaced chips go back and
   * are reshuffled (GDD 4-2), so the hand is not gone; placing is what removes a
   * chip for good, and that is exactly what these figures should answer to.
   */
  readonly pool: readonly Chip[]
  readonly width: number
  readonly height: number
  /** One suit's share of the row, in whole pixels (GDD 11-10). */
  readonly cell: number
  readonly bar: number
}) {
  const counts = countDeck(pool)
  const chances = drawChances(pool, HAND_SIZE)

  return (
    <div
      className="flex flex-col rounded px-1 py-1"
      style={{ width, height, background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] font-bold leading-tight" style={{ color: PALETTE.starWhite }}>
          STAR-CHART
        </span>
        {/* Names what the percentages are of. Still a label rather than the shop's
            full sentence: the row is wide now, but a sentence up here would be read
            once and then sit over the board for the rest of the run. */}
        <span className="text-[9px] leading-tight tabular-nums" style={{ color: PALETTE.starLink }}>
          다음 {HAND_SIZE}장
        </span>
      </div>

      <div className="flex flex-1 items-end">
        {SUIT_ORDER.map((suit) => {
          const held = counts.bySuit[suit]

          return (
            <div key={suit} className="flex flex-col gap-0.5" style={{ width: cell }}>
              <div className="flex items-center gap-0.5">
                <PixelSprite pixels={basicChip(suit)} scale={1} alt="" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[11px] font-bold" style={{ color: SUIT_INK[suit] }}>
                    {suit}
                  </span>
                  {/* GDD 8-1: the full star name, because ORION'S WAGER asks its
                      questions with it and nothing else on this screen carries it
                      (BOOTH-6a). */}
                  <span className="text-[9px]" style={{ color: PALETTE.starLink }}>
                    {SUIT_STAR_NAMES[suit]}
                  </span>
                  <span className="text-[9px] tabular-nums" style={{ color: PALETTE.starGlow }}>
                    {held}
                    <span style={{ color: PALETTE.starLink }}>/{pool.length}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <span
                  className="shrink-0"
                  style={{ width: bar, height: 6, background: PALETTE.panelEdge }}
                >
                  <span
                    className="block"
                    style={{
                      width: barWidth(held, pool.length, bar),
                      height: 6,
                      background: SUIT_INK[suit],
                    }}
                  />
                </span>
                <span
                  className="flex-1 text-right text-[9px] tabular-nums"
                  style={{ color: SUIT_INK[suit] }}
                >
                  {Math.round(chances[suit] * 100)}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
