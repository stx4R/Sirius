// иєвυℓα's shop (GDD 9-3), between one round and the next.
//
// Same fixed 1120×630 plane as the play screen, same absolute coordinates
// (GDD 11-10) — the shelf runs down the left, the two panels that answer what a
// purchase would do to the deck sit top-right, and иєвυℓα has the bottom-right
// corner at 3×, speaking into the gap beside her.
//
// Every rule the screen appears to enforce belongs to core (CLAUDE.md §5). What
// can be afforded, what a purchase costs, what leaves the shelf and what the deck
// then holds are all `core/shop.ts` and `core/game.ts` answering through the
// store. The only thing decided here is which of those answers is on screen, and
// which of the two constellation flows — buy, or buy over an existing one — the
// player is being shown.

import { useState } from 'react'
import {
  COMPANIONS,
  COMPANION_TIER_WEIGHTS,
  CONSTELLATION_NAMES,
  MODE_PRESETS,
  OWNED_CONSTELLATION_LIMIT,
  SHOP_PRICES,
} from '../core/config'
import { countDeck } from '../core/deck'
import { priceOf, rerollPrice } from '../core/shop'
import type { Purchase, SuitPair } from '../core/shop'
import { SUIT_ORDER } from '../core/types'
import type { Chip, CompanionId, CompanionTier, ConstellationId, SuitId } from '../core/types'
import { basicChip, drifterChip, specialChip } from '../assets/compose'
import { PALETTE, SUIT_INK, TIER_COLOURS, mix } from '../assets/palette'
import { useGame } from '../store/gameStore'
import { At, CANVAS_HEIGHT, CANVAS_WIDTH, Canvas, NEBULA_SCALE, SHOP_LAYOUT } from './Canvas'
import { ConstellationCard } from './ConstellationCard'
import { Stardust } from './HUD'
import { NebulaBubble, NebulaSprite, useNebula } from './Nebula'
import { PixelSprite } from './PixelSprite'
import { usePrefersReducedMotion } from './motion'

/** GDD 7-1's Korean tier names. UI text, so it stays out of config (CLAUDE.md §11). */
const TIER_NAMES: Readonly<Record<CompanionTier, string>> = {
  rare: '가스',
  superRare: '성운',
  epic: '원시별',
  mythic: '주계열성',
  legendary: '초거성',
}

/** GDD 3-1. The chip's colour and symbol already name the suit; this spells it. */
const SUIT_NAMES: Readonly<Record<SuitId, string>> = {
  GAC: 'Gacrux',
  IMA: 'Imai',
  GIN: 'Ginan',
  MIM: 'Mimosa',
  ACR: 'Acrux',
}

/** GDD 3-2's own shorthand for a special chip. */
const pairLabel = (pair: SuitPair) => `${pair[0]}&${pair[1]}`

// ------------------------------------------------------------------- pieces

function GroupLabel({ text, note }: { readonly text: string; readonly note?: string }) {
  return (
    <div className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-[11px] font-bold tracking-wide" style={{ color: PALETTE.starWhite }}>
        {text}
      </span>
      {note !== undefined && (
        <span className="text-[11px]" style={{ color: PALETTE.starGlow }}>
          {note}
        </span>
      )}
    </div>
  )
}

/**
 * The one button that spends stardust. It is grey and inert when the purse
 * cannot reach the price — иєвυℓα says why, but the button has to look refused
 * before it is pressed, or the shop reads as broken.
 */
function PriceButton({
  price,
  affordable,
  width,
  onBuy,
}: {
  readonly price: number
  readonly affordable: boolean
  readonly width: number
  readonly onBuy: () => void
}) {
  return (
    <button
      type="button"
      onClick={onBuy}
      className="rounded py-1 text-[11px] font-bold tabular-nums"
      style={{
        width,
        background: affordable ? PALETTE.nebulaAmber : PALETTE.panelEdge,
        color: affordable ? PALETTE.void : PALETTE.starGlow,
        cursor: affordable ? 'pointer' : 'default',
      }}
    >
      ✦ {price}
    </button>
  )
}

function SpecialEntry({
  pair,
  affordable,
  width,
  onBuy,
}: {
  readonly pair: SuitPair
  readonly affordable: boolean
  readonly width: number
  readonly onBuy: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-1" style={{ width }}>
      <PixelSprite pixels={specialChip(pair[0], pair[1])} scale={2} alt={pairLabel(pair)} />
      {/* Each half named in its own suit's ink. Acrux is the reason: its field is
          nearly the background colour, so what carries that half of the chip is
          its bright rim, and a plain grey label left the eye no way to tell an
          `IMA&ACR` from an `IMA&MIM` at a glance. */}
      <span className="text-[11px] font-bold tracking-wide">
        <span style={{ color: SUIT_INK[pair[0]] }}>{pair[0]}</span>
        <span style={{ color: PALETTE.starLink }}>&</span>
        <span style={{ color: SUIT_INK[pair[1]] }}>{pair[1]}</span>
      </span>
      <PriceButton
        price={SHOP_PRICES.specialChip}
        affordable={affordable}
        width={88}
        onBuy={onBuy}
      />
    </div>
  )
}

/**
 * GDD 11-5 will not let a card be shown without its name, condition and
 * multiplier, so the entry is the card component plus a price — never a bare
 * card with a number beside it.
 */
function ConstellationEntry({
  id,
  affordable,
  width,
  height,
  onBuy,
}: {
  readonly id: ConstellationId
  readonly affordable: boolean
  readonly width: number
  readonly height: number
  readonly onBuy: () => void
}) {
  return (
    <div
      className="flex items-center justify-between rounded px-2"
      style={{
        width,
        height,
        background: PALETTE.panel,
        outline: `1px solid ${PALETTE.panelEdge}`,
      }}
    >
      <ConstellationCard id={id} scale={2} layout="row" />
      <PriceButton
        price={SHOP_PRICES.constellation}
        affordable={affordable}
        width={72}
        onBuy={onBuy}
      />
    </div>
  )
}

/**
 * Stocked and shut (GDD 7-1-b, 미해결 #23). The slot is filled rather than
 * hidden because GDD 7-1 makes the odds table a teaching device, and an empty
 * shelf teaches nothing — so the tier, its published probability and its price
 * are all printed, and only the buying is missing.
 *
 * The lock is stated in words as well as drawn. A plate that merely failed to
 * respond would read as a bug, which is exactly what the player must not
 * conclude here.
 */
function CompanionEntry({
  id,
  width,
  height,
  onPoke,
}: {
  readonly id: CompanionId
  readonly width: number
  readonly height: number
  readonly onPoke: () => void
}) {
  const companion = COMPANIONS[id]
  const hue = TIER_COLOURS[companion.tier]

  return (
    <button
      type="button"
      onClick={onPoke}
      className="flex flex-col justify-between rounded p-2 text-left"
      style={{
        width,
        height,
        // Dimmed toward the panel: it is on the shelf, not on offer.
        background: mix(PALETTE.panel, hue, 0.06),
        outline: `1px solid ${mix(hue, PALETTE.nebulaDeep, 0.45)}`,
        cursor: 'help',
      }}
    >
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-bold" style={{ color: hue }}>
          {companion.name}
        </span>
        <span className="whitespace-nowrap text-[9px]" style={{ color: PALETTE.starGlow }}>
          {TIER_NAMES[companion.tier]} {COMPANION_TIER_WEIGHTS[companion.tier]}%
        </span>
      </div>

      <p className="line-clamp-2 text-[9px] leading-tight" style={{ color: PALETTE.starGlow }}>
        {companion.description}
      </p>

      <div className="flex w-full items-center justify-between">
        <span className="text-[11px] tabular-nums" style={{ color: PALETTE.starLink }}>
          ✦ {companion.price}
        </span>
        <span className="text-[11px] font-bold" style={{ color: PALETTE.starLink }}>
          잠김 — 아직 팔지 않는다
        </span>
      </div>
    </button>
  )
}

/**
 * What the deck is made of, and the only two things that change it (GDD 9-2).
 *
 * Both counts are printed because they are different questions. The big number
 * is how many chips would score as that suit, which is what a constellation
 * needs; the small one is how many basics there are, which is what may be
 * removed — a special counts toward the first and not the second (GDD 3-2).
 *
 * `countDeck` is core's (GDD 8-1's STAR-CHART reads the same counts at P5), so
 * this panel only lays them out.
 */
function DeckPanel({
  deck,
  drifterOwned,
  stardust,
  width,
  height,
  onBuy,
}: {
  readonly deck: readonly Chip[]
  readonly drifterOwned: boolean
  readonly stardust: number
  readonly width: number
  readonly height: number
  readonly onBuy: (purchase: Purchase) => void
}) {
  const counts = countDeck(deck)

  return (
    <div
      className="flex flex-col rounded p-3"
      style={{ width, height, background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
    >
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-bold" style={{ color: PALETTE.starWhite }}>
          덱 구성
        </span>
        <span className="text-[11px] tabular-nums" style={{ color: PALETTE.starGlow }}>
          전체 {deck.length}장 · 추가 ✦{SHOP_PRICES.addBasicChip} / 제거 ✦
          {SHOP_PRICES.removeBasicChip}
        </span>
      </div>

      {SUIT_ORDER.map((suit) => {
        const basics = counts.basicsBySuit[suit]
        const add: Purchase = { kind: 'addBasic', suit }
        const remove: Purchase = { kind: 'removeBasic', suit }

        return (
          <div key={suit} className="flex items-center gap-2" style={{ height: 32 }}>
            <PixelSprite pixels={basicChip(suit)} scale={1} alt="" />

            <span className="w-11 text-[11px] font-bold" style={{ color: SUIT_INK[suit] }}>
              {suit}
            </span>
            <span className="w-14 text-[9px]" style={{ color: PALETTE.starLink }}>
              {SUIT_NAMES[suit]}
            </span>

            <span
              className="w-7 text-right text-sm font-bold tabular-nums"
              style={{ color: PALETTE.starWhite }}
            >
              {counts.bySuit[suit]}
            </span>
            <span className="w-12 text-[9px] tabular-nums" style={{ color: PALETTE.starGlow }}>
              기본 {basics}
            </span>

            <div className="ml-auto flex gap-1">
              <PriceButton
                price={SHOP_PRICES.addBasicChip}
                affordable={stardust >= priceOf(add)}
                width={44}
                onBuy={() => onBuy(add)}
              />
              <PriceButton
                price={SHOP_PRICES.removeBasicChip}
                affordable={basics > 0 && stardust >= priceOf(remove)}
                width={44}
                onBuy={() => basics > 0 && onBuy(remove)}
              />
            </div>
          </div>
        )
      })}

      {/* The five rows sum to fifty and the header says fifty-one, because the
          drifter has no suit until it is scored and so belongs to none of them
          (GDD 3-3). The rule is sound and the arithmetic looks broken, which for
          a booth participant is the same thing as broken — so the panel says it
          where the sum is, not only by drawing the chip in BLACK-HOLE. */}
      {drifterOwned && (
        <span className="mt-auto text-[9px]" style={{ color: PALETTE.starGlow }}>
          떠돌이 1장은 문양이 없어 위 5행에 들어가지 않습니다
        </span>
      )}
    </div>
  )
}

/**
 * BLACK-HOLE (GDD 2): what the run is carrying, as opposed to what is for sale.
 *
 * Duplicates are folded into one sprite with a count. There are only ten special
 * chips in the game (GDD 3-2) and a run can end up holding several of the same
 * one, which as a plain list would run off a 396px panel long before the tenth.
 */
function InventoryPanel({
  specials,
  drifterOwned,
  constellations,
  width,
  height,
}: {
  readonly specials: readonly SuitPair[]
  readonly drifterOwned: boolean
  readonly constellations: readonly ConstellationId[]
  readonly width: number
  readonly height: number
}) {
  const held = new Map<string, { pair: SuitPair; count: number }>()
  for (const pair of specials) {
    const key = pairLabel(pair)
    held.set(key, { pair, count: (held.get(key)?.count ?? 0) + 1 })
  }

  return (
    <div
      className="flex flex-col gap-1 rounded p-2"
      style={{ width, height, background: PALETTE.panel, outline: `1px solid ${PALETTE.panelEdge}` }}
    >
      {/* Both lines are held to a tight leading because Galmuri's line box is
          ~1.55em: at the default the panel's contents come to 90px inside the
          86px GDD 11-10 gives it, and the constellation line below loses its
          descenders to the `truncate`. Tightening the text is the fix rather
          than growing the panel, which is a documented coordinate. */}
      <span className="text-[11px] font-bold leading-tight" style={{ color: PALETTE.starWhite }}>
        BLACK-HOLE
      </span>

      <div className="flex items-center" style={{ gap: 1, height: 32 }}>
        {[...held].map(([key, { pair, count }]) => (
          <span key={key} className="relative" title={key}>
            <PixelSprite pixels={specialChip(pair[0], pair[1])} scale={1} alt={key} />
            {count > 1 && (
              <span
                className="absolute -bottom-1 -right-1 rounded px-0.5 text-[9px] font-bold tabular-nums"
                style={{ background: PALETTE.void, color: PALETTE.starWhite }}
              >
                {count}
              </span>
            )}
          </span>
        ))}
        {drifterOwned && <PixelSprite pixels={drifterChip()} scale={1} alt="떠돌이" />}
        {held.size === 0 && !drifterOwned && (
          <span className="text-[11px]" style={{ color: PALETTE.starLink }}>
            아직 특수 조각이 없습니다
          </span>
        )}
      </div>

      <span className="truncate text-[11px] leading-tight" style={{ color: PALETTE.starGlow }}>
        별자리 {constellations.length}/{OWNED_CONSTELLATION_LIMIT} ·{' '}
        {constellations.map((id) => CONSTELLATION_NAMES[id]).join(' · ')}
      </span>
    </div>
  )
}

/**
 * GDD 6: four constellations is the limit, so a fifth has to replace one. The
 * choice is made against the full cards rather than a list of names — which one
 * to drop is a comparison of conditions and multipliers, and GDD 11-5 says those
 * are never separated from the card anyway.
 */
function ReplacePrompt({
  incoming,
  owned,
  onPick,
  onCancel,
}: {
  readonly incoming: ConstellationId
  readonly owned: readonly ConstellationId[]
  readonly onPick: (victim: ConstellationId) => void
  readonly onCancel: () => void
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded p-4"
      style={{
        width: SHOP_LAYOUT.replace.w,
        height: SHOP_LAYOUT.replace.h,
        background: PALETTE.panel,
        outline: `1px solid ${PALETTE.nebulaAmber}`,
      }}
    >
      <span className="text-[11px] font-bold" style={{ color: PALETTE.starWhite }}>
        별자리는 {OWNED_CONSTELLATION_LIMIT}개까지입니다 — 「
        {CONSTELLATION_NAMES[incoming]}」와 바꿀 카드를 고르세요
      </span>

      <div className="flex items-start" style={{ gap: SHOP_LAYOUT.replace.gap }}>
        {owned.map((id) => (
          <button key={id} type="button" onClick={() => onPick(id)} className="rounded p-1">
            <ConstellationCard id={id} scale={2} layout="stack" width={SHOP_LAYOUT.replace.card - 8} />
            <span className="mt-1 block text-[11px] font-bold" style={{ color: PALETTE.ginanEdge }}>
              버리기
            </span>
          </button>
        ))}

        <div
          className="self-center text-center text-lg"
          style={{ width: SHOP_LAYOUT.replace.arrow, color: PALETTE.starGlow }}
        >
          →
        </div>

        <div className="rounded p-1" style={{ outline: `1px solid ${PALETTE.nebulaAmber}` }}>
          <ConstellationCard id={incoming} scale={2} layout="stack" width={SHOP_LAYOUT.replace.card - 8} />
          <span className="mt-1 block text-[11px] font-bold" style={{ color: PALETTE.nebulaAmber }}>
            새 카드
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="rounded px-4 py-1 text-[11px]"
        style={{ background: PALETTE.panelEdge, color: PALETTE.starGlow }}
      >
        그만두기
      </button>
    </div>
  )
}

// -------------------------------------------------------------------- screen

export function Shop() {
  const game = useGame((state) => state.game)
  const seed = useGame((state) => state.seed)
  const { buyItem, rerollStock, leaveShop } = useGame.getState()

  const reduced = usePrefersReducedMotion()
  const nebula = useNebula(seed)

  /** The card waiting for something to be dropped for it. Presentation only. */
  const [replacing, setReplacing] = useState<ConstellationId | null>(null)

  const stock = game.stock
  const layout = SHOP_LAYOUT
  const rerollCost = rerollPrice(game.rerollsUsed)
  const full = game.ownedConstellations.length >= OWNED_CONSTELLATION_LIMIT

  // Core has already moved the counter on and will set the target when the round
  // starts (GDD 4-2), so this is what the purchases are being weighed against.
  const nextTarget = game.targets[game.round - 1] ?? 0

  const ownedSpecials = game.ownedDeck.flatMap((chip): SuitPair[] =>
    chip.kind === 'special' ? [[chip.left, chip.right]] : [],
  )

  /**
   * Core decides. The price check here only chooses which line she says — the
   * purchase itself goes through `buy`, which checks again and is the one that
   * counts.
   */
  const attempt = (purchase: Purchase) => {
    if (game.stardust < priceOf(purchase)) return nebula.speak('broke')
    buyItem(purchase)
    nebula.speak('bought')
  }

  const buyConstellation = (id: ConstellationId) => {
    if (game.stardust < SHOP_PRICES.constellation) return nebula.speak('broke')
    if (full) return setReplacing(id)
    attempt({ kind: 'constellation', id, replaces: null })
  }

  const replaceWith = (victim: ConstellationId) => {
    if (replacing === null) return
    attempt({ kind: 'constellation', id: replacing, replaces: victim })
    setReplacing(null)
  }

  const doReroll = () => {
    if (game.stardust < rerollCost) return nebula.speak('broke')
    rerollStock()
    nebula.speak('reroll')
  }

  return (
    <Canvas>
      <At x={layout.stardust.x} y={layout.stardust.y}>
        <Stardust value={game.stardust} />
      </At>

      <At x={CANVAS_WIDTH / 2} y={layout.title.y} centre>
        <span className="whitespace-nowrap text-sm font-bold" style={{ color: PALETTE.starWhite }}>
          иєвυℓα의 상점
        </span>
      </At>

      <At x={CANVAS_WIDTH / 2} y={layout.note.y} centre>
        <span className="whitespace-nowrap text-[11px]" style={{ color: PALETTE.starGlow }}>
          다음은 라운드 {game.round} / {MODE_PRESETS[game.mode].TOTAL_ROUNDS} · 목표{' '}
          {nextTarget.toLocaleString('ko-KR')}점
        </span>
      </At>

      {/* ------------------------------------------------------------ shelf */}

      <At x={layout.specials.label.x} y={layout.specials.label.y}>
        <GroupLabel text="특수 조각" note={`두 문양으로 모두 판정됩니다 · ${stock?.specials.length ?? 0}종`} />
      </At>
      <At x={layout.specials.x} y={layout.specials.y} w={layout.specials.w} h={layout.specials.h}>
        <div className="flex" style={{ gap: layout.specials.gap }}>
          {stock?.specials.map((pair) => (
            <SpecialEntry
              key={pairLabel(pair)}
              pair={pair}
              affordable={game.stardust >= SHOP_PRICES.specialChip}
              width={layout.specials.entry}
              onBuy={() => attempt({ kind: 'special', pair })}
            />
          ))}
          {stock?.specials.length === 0 && (
            <span className="text-[11px]" style={{ color: PALETTE.starLink }}>
              오늘 조각은 다 나갔네. 리롤해 보게
            </span>
          )}
        </div>
      </At>

      <At x={layout.constellations.label.x} y={layout.constellations.label.y}>
        <GroupLabel
          text="별자리"
          note={`보유 ${game.ownedConstellations.length}/${OWNED_CONSTELLATION_LIMIT}${full ? ' — 사면 한 장을 버립니다' : ''}`}
        />
      </At>
      <At
        x={layout.constellations.x}
        y={layout.constellations.y}
        w={layout.constellations.w}
        h={layout.constellations.h}
      >
        <div className="flex" style={{ gap: layout.constellations.gap }}>
          {stock?.constellations.map((id) => (
            <ConstellationEntry
              key={id}
              id={id}
              affordable={game.stardust >= SHOP_PRICES.constellation}
              width={layout.constellations.entry}
              height={layout.constellations.h}
              onBuy={() => buyConstellation(id)}
            />
          ))}
          {stock?.constellations.length === 0 && (
            <span className="text-[11px]" style={{ color: PALETTE.starLink }}>
              별자리는 동났네
            </span>
          )}
        </div>
      </At>

      <At x={layout.companions.label.x} y={layout.companions.label.y}>
        <GroupLabel text="동반성" note="확률 공개 · 지금은 진열만 합니다" />
      </At>
      <At
        x={layout.companions.x}
        y={layout.companions.y}
        w={layout.companions.w}
        h={layout.companions.h}
      >
        <div className="flex" style={{ gap: layout.companions.gap }}>
          {stock?.companions.map((id) => (
            <CompanionEntry
              key={id}
              id={id}
              width={layout.companions.entry}
              height={layout.companions.h}
              onPoke={() => nebula.speak('locked')}
            />
          ))}
        </div>
      </At>

      <At x={layout.reroll.x} y={layout.reroll.y} w={layout.reroll.w} h={layout.reroll.h}>
        <button
          type="button"
          onClick={doReroll}
          className="h-full w-full rounded text-[11px] font-bold"
          style={{
            background: game.stardust >= rerollCost ? PALETTE.nebulaTeal : PALETTE.panelEdge,
            color: game.stardust >= rerollCost ? PALETTE.void : PALETTE.starGlow,
            cursor: game.stardust >= rerollCost ? 'pointer' : 'default',
          }}
        >
          진열 다시 뽑기 ✦ {rerollCost}
        </button>
      </At>

      {/* Under the two buttons, not between them: the leave button moved into the
          gap this note used to sit in.

          In `starGlow`, the tone the rest of the screen's secondary text uses.
          It was in `starLink`, which is the hairline colour — on the void it is
          barely there, and this is the line that teaches what a rising reroll
          price means. GDD 12-2 asks the screen to teach unaided; a caption
          nobody can read is a caption that is not there. */}
      <At x={layout.rerollNote.x} y={layout.rerollNote.y}>
        <span className="whitespace-nowrap text-[11px]" style={{ color: PALETTE.starGlow }}>
          {game.rerollsUsed}회 사용 · 쓸 때마다 ✦{SHOP_PRICES.rerollIncrement}씩 오릅니다
        </span>
      </At>

      {/* ------------------------------------------------------------ иєвυℓα */}

      <At x={layout.bubble.x} y={layout.bubble.y}>
        <NebulaBubble
          line={nebula.line}
          reduced={reduced}
          width={layout.bubble.w}
          height={layout.bubble.h}
        />
      </At>

      <At x={layout.nebula.x} y={layout.nebula.y}>
        <NebulaSprite mood={nebula.mood} scale={NEBULA_SCALE} />
      </At>

      <At x={layout.deck.x} y={layout.deck.y}>
        <DeckPanel
          deck={game.ownedDeck}
          drifterOwned={game.drifterOwned}
          stardust={game.stardust}
          width={layout.deck.w}
          height={layout.deck.h}
          onBuy={attempt}
        />
      </At>

      <At x={layout.inventory.x} y={layout.inventory.y}>
        <InventoryPanel
          specials={ownedSpecials}
          drifterOwned={game.drifterOwned}
          constellations={game.ownedConstellations}
          width={layout.inventory.w}
          height={layout.inventory.h}
        />
      </At>

      <At x={layout.leave.x} y={layout.leave.y} w={layout.leave.w} h={layout.leave.h}>
        <button
          type="button"
          onClick={leaveShop}
          className="h-full w-full rounded text-[11px] font-bold"
          style={{ background: PALETTE.nebulaAmber, color: PALETTE.void }}
        >
          라운드 {game.round} 시작
        </button>
      </At>

      {replacing !== null && (
        <>
          {/* A real scrim rather than a shadow: while the choice is open the shelf
              behind it must not be clickable, or a purchase could land between
              picking a card and dropping one. Clicking it backs out. */}
          <At x={0} y={0} w={CANVAS_WIDTH} h={CANVAS_HEIGHT} z={45}>
            <button
              type="button"
              aria-label="교체 취소"
              onClick={() => setReplacing(null)}
              className="h-full w-full"
              style={{ background: `${PALETTE.void}CC`, cursor: 'default' }}
            />
          </At>

          <At x={CANVAS_WIDTH / 2} y={SHOP_LAYOUT.replace.y} centre z={50}>
            <ReplacePrompt
              incoming={replacing}
              owned={game.ownedConstellations}
              onPick={replaceWith}
              onCancel={() => setReplacing(null)}
            />
          </At>
        </>
      )}
    </Canvas>
  )
}
