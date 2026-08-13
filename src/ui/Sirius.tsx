// The Sirius mark (GDD 11-10) — the symbol half of the logo sheet's lockups.
//
// The wordmark has no component, on purpose: it is six Latin letters and Galmuri has
// all of them, so it is type set at a whole multiple of the face the sheet was built
// on (Galmuri14 × 3 = 42px, see `TITLE_LAYOUT.wordmark`). Drawing it would be a
// second copy of something the font already holds — the opposite of the case for
// γένεσις and иєвυℓα, where the font holds nothing (`PixelWord.tsx`).

import { useMemo } from 'react'
import { siriusSymbol } from '../assets/compose'
import { SIRIUS_SIZE } from '../assets/pixels'
import { PixelSprite } from './PixelSprite'

/** GDD 11-10: the 56×56 map, at whole multiples only (CLAUDE.md §7). */
export function SiriusSymbol({ scale = 1 }: { readonly scale?: number }) {
  // Nothing varies it — no mood, no colour parameter — so the 3,136 cells are built
  // once for the life of the page rather than on every render of the screen round it.
  const pixels = useMemo(() => siriusSymbol(), [])
  return <PixelSprite pixels={pixels} scale={scale} alt="Sirius" />
}

export { SIRIUS_SIZE }
