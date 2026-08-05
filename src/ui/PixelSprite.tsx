// GDD 11-1: a pixel map is painted once onto an offscreen 16×16 canvas, turned
// into a data URL, and shown as an <img> scaled by CSS.
//
// The alternative — one SVG rect per pixel — is 256 nodes per chip and thousands
// on a full board. This keeps one <img> per sprite and does the painting once.

import { useMemo } from 'react'
import type { PixelMap } from '../assets/compose'

interface Props {
  readonly pixels: PixelMap
  /** Integer only. Fractional scaling would blur the dot grid (CLAUDE.md §7). */
  readonly scale?: number
  readonly alt?: string
}

function toDataUrl(pixels: PixelMap): string {
  const height = pixels.length
  const width = height === 0 ? 0 : pixels[0].length
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (ctx === null) return ''

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const colour = pixels[row][col]
      if (colour === null) continue
      ctx.fillStyle = colour
      ctx.fillRect(col, row, 1, 1)
    }
  }
  return canvas.toDataURL()
}

export function PixelSprite({ pixels, scale = 2, alt = '' }: Props) {
  const src = useMemo(() => toDataUrl(pixels), [pixels])
  const size = pixels.length * Math.trunc(scale)

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
