// The hand: HAND_SIZE chips drawn each turn (GDD 4-2). Clicking picks one up,
// clicking it again puts it back down.
//
// Laid out as an overlapping fan rather than a row. Eight 64px chips in a line is
// 512px of the 1366 a booth laptop has (GDD 12-1), and a row that wide competes
// with the board for the eye; fanned, the same eight take 432px and read as a
// hand being held.
//
// The overlap is bounded by one rule: every suit symbol stays visible. A chip's
// symbol is the middle 16px of its 32px map (GDD 11-4), so at 2× the symbol
// occupies the middle 32px of 64 — anything up to 16px of overlap per side keeps
// it clear, and SPREAD is set from that.

import { motion } from 'framer-motion'
import { useState } from 'react'
import { HAND_SIZE, MAX_PLACEMENTS_PER_TURN } from '../core/config'
import type { Chip } from '../core/types'
import { chipSprite } from '../assets/compose'
import { PALETTE } from '../assets/palette'
import { DRAW_STAGGER, LAND_SPRING, SPRING } from './motion'
import { PixelSprite } from './PixelSprite'

/** GDD 11-4: a chip is 32×32 shown at 2×. */
const CHIP = 64
/** Centre-to-centre. 46 leaves 18px of overlap, short of the 16px+16px of gutter. */
const SPREAD = 46
/** Downward drop per step from the middle, squared — this is what curves the fan. */
const ARC_DROP = 3.4
/** Degrees of tilt per step from the middle. */
const TILT = 4

const LIFT_HOVER = 22
const LIFT_SELECTED = 32
/** How far a chip leans aside to make room for the one being hovered. */
const MAKE_ROOM = 16

const FAN_WIDTH = HAND_SIZE * SPREAD + CHIP
const FAN_HEIGHT = CHIP + ARC_DROP * (HAND_SIZE / 2) ** 2 + LIFT_SELECTED

interface Props {
  readonly hand: readonly Chip[]
  readonly selected: Chip | null
  readonly placedThisTurn: number
  readonly reduced?: boolean
  readonly onSelect: (chip: Chip) => void
}

export function Hand({ hand, selected, placedThisTurn, reduced = false, onSelect }: Props) {
  const full = placedThisTurn >= MAX_PLACEMENTS_PER_TURN
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 text-[11px]">
        <span style={{ color: PALETTE.starGlow }}>손패 {hand.length}장</span>
        <span style={{ color: full ? PALETTE.nebulaAmber : PALETTE.starGlow }}>
          이번 턴 배치 {placedThisTurn} / {MAX_PLACEMENTS_PER_TURN}
          {full && ' — 턴을 종료하세요'}
        </span>
      </div>

      <div className="relative" style={{ width: FAN_WIDTH, height: FAN_HEIGHT }}>
        {hand.map((chip, i) => {
          const isSelected = selected?.id === chip.id
          const isHovered = hovered === i
          const disabled = full && !isSelected

          // Measured from the middle of the hand, so the fan stays centred as
          // chips leave it and the remaining ones close the gap.
          const offset = i - (hand.length - 1) / 2

          let x = offset * SPREAD
          if (hovered !== null && hovered !== i) {
            const distance = i - hovered
            x += Math.sign(distance) * (MAKE_ROOM / Math.abs(distance))
          }

          const lift = isSelected ? LIFT_SELECTED : isHovered ? LIFT_HOVER : 0

          return (
            <motion.button
              key={chip.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(chip)}
              onHoverStart={() => !disabled && setHovered(i)}
              onHoverEnd={() => setHovered((current) => (current === i ? null : current))}
              className="absolute top-0 rounded"
              style={{
                left: '50%',
                width: CHIP,
                height: CHIP,
                marginLeft: -CHIP / 2,
                zIndex: isSelected || isHovered ? HAND_SIZE + 1 : i,
                transformOrigin: '50% 120%',
                outline: isSelected ? `2px solid ${PALETTE.starWhite}` : '2px solid transparent',
                boxShadow: isSelected ? `0 0 14px ${PALETTE.starWhite}` : 'none',
                opacity: disabled ? 0.35 : 1,
                cursor: disabled ? 'default' : 'pointer',
              }}
              // Chips fly in from off the left edge and land in order, so a draw
              // reads as eight separate events rather than one appearance.
              initial={reduced ? false : { x: -FAN_WIDTH - 240, y: 70, rotate: -34, opacity: 0 }}
              animate={{
                x,
                y: offset * offset * ARC_DROP - lift,
                rotate: offset * TILT,
                scale: isSelected ? 1.12 : isHovered ? 1.06 : 1,
                opacity: disabled ? 0.35 : 1,
              }}
              transition={
                reduced ? { duration: 0 } : { ...SPRING, delay: hovered === null ? i * DRAW_STAGGER : 0 }
              }
            >
              {/* Shares an id with the cell this chip lands in, so Framer carries
                  the same element from the hand to the board rather than fading
                  one out and another in (spec: the chip travels). The id is on
                  the sprite, not the button: the button is already running the
                  fan's own x/y animation, and a layout animation on top of that
                  would fight it. */}
              <motion.span layoutId={chip.id} transition={reduced ? { duration: 0 } : LAND_SPRING}>
                <PixelSprite pixels={chipSprite(chip)} scale={2} alt="" />
              </motion.span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
