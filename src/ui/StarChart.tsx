// STAR-CHART on the play screen (GDD 8-1), where the deck is actually being
// drawn down and the figures move.
//
// Deliberately not the shop's `DeckPanel`. That panel is 440 wide and lays a suit
// out in one row; the only gap left on this plane is 108 wide (LAYOUT.starChart),
// which will not hold that row at any font size. So the two screens share the
// arithmetic — `drawChances` in core, as CLAUDE.md §5 requires — and nothing else.
//
// What the shop shows and this does not: the educational sentence, the observed
// column, and the buy buttons. None of them fit in 108px, and the shop is where a
// purchase is being weighed anyway.
//
// The full star name is on both from BOOTH-6b (GDD 8-1). It is the one thing the
// two panels had to stop disagreeing about: the wager writes its questions with
// it and neither panel carried it, so the question named something the screen did
// not (BOOTH-6a).

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
  row,
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
  readonly row: number
  readonly bar: number
}) {
  const counts = countDeck(pool)
  const chances = drawChances(pool, HAND_SIZE)

  return (
    <div
      className="flex flex-col rounded p-1"
      style={{ width, height, background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] font-bold leading-tight" style={{ color: PALETTE.starWhite }}>
          STAR-CHART
        </span>
        {/* Names what the percentages are of. Not the shop's full sentence — this
            is a label, and 108px has room for a label and nothing else. */}
        <span className="text-[9px] leading-tight tabular-nums" style={{ color: PALETTE.starLink }}>
          다음 {HAND_SIZE}장
        </span>
      </div>

      {SUIT_ORDER.map((suit) => {
        const held = counts.bySuit[suit]

        return (
          <div key={suit} className="flex flex-col justify-center gap-1" style={{ height: row }}>
            <div className="flex items-center gap-1">
              <PixelSprite pixels={basicChip(suit)} scale={1} alt="" />
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-bold" style={{ color: SUIT_INK[suit] }}>
                  {suit}
                </span>
                {/* GDD 8-1: the full star name, because ORION'S WAGER asks its
                    questions with it and nothing else on this screen carries it
                    (BOOTH-6a). At 9px the longest of the five is 54px, which is
                    what `tests/canvas.test.ts` checks the 108px column against. */}
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
  )
}
