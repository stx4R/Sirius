// The words on these screens that are drawn instead of typed (GDD 11-9).
//
// There are four: иєвυℓα, who has been drawn since BOOTH-2b, and the three
// BOOTH-9a terminology brought in — γένεσις for a placement, πειρασμός for a wager
// question and MЦLГЦS for the special chips.
//
// They are drawn for one measured reason, recorded in full beside the maps in
// `assets/pixels.ts`: Galmuri9 and Galmuri11 do cover the Greek and the Cyrillic,
// but **Galmuri14 and Galmuri11-Bold do not**, and index.css maps `text-sm` — the
// face every bubble, caption and explanation is set in — onto Galmuri14. Typed, the
// same word is dot text in one panel and antialiased system text in the next.
//
// The substitution happens at render, never in the tables. `dialogue.ts`, the wager
// generator and the coach copy all keep the real characters, so they stay plain
// readable data (CLAUDE.md §11), a screen reader announces the word, and a
// copy-paste off the screen still yields it.

import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
import { nebulaName, pixelWordMap } from '../assets/compose'
import type { PixelMap } from '../assets/compose'
import {
  PIXEL_GLYPH_BASELINE,
  PIXEL_GLYPH_HEIGHT,
  PIXEL_WORDS,
} from '../assets/pixels'
import { PixelSprite } from './PixelSprite'

/** GDD 11-9 fixes this spelling; this is the one place the literal is written. */
export const NEBULA_NAME_TEXT = 'иєвυℓα'

/** Rows of a BOOTH-9a map that hang below the baseline (γ ρ μ ς and Ц's tail). */
const DESCENDER_ROWS = PIXEL_GLYPH_HEIGHT - PIXEL_GLYPH_BASELINE

/** GDD 11-9: whole multiples only (CLAUDE.md §7). 2× is what 14px body text takes. */
export const PIXEL_WORD_SCALE = 2

/**
 * A drawn word standing in for a run of text.
 *
 * ★ `descenderRows` is the whole of the alignment. An inline-block's baseline is
 * the bottom of its box, so a map that ends on its baseline needs no correction —
 * which is why иєвυℓα, who has no descender, never needed one. A map with rows
 * *below* the baseline would otherwise hang its whole word two rows too high, so it
 * is pushed back down by exactly what hangs below.
 *
 * The 1px nudge on top of that is иєвυℓα's, kept for both: at 2× the dot grid of
 * the surrounding Galmuri sits a pixel low against a sprite's box edge.
 *
 * `aria-label` goes on the wrapper rather than the image so a screen reader says
 * the word once, not once per node.
 */
export function InlinePixelWord({
  pixels,
  label,
  descenderRows,
  scale = PIXEL_WORD_SCALE,
}: {
  readonly pixels: PixelMap
  readonly label: string
  readonly descenderRows: number
  readonly scale?: number
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-block align-baseline"
      style={{ transform: `translateY(${descenderRows * scale + 1}px)` }}
    >
      <PixelSprite pixels={pixels} scale={scale} />
    </span>
  )
}

/** One of γένεσις · πειρασμός · MЦLГЦS, in the colour of the line it sits in. */
export function PixelWordSprite({
  word,
  colour,
  scale = PIXEL_WORD_SCALE,
}: {
  readonly word: string
  readonly colour: string
  readonly scale?: number
}) {
  const pixels = useMemo(() => pixelWordMap(word, colour), [word, colour])
  return (
    <InlinePixelWord
      pixels={pixels}
      label={word}
      descenderRows={DESCENDER_ROWS}
      scale={scale}
    />
  )
}

/** Her name (GDD 11-9). No descender, so it sits on the baseline uncorrected. */
export function NebulaNameSprite({
  colour,
  scale = PIXEL_WORD_SCALE,
}: {
  readonly colour: string
  readonly scale?: number
}) {
  const pixels = useMemo(() => nebulaName(colour), [colour])
  return (
    <InlinePixelWord
      pixels={pixels}
      label={NEBULA_NAME_TEXT}
      descenderRows={0}
      scale={scale}
    />
  )
}

/**
 * Every drawn word, longest first.
 *
 * ★ Longest first matters. Split on a shorter word that is a prefix of a longer one
 * and the longer one comes apart mid-map; nothing in this list is a prefix of
 * another today, and ordering by length is what keeps that from becoming a bug the
 * next time a word is added.
 */
const DRAWN_WORDS: readonly string[] = [...PIXEL_WORDS, NEBULA_NAME_TEXT].sort(
  (a, b) => b.length - a.length,
)

/** Matches any drawn word. Rebuilt from the list above so the two cannot drift. */
const DRAWN_PATTERN = new RegExp(`(${DRAWN_WORDS.join('|')})`, 'g')

/**
 * Renders a line of text with every drawn word drawn.
 *
 * A speech bubble, a caption and a wager question are all plain strings, so the
 * substitution is done here rather than by turning those tables into JSX — the
 * tables stay data, which is what lets them be read and edited as text.
 *
 * Returns the string untouched when it holds none of the words, so the common case
 * costs one regex test and allocates nothing.
 */
export function withPixelWords(line: string, colour: string): ReactNode {
  const parts = line.split(DRAWN_PATTERN)
  if (parts.length === 1) return line

  return parts.map((part, i) => {
    if (part === NEBULA_NAME_TEXT) {
      return <NebulaNameSprite key={i} colour={colour} />
    }
    if ((PIXEL_WORDS as readonly string[]).includes(part)) {
      return <PixelWordSprite key={i} word={part} colour={colour} />
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}
