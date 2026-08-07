// A fixed 1120×630 canvas, scaled to the window (GDD 11-10).
//
// The screen used to be a fluid web layout. On a 2560px monitor that left the
// board at its original size while everything else drifted to the edges, because
// only the board had a size in pixels — the rest was flex slack. Moving elements
// one at a time cannot fix that; the layout has to stop being fluid.
//
// So every element is placed on one logical 1120×630 plane and the whole plane is
// scaled. The proportions a booth participant sees are then the same on any
// machine, which is the only way three laptops of different sizes show the same
// game (GDD 12-2).

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { PALETTE } from '../assets/palette'
import { usePrefersReducedMotion } from './motion'

export const CANVAS_WIDTH = 1120
export const CANVAS_HEIGHT = 630

/**
 * Where everything sits on the plane. One table, so a change of mind about the
 * layout is a change to this object rather than a hunt through the components.
 * Mirrors the coordinate table in GDD 11-10.
 */
export const LAYOUT = {
  stardust: { x: 16, y: 12 },
  roundTurn: { y: 16 },
  status: { y: 48 },
  dev: { x: 1050, y: 12 },

  /** 5×72 cells plus four 2px seams (GDD 11-4). */
  board: { x: 40, y: 106, size: 368 },

  /**
   * Two by two, not a column. Four cards at 72×104 stack to 434px on their own,
   * but GDD 11-5 forbids showing a card without its name, condition and
   * multiplier — with the text each entry is ~150px, so a column of four runs
   * 624px and collides with the end-turn button. Two by two fits in 308.
   */
  // The label sits at y=70 rather than above the grid at 52: the card column
  // starts at x=432 and the status line is centred on 560, so a label up there
  // ran into it. Dropping the block 16px clears the status line and still leaves
  // the grid (292px) well short of the end-turn button.
  constellations: { x: 432, y: 94, cell: 72, gap: 8, label: { x: 432, y: 70 } },
  endTurn: { x: 432, y: 520, w: 88, h: 44 },

  /** Shifted 24px right of the original 560 to clear the 2×2 card grid. */
  settlement: { x: 584, y: 90, w: 516, h: 150 },
  equation: { right: 1096, y: 258 },
  roundTotal: { centre: 842, y: 330 },

  bubble: { x: 700, y: 470, w: 250, h: 90 },
  orion: { x: 980, y: 474, w: 120, h: 156 },

  hand: { x: 20, y: 496, w: 400, h: 104, label: { x: 20, y: 606 } },
} as const

/**
 * The shop (GDD 9-3), on the same plane and by the same rules. A second table
 * rather than more entries in the one above: the two screens never appear
 * together and share no element, so mixing them would mean reading past half the
 * list to find either layout.
 *
 * The shelf runs down the left, widest first — four chips, then two
 * constellation cards with the text GDD 11-5 will not let them go without, then
 * the two locked companion slots.
 *
 * иєвυℓα has the bottom-right corner, at 3× rather than ORION's 2×, standing to
 * the full height of the lower third. She is the only character on this screen
 * and it is her shop; at 2× in the top corner she was a small figure with a
 * quarter of the canvas empty beneath her. The panels that say what a purchase
 * would do to the deck sit above her, because that is the question every price
 * on the left is asking.
 *
 * Mirrors the shop coordinate table in GDD 11-10.
 */
export const SHOP_LAYOUT = {
  stardust: { x: 16, y: 12 },
  title: { y: 14 },
  note: { y: 44 },

  /** Four chips at 64px with a name and a price under each. */
  specials: { x: 24, y: 100, w: 600, h: 110, entry: 142, gap: 10, label: { x: 24, y: 82 } },
  /** Two cards laid out beside their text, with the buy button at the right edge. */
  constellations: { x: 24, y: 250, w: 600, h: 120, entry: 294, gap: 12, label: { x: 24, y: 232 } },
  /** Stocked, never sold (GDD 7-1-b). Same size as a constellation entry. */
  companions: { x: 24, y: 410, w: 600, h: 110, entry: 294, gap: 12, label: { x: 24, y: 392 } },
  reroll: { x: 24, y: 544, w: 200, h: 48 },
  leave: { x: 248, y: 544, w: 200, h: 48 },
  /** The line under the two buttons saying what a reroll has cost so far. */
  rerollNote: { x: 24, y: 602 },

  /** Five rows of 32: a 32px chip at 1× will not fit in less (GDD 11-4). */
  deck: { x: 664, y: 72, w: 440, h: 214 },
  /** BLACK-HOLE (GDD 2). STAR-CHART joins it here at P5 — GDD 8-1 puts them side by side. */
  inventory: { x: 664, y: 296, w: 440, h: 86 },
  bubble: { x: 664, y: 424, w: 256, h: 104 },
  /** 60×78 at 3×, planted on the bottom edge. */
  nebula: { x: 932, y: 396, w: 180, h: 234 },

  /**
   * The replacement prompt (GDD 6), centred over everything else when a fifth
   * constellation is bought. Sized here rather than inside the component so the
   * five cards it lays out — four held plus the incoming one — can be checked
   * against the plane without a browser.
   *
   * ★ `card` is the **entry footprint**, not the card image. The image is the
   * 36×52 map at 2× = 72×104 (GDD 11-4, and CLAUDE.md §7 allows nothing but whole
   * multiples); `card` adds the text column's width and the 4px padding either
   * side of it. Reading 96 as an image width would make it a 2.67× scale, which
   * is exactly the mistake the constant is named to prevent.
   *
   * It is a modal, so it is deliberately outside the pairwise overlap check —
   * see `tests/canvas.test.ts`.
   */
  replace: { y: 150, w: 648, h: 268, card: 96, cardImage: 72, gap: 12, arrow: 32 },
} as const

/** GDD 11-9: her pixel map is shown at this multiple in the shop (CLAUDE.md §7). */
export const NEBULA_SCALE = 3

/**
 * Integer scale, so a 32×32 chip lands on whole pixels and the dot grid stays a
 * dot grid (CLAUDE.md §7, GDD 11-4). 1366×768 gives a raw 1.22 and 2560×1440 a
 * raw 2.28, which floor to the 1× and 2× the layout was drawn for.
 *
 * Below 1× there is nothing to floor to, so a window smaller than the canvas gets
 * the fractional scale and soft pixels — a shrunken screen beats a clipped one.
 */
export function canvasScale(width: number, height: number): number {
  const raw = Math.min(width / CANVAS_WIDTH, height / CANVAS_HEIGHT)
  return raw >= 1 ? Math.floor(raw) : raw
}

export function useCanvasScale(): number {
  const [scale, setScale] = useState(() =>
    typeof window === 'undefined' ? 1 : canvasScale(window.innerWidth, window.innerHeight),
  )

  useEffect(() => {
    const measure = () => setScale(canvasScale(window.innerWidth, window.innerHeight))
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return scale
}

/** Absolute placement on the plane. Every child of `Canvas` goes through this. */
export function At({
  x,
  y,
  w,
  h,
  z,
  centre,
  children,
}: {
  readonly x: number
  readonly y: number
  readonly w?: number
  readonly h?: number
  readonly z?: number
  /** Centres the box on `x` instead of starting it there. */
  readonly centre?: boolean
  readonly children: ReactNode
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        zIndex: z,
        transform: centre ? 'translateX(-50%)' : undefined,
      }}
    >
      {children}
    </div>
  )
}

/**
 * How the plane arrives. Play and shop are separate mounts (see `Play` in
 * main.tsx), so this fires exactly once per screen change and reads as the
 * transition between them.
 *
 * It is an entrance only — there is no `AnimatePresence` pairing an exit with
 * it. `mode="wait"` holds the incoming screen back until the outgoing one
 * finishes leaving, and a dropped frame mid-exit then leaves nothing mounted at
 * all: the trap already sprung twice on the status line (HUD.tsx) and the speech
 * bubble (Orion.tsx). A screen that fades in over an instant swap cannot fail
 * that way.
 *
 * Opacity and a small rise, and no scale — the plane's scale is the integer one
 * the dot grid depends on (CLAUDE.md §7), and animating it would blur every
 * sprite on the way in.
 */
const ENTER = { opacity: 0, y: 12 }

export function Canvas({ children }: { readonly children: ReactNode }) {
  const scale = useCanvasScale()
  const reduced = usePrefersReducedMotion()

  return (
    // The leftover area is letterboxed in the void colour, so the canvas reads as
    // the whole game rather than as a panel floating on a page.
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden font-mono"
      style={{ background: PALETTE.void, color: PALETTE.starWhite }}
    >
      <div
        style={{
          position: 'relative',
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
        }}
      >
        <motion.div
          className="absolute inset-0"
          initial={reduced ? false : ENTER}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.32, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  )
}
