// Measures how far apart the five suits look on a chip. Measurement only — it
// sets no threshold and passes no judgement (GDD 11-4 readability is a design
// call, not a computed one).
//
//   npx tsx tools/chip-contrast.mjs
//
// The arithmetic lives in `chip-contrast-core.ts`, which `tests/chip-contrast.
// test.ts` also imports; this file only formats and prints.
//
// WHAT IS AND IS NOT SCALE-DEPENDENT
//
// A pixel map scaled by a whole number does not change colour, so the mean
// colour of a region is identical at 1× and 2×. What changes with scale is how
// much *screen* a region occupies, and therefore whether the eye resolves it at
// all: the 1px rim is 4 device pixels at 2× and 1 at 1×.
//
// So three things are reported per scale:
//   · region means            — identical at both scales, stated so plainly
//   · region area in device px — the part that genuinely differs
//   · acuity-limited means     — the map upscaled to its display size and box
//                                blurred over 3×3 device px, which models a
//                                feature thinner than the kernel blending into
//                                its neighbours. This is a MODEL, not a
//                                measurement of the file.
//
// REGIONS (disjoint, so the three partition the chip)
//   field   'field' + 'band'   the flat suit colour
//   edge    'rim' + 'notch' + 'dot'
//   symbol  the 16×16 glyph mask + 'ring'
// The inner ring is grouped with the symbol because `compose.ts` paints both in
// the suit's symbol colour; it is not part of the centre glyph's shape.
//
// A special chip is two suits meeting at column 16, so a blur kernel straddling
// the seam mixes one suit into the other. One column each side is excluded from
// every measurement — in the unblurred pass too, so the areas stay comparable.

import { SUIT_ORDER } from '../src/core/types.ts'
import { BLUR, REGIONS, hex, pairDistances, suitSignatures } from './chip-contrast-core.ts'

const SCALES = [
  { name: '2배 · 64px (보드 · 진열)', factor: 2 },
  { name: '1배 · 32px (덱 구성 패널)', factor: 1 },
]

// ------------------------------------------------------------------- report

const pad = (s, n) => String(s).padEnd(n)
const num = (v, n = 6) => String(v.toFixed(1)).padStart(n)

console.log('특수 조각 10종을 렌더해 문양별 영역색을 추출한다.')
console.log(`영역: field = 필드(band+field) · edge = 테두리+노치+점선 · symbol = 중앙 문양+안쪽 링`)
console.log(`배경(원 바깥)과 이음매 양옆 1열은 제외. 거리: CIE76 ΔE / ΔL* / ΔC*ab / Δluma\n`)

const signatures = {}
for (const scale of SCALES) {
  for (const blurred of [false, true]) {
    const key = `${scale.factor}x${blurred ? '-blur' : ''}`
    const { bySuit, disagreements } = suitSignatures(scale.factor, blurred)
    signatures[key] = bySuit
    for (const where of disagreements) {
      console.log(`  ⚠ ${where} disagrees between chips at ${key}`)
    }
  }
}

for (const scale of SCALES) {
  for (const blurred of [false, true]) {
    const key = `${scale.factor}x${blurred ? '-blur' : ''}`
    const sig = signatures[key]
    console.log('='.repeat(78))
    console.log(
      `${scale.name}${blurred ? `  —  시야 한계 모델 (${BLUR}×${BLUR} device px 평균)` : '  —  원본 색'}`,
    )
    console.log('='.repeat(78))

    console.log(`\n${pad('문양', 6)}${REGIONS.map((r) => pad(r + ' 평균색', 20)).join('')}`)
    for (const suit of SUIT_ORDER) {
      const cells = REGIONS.map((region) => {
        const { mean, area } = sig[suit][region]
        return pad(mean === null ? '—' : `${hex(mean)} ${area}px`, 20)
      })
      console.log(pad(suit, 6) + cells.join(''))
    }

    for (const region of REGIONS) {
      console.log(`\n  [${region}]  ${pad('', 4)}${pad('ΔE(CIE76)', 12)}${pad('ΔL*', 9)}${pad('ΔC*ab', 9)}Δluma`)
      for (const row of pairDistances(sig, region)) {
        console.log(
          `  ${pad(row.pair, 12)}${num(row.deltaE, 9)}${num(row.dLstar, 9)}${num(row.dChroma, 9)}${num(row.dLuma, 9)}`,
        )
      }
    }
    console.log()
  }
}

console.log('='.repeat(78))
console.log('원본 색은 두 배율에서 동일하다 — 정수배 확대는 색을 바꾸지 않는다.')
console.log('배율 사이에서 실제로 달라지는 것은 영역의 device px 면적과, 그에 따라')
console.log('1px 폭 요소가 이웃과 섞이는 정도다(위의 blur 표).')
console.log('임계값 판정은 하지 않는다 — 하한 게이트는 tests/chip-contrast.test.ts에 있다.')
