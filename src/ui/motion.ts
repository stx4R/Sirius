// Shared animation vocabulary, so the board, the hand and the settlement move
// like one screen rather than three.
//
// Every timing here is presentation only. Nothing in this file can change a
// score — the numbers it animates towards are the ones core already returned.

import { useEffect, useState } from 'react'

/** GDD 4-2: eight chips a turn, staggered rather than dealt all at once. */
export const DRAW_STAGGER = 0.06

// The settlement's own pacing moved to `core/config.ts` at BOOTH-9b — it stopped
// being decoration when the turn began advancing on it, and now sets part of the
// booth's time budget (GDD 12-1).

export const SPRING = { type: 'spring', stiffness: 320, damping: 22 } as const

/** Softer, for a chip landing in a cell — it should settle, not snap. */
export const LAND_SPRING = { type: 'spring', stiffness: 420, damping: 15 } as const

/**
 * A booth machine is a public one and the player did not choose its settings, so
 * the OS preference is the only signal there is. When it is set, every flight and
 * stagger collapses to nothing; the settlement still steps suit by suit, because
 * that sequence is what explains the score rather than decoration on top of it.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
