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

/**
 * GDD 5-1 wants the card to react when its line fires, and CLAUDE.md §7 will not
 * let a fractional transform do it. This used to animate to `scale: 1.08`, which
 * held every dot of the star chart and every glyph of the caption between pixels
 * for as long as the beat lasted — the one place in the game that broke the
 * integer-scale rule, and it broke it while the player was looking straight at it.
 *
 * A two-pixel hop replaces it. The keyframes are timed almost on top of each
 * other so the value is only ever 0 or -2 and never 1.37: this version of
 * framer-motion exports no `steps` easing, and duplicated times are how a step
 * function is written without one. Two logical pixels stay two whole device
 * pixels at every integer canvas scale (GDD 11-10).
 *
 * The hop is the impact; the glow is what sustains it, and a box-shadow costs
 * nothing because it is painted outside the sprite rather than resampling it.
 */
const FIRING_HOP = [0, -2, -2, 0]
const FIRING_TIMES = [0, 0.001, 0.7, 0.701]

interface Props {
  readonly id: ConstellationId
  readonly scale?: number
  /**
   * `stack` puts the text under the card, `row` beside it. Both keep the three
   * strings attached, which is the rule GDD 11-5 actually sets; what varies is
   * only where they sit.
   */
  readonly layout?: 'stack' | 'row'
  /** Width of the text column, so a 2×2 grid can hold its cells to one size. */
  readonly width?: number
  /** Lit while this constellation is firing in the settlement (GDD 5-1). */
  readonly firing?: boolean
  readonly reduced?: boolean
}

export function ConstellationCard({
  id,
  scale = 2,
  layout = 'stack',
  width,
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
          : 'flex flex-col items-center gap-1'
      }
      style={layout === 'stack' ? { width } : undefined}
      animate={{
        y: firing ? FIRING_HOP : 0,
        boxShadow: firing ? `0 0 14px ${frame}` : '0 0 0 rgba(0,0,0,0)',
      }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              y: { duration: 0.3, times: FIRING_TIMES, ease: 'linear' },
              boxShadow: { duration: 0.2 },
            }
      }
    >
      <PixelSprite pixels={constellationCard(id)} scale={scale} alt={name} />
      <figcaption
        className={
          layout === 'row'
            ? 'text-left text-[11px] leading-tight'
            : 'text-center text-[9px] leading-tight'
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
