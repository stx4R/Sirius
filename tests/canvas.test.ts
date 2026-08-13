import { describe, expect, it } from 'vitest'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  LAYOUT,
  NEBULA_SCALE,
  ORACLE_MAX_ROWS,
  SHOP_LAYOUT,
  TITLE_LAYOUT,
  canvasScale,
} from '../src/ui/Canvas'
import { COACH_ORDER } from '../src/ui/Coach'
import { RESET_CONFIRM } from '../src/ui/Reset'
import { DECK_NAME_COLUMN } from '../src/ui/Shop'
import { CARD_WIDTH, NEBULA_HEIGHT, NEBULA_WIDTH, SIRIUS_SIZE } from '../src/assets/pixels'
import {
  MODE_PRESETS,
  OWNED_CONSTELLATION_LIMIT,
  STARTING_CONSTELLATION_CHOICES,
  SUIT_STAR_NAMES,
} from '../src/core/config'
import { SUIT_ORDER } from '../src/core/types'

describe('canvas scale (GDD 11-10)', () => {
  // CLAUDE.md §7 allows integer scaling only: a 32×32 chip drawn at 1.22× lands
  // between pixels and the dot grid stops being a grid.
  it('lands on whole numbers at the two sizes the game is played on', () => {
    expect(canvasScale(1366, 768)).toBe(1)
    expect(canvasScale(2560, 1440)).toBe(2)
    expect(canvasScale(1920, 1080)).toBe(1)
    expect(canvasScale(3840, 2160)).toBe(3)
  })

  it('takes the tighter of the two axes, so nothing is clipped', () => {
    // Wide but short: height decides, and 700/630 floors to 1.
    expect(canvasScale(4000, 700)).toBe(1)
    // Tall but narrow: width decides.
    expect(canvasScale(1200, 4000)).toBe(1)
  })

  it('falls back to a fractional scale only below 1×, where flooring would give 0', () => {
    const small = canvasScale(560, 315)

    expect(small).toBeCloseTo(0.5)
    expect(small).toBeGreaterThan(0)
  })
})

describe('canvas layout (GDD 11-10)', () => {
  const boxes = {
    board: { x: LAYOUT.board.x, y: LAYOUT.board.y, w: LAYOUT.board.size, h: LAYOUT.board.size },
    endTurn: { x: LAYOUT.endTurn.x, y: LAYOUT.endTurn.y, w: LAYOUT.endTurn.w, h: LAYOUT.endTurn.h },
    settlement: {
      x: LAYOUT.settlement.x,
      y: LAYOUT.settlement.y,
      w: LAYOUT.settlement.w,
      h: LAYOUT.settlement.h,
    },
    bubble: { x: LAYOUT.bubble.x, y: LAYOUT.bubble.y, w: LAYOUT.bubble.w, h: LAYOUT.bubble.h },
    orion: { x: LAYOUT.orion.x, y: LAYOUT.orion.y, w: LAYOUT.orion.w, h: LAYOUT.orion.h },
    hand: { x: LAYOUT.hand.x, y: LAYOUT.hand.y, w: LAYOUT.hand.w, h: LAYOUT.hand.h },
    starChart: {
      x: LAYOUT.starChart.x,
      y: LAYOUT.starChart.y,
      w: LAYOUT.starChart.w,
      h: LAYOUT.starChart.h,
    },
    // The 2×2 card grid at the ownership limit (GDD 6) — the screen at its most
    // crowded, which is what STAR-CHART has to fit beside. 142 is the measured
    // entry height; see the test below that depends on the same figure.
    constellations: {
      x: LAYOUT.constellations.x,
      y: LAYOUT.constellations.y,
      w: LAYOUT.constellations.cell * 2 + LAYOUT.constellations.gap,
      h: 142 * 2 + LAYOUT.constellations.gap,
    },
    // BOOTH-6b: the ? button is always on screen (GDD 12-2 ①), so unlike the
    // coach captions it is not an overlay and belongs in the pairwise check.
    help: { x: LAYOUT.help.x, y: LAYOUT.help.y, w: LAYOUT.help.size, h: LAYOUT.help.size },
    // BOOTH-7: the mid-run reset (GDD 12-2 ④), in the check for the same reason.
    reset: { x: LAYOUT.reset.x, y: LAYOUT.reset.y, w: LAYOUT.reset.w, h: LAYOUT.reset.h },
  }

  it('keeps every placed box on the plane', () => {
    for (const [name, box] of Object.entries(boxes)) {
      expect(box.x, `${name} left`).toBeGreaterThanOrEqual(0)
      expect(box.y, `${name} top`).toBeGreaterThanOrEqual(0)
      expect(box.x + box.w, `${name} right`).toBeLessThanOrEqual(CANVAS_WIDTH)
      expect(box.y + box.h, `${name} bottom`).toBeLessThanOrEqual(CANVAS_HEIGHT)
    }
  })

  // The 2×2 card grid is why the settlement panel sits at 584 rather than 560.
  it('clears the constellation grid of the settlement panel', () => {
    const gridRight = LAYOUT.constellations.x + LAYOUT.constellations.cell * 2 + LAYOUT.constellations.gap

    expect(gridRight).toBeLessThanOrEqual(LAYOUT.settlement.x)
  })

  // Measured: a card with its mandatory text is 142px tall, so 2×2 is 292px.
  it('leaves the 2×2 card grid clear of the end-turn button under it', () => {
    const CARD_ENTRY = 142
    const gridBottom =
      LAYOUT.constellations.y + CARD_ENTRY * 2 + LAYOUT.constellations.gap

    expect(gridBottom).toBeLessThanOrEqual(LAYOUT.endTurn.y)
    // The column of four the coordinates first called for does not fit: it runs
    // past both the button and the plane, which is why the grid is 2×2.
    expect(LAYOUT.constellations.y + CARD_ENTRY * 4 + LAYOUT.constellations.gap * 3).toBeGreaterThan(
      CANVAS_HEIGHT,
    )
  })

  it('keeps the constellation label below the centred status line', () => {
    expect(LAYOUT.constellations.label.y).toBeGreaterThan(LAYOUT.status.y + 12)
  })

  it('keeps the hand clear of the board above it and the end-turn button beside it', () => {
    expect(LAYOUT.hand.y).toBeGreaterThanOrEqual(LAYOUT.board.y + LAYOUT.board.size)
    expect(LAYOUT.hand.x + LAYOUT.hand.w).toBeLessThanOrEqual(LAYOUT.endTurn.x)
  })

  it('seats the bubble to ORION and leaves them touching', () => {
    const gap = LAYOUT.orion.x - (LAYOUT.bubble.x + LAYOUT.bubble.w)

    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThanOrEqual(40)
  })

  // BOOTH-2b: STAR-CHART went into the one gap the plane had left, so from here
  // the play screen gets the same pairwise check the shop has had.
  it('overlaps nothing', () => {
    const entries = Object.entries(boxes)
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [nameA, a] = entries[i]
        const [nameB, b] = entries[j]
        const apart =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y

        expect(apart, `${nameA} overlaps ${nameB}`).toBe(true)
      }
    }
  })

  // GDD 8-1's panel sits in measured free space: 116×390 at (584, 240), taken
  // with four constellations held. If it ever stops fitting inside that, it is
  // overlapping something the box list above does not name.
  it('keeps STAR-CHART inside the gap that was measured for it', () => {
    const gap = { x: 584, y: 240, w: 116, h: 390 }
    const panel = LAYOUT.starChart

    expect(panel.x).toBeGreaterThanOrEqual(gap.x)
    expect(panel.y).toBeGreaterThanOrEqual(gap.y)
    expect(panel.x + panel.w).toBeLessThanOrEqual(gap.x + gap.w)
    expect(panel.y + panel.h).toBeLessThanOrEqual(gap.y + gap.h)
  })

  it('gives STAR-CHART room for its five suit rows and a header', () => {
    const panel = LAYOUT.starChart
    const PADDING = 4 * 2
    const HEADER = 12

    expect(panel.row * 5 + HEADER + PADDING).toBeLessThanOrEqual(panel.h)
    // The bar has to leave room for the percentage beside it.
    expect(panel.bar).toBeLessThan(panel.w - PADDING)
  })

  // BOOTH-6b: GDD 8-1 puts the full star name on this panel too, and 108px is the
  // reason it was not there before. The name goes under the three-letter code, in
  // the column beside the 32px chip, at the 9px face.
  it('fits the longest star name in the vertical STAR-CHART column', () => {
    const panel = LAYOUT.starChart
    const PADDING = 4 * 2
    const CHIP = 32
    const GAP = 4
    // Galmuri9, and the canvas tests take a Latin glyph at the face's own size as
    // the conservative width (see the oracle row below). Gacrux and Mimosa are the
    // longest of the five at six glyphs.
    const longest = Math.max(...SUIT_ORDER.map((suit) => SUIT_STAR_NAMES[suit].length))

    expect(longest).toBe(6)
    expect(CHIP + GAP + longest * 9).toBeLessThanOrEqual(panel.w - PADDING)
    // Code (11) over name (9) over count (9), against the row height.
    expect(11 + 9 + 9).toBeLessThanOrEqual(panel.row)
  })

  it('places STAR-CHART on whole pixels', () => {
    for (const value of Object.values(LAYOUT.starChart)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  // BOOTH-3b: ORION'S WAGER (GDD 8-2) is a modal, so it is deliberately absent
  // from `boxes` above — it covers the board it is asked over, which GDD 11-10
  // exempts from the pairwise check. The two things asked of a modal instead:
  // it lands on the plane, and its content lands inside it.
  it('centres the wager on the plane and keeps it inside', () => {
    const panel = LAYOUT.wager

    expect(panel.x + panel.w / 2).toBe(CANVAS_WIDTH / 2)
    expect(panel.y + panel.h / 2).toBe(CANVAS_HEIGHT / 2)
    expect(panel.x).toBeGreaterThanOrEqual(0)
    expect(panel.y).toBeGreaterThanOrEqual(0)
    expect(panel.x + panel.w).toBeLessThanOrEqual(CANVAS_WIDTH)
    expect(panel.y + panel.h).toBeLessThanOrEqual(CANVAS_HEIGHT)
  })

  // The answered state is the tallest the box gets (GDD 8-2 shows the explanation
  // in place of the buttons), and every figure below is measured off the generator
  // rather than guessed. BOOTH-6c: the worst case is the conditional tier at 84
  // characters of question and 101 of explanation — the longest either has ever
  // produced over the 300-deck sample tests/wager.test.ts uses.
  const WAGER_MAX_QUESTION = 84
  const WAGER_MAX_EXPLANATION = 101
  /** Korean at this face is one glyph per point of size (GDD 11-7's dot font). */
  const wrap = (chars: number, column: number, glyph: number) =>
    Math.max(1, Math.ceil(chars / Math.floor(column / glyph)))

  it('holds the question, the counts, the verdict and the explanation at once', () => {
    const panel = LAYOUT.wager
    const PADDING = 20 * 2
    const column = panel.w - PADDING
    // Five children in the answered state, so four gaps.
    const GAPS = 16 * 4
    const HEADER = 14
    const QUESTION = 23 * wrap(WAGER_MAX_QUESTION, column, 14)
    const VERDICT = 26
    const EXPLANATION = 18 * wrap(WAGER_MAX_EXPLANATION, column, 11)
    const BUTTON = 40

    expect(
      HEADER + QUESTION + panel.basis + VERDICT + EXPLANATION + BUTTON + GAPS + PADDING,
    ).toBeLessThanOrEqual(panel.h)
  })

  // The open state: the question, the counts, three buttons and the line under them.
  it('holds the question, the counts and the three answers at once', () => {
    const panel = LAYOUT.wager
    const PADDING = 20 * 2
    const column = panel.w - PADDING
    const GAPS = 16 * 3
    const HEADER = 14
    const QUESTION = 23 * wrap(WAGER_MAX_QUESTION, column, 14)
    const BUTTONS = 40
    const HINT = 14

    expect(
      HEADER + QUESTION + panel.basis + BUTTONS + HINT + GAPS + PADDING,
    ).toBeLessThanOrEqual(panel.h)
  })

  // BOOTH-6c cut the height and left the width alone. 640 would also wrap the
  // longest question to two lines — but to *exactly* two, with no character to
  // spare, and the character model is optimistic: `word-break: keep-all` (index.css)
  // breaks Korean at spaces only, so a line never fills to its last glyph. A fit
  // with zero slack is not a fit.
  it('leaves the longest question slack inside its two lines', () => {
    const column = LAYOUT.wager.w - 20 * 2
    const perLine = Math.floor(column / 14)

    expect(wrap(WAGER_MAX_QUESTION, column, 14)).toBe(2)
    expect(perLine * 2 - WAGER_MAX_QUESTION).toBeGreaterThanOrEqual(8)
  })

  // BOOTH-6c: the counts row exists because the scrim hides STAR-CHART, so the
  // panel has to be wide enough for the widest one — two suits, each with its
  // 16px symbol and its full star name, beside the deck total.
  it('fits the widest row of counts the question can ask about', () => {
    const panel = LAYOUT.wager
    const PADDING = 20 * 2
    const LABEL = 5 * 9
    const DECK_TOTAL = 8 * 11
    const longest = Math.max(...SUIT_ORDER.map((suit) => SUIT_STAR_NAMES[suit].length))
    // '⬤Gacrux 10장' — the glyph, then the name and the count at 11px.
    const ENTRY = 16 + 4 + (longest + 4) * 11
    const GAPS = 12 * 3

    expect(LABEL + DECK_TOTAL + ENTRY * 2 + GAPS).toBeLessThanOrEqual(panel.w - PADDING)
  })

  it('places the wager on whole pixels', () => {
    for (const value of Object.values(LAYOUT.wager)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  // BOOTH-4b: DRIFT ORACLE (GDD 8-3) is the second modal on this screen, so it
  // is out of `boxes` for the same reason the wager is, and gets the same two
  // checks — on the plane, and its content inside it.
  it('centres the oracle on the plane and keeps it inside', () => {
    const panel = LAYOUT.oracle

    expect(panel.x + panel.w / 2).toBe(CANVAS_WIDTH / 2)
    expect(panel.y + panel.h / 2).toBe(CANVAS_HEIGHT / 2)
    expect(panel.x).toBeGreaterThanOrEqual(0)
    expect(panel.y).toBeGreaterThanOrEqual(0)
    expect(panel.x + panel.w).toBeLessThanOrEqual(CANVAS_WIDTH)
    expect(panel.y + panel.h).toBeLessThanOrEqual(CANVAS_HEIGHT)
  })

  // The worst case is the state after an answer, and it is the worst case
  // because the table does not go away to make room for the explanation — the
  // reason is about the numbers in it. ₄C₃ = 4 is the most rows GDD 3-3 can
  // produce, so this is the whole panel at its tallest.
  it('holds the question, the four-row table, the verdict and the reason at once', () => {
    const panel = LAYOUT.oracle
    const PADDING = 20 * 2
    const GAPS = 12 * 5
    const HEADER = 14
    const QUESTION = 23 * 2
    const TABLE = 18 + panel.row * ORACLE_MAX_ROWS
    const VERDICT = 26
    const EXPLANATION = 18 * 5
    const BUTTON = 40

    expect(
      HEADER + QUESTION + TABLE + VERDICT + EXPLANATION + BUTTON + GAPS + PADDING,
    ).toBeLessThanOrEqual(panel.h)
  })

  // The widest row is a drifter reading three special chips: five suit codes in
  // the middle column, with the direction, score and probability columns fixed
  // around it (GDD 3-3).
  it('fits the widest table row a drifter can produce', () => {
    const panel = LAYOUT.oracle
    const PADDING = 20 * 2
    const FIXED = 92 + 64 + 72
    // 'GAC, IMA, GIN, MIM, ACR' — 23 characters, and an 11px Galmuri glyph is
    // 11px wide for a Latin capital at this size.
    const WIDEST_SUITS = 23 * 11

    expect(FIXED + WIDEST_SUITS).toBeLessThanOrEqual(panel.w - PADDING)
  })

  // The oracle is taller than the wager and they are both centred, so it is the
  // one that decides how much of the plane a modal covers.
  it('is taller than the wager and still leaves the plane a margin', () => {
    expect(LAYOUT.oracle.h).toBeGreaterThan(LAYOUT.wager.h)
    expect(LAYOUT.oracle.y).toBeGreaterThan(0)
  })

  it('places the oracle on whole pixels', () => {
    for (const value of Object.values(LAYOUT.oracle)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  // BOOTH-5: CONSTELLATION LOG (GDD 8-4) is the third modal, and the largest.
  // Same two checks as the other two — on the plane, content inside it.
  it('centres the report on the plane and keeps it inside', () => {
    const panel = LAYOUT.report

    expect(panel.x + panel.w / 2).toBe(CANVAS_WIDTH / 2)
    expect(panel.y + panel.h / 2).toBe(CANVAS_HEIGHT / 2)
    expect(panel.x).toBeGreaterThanOrEqual(0)
    expect(panel.y).toBeGreaterThanOrEqual(0)
    expect(panel.x + panel.w).toBeLessThanOrEqual(CANVAS_WIDTH)
    expect(panel.y + panel.h).toBeLessThanOrEqual(CANVAS_HEIGHT)
  })

  // The tallest the right-hand column gets is a full run: five suit rows, then
  // one convergence row per round played. Eight rounds is the longest mode
  // (GDD 12-3), so that is the case the height has to hold.
  it('holds five suit rows and a convergence row per round of the longest run', () => {
    const panel = LAYOUT.report
    const PADDING = 20 * 2
    const GAPS = 12 * 3
    const HEADER = 14
    const SUIT_HEADER = 16
    const SUITS = panel.row * SUIT_ORDER.length
    const SERIES_HEADER = 16
    const SERIES = panel.series * MODE_PRESETS.full.TOTAL_ROUNDS
    const BUTTON = 40

    expect(
      HEADER + SUIT_HEADER + SUITS + SERIES_HEADER + SERIES + BUTTON + GAPS + PADDING,
    ).toBeLessThanOrEqual(panel.h)
  })

  // The left column carries the round summary, the wager line and the three
  // teaching sentences; the right carries the bars. They sit side by side, so
  // the two columns plus the gap have to fit the width.
  it('fits both columns of the report across it', () => {
    const panel = LAYOUT.report
    const PADDING = 20 * 2
    const COLUMN_GAP = 20
    const LEFT = 360
    // Suit code, the 240px track, and the "24 / 20.0" figure beside it.
    const RIGHT = 36 + 240 + 96 + 8 * 2

    expect(LEFT + COLUMN_GAP + RIGHT).toBeLessThanOrEqual(panel.w - PADDING)
  })

  // It covers the whole play screen rather than sitting in a gap, so it is the
  // largest of the three modals and the one that decides how much is hidden.
  it('is the largest of the three modals', () => {
    expect(LAYOUT.report.w).toBeGreaterThan(LAYOUT.oracle.w)
    expect(LAYOUT.report.h).toBeGreaterThan(LAYOUT.oracle.h)
  })

  it('places the report on whole pixels', () => {
    for (const value of Object.values(LAYOUT.report)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  // BOOTH-6b: the coach captions (GDD 12-2 ①) are overlays, so they are out of
  // `boxes` for the reason the three modals are — each sits over a corner of the
  // thing it points at. The two things asked of an overlay instead: it lands on
  // the plane, and it lands where it says it points.
  it('keeps every coach caption on the plane', () => {
    for (const [name, spot] of Object.entries(LAYOUT.coach.steps)) {
      expect(spot.x, `${name} left`).toBeGreaterThanOrEqual(0)
      expect(spot.y, `${name} top`).toBeGreaterThanOrEqual(0)
      expect(spot.x + spot.w, `${name} right`).toBeLessThanOrEqual(CANVAS_WIDTH)
      expect(spot.y + LAYOUT.coach.h, `${name} bottom`).toBeLessThanOrEqual(CANVAS_HEIGHT)
    }
  })

  // A caret that points up has to have its subject above it and vice versa, and
  // the caption must not cover that subject. Both failed on the first pass — see
  // the note on LAYOUT.coach.
  it('seats each caption beside what its caret points at', () => {
    const steps = LAYOUT.coach.steps
    const bottom = (y: number) => y + LAYOUT.coach.h

    // 'wager' points up at the modal, which ends at 495; the caption starts below it.
    expect(steps.wager.caret).toBe('up')
    expect(steps.wager.y).toBeGreaterThanOrEqual(LAYOUT.wager.y + LAYOUT.wager.h)

    // 'hand' and 'limit' share the slot above the fan, pointing down at it and at
    // the placement counter under it. They never appear together (see coachStep).
    for (const spot of [steps.hand, steps.limit]) {
      expect(spot.caret).toBe('down')
      expect(bottom(spot.y)).toBeLessThanOrEqual(LAYOUT.hand.y)
      // Clear of STAR-CHART, which a caption reaching further right would cover.
      expect(spot.x + spot.w).toBeLessThanOrEqual(LAYOUT.starChart.x)
    }
    expect(steps.limit).toEqual(steps.hand)

    // 'board' points down at the 5×5 chart, from above it.
    expect(steps.board.caret).toBe('down')
    expect(bottom(steps.board.y)).toBeLessThanOrEqual(LAYOUT.board.y)
    expect(steps.board.x + steps.board.w).toBeLessThanOrEqual(LAYOUT.constellations.label.x)

    // 'target' points up at the round total and starts below it, so the figure and
    // the target line it names stay readable.
    expect(steps.target.caret).toBe('up')
    expect(steps.target.y).toBeGreaterThanOrEqual(LAYOUT.roundTotal.y + LAYOUT.roundTotal.h)
    // It clips the top edge of ORION's bubble by 14px, deliberately: that band is
    // the only room left, and his line is decoration where the target is not.
    expect(steps.target.y).toBeLessThan(LAYOUT.bubble.y)
    expect(bottom(steps.target.y) - LAYOUT.bubble.y).toBeLessThanOrEqual(16)
    // Clear of ORION himself.
    expect(steps.target.x + steps.target.w).toBeLessThanOrEqual(LAYOUT.orion.x)
  })

  it('places the coach, the ? button and its card on whole pixels', () => {
    const numbers = [
      LAYOUT.coach.h,
      ...Object.values(LAYOUT.coach.steps).flatMap((spot) => [spot.x, spot.y, spot.w]),
      ...Object.values(LAYOUT.help),
      ...Object.values(LAYOUT.helpCard),
      ...Object.values(LAYOUT.reset),
      ...Object.values(LAYOUT.resetCard),
    ]

    for (const value of numbers) expect(Number.isInteger(value)).toBe(true)
  })

  // BOOTH-7 (GDD 12-2 ④). The placement is the whole of the decision: it sits in
  // the corner a lost participant already looks at, and a participant reaching for
  // the ? must not land on the button that ends their run.
  it('seats the reset beside the ? without the two touching', () => {
    const gap = LAYOUT.help.x - (LAYOUT.reset.x + LAYOUT.reset.w)

    expect(gap).toBeGreaterThanOrEqual(8)
    // Same row, same height, so the corner reads as one strip of controls.
    expect(LAYOUT.reset.y).toBe(LAYOUT.help.y)
    expect(LAYOUT.reset.h).toBe(LAYOUT.help.size)
    // And the same coordinate on the shop, so it does not move between screens.
    expect({ x: SHOP_LAYOUT.reset.x, y: SHOP_LAYOUT.reset.y }).toEqual({
      x: LAYOUT.reset.x,
      y: LAYOUT.reset.y,
    })
  })

  // The confirmation is the sixth modal, and gets the modal pair of checks.
  it('centres the reset confirmation on the plane and holds its contents', () => {
    const card = LAYOUT.resetCard
    const PADDING = 20 * 2
    const GAPS = 12 * 2
    const TITLE = 20
    // The note is one line at this width — see the length check below.
    const NOTE = 18
    const BUTTONS = 40

    expect(card.x + card.w / 2).toBe(CANVAS_WIDTH / 2)
    expect(card.y + card.h / 2).toBe(CANVAS_HEIGHT / 2)
    expect(TITLE + NOTE + BUTTONS + GAPS + PADDING).toBeLessThanOrEqual(card.h)
  })

  // GDD 12-2 asks the screen to be read unaided, and this one is read by somebody
  // who has already decided to leave. Two buttons and one line each: a wall of
  // text here is a wall of text nobody reads before clicking.
  it('keeps the reset copy to what fits on one line of its card', () => {
    const perLine = Math.floor((LAYOUT.resetCard.w - 20 * 2) / 11)

    expect(RESET_CONFIRM.note.length).toBeLessThanOrEqual(perLine)
    expect(RESET_CONFIRM.title.length).toBeLessThanOrEqual(perLine)
    for (const label of [RESET_CONFIRM.button, RESET_CONFIRM.cancel, RESET_CONFIRM.confirm]) {
      expect(label.length).toBeGreaterThan(0)
      // The corner button carries `button` at the 11px face inside 60px.
      expect(label.length * 11).toBeLessThanOrEqual(LAYOUT.reset.w)
    }
  })

  // The ? card is the fifth modal, and gets the modal pair of checks.
  it('centres the help card on the plane and keeps it inside', () => {
    const card = LAYOUT.helpCard

    expect(card.x + card.w / 2).toBe(CANVAS_WIDTH / 2)
    expect(card.y + card.h / 2).toBe(CANVAS_HEIGHT / 2)
    expect(card.x).toBeGreaterThanOrEqual(0)
    expect(card.y).toBeGreaterThanOrEqual(0)
  })

  // Five numbered lines, a heading and a button. The lines are the coach captions,
  // so the longest one is what the height has to hold.
  it('holds the five help lines, its heading and its button', () => {
    const card = LAYOUT.helpCard
    const PADDING = 20 * 2
    const GAPS = 12 * 2
    const HEADING = 14
    const LINES = 20 * COACH_ORDER.length
    const BUTTON = 40

    expect(COACH_ORDER).toHaveLength(5)
    expect(HEADING + LINES + BUTTON + GAPS + PADDING).toBeLessThanOrEqual(card.h)
  })
})

// P4-A: the shop is drawn on the same plane and answers to the same rules
// (GDD 11-10). Its coordinates are a second table, so they get a second check.
describe('shop layout (GDD 9-3, 11-10)', () => {
  const shelf = SHOP_LAYOUT
  const boxes = {
    specials: { x: shelf.specials.x, y: shelf.specials.y, w: shelf.specials.w, h: shelf.specials.h },
    constellations: {
      x: shelf.constellations.x,
      y: shelf.constellations.y,
      w: shelf.constellations.w,
      h: shelf.constellations.h,
    },
    companions: {
      x: shelf.companions.x,
      y: shelf.companions.y,
      w: shelf.companions.w,
      h: shelf.companions.h,
    },
    reroll: { x: shelf.reroll.x, y: shelf.reroll.y, w: shelf.reroll.w, h: shelf.reroll.h },
    bubble: { x: shelf.bubble.x, y: shelf.bubble.y, w: shelf.bubble.w, h: shelf.bubble.h },
    nebula: { x: shelf.nebula.x, y: shelf.nebula.y, w: shelf.nebula.w, h: shelf.nebula.h },
    deck: { x: shelf.deck.x, y: shelf.deck.y, w: shelf.deck.w, h: shelf.deck.h },
    inventory: { x: shelf.inventory.x, y: shelf.inventory.y, w: shelf.inventory.w, h: shelf.inventory.h },
    leave: { x: shelf.leave.x, y: shelf.leave.y, w: shelf.leave.w, h: shelf.leave.h },
    // BOOTH-7: the mid-run reset (GDD 12-2 ④), always on screen like the shelf.
    reset: { x: shelf.reset.x, y: shelf.reset.y, w: shelf.reset.w, h: shelf.reset.h },
  }

  it('keeps every placed box on the plane', () => {
    for (const [name, box] of Object.entries(boxes)) {
      expect(box.x, `${name} left`).toBeGreaterThanOrEqual(0)
      expect(box.y, `${name} top`).toBeGreaterThanOrEqual(0)
      expect(box.x + box.w, `${name} right`).toBeLessThanOrEqual(CANVAS_WIDTH)
      expect(box.y + box.h, `${name} bottom`).toBeLessThanOrEqual(CANVAS_HEIGHT)
    }
  })

  // `replace` is deliberately absent from `boxes`: it is a modal that covers the
  // screen it is asked over, so it overlaps the deck panel by design (GDD 11-10
  // exempts modal overlays from the pairwise check). It is checked on its own
  // below instead — inside the plane, and wide enough for its five cards.
  it('overlaps nothing', () => {
    const entries = Object.entries(boxes)
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [nameA, a] = entries[i]
        const [nameB, b] = entries[j]
        const apart =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y

        expect(apart, `${nameA} overlaps ${nameB}`).toBe(true)
      }
    }
  })

  it('fits the entries it says each shelf row holds', () => {
    const rows = [
      { row: shelf.specials, count: 4 },
      { row: shelf.constellations, count: 2 },
      { row: shelf.companions, count: 2 },
    ]

    for (const { row, count } of rows) {
      expect(row.entry * count + row.gap * (count - 1)).toBeLessThanOrEqual(row.w)
    }
  })

  it('keeps each group label clear of the row under it', () => {
    for (const row of [shelf.specials, shelf.constellations, shelf.companions]) {
      expect(row.label.y).toBeLessThan(row.y)
      expect(row.label.x).toBe(row.x)
    }
  })

  it('seats the bubble to иєвυℓα and leaves them touching', () => {
    const gap = shelf.nebula.x - (shelf.bubble.x + shelf.bubble.w)

    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThanOrEqual(40)
  })

  // BOOTH-6b: GDD 8-1 now asks for the full star name on the shop's STAR-CHART
  // too, and the suit column went from 36 to 54 to hold it. It came out of the
  // row's own slack, which is what this holds — the fixed columns and the gaps
  // between them still fit the 440px panel.
  it('fits the shop STAR-CHART row once the star names are in it', () => {
    const PADDING = 8 * 2
    const CHILDREN = 9
    const GAPS = 4 * (CHILDREN - 1)
    const CHIP = 32
    const COUNT = 44
    const BAR = 52
    // 계산 · 실제 · 기본, then the add and remove buttons.
    const FIGURES = 40 * 3
    const BUTTONS = 40 * 2 + 4
    const fixed = CHIP + DECK_NAME_COLUMN + COUNT + BAR + FIGURES + BUTTONS

    expect(DECK_NAME_COLUMN).toBeGreaterThanOrEqual(
      Math.max(...SUIT_ORDER.map((suit) => SUIT_STAR_NAMES[suit].length)) * 9,
    )
    expect(fixed + GAPS + PADDING).toBeLessThanOrEqual(SHOP_LAYOUT.deck.w)
  })

  // GDD 8-1 puts STAR-CHART beside BLACK-HOLE at P5, and the deck panel is where
  // it goes — so the two have to be neighbours before it arrives.
  it('stacks the deck panel directly above BLACK-HOLE', () => {
    expect(shelf.deck.x).toBe(shelf.inventory.x)
    expect(shelf.deck.w).toBe(shelf.inventory.w)
    expect(shelf.inventory.y).toBeGreaterThanOrEqual(shelf.deck.y + shelf.deck.h)
  })

  // GDD 11-9: she owns the bottom-right of her own screen, standing to the floor.
  it('plants иєвυℓα in the bottom-right corner at whole-number scale', () => {
    expect(Number.isInteger(NEBULA_SCALE)).toBe(true)
    expect(shelf.nebula.w).toBe(NEBULA_WIDTH * NEBULA_SCALE)
    expect(shelf.nebula.h).toBe(NEBULA_HEIGHT * NEBULA_SCALE)
    // Bottom-right: she reaches the floor and sits in the right-hand half.
    expect(shelf.nebula.y + shelf.nebula.h).toBe(CANVAS_HEIGHT)
    expect(shelf.nebula.x).toBeGreaterThan(CANVAS_WIDTH / 2)
  })

  // GDD 6: buying a fifth constellation means dropping one, and the choice is
  // made against five full cards. This is the case a screenshot is hardest to
  // reach — it needs four constellations held and a purchase attempted — so the
  // geometry is checked here instead.
  it('fits all five cards of the replacement prompt inside it, and it on the plane', () => {
    const { y, w, h, card, gap, arrow } = shelf.replace
    const cards = OWNED_CONSTELLATION_LIMIT + 1
    // p-4 on the panel, and the arrow sits between the held cards and the new one.
    const PADDING = 16 * 2
    const needed = card * cards + gap * cards + arrow

    expect(needed).toBeLessThanOrEqual(w - PADDING)
    expect(w).toBeLessThanOrEqual(CANVAS_WIDTH)
    expect(y + h).toBeLessThanOrEqual(CANVAS_HEIGHT)
    // Centred on the plane, so both edges land inside it.
    expect(CANVAS_WIDTH / 2 - w / 2).toBeGreaterThanOrEqual(0)
    expect(CANVAS_WIDTH / 2 + w / 2).toBeLessThanOrEqual(CANVAS_WIDTH)
  })

  // CLAUDE.md §7: whole multiples only. `card` is an entry footprint and `card`
  // is not a multiple of 36 — the card *image* inside it has to be, and this is
  // what stops the two being confused again.
  it('draws the prompt cards at a whole multiple of the 36×52 map', () => {
    expect(shelf.replace.cardImage % CARD_WIDTH).toBe(0)
    expect(shelf.replace.cardImage / CARD_WIDTH).toBe(2)
    // The image plus its text column and padding is the entry footprint.
    expect(shelf.replace.card).toBeGreaterThan(shelf.replace.cardImage)
  })

  // GDD 11-10's shop table is a copy of SHOP_LAYOUT, and a copy drifts unless
  // something compares them. Every key here has a row there and no row is spare.
  it('has one SHOP_LAYOUT entry per row of the GDD 11-10 shop table', () => {
    const rows = [
      'stardust', // 스타더스트
      'title', // 상점 제목
      'note', // 다음 라운드·목표 안내
      'specials', // 특수 조각 4 (+ 라벨)
      'constellations', // 별자리 2 (+ 라벨)
      'companions', // 동반성 2 (+ 라벨)
      'reroll', // 리롤 버튼
      'leave', // 다음 라운드 버튼
      'rerollNote', // 리롤 안내
      'deck', // 덱 구성 패널
      'inventory', // BLACK-HOLE
      'bubble', // 말풍선
      'nebula', // иєвυℓα
      'replace', // 별자리 교체 프롬프트
      'reset', // 중도 리셋 버튼
    ]

    expect(Object.keys(SHOP_LAYOUT).sort()).toEqual([...rows].sort())
  })
})

// BOOTH-1: the title is a third screen on the same plane, so it answers to the
// same rules (GDD 11-10). Nothing here is a modal, so every box is in the
// pairwise check — unlike the shop, which exempts `replace`.
describe('title layout (GDD 11-10, 12-2)', () => {
  // BOOTH-9a split the one `title` box into the logo sheet's vertical lockup — the
  // symbol sprite, the wordmark and the tagline under it (GDD 11-10). The symbol is
  // centred on the plane rather than placed from its left edge, so its box is
  // derived the way the component derives it.
  const boxes = {
    symbol: {
      x: (CANVAS_WIDTH - TITLE_LAYOUT.symbol.size) / 2,
      y: TITLE_LAYOUT.symbol.y,
      w: TITLE_LAYOUT.symbol.size,
      h: TITLE_LAYOUT.symbol.size,
    },
    wordmark: {
      x: TITLE_LAYOUT.wordmark.x,
      y: TITLE_LAYOUT.wordmark.y,
      w: TITLE_LAYOUT.wordmark.w,
      h: TITLE_LAYOUT.wordmark.h,
    },
    mode: { x: TITLE_LAYOUT.mode.x, y: TITLE_LAYOUT.mode.y, w: TITLE_LAYOUT.mode.w, h: TITLE_LAYOUT.mode.h },
    starting: {
      x: TITLE_LAYOUT.starting.x,
      y: TITLE_LAYOUT.starting.y,
      w: TITLE_LAYOUT.starting.w,
      h: TITLE_LAYOUT.starting.h,
    },
    start: {
      x: TITLE_LAYOUT.start.x,
      y: TITLE_LAYOUT.start.y,
      w: TITLE_LAYOUT.start.w,
      h: TITLE_LAYOUT.start.h,
    },
  }

  it('keeps every placed box on the plane', () => {
    for (const [name, box] of Object.entries(boxes)) {
      expect(box.x, `${name} left`).toBeGreaterThanOrEqual(0)
      expect(box.y, `${name} top`).toBeGreaterThanOrEqual(0)
      expect(box.x + box.w, `${name} right`).toBeLessThanOrEqual(CANVAS_WIDTH)
      expect(box.y + box.h, `${name} bottom`).toBeLessThanOrEqual(CANVAS_HEIGHT)
    }
  })

  it('overlaps nothing', () => {
    const entries = Object.entries(boxes)
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [nameA, a] = entries[i]
        const [nameB, b] = entries[j]
        const apart =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y

        expect(apart, `${nameA} overlaps ${nameB}`).toBe(true)
      }
    }
  })

  // GDD 12-2: a booth participant reads this unaided, so the order is the order
  // the decisions are made in — name, then mode, then constellation, then start.
  it('stacks the screen in the order the choices are made', () => {
    const tops = [
      TITLE_LAYOUT.symbol.y,
      TITLE_LAYOUT.wordmark.y,
      TITLE_LAYOUT.tagline.y,
      TITLE_LAYOUT.mode.y,
      TITLE_LAYOUT.starting.y,
      TITLE_LAYOUT.start.y,
    ]

    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1])
  })

  // GDD 11-10: the lockup is symbol over wordmark over tagline, and the whole of it
  // has to clear the mode label — which is what the 36px shift down the rest of the
  // screen took bought. A tagline running into that label is the failure this holds.
  it('keeps the logo lockup clear of the first choice row', () => {
    expect(TITLE_LAYOUT.symbol.y + TITLE_LAYOUT.symbol.size).toBeLessThanOrEqual(
      TITLE_LAYOUT.wordmark.y,
    )
    expect(TITLE_LAYOUT.wordmark.y + TITLE_LAYOUT.wordmark.h).toBeLessThanOrEqual(
      TITLE_LAYOUT.tagline.y,
    )
    // The tagline is one 11px line, the size class the component sets it in.
    expect(TITLE_LAYOUT.tagline.y + 11).toBeLessThanOrEqual(TITLE_LAYOUT.mode.label.y)
  })

  // The wordmark is type, not a sprite, and 42px is Galmuri14 at 3× — the face the
  // logo sheet builds the wordmark on. 44px would land on Galmuri11 (index.css maps
  // size to face), which is a different wordmark, so the box has to hold 42 and the
  // line height it needs.
  it('gives the wordmark room for a 42px line', () => {
    expect(TITLE_LAYOUT.wordmark.h).toBeGreaterThanOrEqual(42)
  })

  // CLAUDE.md §7: the sprite is shown at a whole multiple of its own map, and the
  // map is square, so the box it is given has to be the map's size exactly.
  it('shows the symbol at its own size', () => {
    expect(TITLE_LAYOUT.symbol.size).toBe(SIRIUS_SIZE)
  })

  it('fits both options of each choice row inside it', () => {
    const rows = [
      { row: TITLE_LAYOUT.mode, count: Object.keys(MODE_PRESETS).length },
      { row: TITLE_LAYOUT.starting, count: STARTING_CONSTELLATION_CHOICES.length },
    ]

    for (const { row, count } of rows) {
      expect(count).toBe(2)
      expect(row.entry * count + row.gap * (count - 1)).toBeLessThanOrEqual(row.w)
    }
  })

  it('keeps each choice label clear of the row under it', () => {
    for (const row of [TITLE_LAYOUT.mode, TITLE_LAYOUT.starting]) {
      expect(row.label.y).toBeLessThan(row.y)
      expect(row.label.x).toBe(row.x)
    }
  })

  // Both choice rows are the same width at the same x, so the second question
  // reads as a continuation of the first rather than as a new screen.
  it('lines the two choice rows up with each other', () => {
    expect(TITLE_LAYOUT.mode.x).toBe(TITLE_LAYOUT.starting.x)
    expect(TITLE_LAYOUT.mode.w).toBe(TITLE_LAYOUT.starting.w)
  })

  it('centres the logo, the choice rows and the start button on the plane', () => {
    for (const box of [
      boxes.symbol,
      TITLE_LAYOUT.wordmark,
      TITLE_LAYOUT.mode,
      TITLE_LAYOUT.starting,
      TITLE_LAYOUT.start,
    ]) {
      expect(box.x + box.w / 2).toBe(CANVAS_WIDTH / 2)
    }
  })

  // The hint says why the button will not press yet, so it has to be under it
  // and still on the plane.
  it('puts the hint below the start button and inside the plane', () => {
    expect(TITLE_LAYOUT.hint.y).toBeGreaterThanOrEqual(
      TITLE_LAYOUT.start.y + TITLE_LAYOUT.start.h,
    )
    expect(TITLE_LAYOUT.hint.y).toBeLessThan(CANVAS_HEIGHT)
  })

  // CLAUDE.md §7 and GDD 11-10: the plane is drawn in whole pixels, so a
  // coordinate that is not an integer lands a sprite between them.
  it('places everything on whole pixels', () => {
    const numbers = Object.values(TITLE_LAYOUT).flatMap((entry) =>
      Object.values(entry).flatMap((value) =>
        typeof value === 'number' ? [value] : Object.values(value),
      ),
    )

    expect(numbers.length).toBeGreaterThan(0)
    for (const value of numbers) expect(Number.isInteger(value)).toBe(true)
  })
})
