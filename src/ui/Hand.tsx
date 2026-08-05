// The hand: HAND_SIZE chips drawn each turn (GDD 4-2). Clicking picks one up,
// clicking it again puts it back down.

import { MAX_PLACEMENTS_PER_TURN } from '../core/config'
import type { Chip } from '../core/types'
import { chipSprite } from '../assets/compose'
import { PALETTE } from '../assets/palette'
import { PixelSprite } from './PixelSprite'

interface Props {
  readonly hand: readonly Chip[]
  readonly selected: Chip | null
  readonly placedThisTurn: number
  readonly onSelect: (chip: Chip) => void
}

export function Hand({ hand, selected, placedThisTurn, onSelect }: Props) {
  const full = placedThisTurn >= MAX_PLACEMENTS_PER_TURN

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px]">
        <span style={{ color: PALETTE.starGlow }}>손패 {hand.length}장</span>
        <span style={{ color: full ? PALETTE.nebulaAmber : PALETTE.starGlow }}>
          이번 턴 배치 {placedThisTurn} / {MAX_PLACEMENTS_PER_TURN}
          {full && ' — 턴을 종료하세요'}
        </span>
      </div>

      <div
        className="flex gap-2 rounded p-3"
        style={{ background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
      >
        {hand.map((chip) => {
          const isSelected = selected?.id === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              disabled={full && !isSelected}
              onClick={() => onSelect(chip)}
              className="rounded transition-transform"
              style={{
                outline: isSelected ? `2px solid ${PALETTE.starWhite}` : '2px solid transparent',
                transform: isSelected ? 'translateY(-6px)' : 'none',
                opacity: full && !isSelected ? 0.35 : 1,
                cursor: full && !isSelected ? 'default' : 'pointer',
              }}
            >
              <PixelSprite pixels={chipSprite(chip)} scale={2} alt="" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
