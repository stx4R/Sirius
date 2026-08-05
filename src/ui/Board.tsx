// The 5×5 star chart (GDD 4-1). Display and pointer handling only — whether a
// placement is legal is core's answer, given when the store replays the staged
// list through `placeChips`.

import { BOARD_SIZE } from '../core/config'
import { position } from '../core/board'
import type { Board as BoardState, Chip, Position } from '../core/types'
import { chipSprite } from '../assets/compose'
import { PALETTE } from '../assets/palette'
import { PixelSprite } from './PixelSprite'

/** GDD 11-4: 72px cell = 64px chip plus 8px of gutter. */
export const CELL_SIZE = 72

interface Props {
  readonly board: BoardState
  /** Shown at half strength under the cursor while a chip is held. */
  readonly holding: Chip | null
  /** Cells the settlement is currently lighting up, as "row,col". */
  readonly lit?: ReadonlySet<string>
  readonly onPlace: (pos: Position) => void
}

const key = (pos: Position) => `${pos.row},${pos.col}`

export function Board({ board, holding, lit, onPlace }: Props) {
  return (
    <div
      className="grid rounded"
      style={{
        gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
        background: PALETTE.panel,
        outline: `1px solid ${PALETTE.panelEdge}`,
      }}
    >
      {board.flatMap((row, r) =>
        row.map((cell, c) => {
          const pos = position(r, c)
          const isLit = lit?.has(key(pos)) ?? false
          const canDrop = cell === null && holding !== null

          return (
            <button
              key={key(pos)}
              type="button"
              disabled={cell !== null || holding === null}
              onClick={() => onPlace(pos)}
              className="group flex items-center justify-center transition-colors"
              style={{
                border: `1px solid ${isLit ? PALETTE.starWhite : PALETTE.panelEdge}`,
                background: isLit ? PALETTE.nebulaDeep : 'transparent',
                cursor: canDrop ? 'pointer' : 'default',
              }}
            >
              {cell !== null && <PixelSprite pixels={chipSprite(cell)} scale={2} alt="" />}
              {canDrop && (
                <span className="opacity-0 transition-opacity group-hover:opacity-40">
                  <PixelSprite pixels={chipSprite(holding)} scale={2} alt="" />
                </span>
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}
