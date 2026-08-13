// Shared animation vocabulary, so the board, the hand and the settlement move
// like one screen rather than three.
//
// Every timing here is presentation only. Nothing in this file can change a
// score — the numbers it animates towards are the ones core already returned.

import { useSyncExternalStore } from 'react'

/** GDD 4-2: eight chips a turn, staggered rather than dealt all at once. */
export const DRAW_STAGGER = 0.06

// The settlement's own pacing moved to `core/config.ts` at BOOTH-9b — it stopped
// being decoration when the turn began advancing on it, and now sets part of the
// booth's time budget (GDD 12-1).

export const SPRING = { type: 'spring', stiffness: 320, damping: 22 } as const

/** Softer, for a chip landing in a cell — it should settle, not snap. */
export const LAND_SPRING = { type: 'spring', stiffness: 420, damping: 15 } as const

/**
 * ★ Animations on or off — the one setting the pause window offers (BOOTH-9c).
 *
 * It is a single effective boolean rather than a preference layered over the OS
 * one, and that is deliberate. Two switches for one effect produce a settings row
 * that does nothing: with `prefers-reduced-motion` set, an "on" the player chose
 * would be overruled and the control would be a lie. So the OS preference decides
 * what the switch *starts* at, and after that the switch is the answer.
 *
 * Read once, at module load, rather than subscribed to. The live subscription this
 * replaces existed because the OS was the only signal there was; now there is a
 * control on screen, and an OS change arriving mid-run to silently overwrite what
 * the player just chose is the failure the subscription would cause. A booth
 * laptop's accessibility settings do not change while a student is playing.
 *
 * ★ Session only — no `localStorage`. GDD 12-2-a rejected it for the coach marks
 * for the reason that applies here too: a booth laptop is not reloaded between
 * students, so a stored setting is the *previous* student's setting imposed on the
 * next one. `다시 시작` deliberately keeps it, because that is the same student.
 */
function osPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

let animations = !osPrefersReducedMotion()

const watchers = new Set<() => void>()

function subscribe(notify: () => void): () => void {
  watchers.add(notify)
  return () => {
    watchers.delete(notify)
  }
}

/** The current setting, for anything that is not a React render. */
export const animationsOn = (): boolean => animations

export function setAnimations(on: boolean): void {
  if (on === animations) return
  animations = on
  for (const notify of watchers) notify()
}

export function useAnimations(): boolean {
  return useSyncExternalStore(subscribe, animationsOn, animationsOn)
}

/**
 * What every screen passes down as `reduced`: flights, staggers and hops collapse
 * to nothing. The settlement still steps suit by suit, because that sequence is
 * what explains the score rather than decoration on top of it — what it loses is
 * the 600ms per suit, so it lands on the finished state in one hop.
 */
export function useReducedMotion(): boolean {
  return !useAnimations()
}
