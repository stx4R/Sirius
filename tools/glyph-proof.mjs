// Renders BOOTH-9a's pixel words magnified and beside the same words typed in
// Galmuri, so stroke weight, x-height and baseline can be checked by eye.
//
//   npx tsx tools/glyph-proof.mjs
//
// Writes tools/out/glyph-proof.html — self-contained, fonts inlined, so it opens
// straight off disk with the real faces. A measurement tool, not game code
// (CLAUDE.md §5): it imports the maps and reports, and decides nothing.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PIXEL_GLYPHS,
  PIXEL_GLYPH_BASELINE,
  PIXEL_GLYPH_HEIGHT,
  PIXEL_GLYPH_WIDTH,
  PIXEL_WORDS,
  pixelWord,
} from '../src/assets/pixels.ts'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(here, 'out')

const INK = '#F2F0FF'
const VOID = '#0A0A12'
const TEAL = '#4FE3C1'
const AMBER = '#FFB347'
const DIM = '#9AA8CC'
const EDGE = '#2E2A45'

const font = (name) =>
  readFileSync(resolve(here, '../public/fonts', `${name}.woff2`)).toString('base64')

/** One mask as an absolutely-positioned grid of divs, magnified by `scale`. */
function maskHtml(m, scale, { guides = false } = {}) {
  const h = m.length
  const w = m[0].length
  const cells = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!m[y][x]) continue
      cells.push(
        `<i style="left:${x * scale}px;top:${y * scale}px;width:${scale}px;height:${scale}px"></i>`,
      )
    }
  }
  const rules = guides
    ? // baseline at row 7, x-height top at row 2 — the two lines every glyph is judged against
      `<u style="top:${PIXEL_GLYPH_BASELINE * scale}px;width:${w * scale}px"></u>` +
      `<s style="top:${2 * scale}px;width:${w * scale}px"></s>`
    : ''
  return `<div class="m" style="width:${w * scale}px;height:${h * scale}px">${cells.join('')}${rules}</div>`
}

// ------------------------------------------------------------------ sections

// 1 · every glyph, large, with the baseline and x-height guides drawn on it.
const glyphCells = Object.entries(PIXEL_GLYPHS)
  .map(([ch, m]) => {
    const zone =
      m.slice(PIXEL_GLYPH_BASELINE).some((r) => r.some(Boolean)) && m[0].some(Boolean)
        ? '0–8 전역'
        : m.slice(PIXEL_GLYPH_BASELINE).some((r) => r.some(Boolean))
          ? '2–8 디센더'
          : m[0].some(Boolean) || m[1].some(Boolean)
            ? '0–6 어센더/캡'
            : '2–6 x-height'
    const cp = `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
    return `<div class="cell">${maskHtml(m, 10, { guides: true })}
      <div class="ch">${ch}</div><div class="cp">${cp}</div><div class="cp">${zone}</div></div>`
  })
  .join('')

// 2 · each word: the pixel map at 4×, then the same word typed at the matching size.
//     A pixel word at scale s is s×(9 rows); typed Galmuri14 is 14px. At 4× the map
//     is 36px tall, so it is set beside 14px×? — instead both are shown at the size
//     they actually ship at (2×) plus a 6× blow-up above it.
const wordRows = PIXEL_WORDS.map((word) => {
  const m = pixelWord(word)
  return `<div class="wrow">
    <div class="cap">${word}<br><span class="dim">${m[0].length}×${m.length}</span></div>
    <div class="stack">
      <div class="lab">픽셀맵 6배</div>${maskHtml(m, 6, { guides: true })}
      <div class="lab">픽셀맵 2배 (실제 출하 배율)</div>${maskHtml(m, 2)}
      <div class="lab">Galmuri14로 타이핑 — 14px 본문에서 폴백되는 모습</div>
      <div class="typed14">${word}</div>
      <div class="lab">Galmuri11로 타이핑 — 11px에서는 도트로 나온다</div>
      <div class="typed11">${word}</div>
    </div></div>`
}).join('')

// 3 · in context: the words inline in real 14px Korean body text, which is the
//     only place the baseline claim can actually be judged.
const CONTEXT = [
  ['배치 → γένεσις', `조각을 골라 성단에 <W>γένεσις</W>하면 그 칸은 고정된다.`],
  ['문제 → πειρασμός', `<W>πειρασμός</W>를 맞히면 스타더스트를 2 받는다.`],
  ['특수 조각 → MЦLГЦS', `<W>MЦLГЦS</W> 조각은 두 문양을 동시에 판정한다.`],
  ['세 단어 한 줄에', `<W>MЦLГЦS</W> 조각을 <W>γένεσις</W>한 뒤 <W>πειρασμός</W>가 나온다.`],
]

const inline = (word) => `<span class="inl">${maskHtml(pixelWord(word), 2)}</span>`

const contextRows = CONTEXT.map(([label, template]) => {
  const filled = template.replace(/<W>(.+?)<\/W>/g, (_, w) => inline(w))
  const typed = template.replace(/<W>(.+?)<\/W>/g, (_, w) => `<b>${w}</b>`)
  return `<div class="ctx">
    <div class="cap">${label}</div>
    <div class="stack">
      <div class="lab">픽셀 글리프 적용</div><div class="body">${filled}</div>
      <div class="lab">타이핑한 채로 두면 (비교용 — 이 줄이 섞인 활자다)</div>
      <div class="body typedbody">${typed}</div>
    </div></div>`
}).join('')

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>BOOTH-9a 글리프 검수</title><style>
  @font-face { font-family:'Galmuri11'; src:url(data:font/woff2;base64,${font('Galmuri11')}) format('woff2'); font-display:block }
  @font-face { font-family:'Galmuri14'; src:url(data:font/woff2;base64,${font('Galmuri14')}) format('woff2'); font-display:block }
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:${VOID};color:${INK};padding:28px 32px;font-family:'Galmuri11',monospace;
       -webkit-font-smoothing:none;font-synthesis:none;font-size:11px}
  h1{font-size:22px;color:${INK};margin-bottom:6px}
  h2{font-size:11px;color:${TEAL};margin:30px 0 12px;letter-spacing:.14em;
     border-top:1px solid ${EDGE};padding-top:12px}
  p.note{color:${DIM};line-height:1.7;max-width:900px;margin-bottom:10px}
  .dim{color:${DIM}}
  .m{position:relative}
  .m i{position:absolute;background:${INK}}
  /* baseline (teal) and x-height top (dim) */
  .m u{position:absolute;left:0;height:1px;background:${TEAL};opacity:.85}
  .m s{position:absolute;left:0;height:1px;background:${DIM};opacity:.4}
  .grid{display:grid;grid-template-columns:repeat(9,auto);gap:16px 20px;justify-items:center}
  .cell{text-align:center}
  .ch{font-size:14px;font-family:'Galmuri14',monospace;color:${AMBER};margin-top:6px}
  .cp{color:${DIM};font-size:9px;line-height:1.5}
  .wrow,.ctx{display:flex;gap:24px;align-items:flex-start;margin-bottom:26px}
  .cap{width:150px;flex:none;color:${INK};line-height:1.6}
  .stack{display:flex;flex-direction:column;gap:4px}
  .lab{color:${DIM};font-size:9px;margin-top:8px}
  .typed14{font-family:'Galmuri14',monospace;font-size:14px}
  .typed11{font-family:'Galmuri11',monospace;font-size:11px}
  /* The real body context: 14px Galmuri14, exactly what a bubble is set in. */
  .body{font-family:'Galmuri14',monospace;font-size:14px;line-height:1.7;
        background:#14121F;padding:8px 12px;border:1px solid ${EDGE};border-radius:4px;max-width:620px}
  .typedbody b{font-weight:400}
  /* An inline pixel word: baseline-aligned, then pushed down by the descender rows
     so the drawn baseline lands on the text baseline. */
  .inl{display:inline-block;vertical-align:baseline;
       transform:translateY(${(PIXEL_GLYPH_HEIGHT - PIXEL_GLYPH_BASELINE) * 2}px)}
</style></head><body>
  <h1>BOOTH-9a — 특수 문자 픽셀 글리프 검수</h1>
  <p class="note">셀 ${PIXEL_GLYPH_WIDTH}×${PIXEL_GLYPH_HEIGHT} · 자간 1px · 획 굵기 1px · 정수배 스케일만.
  <span style="color:${TEAL}">청록 선 = 베이스라인(행 ${PIXEL_GLYPH_BASELINE})</span> ·
  <span style="color:${DIM}">회색 선 = x-height 상단(행 2)</span></p>

  <h2>1 · 글리프 낱자 ${Object.keys(PIXEL_GLYPHS).length}자 (10배)</h2>
  <div class="grid">${glyphCells}</div>

  <h2>2 · 단어 — 픽셀맵 vs 타이핑</h2>
  ${wordRows}

  <h2>3 · 실제 문맥 — 14px 본문 인라인, 베이스라인 정렬</h2>
  <p class="note">아래 각 항목의 첫 줄이 적용 결과고, 둘째 줄은 비교용으로 타이핑한 것이다.
  둘째 줄에서 그리스·키릴 글자만 매끄럽게 보이면 그것이 폴백이다.</p>
  ${contextRows}
</body></html>`

mkdirSync(OUT, { recursive: true })
const out = resolve(OUT, 'glyph-proof.html')
writeFileSync(out, html, 'utf8')

console.log(`wrote ${out}`)
console.log(`glyphs: ${Object.keys(PIXEL_GLYPHS).length}`)
for (const w of PIXEL_WORDS) {
  const m = pixelWord(w)
  console.log(`  ${w.padEnd(11)} ${m[0].length}×${m.length}  (${[...w].length} chars)`)
}
