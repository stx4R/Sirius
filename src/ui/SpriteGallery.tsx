// P3-A deliverable: every sprite the art pipeline produces, on one screen.
// Display only — no board, no hand, no game state.

import type { ReactNode } from 'react'
import { CONSTELLATION_NAMES, SPECIAL_SUIT_PAIRS } from '../core/config'
import { SUIT_ORDER } from '../core/types'
import type { ConstellationId, SuitId } from '../core/types'
import { basicChip, drifterChip, orionSprite, specialChip } from '../assets/compose'
import type { PixelMap } from '../assets/compose'
import { PALETTE } from '../assets/palette'
import type { OrionMood } from '../assets/palette'
import { ConstellationCard } from './ConstellationCard'
import { PixelSprite } from './PixelSprite'
import { withPixelWords } from './PixelWord'

/** GDD 11-8's four, in the order the section reads them. */
const ORION_MOODS: readonly { readonly mood: OrionMood; readonly label: string }[] = [
  { mood: 'calm', label: '기본' },
  { mood: 'surprised', label: '놀람' },
  { mood: 'pleased', label: '만족' },
  { mood: 'dim', label: '저묾' },
]

/** GDD 3-1. Core carries no display names, so they live here with the sprites. */
const SUIT_LABELS: Readonly<Record<SuitId, string>> = {
  GAC: 'Gacrux · 클로버',
  IMA: 'Imai · 다이아',
  GIN: 'Ginan · 하트',
  MIM: 'Mimosa · X자',
  ACR: 'Acrux · 스페이드',
}

function Chip({ pixels, label, scale = 2 }: { pixels: PixelMap; label: string; scale?: number }) {
  return (
    <figure className="flex w-28 flex-col items-center gap-2">
      <PixelSprite pixels={pixels} scale={scale} alt={label} />
      <figcaption
        className="text-center text-[11px] leading-tight"
        style={{ color: PALETTE.starGlow }}
      >
        {label}
      </figcaption>
    </figure>
  )
}

function Section({
  title,
  note,
  id,
  children,
}: {
  title: string
  note?: string
  /** So `npm run shot` can find one section to clip rather than the whole page. */
  id?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4" id={id}>
      <header className="flex items-baseline gap-3">
        {/* `text-sm` is Galmuri14, which has no Greek or Cyrillic at all, so a title
            naming MЦLГЦS would render three of its six characters in a system font
            (`tools/font-fallback.mjs`). At 2× the sprite's x-height is exactly this
            line's. */}
        <h2 className="text-sm font-bold tracking-wide" style={{ color: PALETTE.starWhite }}>
          {withPixelWords(title, PALETTE.starWhite)}
        </h2>
        {note !== undefined && (
          <span className="text-[11px]" style={{ color: PALETTE.starGlow }}>
            {note}
          </span>
        )}
      </header>
      <div
        className="flex flex-wrap gap-x-2 gap-y-6 rounded border p-6"
        style={{ background: PALETTE.panel, borderColor: PALETTE.panelEdge }}
      >
        {children}
      </div>
    </section>
  )
}

const CONSTELLATION_IDS = Object.keys(CONSTELLATION_NAMES) as ConstellationId[]

export function SpriteGallery() {
  return (
    <main
      className="min-h-screen p-10 font-mono"
      style={{ background: PALETTE.void, color: PALETTE.starWhite }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-1">
          {/* GDD 2: the product is Sirius. This was the last user-visible STA-mble. */}
          <h1 className="text-[22px] font-bold">Sirius — 스프라이트 갤러리</h1>
          <p className="text-[11px]" style={{ color: PALETTE.starGlow }}>
            GDD 11절 · 칩 32×32 → 64px · 별자리 카드 36×52 → 72×104px · 이미지 파일 없음
          </p>
          <a href="#" className="text-[11px] underline" style={{ color: PALETTE.nebulaTeal }}>
            ← 게임으로
          </a>
        </header>

        <Section title="기본 조각 5종" note="GDD 3-1 · 노치 6개 · 안쪽 링 · 점선 원 · 중앙 문양">
          {SUIT_ORDER.map((suit) => (
            <Chip key={suit} pixels={basicChip(suit)} label={SUIT_LABELS[suit]} />
          ))}
        </Section>

        <Section title="MЦLГЦS 조각 10종" note="GDD 3-2 · 16열에서 잘라 합성">
          {SPECIAL_SUIT_PAIRS.map(([left, right]) => (
            <Chip
              key={`${left}${right}`}
              pixels={specialChip(left, right)}
              label={`${left}&${right}`}
            />
          ))}
        </Section>

        <Section title="떠돌이 조각" note="GDD 11-6 · 동일 레이아웃 · 무지개 바탕 · 왕관">
          <Chip pixels={drifterChip()} label="떠돌이" />
        </Section>

        <Section
          title="별자리 카드 12종"
          note="GDD 11-5 · 카드마다 다른 별하늘 · 이름·조건·배율 항상 병기"
        >
          {CONSTELLATION_IDS.map((id) => (
            <ConstellationCard key={id} id={id} />
          ))}
        </Section>

        {/* BOOTH-6c: GDD 11-8's four expressions, side by side. The play screen
            only ever shows one at a time, so this is the only place they can be
            compared — and comparing them is the point of having four. */}
        <Section
          title="ORION 표정 4종"
          note="GDD 11-8 · 60×78 → 120×156px · 머리와 팔만 사람 · 몸통은 Hα → 반사성운"
          id="orion"
        >
          {ORION_MOODS.map(({ mood, label }) => (
            <Chip key={mood} pixels={orionSprite(mood)} label={label} scale={2} />
          ))}
        </Section>

        <Section title="확대 검수" note="4배 · 도트 경계와 노치 정렬 확인">
          {SUIT_ORDER.map((suit) => (
            <Chip key={suit} pixels={basicChip(suit)} label={suit} scale={4} />
          ))}
          <Chip pixels={drifterChip()} label="떠돌이" scale={4} />
          <Chip pixels={specialChip('GAC', 'ACR')} label="GAC&ACR" scale={4} />
        </Section>

        {/* 4× on ORION as well, for the three things GDD 11-8 has to be checked
            against by eye: the brightness order including the outline, whether the
            anatomy reads, and the luma steps between parts. */}
        <Section title="ORION 확대 검수" note="4배 · 밝기 위계 · 신체 구조 · 부위 대비" id="orion-zoom">
          {ORION_MOODS.map(({ mood, label }) => (
            <figure key={mood} className="flex w-64 flex-col items-center gap-2">
              <PixelSprite pixels={orionSprite(mood)} scale={4} alt={label} />
              <figcaption className="text-[11px]" style={{ color: PALETTE.starGlow }}>
                {label}
              </figcaption>
            </figure>
          ))}
        </Section>
      </div>
    </main>
  )
}
