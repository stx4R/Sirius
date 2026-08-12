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
import { Fragment, useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { mulberry32 } from '../core/rng'
import { nebulaName, nebulaSprite } from '../assets/compose'
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
  // Handing the drifter over is a transaction as far as she is concerned
  // (GDD 13-4), so the hood lights the way it does on a sale.
  gift: 'dealt',
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

/**
 * `opening` is the beat she greets this visit with. It is a parameter rather
 * than always `enter` because the first visit is the one that hands the drifter
 * over (GDD 13-4), and that has to be said as the screen opens — a greeting
 * followed by an explanation would be two bubbles for one arrival.
 */
export function useNebula(seed: number, opening: ShopBeat): Nebula {
  const rng = useMemo(() => mulberry32(seed ^ SPEECH_SEED_OFFSET), [seed])
  // Drawn from the same generator every later line comes from, so a visit has one
  // reproducible stream rather than two that start on the same value.
  const [state, setState] = useState(() => ({
    line: shopLineFor(opening, rng),
    mood: MOOD_OF[opening],
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
        // `npm run shot` reads this to check the first visit really opened on the
        // drifter's line rather than on the usual greeting (GDD 13-4).
        data-panel="nebula"
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

/**
 * Her name, drawn rather than typed (GDD 11-9). Galmuri has no glyph for any of
 * и є в υ ℓ α, so the browser falls back per character and the name renders in a
 * smooth system font beside the dot Hangul it is written into.
 *
 * It is an inline sprite standing in for a run of text, so it takes the colour of
 * the line it sits in and is nudged onto that line's baseline — the map has no
 * descender, and without the nudge it rides high against the Hangul beside it.
 * `alt` keeps the real spelling in the accessibility tree and in a copy-paste.
 */
/** GDD 11-9 fixes the spelling; this is the one place the literal is written. */
const NEBULA_NAME_TEXT = 'иєвυℓα'

export function NebulaName({
  colour,
  scale = 2,
}: {
  readonly colour: string
  readonly scale?: number
}) {
  const pixels = useMemo(() => nebulaName(colour), [colour])
  return (
    // The name is on the wrapper, not the image, so a screen reader announces
    // "иєвυℓα" once rather than once per node. The map is the whole word.
    <span
      role="img"
      aria-label={NEBULA_NAME_TEXT}
      className="inline-block align-baseline"
      style={{ transform: 'translateY(1px)' }}
    >
      <PixelSprite pixels={pixels} scale={scale} />
    </span>
  )
}

/**
 * Renders a line of dialogue with her name drawn instead of typed.
 *
 * ORION says it too (`dialogue.ts`), and a speech bubble is a plain string, so
 * the substitution happens at render rather than by turning the dialogue table
 * into JSX — the tables stay data, which is what lets them be read and edited as
 * text (CLAUDE.md §11).
 */
export function withNebulaName(line: string, colour: string): ReactNode {
  const parts = line.split(NEBULA_NAME_TEXT)
  if (parts.length === 1) return line

  return parts.map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <NebulaName colour={colour} />}
      {part}
    </Fragment>
  ))
}
