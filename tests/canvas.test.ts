import { describe, expect, it } from 'vitest'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CODEX_LAYOUT,
  LAYOUT,
  NEBULA_SCALE,
  ORACLE_MAX_ROWS,
  SHOP_LAYOUT,
  TITLE_LAYOUT,
  canvasScale,
} from '../src/ui/Canvas'

/**
 * The face a menu row is set in (`MenuRow`), and the one figure the two menu
 * screens' width checks are made against. 22px is Galmuri11 at 2× — measured off
 * the mock, whose menu ink is 20px tall and 93px wide for `게임 시작` (BOOTH-9d).
 */
const MENU_ROW_PX = 22
import { COACH_ORDER } from '../src/ui/Coach'
import { CODEX_TABS, CODEX_TEXT } from '../src/ui/Codex'
import { PAUSE_MENU } from '../src/ui/Pause'
import { RESET_CONFIRM } from '../src/ui/Reset'
import { SETTINGS_TEXT } from '../src/ui/Settings'
import { LOCKED_NOTE, TITLE_MENU } from '../src/ui/Title'
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
    // BOOTH-9b removed the ? and 처음으로 boxes: STAR-CHART is where they were. The
    // cards they open are modals and were never in this check.
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

  // GDD 8-1's panel used to sit in a measured 116×390 gap at (584, 240) — the only
  // hole the plane had left. BOOTH-9b freed the top right and moved it there, and
  // that slot is now deliberately empty; the checks below measure it against its new
  // neighbours instead.
  it('leaves the slot the vertical STAR-CHART vacated empty', () => {
    const vacated = { x: 588, y: 244, w: 108, h: 380 }

    for (const [name, box] of Object.entries(boxes)) {
      const apart =
        box.x + box.w <= vacated.x ||
        vacated.x + vacated.w <= box.x ||
        box.y + box.h <= vacated.y ||
        vacated.y + vacated.h <= box.y

      expect(apart, `${name} reaches into the vacated STAR-CHART slot`).toBe(true)
    }
  })

  // BOOTH-9b turned STAR-CHART from a 108px column into a 448px row across the top.
  // The five cells have to divide the panel exactly, or the suits land between
  // pixels (CLAUDE.md §7).
  it('divides STAR-CHART into five whole-pixel suit cells', () => {
    const panel = LAYOUT.starChart
    const PADDING = 4 * 2

    expect(panel.cell * SUIT_ORDER.length + PADDING).toBe(panel.w)
    expect(Number.isInteger(panel.cell)).toBe(true)
  })

  it('gives STAR-CHART room for a header over one row of suits', () => {
    const panel = LAYOUT.starChart
    const PADDING = 4 * 2
    const HEADER = 13
    // Chip (32) beside a three-line text column (11 + 9 + 9 = 29), then the bar row.
    const SUIT_BLOCK = Math.max(32, 11 + 9 + 9) + 2 + 12

    expect(HEADER + SUIT_BLOCK + PADDING).toBeLessThanOrEqual(panel.h)
  })

  // GDD 8-1 puts the full star name here as well as in the shop (BOOTH-6b), and the
  // 108px column was the reason it nearly did not fit. Measured against the row's
  // own cell: chip, then the text column, and the widest thing in it is the name.
  it('fits every field of a suit inside one cell', () => {
    const panel = LAYOUT.starChart
    const CHIP = 32
    const GAP = 2
    // Galmuri9, and the canvas tests take a Latin glyph at the face's own size as
    // the conservative width (see the oracle row below). Gacrux and Mimosa are the
    // longest of the five at six glyphs.
    const longest = Math.max(...SUIT_ORDER.map((suit) => SUIT_STAR_NAMES[suit].length))

    expect(longest).toBe(6)
    expect(CHIP + GAP + longest * 9).toBeLessThanOrEqual(panel.cell)

    // ★ The bar row is measured rather than counted. The glyph-count rule above is
    // right for Hangul, which is about square at its face's size, and roughly 1.8×
    // too wide for Latin — Galmuri9 draws '100%' in 24px where the rule would say
    // 36, and 'Gacrux' in 30 where it says 54. Sized by the rule, a bar wide enough
    // to read would not fit beside its own percentage at any cell width this row
    // could have. So the widest percentage is the measured 24px.
    const PERCENT = 24

    expect(panel.bar + 4 + PERCENT).toBeLessThanOrEqual(panel.cell)
  })

  // ★ The measurement the move was justified by: the top right really is free once
  // the three controls are gone. Both neighbours are centred on the plane, so their
  // right edges are half their widest width past the middle.
  it('clears the round/turn line, the status line and the settlement panel', () => {
    const panel = LAYOUT.starChart
    // Measured in the browser at 14px bold: '주기 1 / 8' 69 + 16 gap + '턴 1 / 5' 55.
    const ROUND_TURN_W = 146
    // Measured at 11px: '원하는 위치에 놓으세요', the longest of the five states.
    const STATUS_W = 120
    const centre = CANVAS_WIDTH / 2

    expect(panel.x).toBeGreaterThan(centre + ROUND_TURN_W / 2)
    expect(panel.x).toBeGreaterThan(centre + STATUS_W / 2)
    expect(panel.y + panel.h).toBeLessThanOrEqual(LAYOUT.settlement.y)
    // The same margin off the right edge that the stardust readout has off the left.
    expect(CANVAS_WIDTH - (panel.x + panel.w)).toBe(LAYOUT.stardust.x)
  })

  // The DEV toggle moved out of the top right to make room. It is compiled out of a
  // booth build, but in a development one it must not sit on anything either.
  it('parks the DEV toggle clear of the readouts it now sits between', () => {
    // Measured: the stardust block is 57 wide from x=16.
    expect(LAYOUT.dev.x).toBeGreaterThanOrEqual(LAYOUT.stardust.x + 57)
    // 61px wide at 11px, against the round/turn line's left edge at its widest.
    expect(LAYOUT.dev.x + 61).toBeLessThan(CANVAS_WIDTH / 2 - 146 / 2)
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
      ...Object.values(LAYOUT.helpCard),
      ...Object.values(LAYOUT.resetCard),
    ]

    for (const value of numbers) expect(Number.isInteger(value)).toBe(true)
  })

  // BOOTH-9b: the play screen's reset button is gone and STAR-CHART has its corner.
  // The shop still carries one, and it is now the only one — so it is the only
  // placement left to check, and it must stay on the plane.
  it('leaves the shop as the only screen with a reset button', () => {
    expect(LAYOUT).not.toHaveProperty('reset')
    expect(LAYOUT).not.toHaveProperty('help')

    const reset = SHOP_LAYOUT.reset
    expect(reset.x + reset.w).toBeLessThanOrEqual(CANVAS_WIDTH)
    expect(reset.y + reset.h).toBeLessThanOrEqual(CANVAS_HEIGHT)
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
      // The shop's corner button carries `button` at the 11px face inside 60px.
      expect(label.length * 11).toBeLessThanOrEqual(SHOP_LAYOUT.reset.w)
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

  // BOOTH-9c: the ESC pause window is the seventh overlay and the only one that is
  // the whole plane rather than a card on it, so it is out of `boxes` like the
  // others. What it gets instead is the column check — one centred stack, in order,
  // inside the plane.
  it('stacks the pause window as one centred column', () => {
    const spot = LAYOUT.pause
    const tops = [spot.symbol.y, spot.heading.y, spot.menu.y, spot.hint.y]

    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1])

    // The symbol is the logo sheet's mark at its own size (CLAUDE.md §7), and the
    // heading clears it. There is no wordmark on this screen on purpose — see
    // `Pause.tsx`.
    expect(spot.symbol.y + SIRIUS_SIZE).toBeLessThanOrEqual(spot.heading.y)
    // The heading is one 22px line and the menu starts under it.
    expect(spot.heading.y + 22).toBeLessThanOrEqual(spot.menu.y)

    for (const box of [spot.menu, spot.settings]) {
      expect(box.x + box.w / 2).toBe(CANVAS_WIDTH / 2)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.w).toBeLessThanOrEqual(CANVAS_WIDTH)
    }
    expect(spot.hint.y + 11).toBeLessThanOrEqual(CANVAS_HEIGHT)
  })

  // The two pages occupy the same band, so stepping into the settings and back does
  // not move the heading above them or the hint below them.
  it('gives the menu and the settings the same height', () => {
    const spot = LAYOUT.pause
    const rows = PAUSE_MENU.length
    const menu = spot.menu.h * rows + spot.menu.gap * (rows - 1)

    expect(rows).toBe(5)
    expect(menu).toBe(spot.settings.h)
    expect(spot.menu.y + menu).toBeLessThanOrEqual(spot.hint.y)
  })

  // Every label has to fit its row at the face it is set in — 22px for a menu row
  // (`MenuRow`, shared with the main page since BOOTH-9d), 11px for the two settings
  // choices.
  it('fits every label in the row it is drawn in', () => {
    const spot = LAYOUT.pause

    for (const item of PAUSE_MENU) {
      expect(item.label.length * MENU_ROW_PX, item.label).toBeLessThanOrEqual(spot.menu.w)
    }
    for (const label of [SETTINGS_TEXT.on, SETTINGS_TEXT.off, SETTINGS_TEXT.back]) {
      expect(label.length * 11, label).toBeLessThanOrEqual(spot.settings.control)
    }
    // The animation row is a label on the left and the two choices on the right.
    const CHOICES = spot.settings.control * 2 + 8
    expect(SETTINGS_TEXT.animations.length * 11 + CHOICES + 12 * 3).toBeLessThanOrEqual(
      spot.settings.w,
    )
  })

  it('places the pause window on whole pixels', () => {
    const numbers = Object.values(LAYOUT.pause).flatMap((entry) => Object.values(entry))

    for (const value of numbers) expect(Number.isInteger(value)).toBe(true)
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

// BOOTH-9d: the main page and its three sub-pages, on the same plane and by the
// same rules (GDD 11-10).
//
// ★ The figures it is checked against are the mock's, read off
// `docs/brand/title-screen-mock-1120x630.png` — it is 1120×630, the canvas exactly,
// so its ink boxes are coordinates rather than a reference. The whole point of this
// screen is that it *is* the mock, and a layout that drifted off it by 20px would
// look fine and still be wrong.
describe('main page layout (GDD 11-10, 12-2)', () => {
  /** Ink bounding boxes measured off the mock (BOOTH-9d). */
  const MOCK = {
    symbol: { x0: 503, y0: 97, x1: 622, y1: 210 },
    wordmark: { x0: 335, y0: 262, x1: 784, y1: 378 },
    rows: [432, 472, 512, 552],
  } as const

  const boxes = {
    symbol: {
      x: (CANVAS_WIDTH - TITLE_LAYOUT.symbol.size * TITLE_LAYOUT.symbol.scale) / 2,
      y: TITLE_LAYOUT.symbol.y,
      w: TITLE_LAYOUT.symbol.size * TITLE_LAYOUT.symbol.scale,
      h: TITLE_LAYOUT.symbol.size * TITLE_LAYOUT.symbol.scale,
    },
    wordmark: {
      x: TITLE_LAYOUT.wordmark.x,
      y: TITLE_LAYOUT.wordmark.y,
      w: TITLE_LAYOUT.wordmark.w,
      h: TITLE_LAYOUT.wordmark.h,
    },
    menu: {
      x: TITLE_LAYOUT.menu.x,
      y: TITLE_LAYOUT.menu.y,
      w: TITLE_LAYOUT.menu.w,
      h: TITLE_LAYOUT.menu.h * TITLE_MENU.length + TITLE_LAYOUT.menu.gap * (TITLE_MENU.length - 1),
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

  // ★ The mock, held down. Each figure is allowed to sit within a few pixels of the
  // ink it was measured from — the type is set rather than drawn and the mark is on
  // a whole-multiple scale, so neither can land on the mock's pixel exactly. Neither
  // may wander, though, which is what these slacks are for.
  //
  // ★ THE SYMBOL IS CHECKED ON ITS INK, NOT ITS BOX. The mark fills 38×35 of its
  // 56×56 map, so the box is much bigger than what shows — comparing boxes to the
  // mock's ink is what put it at 2× and 44px too small on the first pass.
  it('lands the symbol and the wordmark where the mock puts them', () => {
    const mark = TITLE_LAYOUT.symbol
    const near = (got: number, want: number, slack: number, what: string) =>
      expect(Math.abs(got - want), `${what}: ${got} vs mock ${want}`).toBeLessThanOrEqual(slack)

    const inkTop = mark.y + mark.inkInset * mark.scale

    near(inkTop, MOCK.symbol.y0, 2, 'symbol ink top')
    near(mark.inkHeight * mark.scale, MOCK.symbol.y1 - MOCK.symbol.y0 + 1, 2, 'symbol ink height')
    // 18px wider than the mock, because this mark's companion star reaches further
    // out than the one in the picture. The height is what the scale was set on.
    near(mark.inkWidth * mark.scale, MOCK.symbol.x1 - MOCK.symbol.x0 + 1, 20, 'symbol ink width')
    // The ink is smaller than the map it is drawn on, and the box has to hold it.
    expect(mark.inkWidth * mark.scale).toBeLessThan(boxes.symbol.w)
    near(boxes.wordmark.y, MOCK.wordmark.y0, 6, 'wordmark top')
  })

  it('puts the four menu rows on the mock 40px pitch', () => {
    expect(TITLE_MENU).toHaveLength(MOCK.rows.length)
    for (let i = 1; i < MOCK.rows.length; i++) {
      expect(MOCK.rows[i] - MOCK.rows[i - 1]).toBe(TITLE_LAYOUT.menu.h + TITLE_LAYOUT.menu.gap)
    }
    // The 22px ink of a row is centred in its 40px box, so the first row's text
    // lands within a pixel or two of where the mock drew it.
    const inkTop = TITLE_LAYOUT.menu.y + (TITLE_LAYOUT.menu.h - MENU_ROW_PX) / 2
    expect(Math.abs(inkTop - MOCK.rows[0])).toBeLessThanOrEqual(3)
  })

  it('stacks the main page in the mock order', () => {
    const tops = [
      TITLE_LAYOUT.symbol.y,
      TITLE_LAYOUT.wordmark.y,
      TITLE_LAYOUT.menu.y,
      TITLE_LAYOUT.tagline.y,
    ]

    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1])
  })

  // 126px = Galmuri14 × 9 (index.css maps size → face), which is the multiple the
  // mock's 450×117 of ink was drawn at. The box has to hold that line.
  it('gives the wordmark room for its 126px line', () => {
    expect(TITLE_LAYOUT.wordmark.h).toBeGreaterThanOrEqual(126)
    expect(126 % 14).toBe(0)
  })

  // CLAUDE.md §7: the sprite is shown at a whole multiple of its own map.
  it('shows the symbol at a whole multiple of its own size', () => {
    expect(TITLE_LAYOUT.symbol.size).toBe(SIRIUS_SIZE)
    expect(Number.isInteger(TITLE_LAYOUT.symbol.scale)).toBe(true)
  })

  it('centres the logo, the menu and the sub-pages on the plane', () => {
    for (const box of [
      boxes.symbol,
      TITLE_LAYOUT.wordmark,
      TITLE_LAYOUT.menu,
      TITLE_LAYOUT.starting,
      TITLE_LAYOUT.start,
      TITLE_LAYOUT.settings,
    ]) {
      expect(box.x + box.w / 2).toBe(CANVAS_WIDTH / 2)
    }
  })

  // The tagline is at the foot of the page rather than inside the lockup (GDD 11-10,
  // BOOTH-9d), so what has to hold is that it clears the last menu row and the plane.
  it('seats the tagline below the menu and inside the plane', () => {
    expect(TITLE_LAYOUT.tagline.y).toBeGreaterThanOrEqual(boxes.menu.y + boxes.menu.h)
    expect(TITLE_LAYOUT.tagline.y + 11).toBeLessThanOrEqual(CANVAS_HEIGHT)
  })

  // Every row is one word at 22px, except the locked one, which carries its reason
  // as a 9px second line (GDD 12-2-b).
  it('fits every menu label and the locked note in a row', () => {
    for (const item of TITLE_MENU) {
      expect(item.label.length * MENU_ROW_PX, item.label).toBeLessThanOrEqual(TITLE_LAYOUT.menu.w)
    }
    expect(LOCKED_NOTE.length * 9).toBeLessThanOrEqual(TITLE_LAYOUT.menu.w)
    // 22px of label, 4px of gap and a 9px note inside a 40px row.
    expect(MENU_ROW_PX + 4 + 9).toBeLessThanOrEqual(TITLE_LAYOUT.menu.h)
  })

  // ---------------------------------------------------- the starting page (13-5)

  it('fits both starting choices in their row', () => {
    const row = TITLE_LAYOUT.starting

    expect(STARTING_CONSTELLATION_CHOICES).toHaveLength(2)
    expect(row.entry * 2 + row.gap).toBeLessThanOrEqual(row.w)
    // GDD 13-5 is the reason this page exists at all: two presets, two choices.
    expect(Object.keys(MODE_PRESETS)).toHaveLength(2)
  })

  it('stacks the starting page and keeps it on the plane', () => {
    const row = TITLE_LAYOUT.starting
    const tops = [row.heading.y, row.note.y, row.y, TITLE_LAYOUT.start.y, TITLE_LAYOUT.hint.y]

    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1])
    expect(row.heading.y).toBeGreaterThanOrEqual(TITLE_LAYOUT.back.y + TITLE_LAYOUT.back.h)
    expect(row.y + row.h).toBeLessThanOrEqual(TITLE_LAYOUT.start.y)
    expect(TITLE_LAYOUT.hint.y + 11).toBeLessThanOrEqual(CANVAS_HEIGHT)
  })

  // ---------------------------------------------------- the settings page (12-2-d)

  // The one page, two hosts (`Settings.tsx`). Same box either way, so it is the same
  // page rather than a second one that happens to look similar.
  it('gives the settings page the same box the pause window gives it', () => {
    for (const key of ['w', 'h', 'row', 'control'] as const) {
      expect(TITLE_LAYOUT.settings[key], key).toBe(LAYOUT.pause.settings[key])
    }
  })

  it('stacks the settings page and keeps it on the plane', () => {
    const box = TITLE_LAYOUT.settings

    expect(box.heading.y).toBeGreaterThanOrEqual(TITLE_LAYOUT.back.y + TITLE_LAYOUT.back.h)
    expect(box.heading.y + 22).toBeLessThanOrEqual(box.y)
    expect(box.y + box.h).toBeLessThanOrEqual(TITLE_LAYOUT.settingsHint.y)
    expect(TITLE_LAYOUT.settingsHint.y + 11).toBeLessThanOrEqual(CANVAS_HEIGHT)
  })

  it('keeps the back button in one corner on every sub-page', () => {
    const back = TITLE_LAYOUT.back

    expect(back.x).toBeGreaterThanOrEqual(0)
    expect(back.y).toBeGreaterThanOrEqual(0)
    expect(back.x + back.w).toBeLessThanOrEqual(CANVAS_WIDTH)
    // It must not reach into the column any page centres on the plane.
    expect(back.x + back.w).toBeLessThanOrEqual(TITLE_LAYOUT.settings.x)
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

// BOOTH-9d: 도감, the fifth screen. Not a modal — it replaces the main page's body —
// so it gets the same on-the-plane checks the other screens get.
describe('codex layout (GDD 11-10, 12-2-e)', () => {
  const boxes = {
    tabs: {
      x: CODEX_LAYOUT.tabs.x,
      y: CODEX_LAYOUT.tabs.y,
      w: CODEX_LAYOUT.tabs.w,
      h: CODEX_LAYOUT.tabs.h,
    },
    body: {
      x: CODEX_LAYOUT.body.x,
      y: CODEX_LAYOUT.body.y,
      w: CODEX_LAYOUT.body.w,
      h: CODEX_LAYOUT.body.h,
    },
  }

  it('keeps every placed box on the plane and clear of the others', () => {
    for (const [name, box] of Object.entries(boxes)) {
      expect(box.x, `${name} left`).toBeGreaterThanOrEqual(0)
      expect(box.y, `${name} top`).toBeGreaterThanOrEqual(0)
      expect(box.x + box.w, `${name} right`).toBeLessThanOrEqual(CANVAS_WIDTH)
      expect(box.y + box.h, `${name} bottom`).toBeLessThanOrEqual(CANVAS_HEIGHT)
    }
    expect(boxes.tabs.y + boxes.tabs.h).toBeLessThanOrEqual(boxes.body.y)
    expect(CODEX_LAYOUT.heading.y + 22).toBeLessThanOrEqual(boxes.tabs.y)
    // The header row shares its band with the shared back button.
    expect(TITLE_LAYOUT.back.y + TITLE_LAYOUT.back.h).toBeLessThanOrEqual(boxes.tabs.y)
  })

  it('fits its tabs across the strip, centred', () => {
    const tabs = CODEX_LAYOUT.tabs
    const count = CODEX_TABS.length

    expect(count).toBe(3)
    expect(tabs.entry * count + tabs.gap * (count - 1)).toBe(tabs.w)
    expect(tabs.x + tabs.w / 2).toBe(CANVAS_WIDTH / 2)
    for (const tab of CODEX_TABS) {
      expect(tab.label.length * 11, tab.label).toBeLessThanOrEqual(tabs.entry)
    }
  })

  // ★ Why there are three tabs rather than one page: the bodies do not fit together.
  // Twelve cards at their measured 142px entry are two rows; adding the chip rows
  // and the companion table runs past a body that cannot scroll (GDD 11-10).
  it('holds the tallest tab, and could not hold all three at once', () => {
    const body = CODEX_LAYOUT.body
    const inner = body.h - body.pad * 2
    const CARD_ENTRY = 142
    const SECTION_LABEL = 14

    const zodiac = SECTION_LABEL + 12 + CARD_ENTRY * 2 + 8
    // Three chip sections: label, a 64px sprite row and its 9px caption each.
    const chips = (SECTION_LABEL + 4 + 64 + 4 + 11) * 3 + 16 * 2
    // Header row plus five tier rows, then the locked line.
    const companions = SECTION_LABEL + 12 + 12 + 18 * 5 + 12 + 11

    for (const [name, height] of [
      ['zodiac', zodiac],
      ['chips', chips],
      ['companions', companions],
    ] as const) {
      expect(height, name).toBeLessThanOrEqual(inner)
    }
    expect(zodiac + chips + companions).toBeGreaterThan(inner)
  })

  // Six cards a row, which is what decides the entry width the zodiac tab passes
  // to `ConstellationCard`.
  it('fits six constellation cards across the body', () => {
    const inner = CODEX_LAYOUT.body.w - CODEX_LAYOUT.body.pad * 2
    const ENTRY = 160

    expect(ENTRY * 6 + 8 * 5).toBeLessThanOrEqual(inner)
    expect(ENTRY * 7 + 8 * 6).toBeGreaterThan(inner)
  })

  // The chip rows: five basics at 190 and ten specials at 92, each with its gap.
  it('fits both chip rows across the body', () => {
    const inner = CODEX_LAYOUT.body.w - CODEX_LAYOUT.body.pad * 2

    expect(190 * 5 + 10 * 4).toBeLessThanOrEqual(inner)
    expect(92 * 10 + 6 * 9).toBeLessThanOrEqual(inner)
    // A 64px sprite (the 32px map at 2×) has to fit the narrower of the two.
    expect(64).toBeLessThanOrEqual(92)
  })

  it('keeps its captions short enough to sit beside their section label', () => {
    const inner = CODEX_LAYOUT.body.w - CODEX_LAYOUT.body.pad * 2

    for (const note of [
      CODEX_TEXT.basicsNote,
      CODEX_TEXT.specialsNote,
      CODEX_TEXT.drifterNote,
      CODEX_TEXT.zodiacNote,
      CODEX_TEXT.companionsNote,
    ]) {
      expect(note.length * 9, note).toBeLessThanOrEqual(inner)
    }
  })

  it('places everything on whole pixels', () => {
    const numbers = Object.values(CODEX_LAYOUT).flatMap((entry) => Object.values(entry))

    for (const value of numbers) expect(Number.isInteger(value)).toBe(true)
  })
})
