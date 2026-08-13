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
  /**
   * `h` is the component's measured footprint — the "이번 주기 누적" label, the
   * 44px figure, the progress bar and the target line under it. It is here so the
   * coach caption that points up at this can be held clear of it
   * (`tests/canvas.test.ts`); nothing else reads it.
   */
  roundTotal: { centre: 842, y: 330, h: 100 },

  bubble: { x: 700, y: 470, w: 250, h: 90 },
  orion: { x: 980, y: 474, w: 120, h: 156 },

  hand: { x: 20, y: 496, w: 400, h: 104, label: { x: 20, y: 606 } },

  /**
   * STAR-CHART (GDD 8-1), in the only gap the plane has left.
   *
   * Measured, not guessed: with four constellations held — the GDD 6 limit, and
   * so the screen at its most crowded — the largest empty rectangle is 116×390 at
   * (584, 240). This sits inside it with 4px of air on every side that has a
   * neighbour: the 2×2 card grid ends at x=584, the settlement panel ends at
   * y=240, and the big round total starts at x≈700.
   *
   * That is why it is a column and not the shop's 440×214 panel — 108px will not
   * hold the shop's row, so the two screens draw the same numbers differently and
   * share only `drawChances`.
   */
  starChart: { x: 588, y: 244, w: 108, h: 380, row: 70, bar: 60 },

  /**
   * ORION'S WAGER (GDD 8-2), centred over the play screen. A modal, so it is
   * outside the pairwise overlap check for the same reason the shop's
   * replacement prompt is (GDD 11-10) — it covers the board it is asked over,
   * and there is nothing to do behind it until it is answered.
   *
   * `basis` is the row of counts the question is asked against (GDD 8-1, BOOTH-6c),
   * which is on the panel because the scrim behind it hides STAR-CHART.
   *
   * ★ 312 tall, down from 360 (BOOTH-6c). The old height was sized for six lines
   * of explanation, which BOOTH-6b's cut left as two — a hit outside the tutorial
   * window has no explanation at all and the box was most of the way empty. The
   * new figure is measured off the generator: the worst case is the conditional
   * tier at 84 characters of question and 101 of explanation, which is two lines
   * of each in this width. `tests/canvas.test.ts` holds the sum.
   *
   * The width is unchanged at 720 on purpose. 640 would wrap the same worst case
   * to two lines as well — but to exactly two, with no character to spare, and
   * `word-break: keep-all` (index.css) breaks Korean at spaces only, so a line
   * never fills to its last glyph. 720 leaves twelve characters of slack.
   */
  wager: { x: 200, y: 159, w: 720, h: 312, basis: 20 },

  /**
   * DRIFT ORACLE (GDD 8-3), on the same terms as the wager: a modal over the
   * board, so it is outside the pairwise overlap check.
   *
   * 80px taller than the wager because it carries a table the wager does not.
   * The tallest state is the one after an answer — question, the four rows of
   * GDD 8-3's table, the verdict and the reason, and the button under them, all
   * at once, because the table is what the reason is about and taking it away to
   * make room would leave the explanation talking about numbers that had gone.
   * ₄C₃ = 4 is the most rows there can ever be (GDD 3-3); `tests/canvas.test.ts`
   * holds the sum.
   */
  oracle: { x: 200, y: 95, w: 720, h: 440, row: 22 },

  /**
   * CONSTELLATION LOG (GDD 8-4), the third modal on this screen and much the
   * largest — it is a whole screen's worth of reading, shown once a round rather
   * than once a turn.
   *
   * Two columns, because one will not fit: the five suit bars and the
   * convergence series alone run past 350px, and the round summary, the wager
   * line and the three teaching sentences have to sit beside them rather than
   * under them. `series` is the row height of the convergence list, which is one
   * row per round played — eight in a full run (GDD 12-3), the figure `h` is
   * sized against.
   */
  report: { x: 80, y: 75, w: 960, h: 480, row: 28, series: 22 },

  /**
   * The ? button (GDD 12-2 ①), always there. Left of the dev toggle at x=1050 so
   * the two never sit on each other in a development build; in a production one
   * `DEV_TOOLS` is compiled out and this is the only thing in the corner.
   */
  help: { x: 1012, y: 12, size: 28 },

  /**
   * The mid-run reset (GDD 12-2 ④, BOOTH-7). Left of the ? button, on the same
   * baseline and the same height, so the corner reads as one row of controls
   * rather than as a button that wandered in.
   *
   * ★ The 8px gap to the ? is the whole of the placement decision, and it was
   * measured rather than picked: 944 + 60 = 1004 against the ? at 1012. Any wider
   * a label and the two touch; `tests/canvas.test.ts` holds the sum, and the box
   * is in the pairwise check because — like the ? — it is always on screen.
   *
   * The shop carries the same control at the same coordinate (`SHOP_LAYOUT.reset`),
   * so a participant who wants out does not have to find a different corner
   * depending on which screen they are stranded on.
   */
  reset: { x: 944, y: 12, w: 60, h: 28 },

  /**
   * The confirmation the reset asks for (GDD 12-2 ④). A modal, so it is outside
   * the pairwise check like the other five.
   *
   * It exists because the button is one click from throwing a run away, and the
   * booth's failure case is a participant losing twenty minutes of play to a
   * misclick — not an operator having to press one more button.
   */
  resetCard: { x: 380, y: 231, w: 360, h: 168 },

  /**
   * The one-page summary the ? button opens — the five coach lines at rest, for a
   * player who lost the thread rather than one taking their first turn. A modal,
   * so it is outside the pairwise check like the other four.
   */
  helpCard: { x: 280, y: 155, w: 560, h: 320 },

  /**
   * The first-round coach marks (GDD 12-2 ①, BOOTH-6b).
   *
   * Each step is a caption with a caret, sitting beside the thing it points at.
   * Overlays, so they are outside the pairwise check for the reason the modals
   * are — each one covers a corner of what it is about, and it is gone the moment
   * the action it asks for happens. They are `pointer-events-none`, so a player
   * who ignores them entirely plays a normal game.
   *
   * `wager` sits under the wager modal (which ends at y=495) and points up at it;
   * `board` sits above the 5×5 chart; `hand` and `limit` share a slot above the
   * fan, because both are about the chips in it and the counter under it — they
   * never appear together, so it reads as one caption changing its line rather
   * than two panels. `target` points up at the round total.
   *
   * ★ These were measured on screenshots, not derived. `limit` first sat over the
   * end-turn button and covered a STAR-CHART row doing it, and `target` sat on the
   * "목표 490" line it was naming. A caption that hides its own subject is worse
   * than none. `tests/canvas.test.ts` now holds each one clear of what it points at.
   */
  coach: {
    h: 40,
    steps: {
      wager: { x: 360, y: 503, w: 400, caret: 'up' },
      hand: { x: 20, y: 450, w: 400, caret: 'down' },
      board: { x: 24, y: 62, w: 400, caret: 'down' },
      limit: { x: 20, y: 450, w: 400, caret: 'down' },
      target: { x: 700, y: 444, w: 280, caret: 'up' },
    },
  },
} as const

/** GDD 3-3: four neighbours is ₄C₃ = 4 readings, and nothing produces more. */
export const ORACLE_MAX_ROWS = 4

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
  /**
   * The mid-run reset (GDD 12-2 ④, BOOTH-7), at the same coordinate it has on the
   * play screen. The shop has no ? button, so this is the only thing in the
   * corner here — it is kept at 944 rather than moved into the empty 1012 slot so
   * that the control does not appear to jump between the two screens.
   */
  reset: { x: 944, y: 12, w: 60, h: 28 },
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
 * The title screen, on the same plane and by the same rules. A third table for
 * the same reason the shop has a second: it shares no element with either of the
 * other two screens, so mixing them would mean reading past two layouts to find
 * this one.
 *
 * One column down the middle, in the order the player has to decide things:
 * the game's name, then the mode, then the starting constellation, then the
 * button that commits both. Nothing is offered to the side of anything else —
 * a booth participant reads this unaided (GDD 12-2), and a single column has
 * only one place the eye can go next.
 *
 * The two choice rows are the same width and sit at the same x, so the second
 * question looks like a continuation of the first rather than a new screen.
 * `entry` is one option's footprint and `w` holds two of them plus the gap.
 */
/**
 * ★ The lower block sits 36px further down than it did before BOOTH-9a, and the
 * title block above it is 126px tall rather than 78.
 *
 * The text `Sirius` became the logo sheet's vertical lockup (GDD 11-10) — the symbol
 * over the wordmark, with the tagline under it — and three stacked elements do not
 * fit in the space one line of type occupied. The 36px came out of the bottom
 * margin, which was 68px of nothing below the hint; it is now 32px, and every box
 * below the title moved by the same amount so the column's own spacing is untouched.
 */
const TITLE_SHIFT = 36

export const TITLE_LAYOUT = {
  /**
   * The vertical lockup (GDD 11-10, sheet ①). Three boxes rather than one, because
   * the symbol is a sprite, the wordmark is type and the tagline is a third size —
   * and a sprite cannot be centred on a text baseline by guessing.
   *
   * `symbol` is the 56×56 map at 1×: a whole multiple (CLAUDE.md §7), and the
   * largest one that leaves the wordmark room above the mode row.
   *
   * `wordmark` is 42px — Galmuri14 at 3×, which is what the sheet says the wordmark
   * *is* ("워드마크: Galmuri14"). It is not drawn: Sirius is six Latin letters and
   * Galmuri has all of them, so type at a whole multiple of the face's own grid
   * reproduces the sheet exactly, and drawing it would be a second copy to keep in
   * step. 44px would land on Galmuri11 instead (index.css maps size → face).
   */
  symbol: { y: 34, size: 56 },
  wordmark: { x: 260, y: 94, w: 600, h: 44 },
  tagline: { y: 146 },

  mode: {
    x: 228,
    y: 148 + TITLE_SHIFT,
    w: 664,
    h: 76,
    entry: 320,
    gap: 24,
    label: { x: 228, y: 126 + TITLE_SHIFT },
  },
  /**
   * Taller than the mode row because GDD 11-5 will not let a constellation card
   * appear without its name, condition and multiplier — and this screen adds a
   * plain-language line on top of those, since it is where a player who has
   * never seen the game decides between an axis they have no way to judge yet.
   */
  starting: {
    x: 228,
    y: 268 + TITLE_SHIFT,
    w: 664,
    h: 184,
    entry: 320,
    gap: 24,
    label: { x: 228, y: 246 + TITLE_SHIFT },
  },
  start: { x: 440, y: 476 + TITLE_SHIFT, w: 240, h: 56 },
  /** The line under the button saying why it will not press yet. */
  hint: { y: 548 + TITLE_SHIFT },
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
