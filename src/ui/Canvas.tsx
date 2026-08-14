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
import { useReducedMotion } from './motion'

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

  /**
   * The DEV toggle, moved out of the top right at BOOTH-9b to make room for
   * STAR-CHART. It sits between the stardust readout (which ends at x=73) and the
   * round/turn line (which starts at x=487 at its widest), where nothing else has
   * ever been placed.
   *
   * ★ It is deliberately NOT in the slot the vertical STAR-CHART vacated. That slot
   * is to stay empty (BOOTH-9b), and `DEV_TOOLS` is `import.meta.env.DEV` — the
   * panel does not exist in a booth build at all, so parking it over a reserved
   * space would trade a real constraint for an imaginary convenience.
   */
  dev: { x: 88, y: 12 },

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
   * STAR-CHART (GDD 8-1), across the top right (BOOTH-9b).
   *
   * ★ It used to be a 108×380 column at (588, 244), and it was a column only
   * because 108px was the widest gap the plane had left. Removing the 처음으로 · ?
   * · DEV cluster freed the whole top right, so it is a row now and no longer has
   * to compress: all six of GDD 8-1's fields fit (see `StarChart.tsx`).
   *
   * Measured against the neighbours it actually has, at their worst case:
   *   · the round/turn line is centred on 560 and 146 wide at its widest → ends 634
   *   · the status line is centred on 560 and 120 wide at its widest → ends 620
   *   · the settlement panel starts at y=90
   * So the free rectangle is x 634…1120, y 0…90. This takes 656…1104 × 8…84 —
   * 22px clear of the round/turn line, 6px clear of the settlement panel, and the
   * same 16px margin off the right edge that the stardust readout has off the left.
   *
   * `cell` × 5 + the 8px of padding is exactly `w`, so every suit lands on whole
   * pixels (CLAUDE.md §7). The slot at (588, 244) is now empty and stays empty.
   */
  starChart: { x: 656, y: 8, w: 448, h: 76, cell: 88, bar: 56 },

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
   * ★ The ESC pause window (BOOTH-9c) — GDD 12-2 ①④, and the new home of the two
   * buttons BOOTH-9b took off this screen.
   *
   * The whole plane, not a card. Every other overlay here is a panel over a game
   * the player is still in the middle of; this one is the game stood down, so it
   * covers the plane in the void colour and a star field and reads as its own
   * screen — `docs/brand/title-screen-mock-1120x630.png`, one centred column.
   *
   * It is a modal, so it is outside the pairwise overlap check like the other six.
   * The two cards below are still built and are opened *from* this window rather
   * than from the play screen, so they draw above it at their own z (Coach.tsx,
   * Reset.tsx) and their coordinates are untouched.
   *
   * `menu` holds five 40px rows with 10px between them — 240px, which `settings`
   * is given as one block so the two pages occupy the same band and the window
   * does not change height when the player steps into the settings.
   */
  pause: {
    symbol: { y: 104 },
    heading: { y: 176 },
    menu: { x: 420, y: 232, w: 280, h: 40, gap: 10 },
    settings: { x: 340, y: 232, w: 440, h: 240, row: 40, control: 88 },
    hint: { y: 506 },
  },

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
   * The one-page summary — the five coach lines at rest, for a player who lost the
   * thread rather than one taking their first turn. A modal, so it is outside the
   * pairwise check like the other four.
   *
   * Opened from the pause window's 튜토리얼 시작 since BOOTH-9c; the ? button that
   * used to open it went with BOOTH-9b (see `pause` above).
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
 * The main page and its three sub-pages, on the same plane and by the same rules.
 * A third table for the same reason the shop has a second: it shares no element
 * with either of the other two screens, so mixing them would mean reading past two
 * layouts to find this one.
 *
 * ★ BOOTH-9d replaced the screen. It used to ask both of a run's questions at once
 * — mode and starting constellation, in one column — and it is now
 * `docs/brand/title-screen-mock-1120x630.png`: symbol, wordmark, four menu rows.
 * The starting constellation moved to a second page (`starting` below), because the
 * mock's menu has no room for it and GDD 13-5 will not let the choice be dropped.
 *
 * ★ EVERY FIGURE IN `symbol`, `wordmark` AND `menu` IS MEASURED OFF THE MOCK, not
 * chosen. The mock is 1120×630 — the canvas exactly — so its pixels are these
 * pixels. Ink bounding boxes, read off the PNG:
 *
 *     symbol      y  97…210   x 503…622   (120×114)
 *     wordmark    y 262…378   x 335…784   (450×117)
 *     게임 시작    y 432…451   x 511…603   ( 93× 20)
 *     부스 모드    y 472…489   x 513…604   ( 92× 18)
 *     도감        y 512…531   x 540…577   ( 38× 20)
 *     설정        y 552…571   x 540…578   ( 39× 20)
 *
 * The four rows are on a 40px pitch and every one of them is centred on x≈559.
 */
export const TITLE_LAYOUT = {
  /**
   * The 56×56 mark at **3×** (CLAUDE.md §7 allows nothing but whole multiples).
   *
   * ★ The scale is set from the *ink*, not from the box, and that is the whole
   * reason it is 3 rather than 2. The mark does not fill its own map: measured in
   * the browser, its ink is 46×38 of the 56×56 grid, starting 9 rows down. So 2×
   * draws a 112×112 box with only 76×70 showing — against the mock's 120×114 that
   * reads as a different, smaller logo. 3× puts 138×114 on screen, whose height is
   * the mock's exactly and whose width overshoots by 18 because this mark's
   * companion star reaches further out than the one in the picture.
   *
   * `y` is therefore the mock's ink top (97) minus the inset at this scale
   * (9 × 3 = 27). `tests/canvas.test.ts` derives it the same way rather than
   * hardcoding 70, so a change of scale cannot leave the mark hanging.
   */
  symbol: { y: 70, size: 56, scale: 3, inkInset: 9, inkWidth: 46, inkHeight: 38 },

  /**
   * 126px = Galmuri14 × 9, with 16px of letter-spacing — measured, not chosen.
   * The mock's wordmark is 450×117 of ink and this draws 451×118; ×8 gives 430×105
   * and ×10 gives 538×131. `index.css` maps the size to the face, and the sheet
   * says the wordmark *is* Galmuri14, so any other face would be a different
   * wordmark (GDD 11-10).
   *
   * It is still not drawn as a sprite: `Sirius` is six Latin letters and Galmuri
   * has all of them, so type at a whole multiple of the face's own grid reproduces
   * the sheet — and a drawn copy would be a second thing to keep in step.
   */
  wordmark: { x: 260, y: 258, w: 600, h: 126, tracking: 16 },

  /**
   * Four rows on the mock's 40px pitch, so the ink of each label lands on the row
   * the mock put it on. `gap` is 0 because the pitch *is* the row height: the rows
   * are flush, and only the hover fill shows where one ends.
   */
  menu: { x: 420, y: 422, w: 280, h: 40, gap: 0 },

  /**
   * The tagline (GDD 2, 11-10 sheet ①), at the foot of the page rather than under
   * the wordmark. The mock leaves 54px between the wordmark and the first menu row
   * and an 11px line there would sit 22px above `게임 시작` — close enough to read as
   * that row's caption. Down here it reads as the strapline it is, and the mock's
   * composition is untouched. See GDD 11-10.
   */
  tagline: { y: 600 },

  /** Top-left on every sub-page, so the way back is in one place. ESC does it too. */
  back: { x: 24, y: 24, w: 96, h: 32 },

  /**
   * The starting constellation (GDD 13-5), its own page since BOOTH-9d.
   *
   * The row is unchanged from the screen this came off — taller than a plain choice
   * row because GDD 11-5 will not let a constellation card appear without its name,
   * condition and multiplier, and this page adds a plain-language line on top of
   * those, since it is where a player who has never seen the game decides between
   * an axis they have no way to judge yet.
   */
  starting: {
    heading: { y: 118 },
    /** 주기(週期)'s one 병기 (GDD 2-3) travelled with the label it is on. */
    note: { y: 154 },
    x: 228,
    y: 194,
    w: 664,
    h: 184,
    entry: 320,
    gap: 24,
  },
  start: { x: 440, y: 418, w: 240, h: 56 },
  /** The line under the button saying why it will not press yet. */
  hint: { y: 496 },

  /**
   * The settings page (GDD 12-2-d), which is the pause window's page rendered on
   * this screen — same component, same session state (`Settings.tsx`).
   *
   * Its box is the same 440×240 the pause window gives it, so the one page is the
   * one size wherever it is opened.
   */
  settings: { heading: { y: 130 }, x: 340, y: 206, w: 440, h: 240, row: 40, control: 88 },
  settingsHint: { y: 480 },
} as const

/**
 * 도감 (BOOTH-9d) — the fourth thing on the main page's menu, and the only screen in
 * the game that is neither a run nor a menu.
 *
 * A header row, three tabs, and one body panel. Three tabs rather than one long
 * page because the alternative is scrolling: the twelve constellation cards alone
 * are two rows of 142px, and putting the chips and the companion table under them
 * would run past 630. Nothing here scrolls (GDD 11-10 — the plane does not reflow),
 * so what does not fit has to become a tab.
 */
export const CODEX_LAYOUT = {
  heading: { y: 28 },
  /** Three tabs, centred: 3 × 160 + 2 × 8 = 496, so x = (1120 − 496) / 2. */
  tabs: { x: 312, y: 76, w: 496, h: 36, entry: 160, gap: 8 },
  /** 40px margins left, right and bottom; the panel holds every tab's body. */
  body: { x: 40, y: 128, w: 1040, h: 462, pad: 16 },
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
  const reduced = useReducedMotion()

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
