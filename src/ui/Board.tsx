// The 5×5 star chart (GDD 4-1). Display and pointer handling only — whether a
// placement is legal is core's answer, given when the store replays the staged
// list through `placeChips`.

import { AnimatePresence, motion } from 'framer-motion'
import { BOARD_SIZE } from '../core/config'
import { position } from '../core/board'
import type { Board as BoardState, Chip, Position } from '../core/types'
import { chipSprite, lockIcon } from '../assets/compose'
import { PALETTE, mix } from '../assets/palette'
import { LAND_SPRING } from './motion'
import { PixelSprite } from './PixelSprite'

/** GDD 11-4: 72px cell = 64px chip plus 8px of gutter. */
export const CELL_SIZE = 72
/** GDD 11-10: 2px between cells, so the board measures 5×72 + 4×2 = 368. */
export const CELL_GAP = 2
export const BOARD_PIXELS = BOARD_SIZE * CELL_SIZE + (BOARD_SIZE - 1) * CELL_GAP

/**
 * A pale hairline, so twenty-five empty cells read as a chart to place onto
 * rather than as one dark rectangle. Derived from the palette rather than added
 * to it — `mix` is how the cards make their tones too (GDD 11-7).
 */
const CELL_BORDER = mix(PALETTE.panelEdge, PALETTE.starWhite, 0.32)

/** How far down a chip that is not this suit's turn is pushed. */
const DIM_BRIGHTNESS = 0.4

interface Props {
  readonly board: BoardState
  /** Shown at half strength under the cursor while a chip is held. */
  readonly holding: Chip | null
  /** Cells the settlement is currently lighting up, as "row,col". */
  readonly lit?: ReadonlySet<string>
  /**
   * Drops every chip that is not lit to 40% while the deck is shuffling or the
   * settlement is between suits, so what is being counted right now is the only
   * bright thing on the board.
   */
  readonly dim?: boolean
  readonly reduced?: boolean
  readonly onPlace: (pos: Position) => void
}

const key = (pos: Position) => `${pos.row},${pos.col}`

export function Board({ board, holding, lit, dim = false, reduced = false, onPlace }: Props) {
  return (
    // Sized in absolute pixels rather than by its parent: the board sits at a
    // fixed spot on the canvas (GDD 11-10), and the canvas is what scales.
    <div
      className="grid rounded"
      style={{
        width: BOARD_PIXELS,
        height: BOARD_PIXELS,
        gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
        gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
        gap: CELL_GAP,
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
              className="group relative flex items-center justify-center rounded transition-colors"
              style={{
                border: `1px solid ${CELL_BORDER}`,
                cursor: canDrop ? 'pointer' : 'default',
              }}
            >
              {/* The gold ring a suit's chips wear on its beat (GDD 5-1 order). */}
              <AnimatePresence>
                {isLit && (
                  <motion.span
                    className="pointer-events-none absolute inset-0.5 rounded"
                    initial={reduced ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                    style={{
                      border: `2px solid ${PALETTE.nebulaAmber}`,
                      boxShadow: `0 0 10px ${PALETTE.nebulaAmber}`,
                    }}
                  />
                )}
              </AnimatePresence>

              {cell !== null && (
                <motion.span
                  className="relative"
                  // The same layoutId the chip carried in the hand, so Framer
                  // flies this one element into the cell. LAND_SPRING is
                  // under-damped, which is where the bounce on landing comes from.
                  layoutId={cell.id}
                  animate={{
                    filter: dim && !isLit ? `brightness(${DIM_BRIGHTNESS})` : 'brightness(1)',
                  }}
                  transition={reduced ? { duration: 0 } : LAND_SPRING}
                >
                  <PixelSprite pixels={chipSprite(cell)} scale={2} alt="" />

                  {/* GDD 4-2: a placement is fixed the moment it lands. */}
                  <motion.span
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full"
                    initial={reduced ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={reduced ? { duration: 0 } : { ...LAND_SPRING, delay: 0.12 }}
                    style={{ background: PALETTE.void, outline: `1px solid ${PALETTE.starLink}` }}
                  >
                    <PixelSprite pixels={lockIcon()} scale={1} alt="" />
                  </motion.span>
                </motion.span>
              )}

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
