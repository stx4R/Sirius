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
    '성도가 기다리고 있다',
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
  bigScore: ['제법이군', '그 줄이 컸다', '잘 봤다', '나쁘지 않은 배치였다'],
  nearTarget: ['조금만 더', '목표가 가깝다', '손이 닿는 거리다'],
  roundClear: ['다음 성역으로', '넘었군', 'иєвυℓα가 기다린다'],
  gameOver: ['여기까지인가', '성도가 닫혔다', '별은 다시 뜬다'],
}

/** One line for the beat. Deterministic for a given generator state. */
export function lineFor(beat: Beat, rng: Rng): string {
  const lines = ORION_LINES[beat]
  return lines[Math.floor(rng() * lines.length)]
}
