// Sprites, built by colouring the geometry and masks in pixels.ts.
//
// Nothing here enumerates the ten special chips by hand (GDD 11-2): they are
// halved out of the five basics, so drawing five suits draws fifteen chips.

import { CONSTELLATION_RULES } from '../core/config'
import type { Chip, ConstellationId, SuitId } from '../core/types'
import {
  AXIS_COLOURS,
  CHIP_COLOURS,
  NEBULA_GLOW,
  NEBULA_INK,
  ORION_INK,
  ORION_LIFT,
  PALETTE,
  SIRIUS_INK,
  SUIT_INK,
  luma,
  mix,
} from './palette'
import type { NebulaMood, OrionMood } from './palette'
import {
  CARD_FRAME,
  CARD_HEIGHT,
  CARD_WIDTH,
  CHART_ORIGIN,
  CHIP_SIZE,
  CONSTELLATION_CHARTS,
  CROWN_GLYPH,
  GLYPH_OFFSET,
  GLYPH_SIZE,
  LOCK_GLYPH,
  NEBULA_LIGHT,
  NEBULA_NAME,
  ORION_HEIGHT,
  ORION_LIGHT,
  ORION_SHOULDER_Y,
  SUIT_GLYPHS,
  nebulaLayers,
  chipLayerAt,
  orionLayers,
  pixelWord,
  siriusLayers,
  skyOf,
} from './pixels'
import type { ChartStar, Magnitude, Mask, NebulaLayer, OrionLayer } from './pixels'

/** One sprite. `null` is transparent. */
export type PixelMap = readonly (readonly (string | null)[])[]

/** Where a special chip is cut, and the mirror line every chip layer respects. */
const CHIP_SEAM = CHIP_SIZE / 2

const blank = (width: number, height: number): (string | null)[][] =>
  Array.from({ length: height }, () => new Array<string | null>(width).fill(null))

const within = (value: number, limit: number) => value >= 0 && value < limit

// -------------------------------------------------------------------- chips

interface ChipPaint {
  /** The lit colour: rim, notches and the dotted circle. */
  readonly edgeAt: (row: number) => string
  /** The dark colour: inner ring and the symbol. */
  readonly symbol: string
  /** The field. Both vary down the chip for the drifter, and are flat for a suit. */
  readonly baseAt: (row: number) => string
  readonly glyph: Mask
}

/**
 * GDD 11-4: a round token in four layers — notched edge, dark inner ring, dotted
 * circle, and a 16×16 symbol at the centre.
 *
 * The notches take the suit's lit colour rather than a neutral cream. It reads as
 * starlight leaking through the rim instead of a casino chip, and it carries the
 * suit all the way out to the edge — so a special chip announces both of its
 * suits from the silhouette, not only from the middle.
 */
function renderChip(paint: ChipPaint): PixelMap {
  const out = blank(CHIP_SIZE, CHIP_SIZE)

  for (let row = 0; row < CHIP_SIZE; row++) {
    const base = paint.baseAt(row)
    const edge = paint.edgeAt(row)
    for (let col = 0; col < CHIP_SIZE; col++) {
      switch (chipLayerAt(row, col)) {
        case 'outside':
          break
        // A notch is the same lit colour as the rim; what marks it out is depth,
        // reaching three pixels further in through the band.
        case 'rim':
        case 'notch':
        case 'dot':
          out[row][col] = edge
          break
        case 'ring':
          out[row][col] = paint.symbol
          break
        case 'band':
        case 'field':
          out[row][col] = base
          break
      }
    }
  }

  for (let row = 0; row < GLYPH_SIZE; row++) {
    for (let col = 0; col < GLYPH_SIZE; col++) {
      if (paint.glyph[row][col]) out[row + GLYPH_OFFSET][col + GLYPH_OFFSET] = paint.symbol
    }
  }
  return out
}

export function basicChip(suit: SuitId): PixelMap {
  const colours = CHIP_COLOURS[suit]
  return renderChip({
    edgeAt: () => colours.edge,
    symbol: colours.symbol,
    baseAt: () => colours.base,
    glyph: SUIT_GLYPHS[suit],
  })
}

/**
 * GDD 3-2: left half of `left`'s chip, right half of `right`'s. Every ring and
 * notch is mirror-symmetric about the seam, so the two halves meet without a
 * visible break; the symbol splits at its own centre, as it always has.
 */
export function specialChip(left: SuitId, right: SuitId): PixelMap {
  const a = basicChip(left)
  const b = basicChip(right)
  return a.map((row, r) => [...row.slice(0, CHIP_SEAM), ...b[r].slice(CHIP_SEAM)])
}

/**
 * Spectrum order rather than scoring order, so the drifter's field reads as a
 * rainbow instead of a list. Acrux is left out: black is not a colour of light,
 * and as a band it would read as a dead stripe across the chip.
 */
const SPECTRUM: readonly SuitId[] = ['GIN', 'GAC', 'IMA', 'MIM']

/** The spectrum as a continuous gradient down the chip. */
function refract(row: number): string {
  const position = (row / (CHIP_SIZE - 1)) * (SPECTRUM.length - 1)
  const stop = Math.min(SPECTRUM.length - 2, Math.floor(position))
  return mix(
    CHIP_COLOURS[SPECTRUM[stop]].base,
    CHIP_COLOURS[SPECTRUM[stop + 1]].base,
    position - stop,
  )
}

/**
 * GDD 11-6: the same chip as any other — notches, ring, dotted circle, centre
 * symbol — so it sits on the board as a chip and not as an oddity. What sets it
 * apart is what it is: no suit of its own, so a rainbow field and a crown.
 */
export function drifterChip(): PixelMap {
  return renderChip({
    // The rim carries the rainbow too. A white rim would swallow it — the notches
    // and dotted circle are a third of the chip's surface.
    edgeAt: (row) => mix(refract(row), PALETTE.starWhite, 0.4),
    // Dark against every colour of the rainbow, which no suit colour would be.
    symbol: PALETTE.void,
    baseAt: refract,
    glyph: CROWN_GLYPH,
  })
}

/** How far the eye core is lifted out of the glow it sits in. */
const EYE_CORE_MIX = 0.45
/**
 * The most the brightest rim pixel may reach, as a share of the eye core. Below
 * 1 by construction, so the hierarchy 11-9 states — only the light out of the
 * hood is bright — is enforced by arithmetic rather than by choosing a tone and
 * hoping. Same device, same reason, as `frameTones` (GDD 11-5).
 */
const RIM_CEILING = 0.8
/** Above 1 the rim gives out early, so the hem is unlit well before it runs out. */
const RIM_FALLOFF = 1.6

/**
 * The rim tone at a pixel, as a falloff from the hood's light.
 *
 * ★ The second version ran one bright pink all the way round her, and it broke
 * both halves of the design at once. It out-shone the eyes, so the look went
 * round the outline instead of landing on her face; and a silhouette closed by
 * an unbroken bright line cannot scatter downward, which is what made her read
 * as a sticker on the background rather than as something coming apart.
 *
 * So: the brightest tone is stepped toward the deep until it is safely under the
 * eye core, exactly as a card frame is stepped under its chart, and every rim
 * pixel is then mixed between that and the veil by its distance from the light.
 * Near the hood it is the full tone; at the far end it *is* the veil, which is
 * to say there is no outline down there at all.
 */
function nebulaRim(glow: string, layers: readonly (readonly NebulaLayer[])[]) {
  const core = mix(glow, PALETTE.starWhite, EYE_CORE_MIX)
  // The rim answers the mood too, so the whole silhouette responds and not one
  // spot — it just may not answer louder than the eyes.
  let brightest = mix(NEBULA_INK.rim, glow, glow === NEBULA_GLOW.idle ? 0 : 0.35)
  // A tenth at a time, the same step `frameTones` takes.
  while (luma(brightest) > luma(core) * RIM_CEILING) {
    brightest = mix(brightest, PALETTE.nebulaDeep, 0.1)
  }

  const reach = (x: number, y: number) => Math.hypot(x - NEBULA_LIGHT.x, y - NEBULA_LIGHT.y)
  const distances = layers.flatMap((row, y) =>
    row.flatMap((layer, x) => (layer === 'rim' ? [reach(x, y)] : [])),
  )
  // Measured off the sprite rather than assumed, so the nearest rim pixel really
  // does reach the ceiling and the farthest really does vanish into the veil.
  const near = Math.min(...distances)
  const span = Math.max(...distances) - near

  return (x: number, y: number) => {
    const away = span === 0 ? 0 : (reach(x, y) - near) / span
    return mix(NEBULA_INK.veil, brightest, (1 - away) ** RIM_FALLOFF)
  }
}

/**
 * иєвυℓα at 60×78 (GDD 11-9), shown at 3× in the shop.
 *
 * `mood` changes only the light out of the hood. She has no face to put an
 * expression on — that is the point of the design — so interest and a closed
 * deal read as the glow brightening, and the rim, which is graded off that same
 * light, brightens with it.
 */
/**
 * Her name set in pixels (GDD 11-9), so it stops falling back to a system font
 * beside the dot Hangul — see `NEBULA_NAME` for why the letters cannot simply be
 * typed.
 *
 * The colour is passed in rather than chosen here: the wordmark stands in for a
 * run of text, so it has to take the colour of whatever line it is sitting in.
 */
export function nebulaName(colour: string): PixelMap {
  return NEBULA_NAME.map((row) => row.map((on) => (on ? colour : null)))
}

/**
 * One of BOOTH-9a's words — γένεσις, πειρασμός, MЦLГЦS — set in pixels, for the
 * reason her name is: Galmuri14 and Galmuri11-Bold have no glyph for the Greek or
 * the Cyrillic, and those are the faces the body text and every bold heading use.
 *
 * The colour is passed in for the same reason as above: the word stands in for a
 * run of text and has to take the colour of the line it lands in.
 */
export function pixelWordMap(word: string, colour: string): PixelMap {
  return pixelWord(word).map((row) => row.map((on) => (on ? colour : null)))
}

/**
 * The Sirius mark (GDD 11-10). One tone per band, all four out of `SIRIUS_INK`, so
 * the mark cannot introduce a colour the palette does not already own (GDD 11-7).
 *
 * `background` fills what the star does not cover instead of leaving it transparent.
 * The title screen wants it transparent — the canvas is already `void` behind it —
 * but a favicon does not: a browser draws the tab strip in its own colour, which on a
 * light theme is white, and this mark is four shades of pale blue. Transparent there
 * would put the logo on white and all but erase it.
 */
export function siriusSymbol(size?: number, background: string | null = null): PixelMap {
  return siriusLayers(size).map((row) =>
    row.map((layer) => (layer === 'outside' ? background : SIRIUS_INK[layer])),
  )
}

export function nebulaSprite(mood: NebulaMood = 'idle'): PixelMap {
  const glow = NEBULA_GLOW[mood]
  const layers = nebulaLayers()
  const rimAt = nebulaRim(glow, layers)

  return layers.map((row, y) =>
    row.map((layer, x) => {
      switch (layer) {
        case 'outside':
          return null
        // The gaze. Brightest thing on her by some way — it is what the eye lands
        // on first, and everything else on her is graded down from it.
        case 'eye':
          return mix(glow, PALETTE.starWhite, EYE_CORE_MIX)
        case 'glow':
          return glow
        // The core's light falling on the inside of the hood. Without this step
        // the glow sits on the shade like a sticker instead of coming out of it.
        case 'hollowLit':
          return mix(NEBULA_INK.hollow, glow, 0.45)
        case 'hollow':
          return NEBULA_INK.hollow
        case 'rim':
          return rimAt(x, y)
        case 'sleeve':
          return NEBULA_INK.sleeve
        case 'fold':
          return NEBULA_INK.veilFold
        case 'veil':
          return NEBULA_INK.veil
      }
    }),
  )
}

// ------------------------------------------------------------------- ORION
// GDD 11-8. The colouring is where his two halves are actually told apart: the
// head and arms take a flat pale skin tone, and the cloud below takes a gradient
// from Hα to the blue reflection nebula down the sprite.
//
// The hierarchy is the mirror of иєвυℓα's. Hers puts the one bright thing inside
// the hood and grades the rim under it; his brightest thing is his face, because
// that is where GDD 11-8's four expressions live, and the rim is graded under the
// skin tone the same way.

/** The most a rim pixel may reach, as a share of the skin it has to stay under. */
const ORION_RIM_CEILING = 0.94
/** Above 1 the rim gives out early, so the bottom of the cloud is unlit. */
const ORION_RIM_FALLOFF = 1.5
/**
 * How far a filament is lifted out of the gas around it.
 *
 * 0.18 and not 0.28. At 0.28 a thread over the blue end of the body reached luma
 * 189, which is past the ceiling the rim is held to and close enough to the skin to
 * compete with his face for the eye — and the face is where GDD 11-8's expressions
 * are. Enough to read as a filament, not enough to be the brightest thing on him.
 */
const ORION_FILAMENT_LIFT = 0.18

/** Mood, applied to a tone: up toward starlight, down toward the deep. */
const lifted = (colour: string, lift: number): string =>
  lift >= 0 ? mix(colour, PALETTE.starWhite, lift) : mix(colour, PALETTE.nebulaDeep, -lift)

/**
 * The rim tone at a pixel, as a falloff from his face.
 *
 * Same device as `nebulaRim`, and for the same two reasons GDD 11-9 records: an
 * outline that out-shines the face pulls the eye off the expression, and one bright
 * unbroken line round a silhouette reads as a sticker. The ceiling is arithmetic
 * rather than a chosen tone, so it holds in every mood.
 */
function orionRim(
  skin: string,
  lift: number,
  gasAt: (y: number) => string,
  layers: readonly (readonly OrionLayer[])[],
) {
  let brightest = lifted(ORION_INK.rim, lift)
  // A tenth at a time, the same step `frameTones` and `nebulaRim` take.
  while (luma(brightest) > luma(skin) * ORION_RIM_CEILING) {
    brightest = mix(brightest, PALETTE.nebulaDeep, 0.1)
  }

  const reach = (x: number, y: number) => Math.hypot(x - ORION_LIGHT.x, y - ORION_LIGHT.y)
  const distances = layers.flatMap((row, y) =>
    row.flatMap((layer, x) => (layer === 'rim' ? [reach(x, y)] : [])),
  )
  // Measured off the sprite, so the nearest rim pixel really does reach the
  // ceiling and the farthest really does sink into the body behind it.
  const near = Math.min(...distances)
  const span = Math.max(...distances) - near

  return (x: number, y: number) => {
    const away = span === 0 ? 0 : (reach(x, y) - near) / span
    // ★ Graded toward the body's own colour *at that row*, not toward a fixed tone.
    // The first version faded toward Hα, which is right at the shoulders and wrong
    // at the hem — down there the cloud has turned blue and a red rim reads as a
    // dark line drawn round him. Fading into whatever the neighbouring pixel is
    // means the far end of the outline is not an outline, which is the half of GDD
    // 11-9's forbidden #4 that a ceiling alone does not buy.
    return mix(gasAt(y), brightest, (1 - away) ** ORION_RIM_FALLOFF)
  }
}

/**
 * ORION at 60×78 (GDD 11-8), shown at 2× on the play screen.
 *
 * `mood` moves the face — which is what GDD 11-8's four expressions are — and lifts
 * or drops the whole figure with it. Two pixels of mouth do not read across a booth
 * table at 120×156; the value shift does, and it is what makes `dim` land as the
 * run going out rather than as a slightly different smile.
 */
export function orionSprite(mood: OrionMood = 'calm'): PixelMap {
  const lift = ORION_LIFT[mood]
  const skin = lifted(ORION_INK.skin, lift)
  const layers = orionLayers(mood)

  // The body's colour by row: Hα at the shoulders, the reflection nebula at the
  // bottom edge. GDD 11-8 asks for the gradient; this is the whole of it.
  const gasAt = (y: number) => {
    const depth = Math.min(
      1,
      Math.max(0, (y - ORION_SHOULDER_Y) / (ORION_HEIGHT - 1 - ORION_SHOULDER_Y)),
    )
    return lifted(mix(ORION_INK.hydrogen, ORION_INK.reflection, depth), lift)
  }
  const rimAt = orionRim(skin, lift, gasAt, layers)

  return layers.map((row, y) => {
    const gas = gasAt(y)

    return row.map((layer, x) => {
      switch (layer) {
        case 'outside':
          return null
        case 'eye':
        case 'brow':
        case 'mouth':
          return ORION_INK.feature
        case 'rim':
          return rimAt(x, y)
        case 'skin':
          return skin
        case 'skinShade':
          return lifted(ORION_INK.skinShade, lift)
        case 'filament':
          return mix(gas, PALETTE.starWhite, ORION_FILAMENT_LIFT)
        case 'cloudDeep':
          return mix(gas, PALETTE.nebulaDeep, 0.45)
        case 'cloud':
          return gas
      }
    })
  })
}

/**
 * The bare 16×16 suit symbol, for naming a suit where a whole chip would be too
 * loud — the settlement screen heads each column with one (GDD 5-1's suit order).
 */
export function suitGlyph(suit: SuitId): PixelMap {
  const ink = SUIT_INK[suit]
  return SUIT_GLYPHS[suit].map((row) => row.map((on) => (on ? ink : null)))
}

/**
 * The padlock badge for a chip that has just been fixed to the board. One colour
 * and a transparent ground — the dark disc it needs to read against a bright chip
 * is the badge the board draws under it, not part of the sprite.
 */
export function lockIcon(): PixelMap {
  return LOCK_GLYPH.map((row) => row.map((on) => (on ? PALETTE.starWhite : null)))
}

/** The sprite for a chip as core describes it. */
export function chipSprite(chip: Chip): PixelMap {
  switch (chip.kind) {
    case 'basic':
      return basicChip(chip.suit)
    case 'special':
      return specialChip(chip.left, chip.right)
    case 'drifter':
      return drifterChip()
  }
}

// -------------------------------------------------------- constellation card

/** Arm length of a star's cross, by magnitude. A faint star is a bare point. */
const ARM_LENGTH: Readonly<Record<Magnitude, number>> = { 0: 3, 1: 2, 2: 0 }

const coreOf = (mag: Magnitude) => (mag === 2 ? PALETTE.starGlow : PALETTE.starWhite)

/**
 * GDD 11-5, the brightness rule: the frame may never out-shine the chart. Both
 * frame tones are stepped toward the card's background until the brighter of
 * them sits under the chart's mean star brightness, with room to spare.
 *
 * This is why the dark tone is not the frame hue untouched — at full strength an
 * amber or teal frame is about as bright as the chart it surrounds, and the eye
 * goes to the border instead of the figure. The hue survives on the outline,
 * which is a single pixel and reads as the card's identity rather than as light.
 */
function frameTones(hue: string, chartMean: number): { dark: string; light: string } {
  const dark = mix(hue, PALETTE.nebulaDeep, 0.3)
  let light = mix(hue, PALETTE.starWhite, 0.4)
  // A tenth at a time, so a hue that is already quiet is barely touched.
  while (luma(light) > chartMean * 0.8) light = mix(light, PALETTE.nebulaDeep, 0.1)
  return { dark, light }
}

function paintLine(out: (string | null)[][], from: ChartStar, to: ChartStar, colour: string): void {
  // Steps of one pixel along the longer axis, which is enough for lines this short.
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))
  for (let i = 1; i < steps; i++) {
    const col = CHART_ORIGIN.col + Math.round(from.x + ((to.x - from.x) * i) / steps)
    const row = CHART_ORIGIN.row + Math.round(from.y + ((to.y - from.y) * i) / steps)
    if (within(row, CARD_HEIGHT) && within(col, CARD_WIDTH)) out[row][col] = colour
  }
}

function paintStar(out: (string | null)[][], entry: ChartStar): void {
  const col = CHART_ORIGIN.col + entry.x
  const row = CHART_ORIGIN.row + entry.y

  for (let step = 1; step <= ARM_LENGTH[entry.mag]; step++) {
    for (const [dr, dc] of [
      [-step, 0],
      [step, 0],
      [0, -step],
      [0, step],
    ]) {
      if (within(row + dr, CARD_HEIGHT) && within(col + dc, CARD_WIDTH)) {
        out[row + dr][col + dc] = PALETTE.starGlow
      }
    }
  }
  if (within(row, CARD_HEIGHT) && within(col, CARD_WIDTH)) out[row][col] = coreOf(entry.mag)
}

/**
 * The night sky behind the figure: nebulosity first, then specks over it.
 *
 * Everything here is kept under the chart's own line colour, so the background
 * can never compete with the figure drawn on it. A brighter speck would read as
 * a star of the constellation and break the figure (GDD 11-5).
 */
function paintSky(out: (string | null)[][], id: ConstellationId, hue: string): void {
  const sky = skyOf(id)
  const dim = PALETTE.panelEdge
  const brightSpeck = mix(PALETTE.panelEdge, PALETTE.starGlow, 0.25)
  const nebulaCore = mix(PALETTE.nebulaDeep, hue, 0.16)
  const nebulaEdge = mix(PALETTE.nebulaDeep, hue, 0.08)

  const put = (row: number, col: number, colour: string) => {
    const inside =
      row >= CARD_FRAME &&
      col >= CARD_FRAME &&
      row < CARD_HEIGHT - CARD_FRAME &&
      col < CARD_WIDTH - CARD_FRAME
    if (inside) out[row][col] = colour
  }

  for (const nebula of sky.nebulae) {
    for (let row = nebula.row - nebula.radius; row <= nebula.row + nebula.radius; row++) {
      for (let col = nebula.col - nebula.radius; col <= nebula.col + nebula.radius; col++) {
        // Squashed horizontally, so a patch reads as drifting gas rather than a disc.
        const dy = row - nebula.row
        const dx = (col - nebula.col) * 0.7
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance > nebula.radius) continue
        put(row, col, distance > nebula.radius * 0.55 ? nebulaEdge : nebulaCore)
      }
    }
  }

  const CROSS: readonly (readonly [number, number])[] = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  for (const speck of sky.specks) {
    if (speck.kind === 'dot') {
      put(speck.row, speck.col, dim)
      continue
    }
    for (const [dr, dc] of CROSS) put(speck.row + dr, speck.col + dc, dim)
    if (speck.kind === 'bright') put(speck.row, speck.col, brightSpeck)
  }
}

/** Stars strung along the frame, joined all the way round, anchored at the corners. */
function paintFrame(out: (string | null)[][], hue: string, chartMean: number): void {
  const { dark, light } = frameTones(hue, chartMean)
  const inset = CARD_FRAME - 1
  const last = { row: CARD_HEIGHT - 1, col: CARD_WIDTH - 1 }

  for (let row = 0; row < CARD_HEIGHT; row++) {
    for (let col = 0; col < CARD_WIDTH; col++) {
      const onOutline = row === 0 || col === 0 || row === last.row || col === last.col
      // Dropping the four corner pixels is what rounds the card at this size.
      const corner = (row === 0 || row === last.row) && (col === 0 || col === last.col)
      if (onOutline && !corner) out[row][col] = dark
    }
  }

  // The decoration track: one ring in, so it reads as inside the border.
  const track: [number, number][] = []
  for (let col = inset; col <= last.col - inset; col++) track.push([inset, col])
  for (let row = inset + 1; row <= last.row - inset; row++) track.push([row, last.col - inset])
  for (let col = last.col - inset - 1; col >= inset; col--) track.push([last.row - inset, col])
  for (let row = last.row - inset - 1; row > inset; row--) track.push([row, inset])

  // The strand the stars hang on sits below the outline, so the stars read as
  // points of light rather than as gaps in a second border.
  const strand = mix(dark, PALETTE.nebulaDeep, 0.4)
  for (const [row, col] of track) out[row][col] = strand
  track.forEach(([row, col], index) => {
    if (index % 6 === 0) out[row][col] = light
  })

  // Corner anchors: brighter, and two pixels across rather than one.
  for (const [row, col] of [
    [inset, inset],
    [inset, last.col - inset],
    [last.row - inset, inset],
    [last.row - inset, last.col - inset],
  ]) {
    for (const [dr, dc] of [
      [0, 0],
      [0, 1],
      [1, 0],
    ]) {
      const r = row + (row > CARD_HEIGHT / 2 ? -dr : dr)
      const c = col + (col > CARD_WIDTH / 2 ? -dc : dc)
      if (within(r, CARD_HEIGHT) && within(c, CARD_WIDTH)) out[r][c] = light
    }
  }
}

/**
 * GDD 11-5: a card, not a chip. It carries the constellation's own figure in
 * blue-white over the 5×5 board it scores on; the axis family is told by the
 * frame colour, because the figures themselves say nothing about which axis wins.
 *
 * The card cannot state the run length or the multiplier at this size — the UI
 * prints those beside it, which is where readability is meant to come from.
 */
export function constellationCard(id: ConstellationId): PixelMap {
  const out = blank(CARD_WIDTH, CARD_HEIGHT)
  const hue = AXIS_COLOURS[CONSTELLATION_RULES[id].axis]
  const chart = CONSTELLATION_CHARTS[id]
  const chartMean =
    chart.stars.reduce((total, entry) => total + luma(coreOf(entry.mag)), 0) / chart.stars.length

  for (let row = CARD_FRAME; row < CARD_HEIGHT - CARD_FRAME; row++) {
    for (let col = CARD_FRAME; col < CARD_WIDTH - CARD_FRAME; col++) {
      out[row][col] = PALETTE.nebulaDeep
    }
  }
  paintSky(out, id, hue)

  for (const [from, to] of chart.links) {
    paintLine(out, chart.stars[from], chart.stars[to], PALETTE.starLink)
  }
  for (const entry of chart.stars) paintStar(out, entry)

  paintFrame(out, hue, chartMean)
  return out
}
