// P3-A deliverable: every sprite the art pipeline produces, on one screen.
// Display only — no board, no hand, no game state.

import type { ReactNode } from 'react'
import { CONSTELLATION_NAMES, SPECIAL_SUIT_PAIRS } from '../core/config'
import { SUIT_ORDER } from '../core/types'
import type { ConstellationId, SuitId } from '../core/types'
import { basicChip, drifterChip, specialChip } from '../assets/compose'
import type { PixelMap } from '../assets/compose'
import { PALETTE } from '../assets/palette'
import { ConstellationCard } from './ConstellationCard'
import { PixelSprite } from './PixelSprite'

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

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline gap-3">
        <h2 className="text-sm font-bold tracking-wide" style={{ color: PALETTE.starWhite }}>
          {title}
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
          <h1 className="text-lg font-bold">STA-mble — 스프라이트 갤러리</h1>
          <p className="text-[11px]" style={{ color: PALETTE.starGlow }}>
            GDD 11절 · 칩 32×32 → 64px · 별자리 카드 36×52 → 72×104px · 이미지 파일 없음
          </p>
        </header>

        <Section title="기본 조각 5종" note="GDD 3-1 · 노치 6개 · 안쪽 링 · 점선 원 · 중앙 문양">
          {SUIT_ORDER.map((suit) => (
            <Chip key={suit} pixels={basicChip(suit)} label={SUIT_LABELS[suit]} />
          ))}
        </Section>

        <Section title="특수 조각 10종" note="GDD 3-2 · 16열에서 잘라 합성">
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

        <Section title="확대 검수" note="4배 · 도트 경계와 노치 정렬 확인">
          {SUIT_ORDER.map((suit) => (
            <Chip key={suit} pixels={basicChip(suit)} label={suit} scale={4} />
          ))}
          <Chip pixels={drifterChip()} label="떠돌이" scale={4} />
          <Chip pixels={specialChip('GAC', 'ACR')} label="GAC&ACR" scale={4} />
        </Section>
      </div>
    </main>
  )
}
