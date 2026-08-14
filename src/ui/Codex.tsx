// 도감 (BOOTH-9d) — the fourth item on the main page's menu.
//
// ★ IT INVENTS ALMOST NOTHING. Everything a booth participant reads here already
// existed somewhere in the build: the constellation cards print their own name,
// condition and multiplier (`ConstellationCard`, GDD 11-5), the chips are the same
// sprites the board deals, the star names are `SUIT_STAR_NAMES`, and the companion
// odds are `COMPANION_TIER_WEIGHTS` — GDD 7-1 calls those published odds a teaching
// device, so printing them is the point rather than decoration. What this file adds
// is the three tab names, the five 한글 tier names GDD 7-1 already uses, and one
// caption per section. Nothing else was written.
//
// ★ Three tabs, and the reason is arithmetic rather than taste. Twelve constellation
// cards at their measured 142px entry are two rows of 292px; the chip sections are
// another 290; the companion table is 200. That is 780 in a body 462 tall, and the
// plane does not scroll (GDD 11-10). So the content had to split, and it splits
// where the game itself splits it — chips, constellations, companions.
//
// ★ The companion tab is the odds, not the thirty cards. `COMPANIONS_ENABLED` is
// false (GDD 7-1-b), so a list of thirty names would advertise thirty things this
// build cannot hand over. The tier table teaches what the system *is* and what a
// draw costs, which is the half of it that is true today.

import { useState } from 'react'
import {
  BASE_CHIP_SCORE,
  COMPANIONS,
  COMPANION_TIER_PRICES,
  COMPANION_TIER_WEIGHTS,
  CONSTELLATION_NAMES,
  OWNED_COMPANION_LIMIT,
  SPECIAL_SUIT_PAIRS,
  SUIT_STAR_NAMES,
} from '../core/config'
import { SUIT_ORDER } from '../core/types'
import type { CompanionTier, ConstellationId, SuitId } from '../core/types'
import { basicChip, drifterChip, specialChip } from '../assets/compose'
import { PALETTE } from '../assets/palette'
import { At, CODEX_LAYOUT } from './Canvas'
import { ConstellationCard } from './ConstellationCard'
import { PixelSprite } from './PixelSprite'
import { withPixelWords } from './PixelWord'

/**
 * GDD 3-1's five, as the shapes a player recognises them by.
 *
 * The same table `SpriteGallery.tsx` carries, and for the reason its comment gives:
 * core holds no display names, so they live with the sprites. It is duplicated
 * rather than shared because the gallery is a P3-A inspection page that is not part
 * of the game — importing from it would make a dev surface load-bearing.
 */
const SUIT_SHAPES: Readonly<Record<SuitId, string>> = {
  GAC: '클로버',
  IMA: '다이아',
  GIN: '하트',
  MIM: 'X자',
  ACR: '스페이드',
}

/** GDD 7-1's five tiers, in the 한글 that section names them by. */
const TIER_NAMES: Readonly<Record<CompanionTier, string>> = {
  legendary: '초거성',
  mythic: '주계열성',
  epic: '원시별',
  superRare: '성운',
  rare: '가스',
}

/** Richest first, which is the order GDD 7-1 lists them in. */
const TIER_ORDER: readonly CompanionTier[] = [
  'legendary',
  'mythic',
  'epic',
  'superRare',
  'rare',
]

export const CODEX_TABS = [
  { id: 'chips', label: '조각' },
  { id: 'zodiac', label: '황도 12궁' },
  { id: 'companions', label: '동반성' },
] as const

export type CodexTab = (typeof CODEX_TABS)[number]['id']

/** Every caption on the screen, so the wording is in one place (GDD 12-2). */
export const CODEX_TEXT = {
  heading: '도감',
  basics: '기본 조각',
  basicsNote: `문양 하나로 판정됩니다 · 기본 ${BASE_CHIP_SCORE}점`,
  specials: 'MЦLГЦS 조각',
  specialsNote: '두 문양으로 모두 판정됩니다',
  drifter: '떠돌이 조각',
  drifterNote: '제 문양이 없어 인접한 칩의 문양을 따라갑니다 · 게임당 1개',
  zodiacNote: '같은 문양이 조건대로 이어지면 그 줄에 배율이 붙습니다',
  companionsLocked: '아직 열리지 않았습니다',
  companionsNote: `상점에서 등급별 확률로 나옵니다 · 최대 ${OWNED_COMPANION_LIMIT}개 보유`,
  tierHeader: ['등급', '등장 확률', '가격', '종수'],
} as const

function SectionLabel({ text, note }: { readonly text: string; readonly note?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[11px] font-bold tracking-wide" style={{ color: PALETTE.nebulaAmber }}>
        {withPixelWords(text, PALETTE.nebulaAmber)}
      </span>
      {note !== undefined && (
        <span className="text-[9px]" style={{ color: PALETTE.starGlow }}>
          {note}
        </span>
      )}
    </div>
  )
}

function Chip({
  pixels,
  label,
  width,
}: {
  readonly pixels: ReturnType<typeof basicChip>
  readonly label: string
  readonly width: number
}) {
  return (
    <figure className="flex flex-col items-center gap-1" style={{ width }}>
      <PixelSprite pixels={pixels} scale={2} alt={label} />
      <figcaption className="text-center text-[9px] leading-tight" style={{ color: PALETTE.starGlow }}>
        {label}
      </figcaption>
    </figure>
  )
}

function ChipsTab() {
  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <SectionLabel text={CODEX_TEXT.basics} note={CODEX_TEXT.basicsNote} />
        <div className="flex" style={{ gap: 10 }}>
          {SUIT_ORDER.map((suit) => (
            <Chip
              key={suit}
              pixels={basicChip(suit)}
              label={`${SUIT_STAR_NAMES[suit]} · ${SUIT_SHAPES[suit]}`}
              width={190}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel text={CODEX_TEXT.specials} note={CODEX_TEXT.specialsNote} />
        <div className="flex" style={{ gap: 6 }}>
          {SPECIAL_SUIT_PAIRS.map(([left, right]) => (
            <Chip
              key={`${left}${right}`}
              pixels={specialChip(left, right)}
              label={`${left}&${right}`}
              width={92}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SectionLabel text={CODEX_TEXT.drifter} note={CODEX_TEXT.drifterNote} />
        <div className="flex">
          <Chip pixels={drifterChip()} label="떠돌이" width={92} />
        </div>
      </div>
    </div>
  )
}

const ZODIAC_IDS = Object.keys(CONSTELLATION_NAMES) as ConstellationId[]

function ZodiacTab() {
  return (
    <div className="flex h-full w-full flex-col gap-3">
      <SectionLabel text={`황도 12궁 ${ZODIAC_IDS.length}종`} note={CODEX_TEXT.zodiacNote} />
      {/* Six per row: the entry is 160 wide, so 6 × 160 + 5 × 8 = 1000 inside the
          panel's 1008 of usable width. Each card prints its own three strings —
          GDD 11-5 will not let it appear without them, and they are the whole of
          what this tab has to say. */}
      <div className="flex flex-wrap" style={{ gap: 8 }}>
        {ZODIAC_IDS.map((id) => (
          <ConstellationCard key={id} id={id} scale={2} layout="stack" width={160} />
        ))}
      </div>
    </div>
  )
}

function CompanionsTab() {
  const counts = new Map<CompanionTier, number>()
  for (const companion of Object.values(COMPANIONS)) {
    counts.set(companion.tier, (counts.get(companion.tier) ?? 0) + 1)
  }
  const total = Object.keys(COMPANIONS).length
  const [tier, chance, price, kinds] = CODEX_TEXT.tierHeader

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <SectionLabel text={`동반성 ${total}종`} note={CODEX_TEXT.companionsNote} />

      <div className="flex w-[560px] flex-col gap-1">
        <div className="flex text-[9px]" style={{ color: PALETTE.starLink }}>
          <span className="w-40">{tier}</span>
          <span className="w-32 text-right">{chance}</span>
          <span className="w-32 text-right">{price}</span>
          <span className="w-24 text-right">{kinds}</span>
        </div>
        {TIER_ORDER.map((id) => (
          <div key={id} className="flex items-baseline text-[11px] tabular-nums">
            <span className="w-40" style={{ color: PALETTE.starWhite }}>
              {TIER_NAMES[id]}
            </span>
            <span className="w-32 text-right" style={{ color: PALETTE.nebulaTeal }}>
              {COMPANION_TIER_WEIGHTS[id]}%
            </span>
            <span className="w-32 text-right" style={{ color: PALETTE.nebulaAmber }}>
              ✦ {COMPANION_TIER_PRICES[id]}
            </span>
            <span className="w-24 text-right" style={{ color: PALETTE.starGlow }}>
              {counts.get(id) ?? 0}
            </span>
          </div>
        ))}
      </div>

      {/* GDD 7-1-b: stocked but not sellable until the effect parameters exist. The
          shelf already says so in the shop; this says it where the whole system is
          being looked at. */}
      <span className="text-[11px]" style={{ color: PALETTE.ginanEdge }}>
        {CODEX_TEXT.companionsLocked}
      </span>
    </div>
  )
}

const BODIES: Readonly<Record<CodexTab, () => React.JSX.Element>> = {
  chips: ChipsTab,
  zodiac: ZodiacTab,
  companions: CompanionsTab,
}

/** The tab strip. Lit is the open one; the rest are plain. */
function Tab({
  label,
  chosen,
  width,
  height,
  onPick,
}: {
  readonly label: string
  readonly chosen: boolean
  readonly width: number
  readonly height: number
  readonly onPick: () => void
}) {
  return (
    <button
      type="button"
      data-codex={label}
      aria-pressed={chosen}
      onClick={onPick}
      className="rounded text-[11px] font-bold"
      style={{
        width,
        height,
        background: chosen ? PALETTE.nebulaTeal : PALETTE.panel,
        color: chosen ? PALETTE.void : PALETTE.starGlow,
        outline: `1px solid ${chosen ? PALETTE.nebulaTeal : PALETTE.panelEdge}`,
        cursor: 'pointer',
      }}
    >
      {withPixelWords(label, chosen ? PALETTE.void : PALETTE.starGlow)}
    </button>
  )
}

export function Codex() {
  const [tab, setTab] = useState<CodexTab>('chips')
  const spot = CODEX_LAYOUT
  const Body = BODIES[tab]

  return (
    <>
      <At x={spot.tabs.x} y={spot.tabs.y} w={spot.tabs.w} h={spot.tabs.h}>
        <div className="flex" style={{ gap: spot.tabs.gap }}>
          {CODEX_TABS.map((entry) => (
            <Tab
              key={entry.id}
              label={entry.label}
              chosen={tab === entry.id}
              width={spot.tabs.entry}
              height={spot.tabs.h}
              onPick={() => setTab(entry.id)}
            />
          ))}
        </div>
      </At>

      <At x={spot.body.x} y={spot.body.y} w={spot.body.w} h={spot.body.h}>
        <div
          data-panel="codex"
          className="h-full w-full overflow-hidden rounded"
          style={{
            padding: spot.body.pad,
            background: PALETTE.panel,
            outline: `1px solid ${PALETTE.panelEdge}`,
          }}
        >
          <Body />
        </div>
      </At>
    </>
  )
}
