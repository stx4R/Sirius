// GDD 11-5: a constellation card is never shown on its own.
//
// The card carries the figure, and the figure says nothing about what scores —
// aries and libra are both "three in a row" and their star charts look nothing
// alike. So this component is the only way to put a card on screen, and it
// always prints the name, the condition and the multiplier with it.
//
// All three strings are derived from config, so the card and the engine cannot
// disagree about what the constellation does.

import { motion } from 'framer-motion'
import {
  CONSTELLATION_MULTIPLIERS,
  CONSTELLATION_NAMES,
  CONSTELLATION_RULES,
} from '../core/config'
import type { ConstellationId, LineAxis } from '../core/types'
import { constellationCard } from '../assets/compose'
import { AXIS_COLOURS, PALETTE } from '../assets/palette'
import { PixelSprite } from './PixelSprite'

const AXIS_LABELS: Readonly<Record<LineAxis, string>> = {
  vertical: '세로',
  horizontal: '가로',
  diagonal: '대각',
  shape_A: '도형',
  shape_T: '도형',
  global: '전역',
}

export function conditionOf(id: ConstellationId): string {
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

export function multiplierOf(id: ConstellationId): string {
  const spec = CONSTELLATION_MULTIPLIERS[id]
  if (spec.kind === 'fixed') return `×${spec.value.toFixed(1)}`
  const values = Object.values(spec.table)
  return `×${Math.min(...values).toFixed(1)}~${Math.max(...values).toFixed(1)}`
}

interface Props {
  readonly id: ConstellationId
  readonly scale?: number
  /**
   * `stack` puts the text under the card, `row` beside it. Both keep the three
   * strings attached, which is the rule GDD 11-5 actually sets — the four held
   * constellations sit in a column next to a 360px board, and stacked captions
   * would run past the bottom of it.
   */
  readonly layout?: 'stack' | 'row'
  /** Lit while this constellation is firing in the settlement (GDD 5-1). */
  readonly firing?: boolean
  readonly reduced?: boolean
}

export function ConstellationCard({
  id,
  scale = 2,
  layout = 'stack',
  firing = false,
  reduced = false,
}: Props) {
  const frame = AXIS_COLOURS[CONSTELLATION_RULES[id].axis]
  const name = CONSTELLATION_NAMES[id]

  return (
    <motion.figure
      className={
        layout === 'row'
          ? 'flex items-center gap-2 rounded p-1'
          : 'flex w-28 flex-col items-center gap-2'
      }
      animate={{
        scale: firing ? 1.08 : 1,
        boxShadow: firing ? `0 0 14px ${frame}` : '0 0 0 rgba(0,0,0,0)',
      }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 18 }}
    >
      <PixelSprite pixels={constellationCard(id)} scale={scale} alt={name} />
      <figcaption
        className={
          layout === 'row'
            ? 'text-left text-[10px] leading-tight'
            : 'text-center text-[11px] leading-tight'
        }
      >
        <span className="block font-bold" style={{ color: frame }}>
          {name}
        </span>
        <span className="block" style={{ color: PALETTE.starGlow }}>
          {conditionOf(id)}
        </span>
        <span className="block" style={{ color: PALETTE.starWhite }}>
          {multiplierOf(id)}
        </span>
      </figcaption>
    </motion.figure>
  )
}
