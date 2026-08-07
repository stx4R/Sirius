import { describe, expect, it } from 'vitest'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  LAYOUT,
  NEBULA_SCALE,
  SHOP_LAYOUT,
  canvasScale,
} from '../src/ui/Canvas'
import { CARD_WIDTH, NEBULA_HEIGHT, NEBULA_WIDTH } from '../src/assets/pixels'
import { OWNED_CONSTELLATION_LIMIT } from '../src/core/config'

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
