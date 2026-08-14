// The Windows executable icon — `build/icon.ico`.
//
//   npm run icon
//
// ★ THE ONE IMAGE FILE THIS PROJECT MAKES. GDD 11-1's first rule is that no image
// files are made, and every other mark obeys it: the title symbol and the favicon are
// both painted at load from `siriusSymbol()`. A Windows PE resource cannot be painted
// at load — the shell reads the icon out of the file before a line of the app runs —
// so the exe is the single case where the mark has to exist as bytes. GDD 11-1 records
// the exception, and this script is what keeps it honest: the bytes are *generated*
// from the same geometry, never drawn, so the source of truth is still the code.
//
// ★ ONE GRID, WHOLE MULTIPLES OF IT. `siriusLayers` takes any size, so the obvious
// move is to evaluate it at 256 and get a smooth star. That is the wrong picture: this
// is a dot mark, and CLAUDE.md §7 allows integer scale only. So the mark is evaluated
// once on the 16×16 grid the favicon's small entry already uses, and the four entries
// are that one grid at ×1, ×2, ×3 and ×16. They cannot disagree with each other —
// they are the same array — and at 256 a logical pixel is a 16px block, which is what
// the game's own sprites look like on screen.
//
// ★ FILLED, NOT TRANSPARENT, for the reason `favicon.ts` gives: four shades of pale
// blue on the white of an Explorer pane is an invisible icon. The mark sits on `void`,
// the same ground the canvas is letterboxed in.
//
// Format: uncompressed 32bpp BGRA DIB + AND mask, which needs no encoder and so no
// dependency. Nothing here reads a clock or a random number, so two runs of the script
// produce the same bytes.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { siriusSymbol } from '../src/assets/compose.ts'
import { PALETTE, SIRIUS_INK } from '../src/assets/palette.ts'

/** The grid the mark is evaluated on. Every entry is a whole multiple of it. */
const GRID = 16

/** ×1, ×2, ×3, ×16 → 16, 32, 48, 256. The four sizes Windows asks a .ico for. */
const SCALES = [1, 2, 3, 16]

const OUT = fileURLToPath(new URL('../build/icon.ico', import.meta.url))

/** `#rrggbb` → [r, g, b]. Strict: a colour this cannot read is a palette bug. */
function channels(colour) {
  const match = /^#([0-9a-f]{6})$/i.exec(colour)
  if (!match) throw new Error(`expected #rrggbb, got ${String(colour)}`)
  const packed = Number.parseInt(match[1], 16)
  return [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff]
}

/** Nearest neighbour by construction — each source pixel becomes an n×n block. */
function upscale(map, factor) {
  return map.flatMap((row) => {
    const wide = row.flatMap((colour) => Array.from({ length: factor }, () => colour))
    return Array.from({ length: factor }, () => wide)
  })
}

/**
 * One icon image: BITMAPINFOHEADER, then the colour rows, then the AND mask.
 *
 * Both bitmaps are bottom-up, which is why the row loop counts down. `biHeight` is
 * twice the real height because the header describes the two stacked bitmaps, not
 * the picture — the one part of this format that cannot be read off the numbers.
 */
function image(map) {
  const size = map.length

  const colour = Buffer.alloc(size * size * 4)
  let at = 0
  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = channels(map[y][x])
      colour[at] = b
      colour[at + 1] = g
      colour[at + 2] = r
      colour[at + 3] = 0xff
      at += 4
    }
  }

  // 1 bit per pixel, rows padded to 4 bytes. Left zeroed: every pixel is opaque,
  // because the background is filled. It is written anyway — the mask is not
  // optional in the format, and a reader that ignores the alpha channel needs it.
  const maskStride = Math.ceil(Math.ceil(size / 8) / 4) * 4
  const mask = Buffer.alloc(maskStride * size)

  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0) // biSize
  header.writeInt32LE(size, 4) // biWidth
  header.writeInt32LE(size * 2, 8) // biHeight — colour rows + mask rows
  header.writeUInt16LE(1, 12) // biPlanes
  header.writeUInt16LE(32, 14) // biBitCount
  header.writeUInt32LE(0, 16) // biCompression — BI_RGB
  header.writeUInt32LE(colour.length + mask.length, 20) // biSizeImage

  return Buffer.concat([header, colour, mask])
}

/** ICONDIR + one ICONDIRENTRY per size + the images, in that order. */
function ico(images) {
  const directory = Buffer.alloc(6)
  directory.writeUInt16LE(0, 0) // reserved
  directory.writeUInt16LE(1, 2) // type — 1 is an icon
  directory.writeUInt16LE(images.length, 4)

  let offset = 6 + images.length * 16
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16)
    // 256 does not fit in a byte and is written as 0, which the format defines as
    // 256. Every other size is itself.
    entry.writeUInt8(size & 0xff, 0)
    entry.writeUInt8(size & 0xff, 1)
    entry.writeUInt8(0, 2) // colours in the palette — 0 for a true-colour image
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })

  return Buffer.concat([directory, ...entries, ...images.map(({ data }) => data)])
}

const grid = siriusSymbol(GRID, PALETTE.void)
const images = SCALES.map((factor) => {
  const map = upscale(grid, factor)
  return { size: map.length, data: image(map) }
})

const file = ico(images)
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, file)

// The mark as the shell will draw it, so a change of geometry is visible here
// rather than only after a rebuild. Two characters per pixel keeps it square, and
// one character per tone shows the four bands the ramp is supposed to have.
const TONE = new Map([
  [SIRIUS_INK.core, '██'],
  [SIRIUS_INK.pale, '▓▓'],
  [SIRIUS_INK.mid, '▒▒'],
  [SIRIUS_INK.shade, '░░'],
  [PALETTE.void, '  '],
])

console.log(`build/icon.ico — ${images.map((i) => i.size).join(' / ')}, ${file.length} bytes`)
console.log()
for (const row of grid) console.log(row.map((colour) => TONE.get(colour)).join(''))
