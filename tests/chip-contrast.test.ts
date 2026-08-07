import { describe, expect, it } from 'vitest'
import { REGIONS, pairDistances, suitSignatures } from '../tools/chip-contrast-core'

// GDD 11-4 records the measured minimum as ΔE 19.8 (IMA·ACR at the edge) and
// concludes from it that the palette needs no change. A number that lives only
// in a document is a number the next palette edit breaks quietly.
//
// 18 is a FLOOR, not a target: it sits just under today's 19.8 so that a real
// regression trips it, and it is not something to design toward.
const CONTRAST_FLOOR = 18

// Original colours only. The blur pass in `chip-contrast.mjs` is an acuity
// model, not a measurement of the files, and a model in the gate would make the
// gate move every time the model is tuned. Integer upscaling does not change
// colour, so one scale covers both.
describe('chip suit contrast (GDD 11-4)', () => {
  it('keeps every suit pair above the measured floor in every region', () => {
    const { bySuit, disagreements } = suitSignatures(1, false)
    expect(disagreements).toEqual([])

    for (const region of REGIONS) {
      const rows = pairDistances(bySuit, region)
      expect(rows).toHaveLength(10)
      for (const { pair, deltaE } of rows) {
        expect(deltaE, `${region} ${pair}`).toBeGreaterThanOrEqual(CONTRAST_FLOOR)
      }
    }
  })
})
