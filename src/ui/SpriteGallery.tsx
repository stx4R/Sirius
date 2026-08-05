// P3-A deliverable: every sprite the art pipeline produces, on one screen.
// Display only — no board, no hand, no game state.

import { CONSTELLATION_NAMES, SPECIAL_SUIT_PAIRS } from '../core/config'
import { SUIT_ORDER } from '../core/types'
import type { ConstellationId, SuitId } from '../core/types'
import { basicChip, constellationIcon, drifterChip, specialChip } from '../assets/compose'
import type { PixelMap } from '../assets/compose'
import { PALETTE } from '../assets/palette'
import { PixelSprite } from './PixelSprite'

/** GDD 3-1. Core carries no display names, so they live here with the sprites. */
const SUIT_LABELS: Readonly<Record<SuitId, string>> = {
  GAC: 'Gacrux · 클로버',
  IMA: 'Imai · 다이아',
  GIN: 'Ginan · 하트',
  MIM: 'Mimosa · X자',
  ACR: 'Acrux · 스페이드',
}

interface SpriteProps {
  readonly pixels: PixelMap
  readonly label: string
  readonly scale?: number
}

function Sprite({ pixels, label, scale = 2 }: SpriteProps) {
  return (
    <figure className="flex w-24 flex-col items-center gap-2">
      <PixelSprite pixels={pixels} scale={scale} alt={label} />
      <figcaption
        className="text-center text-[11px] leading-tight"
        style={{ color: PALETTE.textDim }}
      >
        {label}
      </figcaption>
    </figure>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline gap-3">
        <h2 className="text-sm font-bold tracking-wide" style={{ color: PALETTE.starWhite }}>
          {title}
        </h2>
        {note !== undefined && (
          <span className="text-[11px]" style={{ color: PALETTE.textDim }}>
            {note}
          </span>
        )}
      </header>
      <div
        className="flex flex-wrap gap-x-2 gap-y-5 rounded border p-5"
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
          <p className="text-[11px]" style={{ color: PALETTE.textDim }}>
            GDD 11절 · 16×16 픽셀맵을 정수 2배로 표시 · 이미지 파일 없음
          </p>
        </header>

        <Section title="기본 조각 5종" note="GDD 3-1">
          {SUIT_ORDER.map((suit) => (
            <Sprite key={suit} pixels={basicChip(suit)} label={SUIT_LABELS[suit]} />
          ))}
        </Section>

        <Section title="특수 조각 10종" note="GDD 3-2 · 기본 5종에서 합성 생성">
          {SPECIAL_SUIT_PAIRS.map(([left, right]) => (
            <Sprite
              key={`${left}${right}`}
              pixels={specialChip(left, right)}
              label={`${left}&${right}`}
            />
          ))}
        </Section>

        <Section title="떠돌이 조각" note="GDD 3-3 · 고유 문양 없음">
          <Sprite pixels={drifterChip()} label="떠돌이" />
        </Section>

        <Section title="별자리 아이콘 12종" note="GDD 6절 · 판정 패턴 도식">
          {CONSTELLATION_IDS.map((id) => (
            <Sprite key={id} pixels={constellationIcon(id)} label={CONSTELLATION_NAMES[id]} />
          ))}
        </Section>

        <Section title="확대 검수" note="6배 · 경계가 뭉개지지 않는지 확인">
          {SUIT_ORDER.map((suit) => (
            <Sprite key={suit} pixels={basicChip(suit)} label={suit} scale={6} />
          ))}
          <Sprite pixels={drifterChip()} label="떠돌이" scale={6} />
        </Section>
      </div>
    </main>
  )
}
