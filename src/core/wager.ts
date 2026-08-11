// ORION'S WAGER — the YES/NO proposition put to the player before each draw
// (GDD 8-2). Pure core: no React, no DOM, and every random choice comes from an
// injected Rng (CLAUDE.md §5, §8).
//
// There is no question bank. Each proposition is built out of the deck in front
// of the player and its truth is computed from those same counts, so a deck the
// shop has edited or a round has drawn down asks a different question with a
// different answer. Written questions would have to be kept in step with the
// shop, the deck edits and the hand size by hand, and would go stale the first
// time any of the three moved.
//
// The wording is a hard constraint rather than a flourish. GDD 1-4 ③ carries the
// textbook's warning that a conditional probability has to be presented as a
// state the deck is *in*, never as one event following another, so every
// template below opens with the condition and no template narrates a sequence.
// tests/wager.test.ts keeps the list of banned phrasings and reads every
// generated sentence for them.
//
// The deck is assumed to be the one about to be drawn from. In play that is
// never empty — unplaced chips return before the next wager (GDD 4-2) — but a
// deck that supports no clear proposition still gets an answerable question
// back, see `choose`.

import {
  HAND_SIZE,
  WAGER_COMPLEMENT_THRESHOLDS,
  WAGER_MIN_GAP,
  WAGER_TIER_BY_ROUND,
} from './config'
import { chanceOfDrawing, countDeck, drawChances } from './deck'
import type { Rng } from './rng'
import { SUIT_ORDER } from './types'
import type { Chip, SuitId, WagerQuestion, WagerTier } from './types'

/** GDD 3-1. `칩` after the star name keeps every Korean particle in the templates regular. */
const SUIT_NAME: Readonly<Record<SuitId, string>> = {
  GAC: 'Gacrux',
  IMA: 'Imai',
  GIN: 'Ginan',
  MIM: 'Mimosa',
  ACR: 'Acrux',
}

function chip(suit: SuitId): string {
  return `${SUIT_NAME[suit]} 칩`
}

/** One decimal, and none when it lands on a whole number: 81.9%, 50%, 100%. */
function percent(p: number): string {
  const value = Math.round(p * 1000) / 10
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`
}

const SUIT_PAIRS: readonly (readonly [SuitId, SuitId])[] = SUIT_ORDER.flatMap((left, i) =>
  SUIT_ORDER.slice(i + 1).map((right) => [left, right] as const),
)

/** Both ways round: which suit is named first is what decides the answer. */
const ORDERED_PAIRS: readonly (readonly [SuitId, SuitId])[] = SUIT_PAIRS.flatMap(([a, b]) => [
  [a, b] as const,
  [b, a] as const,
])

interface Proposition {
  readonly text: string
  readonly answer: boolean
  readonly explanation: string
  /** Distance between the two quantities the question puts side by side. */
  readonly gap: number
  /**
   * Whether a student who computes both quantities can act on the difference.
   * A gap under WAGER_MIN_GAP cannot be called; an exact tie can, because equal
   * counts are read straight off STAR-CHART and "the same" is then the answer.
   */
  readonly clear: boolean
}

// ------------------------------------------------------------- comparison
// GDD 8-2, rounds 1-2: which of two suits is likelier to show up (Ⅱ-1).

function comparisons(deck: readonly Chip[], handSize: number): Proposition[] {
  const size = deck.length
  const count = countDeck(deck).bySuit
  const chance = drawChances(deck, handSize)
  const out: Proposition[] = []

  const standing = (a: SuitId, b: SuitId): string =>
    count[a] === count[b]
      ? `지금 덱 ${size}장 가운데 ${chip(a)}과 ${chip(b)}은 각각 ${count[a]}장으로 같다.`
      : `지금 덱 ${size}장 가운데 ${chip(a)}은 ${count[a]}장, ${chip(b)}은 ${count[b]}장이다.`

  for (const [a, b] of ORDERED_PAIRS) {
    const gap = Math.abs(chance[a] - chance[b])
    const tied = count[a] === count[b]
    const answer = chance[a] > chance[b]
    const rebuttal = answer
      ? `NO를 고르면 남은 장수가 많은 쪽이 뽑히기도 쉽다는 관계를 뒤집어 본 것이다.`
      : tied
        ? `YES를 고르면 '같다'와 '더 크다'를 같은 것으로 본 것이다.`
        : `YES를 고르면 남은 장수가 적은 ${chip(a)}이 더 잘 나온다고 본 것이다.`

    out.push({
      text: `지금 덱 상태에서, ${handSize}장을 뽑을 때 ${chip(a)}이 1장 이상 나올 가능성이 ${chip(b)}보다 클까?`,
      answer,
      explanation: `${standing(a, b)} ${handSize}장 안에 1장 이상 들어갈 가능성은 ${chip(a)} ${percent(chance[a])}, ${chip(b)} ${percent(chance[b])}다. ${rebuttal}`,
      gap,
      clear: tied || gap >= WAGER_MIN_GAP,
    })
  }

  for (const [a, b] of SUIT_PAIRS) {
    const gap = Math.abs(chance[a] - chance[b])
    const tied = count[a] === count[b]
    const answer = chance[a] === chance[b]

    out.push({
      text: `지금 덱 상태에서, ${handSize}장을 뽑을 때 ${chip(a)}이 1장 이상 나올 가능성과 ${chip(b)}이 1장 이상 나올 가능성이 같을까?`,
      answer,
      explanation: answer
        ? `${standing(a, b)} 남은 장수가 같으면 ${handSize}장 안에 1장 이상 들어갈 가능성도 같아, 양쪽 모두 ${percent(chance[a])}다. NO를 고르면 남은 장수가 같은데도 가능성이 다르다고 본 것이다.`
        : `${standing(a, b)} 가능성은 ${percent(chance[a])}와 ${percent(chance[b])}로 서로 다르다. YES를 고르면 남은 장수가 다른데도 가능성이 같다고 본 것이다.`,
      gap,
      clear: tied || gap >= WAGER_MIN_GAP,
    })
  }

  return out
}

// ------------------------------------------------------------- complement
// GDD 8-2, rounds 3-5: 여사건 — the chance a suit stays out of the hand (Ⅱ-2).

function complements(deck: readonly Chip[], handSize: number): Proposition[] {
  const size = deck.length
  const count = countDeck(deck).bySuit
  const chance = drawChances(deck, handSize)
  const out: Proposition[] = []

  for (const suit of SUIT_ORDER) {
    const none = 1 - chance[suit]
    const fact =
      count[suit] === 0
        ? `지금 덱 ${size}장에 ${chip(suit)}이 1장도 없으므로, ${handSize}장이 모두 다른 칩으로 채워질 확률은 100%다.`
        : none === 0
          ? `지금 덱 ${size}장 가운데 ${chip(suit)}은 ${count[suit]}장이라 나머지가 ${size - count[suit]}장뿐이고, 이것만으로는 ${handSize}장을 채울 수 없다. ${chip(suit)}이 1장도 안 나올 확률은 0%다.`
          : `지금 덱 ${size}장 가운데 ${chip(suit)}은 ${count[suit]}장이라, ${handSize}장이 모두 다른 칩으로 채워질 확률은 ${percent(none)}다. 이것은 1장 이상 나올 확률 ${percent(chance[suit])}의 여사건이다.`

    for (const threshold of WAGER_COMPLEMENT_THRESHOLDS) {
      const label = threshold === 0.5 ? `절반(50%)` : percent(threshold)
      const answer = none > threshold

      out.push({
        text: `지금 덱 상태에서, ${handSize}장을 뽑을 때 ${chip(suit)}이 1장도 안 나올 확률이 ${label}를 넘을까?`,
        answer,
        explanation: answer
          ? `${fact} NO를 고르면 그 확률을 기준 ${label}보다 작게 본 것이다. ${chip(suit)}을 비켜 ${handSize}장을 채울 방법이 그만큼 많다.`
          : `${fact} YES를 고르면 그 확률을 기준 ${label}보다 크게 본 것이다. ${chip(suit)}을 비켜 ${handSize}장을 채우기가 그만큼 어렵다.`,
        gap: Math.abs(none - threshold),
        clear: Math.abs(none - threshold) >= WAGER_MIN_GAP,
      })
    }
  }

  return out
}

// ------------------------------------------------------------ conditional
// GDD 8-2, rounds 6-8: the condition narrows the deck to the chips that satisfy
// it, and the question is about that narrowed range (Ⅱ-3).

/**
 * Chips that score as either suit. A special carrying both is one chip and is
 * counted once — `countDeck` totals it under each of its suits (GDD 3-2), which
 * is right for two separate draw chances and wrong for the size of a range that
 * one drawn chip either falls in or does not.
 */
function countEither(deck: readonly Chip[], a: SuitId, b: SuitId): number {
  return deck.filter(
    (item) =>
      (item.kind === 'basic' && (item.suit === a || item.suit === b)) ||
      (item.kind === 'special' &&
        (item.left === a || item.right === a || item.left === b || item.right === b)),
  ).length
}

// The hand size plays no part here: the condition is about one drawn chip, and
// the question is which side of the narrowed range it falls in.
function conditionals(deck: readonly Chip[]): Proposition[] {
  const size = deck.length
  const count = countDeck(deck).bySuit
  const out: Proposition[] = []

  for (const [a, b] of ORDERED_PAIRS) {
    const union = countEither(deck, a, b)
    // One draw from the narrowed range is exactly the conditional probability:
    // `chanceOfDrawing(union, count[a], 1)` is count[a] / union.
    const share = chanceOfDrawing(union, count[a], 1)
    const gap = Math.abs(share - 0.5)
    const half = share === 0.5
    // A condition nothing in the deck can satisfy is not a question to ask.
    const clear = union > 0 && (half || gap >= WAGER_MIN_GAP)
    const condition = `지금 덱에서 1장을 뽑는다. 그 1장이 ${chip(a)}이나 ${chip(b)}이라는 조건이 주어질 때, 그것이 ${chip(a)}일 가능성이`
    const fact = `지금 덱 ${size}장 가운데 ${chip(a)}은 ${count[a]}장, ${chip(b)}은 ${count[b]}장이고, 둘 중 하나로 판정되는 칩은 ${union}장이다. 조건이 범위를 이 ${union}장으로 좁히므로 ${chip(a)}일 가능성은 ${percent(share)}다.`

    out.push({
      text: `${condition} 절반보다 클까?`,
      answer: share > 0.5,
      explanation:
        share > 0.5
          ? `${fact} NO를 고르면 조건을 빼고 덱 ${size}장 전체에서 ${chip(a)}이 차지하는 몫만 따진 것이다.`
          : half
            ? `${fact} YES를 고르면 절반과 같은 것을 절반보다 큰 것으로 본 것이다.`
            : `${fact} YES를 고르면 조건이 남긴 ${union}장 안에서 ${chip(a)}이 절반에 못 미친다는 점을 놓친 것이다.`,
      gap,
      clear,
    })

    out.push({
      text: `${condition} 정확히 절반일까?`,
      answer: half,
      explanation: half
        ? `${fact} NO를 고르면 조건이 남긴 ${union}장이 두 문양으로 반씩 갈린다는 점을 놓친 것이다.`
        : `${fact} YES를 고르면 조건이 남긴 ${union}장 안에서 ${chip(a)}이 차지하는 몫을 절반으로 본 것이다.`,
      gap,
      clear,
    })
  }

  return out
}

// ----------------------------------------------------------------- picking

/**
 * Which proposition gets asked.
 *
 * The answer is never chosen — it is whatever the deck makes true. What the
 * seed picks is *which* proposition to put, and it starts by picking the side it
 * would like the answer to fall on. Without that the tiers lean: on a deck the
 * round has not touched yet every suit is equally likely, so every "is A more
 * likely than B" is false, and a player who noticed would stop reading the
 * question. Choosing the side first and then looking for a proposition that
 * lands there balances the two answers by construction rather than by flipping
 * a sentence into a double negative.
 *
 * Propositions too close to call are dropped rather than retried: the whole set
 * is enumerated (30 to 40 of them), so filtering it is the search, and a retry
 * cap could give up while a clear proposition was still on the table. When none
 * is clear at all — only reachable on a deck no round produces — the widest gap
 * available is asked instead of nothing.
 */
function choose(propositions: readonly Proposition[], rng: Rng): Proposition {
  const wantTrue = rng() < 0.5
  const clear = propositions.filter((p) => p.clear)
  const matching = clear.filter((p) => p.answer === wantTrue)
  const widest = Math.max(...propositions.map((p) => p.gap))
  const pool =
    matching.length > 0 ? matching : clear.length > 0 ? clear : propositions.filter((p) => p.gap === widest)

  return pool[Math.floor(rng() * pool.length)]
}

/** GDD 8-2's difficulty ramp. Rounds outside the table clamp to its ends. */
export function wagerTierFor(round: number): WagerTier {
  const index = Math.min(Math.max(Math.trunc(round), 1), WAGER_TIER_BY_ROUND.length) - 1
  return WAGER_TIER_BY_ROUND[index]
}

/**
 * The question for one turn's wager, taken from the deck about to be drawn from.
 *
 * `handSize` is a parameter for the reason GDD 8-1 gives for STAR-CHART's: the
 * hand is a setting and 표본추출 원시별 (GDD 7-2) takes it to 10, and a question
 * that kept saying 8 would be asking about a hand the player is not dealt.
 */
export function generateWager(
  deck: readonly Chip[],
  round: number,
  rng: Rng,
  handSize: number = HAND_SIZE,
): WagerQuestion {
  const tier = wagerTierFor(round)
  const propositions =
    tier === 'comparison'
      ? comparisons(deck, handSize)
      : tier === 'complement'
        ? complements(deck, handSize)
        : conditionals(deck)
  const { text, answer, explanation } = choose(propositions, rng)

  return { text, answer, tier, explanation }
}
