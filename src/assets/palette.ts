// The 32-colour limit (CLAUDE.md §7, GDD 11-7). Nothing outside this file may
// hard-code a colour, so the whole look changes from one place.
//
// Budget, following GDD 11-7 exactly:
//   15  chips        5 suits × (base, edge, symbol)
//    5  tier frames  reserved for the P4 companions, unused for now
//    6  nebula       5 of them double as the constellation axis coding (11-5)
//    6  ui           neutrals
//   ---
//   32
//
// The nebula hues carry two jobs on purpose. Colour-coding the constellation
// axes needs 5 distinct hues, and real nebulae come in exactly this kind of
// spread — so the coding reads as astronomy rather than as a legend.

import type { LineAxis, SuitId } from '../core/types'

export const PALETTE = {
  // --- chips: base, the 1px lit edge, and the symbol (GDD 3-1 base values)
  gacrux: '#7FD44C',
  gacruxEdge: '#B8F08A',
  gacruxShade: '#3D7A22',
  imai: '#3F8FE0',
  imaiEdge: '#86C4F5',
  imaiShade: '#1B4C87',
  ginan: '#E0453F',
  ginanEdge: '#F58F8A',
  ginanShade: '#8A1F1B',
  mimosa: '#9A4FD4',
  mimosaEdge: '#C99BF0',
  mimosaShade: '#57238A',
  // GDD 11-7: a shade of Acrux would be invisible on the void, so its third slot
  // buys a bright edge instead. The mid grey becomes the symbol.
  acrux: '#2B2B38',
  acruxEdge: '#B9BCD8',
  acruxSymbol: '#6E6E85',

  // --- companion tier frames, reserved for P4 (GDD 7-1 tiers)
  tierRare: '#7FA8C9',
  tierSuperRare: '#6FE0A8',
  tierEpic: '#B77BF0',
  tierMythic: '#FFC24D',
  tierLegendary: '#FF7A5C',

  // --- nebula
  nebulaDeep: '#1B1230',
  nebulaTeal: '#4FE3C1',
  nebulaAmber: '#FFB347',
  nebulaMagenta: '#FF6BC7',
  nebulaPeriwinkle: '#8AA8FF',
  nebulaHydrogen: '#FF5C5C',

  // --- ui neutrals
  //
  // Three of these do double duty on the constellation cards (GDD 11-7). The
  // tier frames above are reserved for P4 and were not touched to pay for it.
  //   starWhite  bright text · star cores · the drifter's rim
  //   starGlow   dim text    · the arms of a star
  //   starLink   panel hairlines · the lines joining stars
  //   panelEdge  panel borders · the faint specks behind a star chart
  void: '#0A0A12',
  panel: '#14121F',
  panelEdge: '#2E2A45',
  starWhite: '#F2F0FF',
  starGlow: '#9AA8CC',
  starLink: '#46557F',
} as const

export type ColourName = keyof typeof PALETTE

// ------------------------------------------------------------------- tones
// GDD 11-5 asks for two tones per card, made from its own colour. Derived tones
// are mixes of colours already in the palette, so the palette itself stays at 32
// — the list above is still the only place a colour is chosen.

const channels = (colour: string): [number, number, number] => [
  parseInt(colour.slice(1, 3), 16),
  parseInt(colour.slice(3, 5), 16),
  parseInt(colour.slice(5, 7), 16),
]

const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0')

/** `amount` of 0 keeps `from`, 1 gives `to`. */
export function mix(from: string, to: string, amount: number): string {
  const a = channels(from)
  const b = channels(to)
  return `#${a.map((value, i) => hex(value + (b[i] - value) * amount)).join('')}`
}

/** Perceived brightness, 0–255. Used to keep the frame quieter than the chart. */
export function luma(colour: string): number {
  const [r, g, b] = channels(colour)
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** Base / edge / symbol for one chip. The edge is the 1px rim that lifts it off the void. */
export interface ChipColours {
  readonly base: string
  readonly edge: string
  readonly symbol: string
}

export const CHIP_COLOURS: Readonly<Record<SuitId, ChipColours>> = {
  GAC: { base: PALETTE.gacrux, edge: PALETTE.gacruxEdge, symbol: PALETTE.gacruxShade },
  IMA: { base: PALETTE.imai, edge: PALETTE.imaiEdge, symbol: PALETTE.imaiShade },
  GIN: { base: PALETTE.ginan, edge: PALETTE.ginanEdge, symbol: PALETTE.ginanShade },
  MIM: { base: PALETTE.mimosa, edge: PALETTE.mimosaEdge, symbol: PALETTE.mimosaShade },
  ACR: { base: PALETTE.acrux, edge: PALETTE.acruxEdge, symbol: PALETTE.acruxSymbol },
}

/**
 * GDD 11-5: the colour of a constellation card's frame. The star chart inside is
 * blue-white for every card, so the axis has to be readable from the frame alone
 * — the starting choice of aries (vertical) vs libra (horizontal) depends on
 * telling the two apart at a glance (GDD 10-3).
 */
export const AXIS_COLOURS: Readonly<Record<LineAxis, string>> = {
  vertical: PALETTE.nebulaTeal,
  horizontal: PALETTE.nebulaAmber,
  diagonal: PALETTE.nebulaMagenta,
  shape_A: PALETTE.nebulaPeriwinkle,
  shape_T: PALETTE.nebulaPeriwinkle,
  global: PALETTE.nebulaHydrogen,
}
