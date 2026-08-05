// P3-A deliverable: every sprite the art pipeline produces, on one screen.
// Display only — no board, no hand, no game state.

import type { ReactNode } from 'react'
import {
  CONSTELLATION_MULTIPLIERS,
  CONSTELLATION_NAMES,
  CONSTELLATION_RULES,
  SPECIAL_SUIT_PAIRS,
} from '../core/config'
import { SUIT_ORDER } from '../core/types'
import type { ConstellationId, LineAxis, SuitId } from '../core/types'
import { basicChip, constellationCard, drifterChip, specialChip } from '../assets/compose'
import type { PixelMap } from '../assets/compose'
import { AXIS_COLOURS, PALETTE } from '../assets/palette'
import { PixelSprite } from './PixelSprite'

/** GDD 3-1. Core carries no display names, so they live here with the sprites. */
const SUIT_LABELS: Readonly<Record<SuitId, string>> = {
  GAC: 'Gacrux · 클로버',
  IMA: 'Imai · 다이아',
  GIN: 'Ginan · 하트',
  MIM: 'Mimosa · X자',
  ACR: 'Acrux · 스페이드',
}

const AXIS_LABELS: Readonly<Record<LineAxis, string>> = {
  vertical: '세로',
  horizontal: '가로',
  diagonal: '대각',
  shape_A: '도형',
  shape_T: '도형',
  global: '전역',
}

/**
 * GDD 11-5: the card shows the figure, not the rule, so the rule is printed
 * beside it. Both strings are derived from config — the card and the engine
 * cannot disagree about what scores.
 */
function conditionOf(id: ConstellationId): string {
  const rule = CONSTELLATION_RULES[id]
  switch (rule.axis) {
    case 'shape_A':
      return 'ㅅ자 패턴'
    case 'shape_T':
      return 'ㅗ자 패턴'
    case 'global':
      return '보드 최다 문양'
    default:
      return `${AXIS_LABELS[rule.axis]} ${rule.length}연속${rule.exact ? '' : ' 이상'}`
  }
}

function multiplierOf(id: ConstellationId): string {
  const spec = CONSTELLATION_MULTIPLIERS[id]
  if (spec.kind === 'fixed') return `×${spec.value.toFixed(1)}`
  const values = Object.values(spec.table)
  return `×${Math.min(...values).toFixed(1)}~${Math.max(...values).toFixed(1)}`
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <figcaption className="text-center text-[11px] leading-tight" style={{ color: PALETTE.starGlow }}>
      {children}
    </figcaption>
  )
}

function Chip({ pixels, label, scale = 2 }: { pixels: PixelMap; label: string; scale?: number }) {
  return (
    <figure className="flex w-28 flex-col items-center gap-2">
      <PixelSprite pixels={pixels} scale={scale} alt={label} />
      <Caption>{label}</Caption>
    </figure>
  )
}

function Card({ id }: { id: ConstellationId }) {
  const frame = AXIS_COLOURS[CONSTELLATION_RULES[id].axis]
  return (
    <figure className="flex w-28 flex-col items-center gap-2">
      <PixelSprite pixels={constellationCard(id)} scale={2} alt={CONSTELLATION_NAMES[id]} />
      <Caption>
        <span className="block font-bold" style={{ color: frame }}>
          {CONSTELLATION_NAMES[id]}
        </span>
        <span className="block">{conditionOf(id)}</span>
        <span className="block" style={{ color: PALETTE.starWhite }}>
          {multiplierOf(id)}
        </span>
      </Caption>
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
          note="GDD 11-5 · 실제 성도 + 5×5 판정 격자 · 프레임 색 = 축"
        >
          {CONSTELLATION_IDS.map((id) => (
            <Card key={id} id={id} />
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
