// иєвυℓα (GDD 11-9), who keeps the shop. ORION watches the play and never sells;
// she sells and never watches.
//
// The sprite is computed, not drawn — `nebulaSprite` builds the silhouette from
// geometry every time (GDD 11-9, and read docs/WIP.md before touching it). She
// has no face, so a reaction is the light out of the hood brightening, which is
// what `mood` selects.
//
// CLAUDE.md §8: her lines come from a generator of her own, seeded off the run's
// seed. Handing her `game.rng` would spend draws the deck and the drifter are
// counting on, and the same seed would stop replaying the same run.

import { motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { mulberry32 } from '../core/rng'
import { nebulaSprite } from '../assets/compose'
import { NEBULA_INK, PALETTE, mix } from '../assets/palette'
import type { NebulaMood } from '../assets/palette'
import { PixelSprite } from './PixelSprite'
import { shopLineFor } from './dialogue'
import type { ShopBeat } from './dialogue'

/** Her own offset, distinct from ORION's 0x5ee0, so the two never share a stream. */
const SPEECH_SEED_OFFSET = 0x2eb0

/**
 * What the light does after each beat. She has no expression to change, so the
 * hood answers instead: a sale brightens it, a shelf worth turning over interests
 * it, and everything else settles back (GDD 11-9).
 */
const MOOD_OF: Readonly<Record<ShopBeat, NebulaMood>> = {
  enter: 'idle',
  bought: 'dealt',
  reroll: 'keen',
  broke: 'idle',
  locked: 'keen',
  leave: 'idle',
}

export interface Nebula {
  readonly line: string
  readonly mood: NebulaMood
  readonly speak: (beat: ShopBeat) => void
}

export function useNebula(seed: number): Nebula {
  const rng = useMemo(() => mulberry32(seed ^ SPEECH_SEED_OFFSET), [seed])
  // Drawn from the same generator every later line comes from, so a visit has one
  // reproducible stream rather than two that start on the same value.
  const [state, setState] = useState(() => ({
    line: shopLineFor('enter', rng),
    mood: MOOD_OF.enter,
  }))

  const speak = useCallback(
    (beat: ShopBeat) => setState({ line: shopLineFor(beat, rng), mood: MOOD_OF[beat] }),
    [rng],
  )

  return { line: state.line, mood: state.mood, speak }
}

/**
 * Her bubble, pointing right at her. The edge is her own plum rather than the
 * panel grey ORION's uses — on the one screen she owns, the voice should look
 * like it belongs to the figure standing in it.
 *
 * Keyed remount rather than a crossfade, for the reason spelled out in Orion.tsx
 * and HUD.tsx: `AnimatePresence mode="wait"` leaves the bubble empty whenever a
 * frame is dropped mid-exit.
 */
export function NebulaBubble({
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
  const edge = mix(NEBULA_INK.veilFold, PALETTE.nebulaMagenta, 0.35)

  return (
    <div className="relative" style={{ width, height }}>
      <motion.p
        key={line}
        initial={reduced ? false : { y: 8 }}
        animate={{ y: 0 }}
        transition={{ duration: reduced ? 0 : 0.22 }}
        className="flex h-full w-full items-center justify-center rounded-lg px-4 text-center text-sm leading-relaxed"
        style={{ background: PALETTE.panel, outline: `1px solid ${edge}`, color: PALETTE.starWhite }}
      >
        {line}
      </motion.p>

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
          borderLeft: `10px solid ${edge}`,
        }}
      />
    </div>
  )
}

/**
 * GDD 11-9: the 60×78 map, scaled by whole numbers only (CLAUDE.md §7).
 *
 * `mood` is the only thing that changes the map, so the 4,680 cells are built
 * once per mood rather than on every render of the shop around her.
 */
export function NebulaSprite({
  mood,
  scale,
}: {
  readonly mood: NebulaMood
  readonly scale: number
}) {
  const pixels = useMemo(() => nebulaSprite(mood), [mood])
  return <PixelSprite pixels={pixels} scale={scale} alt="иєвυℓα" />
}
