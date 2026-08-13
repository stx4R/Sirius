// ORION (M42), the companion who watches the play (GDD 2, 11-8).
//
// Nothing he says reads or changes game state — the screen tells him which beat
// just happened and he answers with a line and a face.
//
// The bubble is placed to his left and points at him (GDD 11-10), so the two read
// as one figure speaking rather than as a caption that happens to be nearby.
//
// ★ The beat picks the expression as well as the line (BOOTH-6c). They come from
// one call so a face and the sentence under it can never disagree — see `MOOD_OF`
// for which of GDD 11-8's four each beat wears.

import { motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { mulberry32 } from '../core/rng'
import { orionSprite } from '../assets/compose'
import { PALETTE } from '../assets/palette'
import type { OrionMood } from '../assets/palette'
import { MOOD_OF, lineFor } from './dialogue'
import type { Beat } from './dialogue'
import { withPixelWords } from './PixelWord'
import { PixelSprite } from './PixelSprite'

/**
 * Offsets ORION's generator from the one core plays the run with, so his lines
 * are reproducible for a seed without consuming draws that belong to the deck
 * (CLAUDE.md §8).
 */
const SPEECH_SEED_OFFSET = 0x5ee0

export interface Orion {
  readonly line: string
  /** The face that goes with the line (GDD 11-8). */
  readonly mood: OrionMood
  readonly speak: (beat: Beat) => void
}

export function useOrion(seed: number): Orion {
  const rng = useMemo(() => mulberry32(seed ^ SPEECH_SEED_OFFSET), [seed])
  // Drawn from the same generator every later line comes from, so the run has one
  // reproducible stream of dialogue rather than two that start on the same value.
  //
  // The line and the face are one piece of state, set together: two pieces would
  // let a dropped update leave a pleased face over '성도가 닫혔다'.
  const [said, setSaid] = useState(() => ({
    line: lineFor('turnStart', rng),
    mood: MOOD_OF.turnStart,
  }))

  const speak = useCallback(
    (beat: Beat) => setSaid({ line: lineFor(beat, rng), mood: MOOD_OF[beat] }),
    [rng],
  )

  return { line: said.line, mood: said.mood, speak }
}

export function OrionBubble({
  line,
  reduced,
  width,
  height,
}: {
  readonly line: string
  readonly reduced: boolean
  readonly width: number
  readonly height: number
}) {
  return (
    <div className="relative" style={{ width, height }}>
      {/* Keyed remount rather than a crossfade, and the animation moves the line
          without ever hiding it. `AnimatePresence mode="wait"` would hold the new
          line back until the old one finished exiting, so a dropped frame leaves
          the bubble empty — the same trap the status line fell into (HUD.tsx). */}
      <motion.p
        key={line}
        initial={reduced ? false : { y: 8 }}
        animate={{ y: 0 }}
        transition={{ duration: reduced ? 0 : 0.22 }}
        className="flex h-full w-full items-center justify-center rounded-lg px-4 text-center text-sm leading-relaxed"
        style={{
          background: PALETTE.panel,
          outline: `1px solid ${PALETTE.panelEdge}`,
          color: PALETTE.starGlow,
        }}
      >
        {/* ORION names иєвυℓα in one of his round-clear lines, and BOOTH-9a's
            terminology puts γένεσις and 성도 in the rest — the bubble is `text-sm`,
            so Galmuri14 is the face, and it has no glyph for the Greek or the
            Cyrillic. Both are swapped for their sprites here (GDD 11-9). */}
        {withPixelWords(line, PALETTE.starGlow)}
      </motion.p>

      {/* The tail, aimed at ORION on the right. */}
      <span
        className="absolute"
        style={{
          right: -10,
          top: '50%',
          marginTop: -9,
          width: 0,
          height: 0,
          borderTop: '9px solid transparent',
          borderBottom: '9px solid transparent',
          borderLeft: `10px solid ${PALETTE.panelEdge}`,
        }}
      />
    </div>
  )
}

/**
 * GDD 11-4: the 60×78 map at 2×, which is the 120×156 the layout reserves.
 *
 * No frame and no background behind him. He stands on the void the way иєвυℓα
 * stands on the shop's — the placeholder that used to sit here had a bordered
 * gradient panel, and a character in a box reads as an icon rather than as somebody
 * watching the game.
 */
export function OrionSprite({
  mood,
  width,
  height,
}: {
  readonly mood: OrionMood
  readonly width: number
  readonly height: number
}) {
  return (
    <div className="flex items-end justify-center" style={{ width, height }}>
      <PixelSprite pixels={orionSprite(mood)} scale={2} alt="ORION" />
    </div>
  )
}
