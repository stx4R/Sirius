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

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { PALETTE } from '../assets/palette'

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

export function Canvas({ children }: { readonly children: ReactNode }) {
  const scale = useCanvasScale()

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
        {children}
      </div>
    </div>
  )
}
