import { describe, expect, it } from 'vitest'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  LAYOUT,
  NEBULA_SCALE,
  SHOP_LAYOUT,
  TITLE_LAYOUT,
  canvasScale,
} from '../src/ui/Canvas'
import { CARD_WIDTH, NEBULA_HEIGHT, NEBULA_WIDTH } from '../src/assets/pixels'
import {
  MODE_PRESETS,
  OWNED_CONSTELLATION_LIMIT,
  STARTING_CONSTELLATION_CHOICES,
} from '../src/core/config'

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

  it('places STAR-CHART on whole pixels', () => {
    for (const value of Object.values(LAYOUT.starChart)) {
      expect(Number.isInteger(value)).toBe(true)
    }
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
    ]

    expect(Object.keys(SHOP_LAYOUT).sort()).toEqual([...rows].sort())
  })
})

// BOOTH-1: the title is a third screen on the same plane, so it answers to the
// same rules (GDD 11-10). Nothing here is a modal, so every box is in the
// pairwise check — unlike the shop, which exempts `replace`.
describe('title layout (GDD 11-10, 12-2)', () => {
  const boxes = {
    title: {
      x: TITLE_LAYOUT.title.x,
      y: TITLE_LAYOUT.title.y,
      w: TITLE_LAYOUT.title.w,
      h: TITLE_LAYOUT.title.h,
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
      TITLE_LAYOUT.title.y,
      TITLE_LAYOUT.mode.y,
      TITLE_LAYOUT.starting.y,
      TITLE_LAYOUT.start.y,
    ]

    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1])
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

  it('centres the title, the choice rows and the start button on the plane', () => {
    for (const box of [TITLE_LAYOUT.title, TITLE_LAYOUT.mode, TITLE_LAYOUT.starting, TITLE_LAYOUT.start]) {
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
