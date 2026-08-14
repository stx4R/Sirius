// The furniture the two menu screens share (BOOTH-9d).
//
// There are two screens in this game that are not the game: the main page
// (`Title.tsx`, GDD 11-10's title table) and the ESC pause window (`Pause.tsx`,
// GDD 12-2-d). Both are the whole 1120×630 plane in the void colour, both put one
// centred column of plain rows on a star field, and both open the same settings
// page. This file is what they have in common, so the two cannot drift apart.
//
// It arrived when the main page did. BOOTH-9c wrote the sky and the row for the
// pause window alone; BOOTH-9d's main page is the same picture, and the mock they
// were both drawn from — `docs/brand/title-screen-mock-1120x630.png` — is one
// picture, not two.

import { motion } from 'framer-motion'
import { mulberry32 } from '../core/rng'
import { PALETTE } from '../assets/palette'
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './Canvas'

/**
 * The star field both screens sit on.
 *
 * ★ Seeded, not `Math.random()` (CLAUDE.md §8). The rule is there so the simulator
 * and the tests reproduce, and it applies to decoration for a third reason: every
 * `npm run shot` has to photograph the same sky, or the duplicate check at the end
 * of the screenshot tool is comparing two pictures that were never the same.
 *
 * ★ One seed, so both screens show the *same* sky. They are the same place — the
 * game stood down — and `처음 화면으로` walks from one to the other, so a second sky
 * would read as a scene change where there is none.
 *
 * The tones come off the palette and land where GDD 11-7 already puts them —
 * `panelEdge` is named "the faint specks behind a star chart", so most of the sky
 * is that, and the handful of `starWhite` ones are the only 2px dots.
 */
const FIELD_SEED = 9031
const FIELD_STARS = 120

interface Star {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly ink: string
}

function starField(): readonly Star[] {
  const rng = mulberry32(FIELD_SEED)
  const stars: Star[] = []

  for (let i = 0; i < FIELD_STARS; i++) {
    // Whole pixels, so a 1px dot is a dot rather than two grey ones (CLAUDE.md §7).
    const x = Math.floor(rng() * CANVAS_WIDTH)
    const y = Math.floor(rng() * CANVAS_HEIGHT)
    const tone = rng()
    const ink =
      tone < 0.08
        ? PALETTE.starWhite
        : tone < 0.3
          ? PALETTE.starGlow
          : tone < 0.65
            ? PALETTE.starLink
            : PALETTE.panelEdge

    stars.push({ x, y, size: tone < 0.08 ? 2 : 1, ink })
  }

  return stars
}

/** Built once for the life of the page: nothing varies the sky. */
export const STAR_FIELD = starField()

/** The sky, as absolutely positioned specks inside a full-plane box. */
export function StarField() {
  return (
    <>
      {STAR_FIELD.map((star, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: star.x,
            top: star.y,
            width: star.size,
            height: star.size,
            background: star.ink,
          }}
        />
      ))}
    </>
  )
}

/**
 * One row of a menu.
 *
 * Plain text on the sky rather than a filled button, which is the mock's list and
 * also the honest shape: equally weighted choices, none of them the one the screen
 * is pushing. The lit state is on hover and on focus, so a keyboard tab shows the
 * same thing a mouse does.
 *
 * `note` is the second line a disabled row needs — the main page's `게임 시작` is
 * shut on a booth build and has to say why (GDD 12-2-b). It is the only thing that
 * makes a row anything other than one word.
 */
export function MenuRow({
  label,
  note,
  disabled = false,
  reduced,
  width,
  height,
  onPick,
}: {
  readonly label: string
  readonly note?: string
  readonly disabled?: boolean
  readonly reduced: boolean
  readonly width: number
  readonly height: number
  readonly onPick: () => void
}) {
  return (
    <motion.button
      type="button"
      // One attribute for both screens: a row is a row, and the screenshot tool
      // reaches for them the same way on the title as in the pause window.
      data-menu={label}
      onClick={onPick}
      disabled={disabled}
      className="flex flex-col items-center justify-center rounded"
      style={{ width, height, cursor: disabled ? 'default' : 'pointer' }}
      initial={false}
      animate={{
        backgroundColor: 'rgba(0,0,0,0)',
        color: disabled ? PALETTE.starLink : PALETTE.starGlow,
      }}
      whileHover={disabled ? {} : { backgroundColor: PALETTE.panel, color: PALETTE.starWhite }}
      whileFocus={disabled ? {} : { backgroundColor: PALETTE.panel, color: PALETTE.starWhite }}
      transition={{ duration: reduced ? 0 : 0.12 }}
    >
      {/* 22px is Galmuri11 at 2×, measured against the mock: its menu ink is 20px
          tall and `게임 시작` is 93px wide, and this face at this size draws 21 and
          97 (`tools/`-side measurement, BOOTH-9d). */}
      <span className="text-[22px] leading-none">{label}</span>
      {note !== undefined && (
        <span className="mt-1 text-[9px] leading-none" style={{ color: PALETTE.starLink }}>
          {note}
        </span>
      )}
    </motion.button>
  )
}
