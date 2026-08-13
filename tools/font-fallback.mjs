// Does any BOOTH-9a word fall back to a system font? (GDD 11-9, BOOTH-9a step 5)
//
//   npx tsx tools/font-fallback.mjs
//
// A measurement tool, not game code (CLAUDE.md §5): it reports and decides nothing.
//
// WHY THIS EXISTS. GDD 11-9's rule is that no string on screen may be rendered in a
// smooth system font beside the dot Hangul. Whether that happens is not a property of
// a word — it is a property of the *face*, and index.css picks the face from the size
// class. So the only honest check walks the faces the screens actually use and asks
// each one whether it owns every character.
//
// It reads the woff2 cmaps directly rather than rendering. Rendering to a canvas
// antialiases, which makes a 1px stroke measure 2–3px and makes "is this the real
// face or a fallback?" a judgement call about blur; a cmap either has the codepoint
// or it does not.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliDecompressSync } from 'node:zlib'
import { PIXEL_WORDS } from '../src/assets/pixels.ts'

const here = dirname(fileURLToPath(import.meta.url))

/** The 63 known tags, in the exact order WOFF2 §5 indexes them. */
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm',
  'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern',
  'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
  'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar',
  'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty',
  'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
]

function readBase128(buf, pos) {
  let value = 0
  for (let i = 0; i < 5; i++) {
    const byte = buf[pos++]
    value = (value << 7) | (byte & 0x7f)
    if ((byte & 0x80) === 0) return [value, pos]
  }
  throw new Error('bad base-128')
}

/** Every codepoint the face has a non-zero glyph id for. */
function coverage(face) {
  const buf = readFileSync(resolve(here, '../public/fonts', `${face}.woff2`))
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${face}: not woff2`)

  const numTables = buf.readUInt16BE(12)
  let pos = 48
  const dir = []
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos++]
    const index = flags & 0x3f
    let tag
    if (index === 0x3f) { tag = buf.toString('latin1', pos, pos + 4); pos += 4 }
    else tag = KNOWN_TAGS[index]
    let origLength
    ;[origLength, pos] = readBase128(buf, pos)
    let length = origLength
    const transform = (flags >> 6) & 0x03
    const transformed = tag === 'glyf' || tag === 'loca' ? transform === 0 : transform !== 0
    if (transformed) [length, pos] = readBase128(buf, pos)
    dir.push({ tag, length })
  }

  const blob = brotliDecompressSync(buf.subarray(pos, pos + buf.readUInt32BE(20)))

  let at = 0
  let cmapAt = -1
  for (const t of dir) {
    if (t.tag === 'cmap') { cmapAt = at; break }
    at += t.length
  }
  if (cmapAt < 0) throw new Error(`${face}: no cmap`)

  const numSub = blob.readUInt16BE(cmapAt + 2)
  let best = null
  for (let i = 0; i < numSub; i++) {
    const rec = cmapAt + 4 + i * 8
    const platform = blob.readUInt16BE(rec)
    const encoding = blob.readUInt16BE(rec + 2)
    const sub = cmapAt + blob.readUInt32BE(rec + 4)
    const format = blob.readUInt16BE(sub)
    if (platform === 3 && (encoding === 1 || encoding === 10) && (format === 4 || format === 12)) {
      if (best === null || format === 12) best = { sub, format }
    }
  }
  if (best === null) throw new Error(`${face}: no unicode subtable`)

  const set = new Set()
  if (best.format === 4) {
    const segX2 = blob.readUInt16BE(best.sub + 6)
    const endAt = best.sub + 14
    const startAt = endAt + segX2 + 2
    const deltaAt = startAt + segX2
    const rangeAt = deltaAt + segX2
    for (let s = 0; s < segX2 / 2; s++) {
      const end = blob.readUInt16BE(endAt + s * 2)
      const start = blob.readUInt16BE(startAt + s * 2)
      if (start === 0xffff) continue
      const delta = blob.readInt16BE(deltaAt + s * 2)
      const rangeOffset = blob.readUInt16BE(rangeAt + s * 2)
      for (let c = start; c <= end && c !== 0x10000; c++) {
        let gid
        if (rangeOffset === 0) gid = (c + delta) & 0xffff
        else {
          gid = blob.readUInt16BE(rangeAt + s * 2 + rangeOffset + (c - start) * 2)
          if (gid !== 0) gid = (gid + delta) & 0xffff
        }
        if (gid !== 0) set.add(c)
      }
    }
  } else {
    const groups = blob.readUInt32BE(best.sub + 12)
    for (let g = 0; g < groups; g++) {
      const rec = best.sub + 16 + g * 12
      const start = blob.readUInt32BE(rec)
      const end = blob.readUInt32BE(rec + 4)
      if (blob.readUInt32BE(rec + 8) === 0) continue
      for (let c = start; c <= end; c++) set.add(c)
    }
  }
  return set
}

/**
 * Size class → face, mirroring index.css exactly. If that file's map changes and
 * this one does not, the table below reports the wrong face — so it is written as
 * the same list in the same order, and `tests/assets.test.ts` holds the pairing.
 */
const SIZE_FACES = [
  { klass: 'text-[9px]', px: 9, face: 'Galmuri9', bold: false },
  { klass: 'text-lg (18px)', px: 18, face: 'Galmuri9', bold: false },
  { klass: 'text-sm (14px)', px: 14, face: 'Galmuri14', bold: false },
  { klass: 'text-[42px]', px: 42, face: 'Galmuri14', bold: false },
  { klass: 'text-[11px]', px: 11, face: 'Galmuri11', bold: false },
  { klass: 'text-[11px] bold', px: 11, face: 'Galmuri11-Bold', bold: true },
  { klass: 'text-[22px]', px: 22, face: 'Galmuri11', bold: false },
  { klass: 'text-[22px] bold', px: 22, face: 'Galmuri11-Bold', bold: true },
  { klass: 'text-[44px]', px: 44, face: 'Galmuri11', bold: false },
]

const WORDS = [...PIXEL_WORDS, 'иєвυℓα']

const sets = new Map()
for (const face of new Set(SIZE_FACES.map((s) => s.face))) sets.set(face, coverage(face))

console.log('BOOTH-9a 폴백 감지 — 화면이 실제로 쓰는 서체별로, 단어가 통째로 렌더되는가\n')
console.log(`| 크기 클래스 | 서체 | ${WORDS.join(' | ')} |`)
console.log(`|:--|:--|${WORDS.map(() => ':--:').join('|')}|`)

const needsSprite = []
for (const size of SIZE_FACES) {
  const set = sets.get(size.face)
  const cells = WORDS.map((word) => {
    const missing = [...word].filter((c) => !set.has(c.codePointAt(0)))
    if (missing.length === 0) return '도트'
    return `**폴백 ${missing.length}자**`
  })
  if (cells.some((c) => c.startsWith('**'))) needsSprite.push(size)
  console.log(`| \`${size.klass}\` | ${size.face} | ${cells.join(' | ')} |`)
}

console.log('\n스프라이트가 반드시 필요한 서체 (타이핑하면 폴백):')
for (const s of needsSprite) console.log(`  · ${s.face}  ← ${s.klass}`)

console.log('\nx-height 정합 (스프라이트 5행 × 배율 vs 서체 실측)')
console.log('  Galmuri14 @14px = 10px  →  5행 × 2배 = 10px   정확히 일치')
console.log('  Galmuri11 @11px =  8px  →  정수배 불가 (8/5=1.6) — 그래서 이 서체는 타이핑한다')
console.log('  Galmuri9  @9px  측정은 tools/glyph-proof.mjs 참조')
