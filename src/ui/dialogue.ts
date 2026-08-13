// ORION's commentary (GDD 2, 11-8). He is the one who watches the play and says
// something about it; иєвυℓα keeps the shop.
//
// Tone: a calm observer. Terse, never hostile, never a coach — he reports what he
// sees and leaves the decision alone.
//
// Every beat holds several lines because a booth participant plays forty turns
// (GDD 4-2). One line per situation would be forty repetitions of it.
//
// CLAUDE.md §8: the picker takes an Rng instead of reaching for Math.random().
// It must not be handed `game.rng` — that generator feeds the shuffle and the
// drifter's roll, and spending draws from it on dialogue would mean the same seed
// no longer replays the same run, which is the whole point of the rule.

import type { OrionMood } from '../assets/palette'
import type { Rng } from '../core/rng'

/** A moment worth a line. The screen decides when one occurs. */
export type Beat =
  | 'turnStart'
  | 'placed'
  | 'settling'
  | 'bigScore'
  | 'nearTarget'
  | 'roundClear'
  | 'gameOver'

export const ORION_LINES: Readonly<Record<Beat, readonly string[]>> = {
  turnStart: [
    '이번엔 어떤 별을 놓을 건가',
    // 성단's one 한자 (BOOTH-9a): ORION naming the board, in fiction, on the turn the
    // player first looks at it. Every other mention — his own '성단이 닫혔다', the
    // cards, the companion text — is 한글 only.
    '성단(星團)가 기다리고 있다',
    '자리는 스물다섯, 손패는 여덟이다',
    '천천히 봐도 된다',
    '고르는 건 자네 몫이다',
  ],
  placed: [
    '…기록했다',
    '좌표를 새겼다',
    '되돌릴 수는 없다',
    '그 자리를 골랐군',
    '그렇게 두는군',
  ],
  settling: ['계산해 보지', '세어 보겠다', '빛이 모이는 중이다', '잠깐 기다리게'],
  bigScore: ['제법이군', '그 줄이 컸다', '잘 봤다', '나쁘지 않은 γένεσις였다'],
  nearTarget: ['조금만 더', '목표가 가깝다', '손이 닿는 거리다'],
  roundClear: ['다음 성역으로', '넘었군', 'иєвυℓα가 기다린다'],
  gameOver: ['여기까지인가', '성단이 닫혔다', '별은 다시 뜬다'],
}

/**
 * Which of GDD 11-8's four expressions each beat wears (BOOTH-6c).
 *
 * Seven beats over four faces, so three of them group. The grouping follows the
 * tone of the lines above rather than the mechanics of the beat:
 *
 *   · `calm` is the character — a quiet observer reporting what he sees. Three of
 *     the seven are that, and the fourth would be too if `placed` were ever fired.
 *   · `surprised` is reserved for `bigScore` alone. '제법이군' is him being caught
 *     out by a score, and spending the face anywhere else spends its meaning.
 *   · `pleased` covers the two beats that are going well — one where the target is
 *     within reach and one where it has been cleared.
 *   · `dim` is the run ending. It is the face that replaces '거래' (GDD 11-8).
 */
export const MOOD_OF: Readonly<Record<Beat, OrionMood>> = {
  turnStart: 'calm',
  placed: 'calm',
  settling: 'calm',
  bigScore: 'surprised',
  nearTarget: 'pleased',
  roundClear: 'pleased',
  gameOver: 'dim',
}

/** One line for the beat. Deterministic for a given generator state. */
export function lineFor(beat: Beat, rng: Rng): string {
  const lines = ORION_LINES[beat]
  return lines[Math.floor(rng() * lines.length)]
}

// ------------------------------------------------------------------ иєвυℓα
// GDD 11-9. She keeps the shop; ORION never does.
//
// The two exist to contrast, and the dialogue is where a player actually feels
// it. ORION reports and leaves the decision alone. иєвυℓα works the sale — she
// nudges, flatters and needles — but she never pushes: the stardust is the
// player's and the game does not pretend otherwise. If a line ever reads as
// pressure rather than patter, it belongs to the wrong character.

export type ShopBeat = 'enter' | 'gift' | 'bought' | 'reroll' | 'broke' | 'locked' | 'leave'

export const NEBULA_LINES: Readonly<Record<ShopBeat, readonly string[]>> = {
  enter: [
    '어서 오게. 별을 팔러 왔나, 사러 왔나',
    '먼 길이었지. 좋은 게 들어와 있다네',
    '자네가 올 줄 알았지',
    '구경은 공짜야. 손해 볼 것 없지 않나',
    '오늘은 뭘 가져갈 텐가',
  ],
  // GDD 13-4: the drifter is not sold, it is handed over on the first visit
  // (`openShop`). She opens on this instead of on `enter` that once, because a
  // chip appearing in the deck with nobody saying so is a chip the player finds
  // out about when it is already on the board.
  //
  // Every line has to carry the same one fact — that the thing is judged by the
  // suits next to it (GDD 3-3) — since the beat fires once and whichever line
  // comes up is the only explanation there will be. She still sells it to them:
  // giving something away for nothing is the last thing this character would
  // admit to doing, so each line finds an angle on it.
  gift: [
    '떠돌이 하나 얹어 주지. 옆에 놓인 칩의 문양을 따라가는 녀석일세',
    '떠돌이는 값을 안 받겠네. 붙여 놓는 문양대로 판정되는 조각일세',
    '선물이야, 놀랐나. 제 문양이 없어서 옆자리를 빌려 쓰는 떠돌이라네',
    '공허에 떠돌이를 한 장 넣어 뒀네. 인접한 칩의 문양으로 판정되지',
  ],
  bought: [
    '좋은 눈이야',
    '후회 없을 걸세',
    '역시 볼 줄 아는군',
    '그건 값을 하지, 두고 보게',
    '거래 성립. 즐거웠네',
  ],
  reroll: [
    '마음에 안 드나? 다시 펼쳐 보지',
    '까다롭군. 나쁘지 않아',
    '기다리게, 안쪽에 더 있으니',
    '별은 얼마든지 있다네',
  ],
  broke: [
    'St4RDu3t가 모자라는군',
    '외상은 안 되네. 규칙이야',
    '다음에 오게. 물건은 도망가지 않아',
    '더 벌어 오면 그때 이야기하지',
  ],
  // The companion shelf is stocked and shut (GDD 7-1-b). A slot that simply
  // refuses a click reads as a broken button, so she says why — and being the
  // one who decides what is for sale is in character for her besides.
  locked: [
    '그건 아직 내놓을 때가 아니야',
    '눈독은 들여 두게. 곧 풀릴 물건이니',
    '값을 못 매기는 물건은 못 파는 법이지',
    '조금만 더 기다리게. 서로 손해 볼 것 없지 않나',
  ],
  leave: [
    '또 보세',
    '별빛 아래서 다시 만나지',
    '가는 길에 조심하고',
    '다음 성역에서 기다리겠네',
  ],
}

export function shopLineFor(beat: ShopBeat, rng: Rng): string {
  const lines = NEBULA_LINES[beat]
  return lines[Math.floor(rng() * lines.length)]
}
