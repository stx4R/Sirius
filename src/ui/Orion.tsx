// ORION (M42), the companion who watches the play (GDD 2, 11-8).
//
// The 48×64 sprite is P4 work (GDD 11-8), so what stands here is the speech
// bubble and the line inside it. Nothing he says reads or changes game state —
// the screen tells him which beat just happened and he answers with a line.

import { AnimatePresence, motion } from 'framer-motion'
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

export function OrionBubble({ line, reduced }: { readonly line: string; readonly reduced: boolean }) {
  return (
    <div className="flex items-end justify-end gap-2">
      <div className="relative max-w-64">
        <AnimatePresence mode="wait">
          <motion.p
            key={line}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: reduced ? 0 : 0.22 }}
            className="rounded-lg px-3 py-2 text-[11px] leading-relaxed"
            style={{
              background: PALETTE.panel,
              outline: `1px solid ${PALETTE.panelEdge}`,
              color: PALETTE.starGlow,
            }}
          >
            {line}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Stand-in for the 48×64 sprite, which GDD 11-8 books for P4. */}
      <div
        className="flex h-16 w-12 shrink-0 items-end justify-center rounded pb-1 text-[9px] font-bold tracking-wide"
        style={{
          background: `linear-gradient(180deg, ${PALETTE.nebulaHydrogen} 0%, ${PALETTE.nebulaPeriwinkle} 100%)`,
          color: PALETTE.void,
        }}
      >
        ORION
      </div>
    </div>
  )
}
