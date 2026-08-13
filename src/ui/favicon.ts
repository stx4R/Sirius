// The tab icon (GDD 11-10) — the Sirius symbol at 32 and 16.
//
// ★ PAINTED AT LOAD, NOT SHIPPED AS A FILE. GDD 11-1's first rule is that no image
// files are made, and a .ico or .png in `public/` would be one — with its colours
// baked in, so it could not follow the palette, and drawn a second time, so it could
// drift from the mark on the title screen. This paints the same `siriusLayers`
// geometry the title uses and hands the browser two data URLs.
//
// What that costs: the icon appears once the module has run rather than with the
// first byte of HTML. index.html holds `data:,` until then, which is the empty icon
// it has carried since P0 — so the tab goes from blank to the mark, never from a
// broken-image glyph to the mark, and no request 404s on the way (the reason the
// empty icon was put there in the first place).

import { siriusSymbol } from '../assets/compose'
import { PALETTE } from '../assets/palette'
import { SIRIUS_ICON_SIZES } from '../assets/pixels'
import { toDataUrl } from './PixelSprite'

/**
 * Replaces the placeholder icon with the mark.
 *
 * Both sizes are declared rather than just the larger one. The 16 is not the 32
 * resampled: `siriusLayers` is evaluated on a 16×16 grid, so the arms land on whole
 * pixels at the size the browser actually draws them, which is the whole point of
 * stating the geometry in fractions (`pixels.ts`). Left to downscale a 32, a browser
 * resamples and the dot grid goes (CLAUDE.md §7).
 *
 * The background is filled rather than left transparent — a tab strip is the
 * browser's colour, and four shades of pale blue on white is an invisible icon.
 */
export function installFavicon(): void {
  // The placeholder in index.html is the only `rel="icon"` there, so clearing it
  // first keeps a browser from choosing `data:,` over a real icon on a re-run.
  for (const stale of document.querySelectorAll('link[rel="icon"]')) stale.remove()

  for (const size of SIRIUS_ICON_SIZES) {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.type = 'image/png'
    link.sizes = `${size}x${size}`
    link.href = toDataUrl(siriusSymbol(size, PALETTE.void))
    document.head.append(link)
  }
}
