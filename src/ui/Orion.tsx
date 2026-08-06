// ORION (M42), the companion who watches the play (GDD 2, 11-8).
//
// The 60×78 sprite is P4 work (GDD 11-8), so what stands here is the frame at its
// final size plus the speech bubble. Nothing he says reads or changes game state
// — the screen tells him which beat just happened and he answers with a line.
//
// The bubble is placed to his left and points at him (GDD 11-10), so the two read
// as one figure speaking rather than as a caption that happens to be nearby.

import { motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { mulberry32 } from '../core/rng'
import { PALETTE } from '../assets/palette'
import { lineFor } from './dialogue'
import type { Beat } from './dialogue'

/**
 * Offsets ORION's generator from the one core plays the run with, so his lines
 * are reproducible for a seed without consuming draws that belong to the deck
 * (CLAUDE.md §8).
 */
const SPEECH_SEED_OFFSET = 0x5ee0

export interface Orion {
  readonly line: string
  readonly speak: (beat: Beat) => void
}

export function useOrion(seed: number): Orion {
  const rng = useMemo(() => mulberry32(seed ^ SPEECH_SEED_OFFSET), [seed])
  // Drawn from the same generator every later line comes from, so the run has one
  // reproducible stream of dialogue rather than two that start on the same value.
  const [line, setLine] = useState(() => lineFor('turnStart', rng))

  const speak = useCallback((beat: Beat) => setLine(lineFor(beat, rng)), [rng])

  return { line, speak }
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
        {line}
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
 * GDD 11-4: a 60×78 pixel map shown at 2×. The sprite itself lands at P4; this
 * holds the space at its final size so the layout does not move when it arrives.
 */
export function OrionSprite({ width, height }: { readonly width: number; readonly height: number }) {
  return (
    <div
      className="flex flex-col items-center justify-end rounded pb-2"
      style={{
        width,
        height,
        // GDD 11-8: red hydrogen glow over the blue reflection nebula.
        background: `linear-gradient(180deg, ${PALETTE.nebulaHydrogen} 0%, ${PALETTE.nebulaPeriwinkle} 100%)`,
        outline: `1px solid ${PALETTE.panelEdge}`,
      }}
    >
      <span className="text-[10px] font-bold tracking-wide" style={{ color: PALETTE.void }}>
        ORION
      </span>
      <span className="text-[8px]" style={{ color: PALETTE.void }}>
        60×78 · P4
      </span>
    </div>
  )
}
