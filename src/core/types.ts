// Domain types for STA-mble. Type declarations and literal constants only —
// no implementations, no React, no DOM (see CLAUDE.md §5).

// ---------------------------------------------------------------- suits

/** Crux stars used as chip suits (GDD 3-1). */
export type SuitId = 'GAC' | 'IMA' | 'GIN' | 'MIM' | 'ACR'

/** Fixed scoring order (GDD 3-1). Also normalises special-chip left/right (GDD 3-2). */
export const SUIT_ORDER = ['GAC', 'IMA', 'GIN', 'MIM', 'ACR'] as const satisfies readonly SuitId[]

// ---------------------------------------------------------------- chips

export type ChipKind = 'basic' | 'special' | 'drifter'

/** Unique per chip instance, so duplicate suits stay distinguishable in deck/hand/board. */
export type ChipId = string

/** One suit (GDD 3-1). */
export interface BasicChip {
  readonly id: ChipId
  readonly kind: 'basic'
  readonly suit: SuitId
}

/** Two suits, scored as both (GDD 3-2). `left` precedes `right` in SUIT_ORDER. */
export interface SpecialChip {
  readonly id: ChipId
  readonly kind: 'special'
  readonly left: SuitId
  readonly right: SuitId
}

/** No suit of its own — takes suits from adjacent chips at scoring time (GDD 3-3). */
export interface DrifterChip {
  readonly id: ChipId
  readonly kind: 'drifter'
}

export type Chip = BasicChip | SpecialChip | DrifterChip

// ---------------------------------------------------------------- board

export type RowIndex = 0 | 1 | 2 | 3 | 4
export type ColIndex = 0 | 1 | 2 | 3 | 4

export interface Position {
  readonly row: RowIndex
  readonly col: ColIndex
}

export type BoardCell = Chip | null
export type BoardRow = [BoardCell, BoardCell, BoardCell, BoardCell, BoardCell]
export type Board = [BoardRow, BoardRow, BoardRow, BoardRow, BoardRow]

// ---------------------------------------------------------- constellations

/** The 12 zodiac constellations (GDD 6). */
export type ConstellationId =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces'

/** `shape_A` = Aquarius 'ㅅ' (GDD 6-1), `shape_T` = Virgo 'ㅗ' (GDD 6-2), `global` = Cancer (GDD 6-3). */
export type LineAxis = 'vertical' | 'horizontal' | 'diagonal' | 'shape_A' | 'shape_T' | 'global'

/** GDD 6-0. `bySize` is keyed by cell count, which uniquely determines the multiplier. */
export type MultiplierSpec =
  | { readonly kind: 'fixed'; readonly value: number }
  | { readonly kind: 'bySize'; readonly table: Readonly<Record<number, number>> }

/** One line that fired during scoring. */
export interface ScoredLine {
  readonly positions: readonly Position[]
  readonly axis: LineAxis
  readonly constellations: readonly ConstellationId[]
  /** Stacked multiplier over `constellations`, combined per MULTIPLIER_STACK_MODE. */
  readonly multiplier: number
}

// ------------------------------------------------------------- companions

export type CompanionTier = 'rare' | 'superRare' | 'epic' | 'mythic' | 'legendary'

/** The 30 companions (GDD 7-2). */
export type CompanionId =
  // legendary — 초거성 (2)
  | 'cloverSupergiant'
  | 'lawOfLargeNumbersSupergiant'
  // mythic — 주계열성 (4)
  | 'expectedValueMainSequence'
  | 'pulsatingMainSequence'
  | 'supernovaMainSequence'
  | 'binaryMainSequence'
  // epic — 원시별 (6)
  | 'duckProtostar'
  | 'complementProtostar'
  | 'samplingProtostar'
  | 'conditionalProtostar'
  | 'redProtostar'
  | 'darkProtostar'
  // superRare — 성운 (8)
  | 'sampleMeanNebula'
  | 'withoutReplacementNebula'
  | 'independentTrialNebula'
  | 'unstableNebula'
  | 'eclipticNebula'
  | 'mirrorNebula'
  | 'magneticNebula'
  | 'cumulusNebula'
  // rare — 가스 (10)
  | 'sampleSizeGas'
  | 'relativeFrequencyGas'
  | 'dustGas'
  | 'blueGas'
  | 'greenGas'
  | 'purpleGas'
  | 'blackGas'
  | 'planetaryGas'
  | 'coreGas'
  | 'cometGas'

/** Effect parameters land in COMPANION_PARAMS at P4 (GDD 7-1-b). */
export interface CompanionDef {
  readonly id: CompanionId
  readonly name: string
  readonly tier: CompanionTier
  readonly price: number
  readonly description: string
}

// ------------------------------------------------------------------ wager

/** Question difficulty, ramped by round (GDD 8-2). */
export type WagerTier = 'comparison' | 'complement' | 'conditional'

export type WagerChoice = 'yes' | 'no' | 'abstain'

/**
 * One ORION'S WAGER prediction question.
 * Phrasing rule (GDD 8-2): conditional questions state a deck *condition*,
 * never a temporal or causal sequence.
 */
export interface WagerQuestion {
  readonly text: string
  readonly answer: boolean
  readonly tier: WagerTier
  readonly explanation: string
}

export interface WagerRecord {
  readonly round: number
  readonly turn: number
  readonly question: WagerQuestion
  readonly choice: WagerChoice
  readonly correct: boolean
}

/** Per-turn draw, kept for the CONSTELLATION LOG frequency report (GDD 8-4). */
export interface DrawRecord {
  readonly round: number
  readonly turn: number
  readonly drawn: readonly Chip[]
}

// ------------------------------------------------------------- game state

export type GameMode = 'full' | 'booth'

export interface GameState {
  board: Board
  deck: Chip[]
  hand: Chip[]
  ownedConstellations: ConstellationId[]
  ownedCompanions: CompanionId[]
  stardust: number
  /** 1-based. */
  round: number
  /** 1-based, resets each round. */
  turn: number
  roundScore: number
  targetScore: number
  wagerHistory: WagerRecord[]
  drawHistory: DrawRecord[]
}
