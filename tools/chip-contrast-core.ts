// The measurement behind GDD 11-4. Split out of `chip-contrast.mjs` so the
// report and the contrast floor test run the same arithmetic instead of two
// copies of it — a duplicated ΔE would let the two disagree silently.
//
// Calculation only: nothing here prints, and nothing here judges. The regions,
// the seam guard and the acuity model are explained in `chip-contrast.mjs`,
// which is the only place that reports them.

import { SPECIAL_SUIT_PAIRS } from '../src/core/config'
import { SUIT_ORDER } from '../src/core/types'
import type { SuitId } from '../src/core/types'
import { specialChip } from '../src/assets/compose'
import type { PixelMap } from '../src/assets/compose'
import {
  CHIP_SIZE,
  GLYPH_OFFSET,
  GLYPH_SIZE,
  SUIT_GLYPHS,
  chipLayerAt,
} from '../src/assets/pixels'

/** Disjoint, so the three partition the chip. */
export const REGIONS = ['field', 'edge', 'symbol'] as const
export type Region = (typeof REGIONS)[number]

export type Rgb = readonly [number, number, number]

export const BLUR = 3
const SEAM_GUARD = 1
const HALF = CHIP_SIZE / 2

// ------------------------------------------------------------------ colour

export function rgb(value: string): Rgb {
  return [
    parseInt(value.slice(1, 3), 16),
    parseInt(value.slice(3, 5), 16),
    parseInt(value.slice(5, 7), 16),
  ]
}

export function hex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

const luma = ([r, g, b]: Rgb): number => 0.299 * r + 0.587 * g + 0.114 * b

/** sRGB → CIE L*a*b* (D65), so ΔE can be CIE76 rather than a raw RGB distance. */
function lab([r, g, b]: Rgb): Rgb {
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29)
  const [fx, fy, fz] = [f(X), f(Y), f(Z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export interface Distance {
  readonly deltaE: number
  readonly dLstar: number
  readonly dChroma: number
  readonly dLuma: number
}

/** CIE76, plus the split the eye actually uses: lightness apart from colour. */
export function distance(a: Rgb, b: Rgb): Distance {
  const [la, aa, ba] = lab(a)
  const [lb, ab, bb] = lab(b)
  const dL = lb - la
  return {
    deltaE: Math.hypot(dL, ab - aa, bb - ba),
    dLstar: Math.abs(dL),
    dChroma: Math.hypot(ab - aa, bb - ba),
    dLuma: Math.abs(luma(b) - luma(a)),
  }
}

// ----------------------------------------------------------------- regions

/** Which of the three regions a chip pixel belongs to, or null for background. */
export function regionAt(row: number, col: number, suit: SuitId): Region | null {
  const layer = chipLayerAt(row, col)
  if (layer === 'outside') return null

  const gr = row - GLYPH_OFFSET
  const gc = col - GLYPH_OFFSET
  const onGlyph =
    gr >= 0 && gc >= 0 && gr < GLYPH_SIZE && gc < GLYPH_SIZE && SUIT_GLYPHS[suit][gr][gc]
  if (onGlyph || layer === 'ring') return 'symbol'
  if (layer === 'rim' || layer === 'notch' || layer === 'dot') return 'edge'
  return 'field'
}

/** Nearest-neighbour upscale, the same integer scaling the browser does. */
function upscale(map: PixelMap, factor: number): (string | null)[][] {
  const out: (string | null)[][] = []
  for (const row of map) {
    const wide = row.flatMap((cell) => Array<string | null>(factor).fill(cell))
    for (let i = 0; i < factor; i++) out.push(wide)
  }
  return out
}

/**
 * Box blur over BLUR×BLUR device pixels (odd, so it is symmetric — an even
 * kernel is left-biased and makes a half disagree with its own mirror).
 * Transparent neighbours are skipped.
 */
function blur(image: (string | null)[][]): (string | null)[][] {
  return image.map((row, y) =>
    row.map((cell, x) => {
      if (cell === null) return null
      let [r, g, b, n] = [0, 0, 0, 0]
      for (let dy = 0; dy < BLUR; dy++) {
        for (let dx = 0; dx < BLUR; dx++) {
          const near = image[y + dy - (BLUR >> 1)]?.[x + dx - (BLUR >> 1)]
          if (!near) continue
          const [nr, ng, nb] = rgb(near)
          r += nr
          g += ng
          b += nb
          n++
        }
      }
      return n === 0 ? cell : hex([r / n, g / n, b / n])
    }),
  )
}

export interface Measurement {
  readonly mean: Rgb | null
  readonly area: number
}

export type SuitSignature = Record<Region, Measurement>

/** Mean colour and device-pixel area of each region, for one half of one chip. */
export function measureHalf(
  chip: PixelMap,
  suit: SuitId,
  side: 'left' | 'right',
  factor: number,
  blurred: boolean,
): SuitSignature {
  const from = side === 'left' ? 0 : HALF
  const to = side === 'left' ? HALF : CHIP_SIZE

  const image = blurred ? blur(upscale(chip, factor)) : upscale(chip, factor)
  const totals: Record<Region, { r: number; g: number; b: number; n: number }> = {
    field: { r: 0, g: 0, b: 0, n: 0 },
    edge: { r: 0, g: 0, b: 0, n: 0 },
    symbol: { r: 0, g: 0, b: 0, n: 0 },
  }

  for (let row = 0; row < CHIP_SIZE; row++) {
    for (let col = from; col < to; col++) {
      if (col >= HALF - SEAM_GUARD && col < HALF + SEAM_GUARD) continue
      const region = regionAt(row, col, suit)
      if (region === null) continue
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const cell = image[row * factor + dy][col * factor + dx]
          if (cell === null) continue
          const [r, g, b] = rgb(cell)
          const t = totals[region]
          t.r += r
          t.g += g
          t.b += b
          t.n++
        }
      }
    }
  }

  const measured = {} as Record<Region, Measurement>
  for (const region of REGIONS) {
    const t = totals[region]
    measured[region] = { mean: t.n === 0 ? null : [t.r / t.n, t.g / t.n, t.b / t.n], area: t.n }
  }
  return measured
}

export interface Signatures {
  readonly bySuit: Record<SuitId, SuitSignature>
  /** Suits whose halves disagree across the chips they appear on. */
  readonly disagreements: readonly string[]
}

/**
 * Every special chip's halves come from the two basic chips, so a suit's
 * signature is read out of the specials rather than assumed — and checked for
 * agreement across all the pairs that contain it.
 */
export function suitSignatures(factor: number, blurred: boolean): Signatures {
  const bySuit = {} as Record<SuitId, SuitSignature>
  const disagreements: string[] = []

  for (const [left, right] of SPECIAL_SUIT_PAIRS) {
    const chip = specialChip(left, right)
    const halves: readonly (readonly [SuitId, 'left' | 'right'])[] = [
      [left, 'left'],
      [right, 'right'],
    ]
    for (const [suit, side] of halves) {
      const measured = measureHalf(chip, suit, side, factor, blurred)
      const seen: SuitSignature | undefined = bySuit[suit]
      if (seen === undefined) {
        bySuit[suit] = measured
        continue
      }
      for (const region of REGIONS) {
        const a = seen[region].mean
        const b = measured[region].mean
        if (a && b && Math.abs(a[0] - b[0]) > 0.5) disagreements.push(`${suit} ${region}`)
      }
    }
  }

  return { bySuit, disagreements }
}

export interface PairDistance extends Distance {
  readonly pair: string
}

/** Every suit pair in one region, closest first. */
export function pairDistances(
  bySuit: Record<SuitId, SuitSignature>,
  region: Region,
): PairDistance[] {
  const rows: PairDistance[] = []
  for (let i = 0; i < SUIT_ORDER.length; i++) {
    for (let j = i + 1; j < SUIT_ORDER.length; j++) {
      const a = bySuit[SUIT_ORDER[i]][region].mean
      const b = bySuit[SUIT_ORDER[j]][region].mean
      if (!a || !b) continue
      rows.push({ pair: `${SUIT_ORDER[i]}·${SUIT_ORDER[j]}`, ...distance(a, b) })
    }
  }
  return rows.sort((x, y) => x.deltaE - y.deltaE)
}
