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
  void: '#0A0A12',
  panel: '#14121F',
  panelEdge: '#2E2A45',
  starWhite: '#F2F0FF',
  starDim: '#5A5478',
  textDim: '#9A94B8',
} as const

export type ColourName = keyof typeof PALETTE

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
 * GDD 11-5: nine of the twelve constellations are "N stars along an axis", so the
 * axis has to be legible as colour before the count is even read. The starting
 * choice of aries (vertical) vs libra (horizontal) depends on it (GDD 10-3).
 */
export const AXIS_COLOURS: Readonly<Record<LineAxis, string>> = {
  vertical: PALETTE.nebulaTeal,
  horizontal: PALETTE.nebulaAmber,
  diagonal: PALETTE.nebulaMagenta,
  shape_A: PALETTE.nebulaPeriwinkle,
  shape_T: PALETTE.nebulaPeriwinkle,
  global: PALETTE.nebulaHydrogen,
}
