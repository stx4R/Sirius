import { describe, expect, it } from 'vitest'
import { CANVAS_HEIGHT, CANVAS_WIDTH, LAYOUT, canvasScale } from '../src/ui/Canvas'

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
})
