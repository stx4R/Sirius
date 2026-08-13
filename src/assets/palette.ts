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

import type { CompanionTier, LineAxis, SuitId } from '../core/types'

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
 * The colour that stands for a suit in text and numbers on a dark panel — the
 * settlement screen colours each suit's column with it.
 *
 * Four suits use their chip's base colour. Acrux cannot: `#2B2B38` against the
 * void is all but invisible, which is the case GDD 11-7 flags, so it takes its
 * bright edge instead. No new colour enters the palette either way.
 */
export const SUIT_INK: Readonly<Record<SuitId, string>> = {
  GAC: PALETTE.gacrux,
  IMA: PALETTE.imai,
  GIN: PALETTE.ginan,
  MIM: PALETTE.mimosa,
  ACR: PALETTE.acruxEdge,
}

/**
 * иєвυℓα (GDD 11-9). Derived tones, so the palette stays at 32 — the same way
 * the constellation cards make theirs.
 *
 * Two colours were off limits and both are the obvious ones. `mimosa` is a chip
 * suit: dressing the shopkeeper in it would put her in the same purple as the
 * pieces on the board. `nebulaMagenta` codes the diagonal constellation axis
 * (11-5), and spending it on a character would blur what the axis colours mean.
 *
 * So the veil is magenta pushed deep into the nebula blue — a plum at luma 65
 * against mimosa's 117, which separates them by value as well as by hue and is
 * what the test enforces.
 *
 * It was darker still, and at 60×78 on the void that made her a black cut-out
 * with a rim: the purple this character is supposed to be simply did not read.
 * The four cloth tones now step 0.30 / 0.39 / 0.46 into the magenta so the robe,
 * the sleeves and the folds are told apart by value, with the hood's shade below
 * all of them and only the light inside it allowed to be bright.
 */
export const NEBULA_INK = {
  /** The robe and hood. */
  veil: mix(PALETTE.nebulaDeep, PALETTE.nebulaMagenta, 0.3),
  /** One value up, for folds in the cloth. */
  veilFold: mix(PALETTE.nebulaDeep, PALETTE.nebulaMagenta, 0.46),
  /** The sleeves, between the robe and its folds — an arm has to be its own shape. */
  sleeve: mix(PALETTE.nebulaDeep, PALETTE.nebulaMagenta, 0.39),
  /** The lit edge that lifts the silhouette off the void. */
  rim: mix(PALETTE.nebulaMagenta, PALETTE.starWhite, 0.3),
  /**
   * Deep shade under the hood.
   *
   * Emphatically *not* `void`. It was, and a face-shaped patch of the background
   * colour does not read as a shadowed face — it reads as a hole punched through
   * her, which is what made the first sprite look like a nozzle. Keeping it a
   * plum darker than the veil says "inside the hood" instead.
   */
  hollow: mix(PALETTE.nebulaDeep, PALETTE.nebulaMagenta, 0.14),
} as const

/**
 * ORION (GDD 11-8). Derived tones, so the palette stays at 32 — the same way
 * иєвυℓα's and the cards' are made.
 *
 * GDD 11-8 splits him in two: the head and arms are humanlike, and everything
 * below is the nebula itself — red Hα over the blue reflection. So the tones split
 * the same way, and the split is what makes the anatomy readable at 60×78: a pale
 * blue-white head and pair of arms in front of a red-to-blue cloud are told apart
 * by value before any outline is involved.
 *
 * He is the opposite side of the contrast 11-9 draws. иєвυℓα's one light is inside
 * her hood and she has no face; his is his face, and it is the brightest thing on
 * him — so the rim is graded to stay under it (compose.ts).
 */
export const ORION_INK = {
  /** Head and arms — the parts GDD 11-8 makes humanlike. */
  skin: mix(PALETTE.nebulaPeriwinkle, PALETTE.starWhite, 0.42),
  /**
   * Under the jaw, and the outer edge of an arm.
   *
   * 0.30 rather than 0.18, so it stays clear of the Hα the head sits against: at
   * 0.18 the jaw shadow and the top of the cloud were within two of the same luma
   * and the chin dissolved into the body.
   */
  skinShade: mix(PALETTE.nebulaPeriwinkle, PALETTE.nebulaDeep, 0.3),
  /**
   * Eyes, brows and mouth.
   *
   * Emphatically not `void`. A feature in the background colour on a pale head
   * reads as a hole punched through it, which is the mistake иєвυℓα's first hood
   * made (GDD 11-9, forbidden #3). A dark blue-violet says "eye" instead.
   */
  feature: mix(PALETTE.nebulaDeep, PALETTE.nebulaPeriwinkle, 0.15),
  /** Hα emission — the top of the body. */
  hydrogen: PALETTE.nebulaHydrogen,
  /** The blue reflection nebula — the bottom of it. */
  reflection: PALETTE.nebulaPeriwinkle,
  /** The lit edge, before compose.ts grades it down by distance from his face. */
  rim: mix(PALETTE.nebulaHydrogen, PALETTE.starWhite, 0.45),
} as const

/**
 * GDD 11-8's four expressions. '거래' is gone — see 11-8 for why, and `MOOD_OF` in
 * dialogue.ts for which of ORION's beats each of these answers.
 */
export type OrionMood = 'calm' | 'surprised' | 'pleased' | 'dim'

/**
 * How much the whole figure lifts or drops with the mood.
 *
 * The face carries the expression; this is what makes it read at 120×156 across a
 * booth table, where a two-pixel change to a mouth does not. Positive steps toward
 * `starWhite`, negative toward `nebulaDeep` — so `dim`, which is the run ending,
 * visibly goes out.
 */
export const ORION_LIFT: Readonly<Record<OrionMood, number>> = {
  calm: 0,
  surprised: 0.08,
  pleased: 0.16,
  dim: -0.18,
}

/** GDD 11-9: she has no expressions — the light out of the hood answers instead. */
export type NebulaMood = 'idle' | 'keen' | 'dealt'

export const NEBULA_GLOW: Readonly<Record<NebulaMood, string>> = {
  idle: mix(PALETTE.nebulaMagenta, PALETTE.nebulaDeep, 0.3),
  keen: PALETTE.nebulaMagenta,
  dealt: mix(PALETTE.nebulaMagenta, PALETTE.starWhite, 0.5),
}

/**
 * The Sirius mark (GDD 11-10, 11-7). Derived tones and existing primaries, so the
 * palette stays at 32 — the same bargain NEBULA_INK and ORION_INK make.
 *
 * ★ THE LOGO SHEET'S FIVE COLOURS ARE NOT FIVE NEW COLOURS. `docs/brand/
 * SIRIUS-LOGO-SHEET.png` publishes a ramp of #FFFFFF · #D6EEFF · #96C9F4 · #6096D2
 * over #0A0F1F, and writing those literals here is exactly what GDD 11-7 forbids —
 * `PALETTE` is full at 32, and a hand-written literal outside it is a 33rd colour
 * however it is labelled.
 *
 * It costs nothing, because the game already owns this ramp. Sirius is a blue-white
 * A-class star and Imai is the blue suit, so the sheet's blues and the Imai family
 * are the same four steps of the same hue:
 *
 *     sheet      → palette                     Δ
 *     #FFFFFF    → starWhite   #F2F0FF         star cores already use it (11-7)
 *     #D6EEFF    → mix(starWhite, imaiEdge)    derived, ≈#D6E5FC
 *     #96C9F4    → imaiEdge    #86C4F5         the same pale blue edge
 *     #6096D2    → imai        #3F8FE0         the same mid blue
 *     #0A0F1F    → void        #0A0A12         the canvas background already is this
 *
 * So the mark is drawn in colours that mean something elsewhere in the game rather
 * than in five that mean nothing anywhere else, and the count does not move.
 */
export const SIRIUS_INK = {
  /** The star's core, and the brightest thing on the title screen. */
  core: PALETTE.starWhite,
  /** The halo between core and arm. */
  pale: mix(PALETTE.starWhite, PALETTE.imaiEdge, 0.26),
  /** The arms. */
  mid: PALETTE.imaiEdge,
  /** The two arms facing away from the light. */
  shade: PALETTE.imai,
} as const

/**
 * GDD 7-1: the five tier colours, claiming the slots the budget above reserved
 * for them. The shop shelf is the first thing to use them — a tier is a rarity
 * and a price, and a frame colour says both at a glance before the text does.
 */
export const TIER_COLOURS: Readonly<Record<CompanionTier, string>> = {
  rare: PALETTE.tierRare,
  superRare: PALETTE.tierSuperRare,
  epic: PALETTE.tierEpic,
  mythic: PALETTE.tierMythic,
  legendary: PALETTE.tierLegendary,
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
