// Screenshots of the running game, without a browser extension.
//
//   npm run dev                 # in one terminal
//   npm run shot -- <outDir>    # in another
//
// Launches Chrome headless, drives the dev server over the DevTools protocol by
// clicking real DOM nodes, and writes a PNG at each screen worth looking at. No
// state is injected: it plays the game the way a player would, so what lands in
// the PNG is the real UI reacting to real events.
//
// It exists because the shop and the replacement prompt cannot be reviewed any
// other way — the prompt only opens with four constellations held and a fifth
// bought, which is several minutes of clicking to reach by hand. `tests/` covers
// the logic; this covers what it looks like.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'

const PORT = 9222
const APP = 'http://localhost:5173/'
const OUT = process.argv[2] ?? 'shots'
const WINDOW = { width: 1366, height: 768 }

/**
 * The run these shots are taken from, pinned through `?seed=` so the same click
 * path produces the same PNGs every time.
 *
 * It has to be a seed whose round 2 clears: the tool places every chip in the
 * first free cell, and only round 1 has a floor above its target (GDD 10-2), so
 * a seed that plays badly ends the run before the shop is ever reached.
 *
 * It was 1 until BOOTH-3b, when ORION'S WAGER started generating a question from
 * the same generator the deck is shuffled with (GDD 8-2) — two draws a turn, so
 * every seed deals a different run than it used to and seed 1's round 2 stopped
 * clearing. 2 is the first that gets there now, with stardust to spare for the
 * constellation the replacement prompt needs.
 */
const SEED = 2

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Everything that went wrong, reported at the end as a non-zero exit.
 *
 * The warnings below used to be `console.log` and nothing else, so a run that
 * reached no shop and shot four copies of Vite's error page still exited 0. A
 * screenshot is the only evidence the art is reviewed on, which makes a silent
 * failure here worse than a silent failure in a test: a green tick beside a
 * wrong picture is what gets believed.
 */
const problems = []

/** PNG sizes by name, for the duplicate check below. */
const written = new Map()

let nextId = 1
const rpc = (ws, method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    const onMessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id !== id) return
      ws.removeEventListener('message', onMessage)
      msg.error ? reject(new Error(`${method}: ${JSON.stringify(msg.error)}`)) : resolve(msg.result)
    }
    ws.addEventListener('message', onMessage)
    ws.send(JSON.stringify({ id, method, params }))
  })

async function evaluate(ws, expression) {
  const res = await rpc(ws, 'Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'threw')
  return res.result.value
}

async function shot(ws, name, clip) {
  const { data } = await rpc(ws, 'Page.captureScreenshot', { format: 'png', ...(clip && { clip }) })
  const png = Buffer.from(data, 'base64')
  await writeFile(`${OUT}/${name}.png`, png)
  written.set(name, png.length)
  console.log('  →', `${OUT}/${name}.png`)
}

/**
 * Page-side helpers. A board cell is only enabled once a chip is held, so every
 * placement is two clicks with a re-render in between — the pauses are not
 * padding, they are what lets React catch up.
 */
const HELPERS = `
window.__wait = (ms) => new Promise(r => setTimeout(r, ms));
window.__t = (s) => [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(s));
window.__cells = () => [...document.querySelectorAll('div.grid > button')];
window.__hand = () => [...document.querySelectorAll('button.absolute.top-0.rounded')];
// An occupied cell carries the landed chip's span; the hover ghost is a
// different one, so this reads the board without a chip having to be held.
window.__filled = () => window.__cells().map(c => c.querySelector('span.relative') !== null);
// (2,2) and its four orthogonal cells. The centre is kept empty for the drifter
// so that when one turns up it reads four neighbours — GDD 3-3's ₄C₃ case, which
// is DRIFT ORACLE's four-row table and the widest thing the panel has to hold.
window.__TARGET = 12;
window.__RING = [7, 17, 11, 13];
window.__playTurn = async () => {
  let placed = 0;
  for (let step = 0; step < 4; step++) {
    const hand = window.__hand();
    if (!hand.length) break;
    const filled = window.__filled();
    const drifter = hand.find(c => c.dataset.kind === 'drifter');
    const seated = window.__RING.every(i => filled[i]) && !filled[window.__TARGET];

    let chip = drifter;
    let want = window.__TARGET;
    if (!drifter || !seated) {
      chip = hand.find(c => c.dataset.kind !== 'drifter');
      if (!chip) break;
      const gap = window.__RING.find(i => !filled[i]);
      want = gap === undefined ? filled.findIndex((f, i) => !f && i !== window.__TARGET) : gap;
    }
    if (want === undefined || want < 0) break;

    chip.click();
    await window.__wait(140);
    const cell = window.__cells()[want];
    if (!cell || cell.disabled) break;
    cell.click();
    await window.__wait(140);
    placed++;
  }
  return placed;
};
'ready'
`

/**
 * ORION'S WAGER (GDD 8-2) stands between every turn and its hand, so the tool has
 * to answer it the way a player does. It always says YES: the answers come out
 * about half true (core/wager.ts), so both an explanation of a hit and of a miss
 * turn up within a round or two — and both are shots this file has to produce.
 *
 * The panel is measured while it is up. Its explanation is 2~3 sentences core
 * wrote from the deck, and one clipped by the box is a wrong answer with no
 * visible reason — which no screenshot would show, because a clipped box looks
 * like a short explanation.
 */
async function answerWager(ws) {
  if (!(await evaluate(ws, `!!window.__t('기권')`))) return

  const fit = await evaluate(
    ws,
    `(() => {
       const el = document.querySelector('[data-panel="wager"]');
       return el === null ? null : { scroll: el.scrollHeight, client: el.clientHeight };
     })()`,
  )
  if (fit === null) problems.push('the wager panel has no box to measure')
  else if (fit.scroll > fit.client) {
    problems.push(`the wager panel clips its own content: ${fit.scroll} > ${fit.client}`)
  }

  // Not while a coach caption is up (BOOTH-6b). The first wager of a run carries
  // one, and `coach-wager.png` is that same frame — two names for one image is
  // what the duplicate check at the end of this file calls a failure, and it
  // would be right. The panel's own shot waits for the next wager instead.
  const coached = await evaluate(ws, `!!document.querySelector('[data-coach]')`)
  if (!written.has('wager') && !coached) await shot(ws, 'wager')

  await evaluate(ws, `window.__t('YES')?.click()`)
  await sleep(400)

  // The verdict beside a miss reads "정답은 …", so a hit is the absence of 오답.
  //
  // A hit has two faces from BOOTH-6b: inside the tutorial window it still carries
  // the explanation, and after it there is nothing under the verdict but the
  // button (GDD 8-2). Both are shots this file has to produce, and naming the
  // frame by what is actually on it is what keeps them from being one image under
  // two names — `data-explained` is the panel saying which it is.
  const missed = await evaluate(ws, `document.body.innerText.includes('오답')`)
  const explained = await evaluate(
    ws,
    `document.querySelector('[data-panel="wager"]')?.dataset.explained ?? 'unknown'`,
  )
  const name = missed
    ? 'wager-wrong'
    : explained === 'false'
      ? 'wager-correct-brief'
      : 'wager-correct'
  if (!written.has(name)) await shot(ws, name)

  // Closing the explanation is what deals the hand (gameStore `dismissWager`),
  // and the shuffle beat holds the board disabled while it runs — so this waits
  // out SHUFFLE_MS rather than clicking into a board that cannot take a chip.
  await evaluate(ws, `window.__t('계속')?.click()`)
  await sleep(900)
}

/**
 * DRIFT ORACLE (GDD 8-3) stands between the end-turn button and the score, so
 * from BOOTH-4b the tool has a second modal to get past. It only appears once a
 * drifter is on the board, which is why `__playTurn` reaches for one.
 *
 * Which button it presses alternates on purpose. The three choices are the
 * expectation between the best and the worst case (core/oracle.ts), so the
 * middle value by size is usually the right one and the largest usually is not —
 * enough to reach both explanations within a round rather than hoping the
 * shuffle obliges. The shot is still named after the verdict that actually came
 * back, never after the one that was aimed at.
 */
let oraclesAnswered = 0

async function answerOracle(ws) {
  const present = await evaluate(ws, `!!document.querySelector('[data-panel="oracle"]')`)
  if (!present) return

  const fit = await evaluate(
    ws,
    `(() => {
       const el = document.querySelector('[data-panel="oracle"]');
       return el === null ? null : { scroll: el.scrollHeight, client: el.clientHeight };
     })()`,
  )
  if (fit === null) problems.push('the oracle panel has no box to measure')
  else if (fit.scroll > fit.client) {
    problems.push(`the oracle panel clips its own content: ${fit.scroll} > ${fit.client}`)
  }

  if (!written.has('oracle')) await shot(ws, 'oracle')

  const aimHigh = oraclesAnswered % 2 === 1
  oraclesAnswered++
  await evaluate(
    ws,
    `(() => {
       const buttons = [...document.querySelectorAll('[data-panel="oracle"] button')];
       const sorted = buttons.slice().sort((a, b) => Number(a.textContent) - Number(b.textContent));
       (${aimHigh} ? sorted[sorted.length - 1] : sorted[1])?.click();
     })()`,
  )
  await sleep(400)

  const missed = await evaluate(ws, `document.body.innerText.includes('오답')`)
  const name = missed ? 'oracle-wrong' : 'oracle-correct'
  if (!written.has(name)) await shot(ws, name)

  await evaluate(ws, `window.__t('정산으로')?.click()`)
  await sleep(600)
}

/**
 * The first-run coach captions (GDD 12-2 ①), added at BOOTH-6b.
 *
 * Each one is dismissed by *doing* the thing it asks for, so the only way to
 * photograph all five is to walk turn 1 of round 1 a click at a time —
 * `__playTurn` makes four placements inside one page-side loop and there is no
 * moment in between for Node to reach.
 *
 * The caption is found by `data-coach`, and a shot is only taken when it is really
 * there. A PNG of the step that was aimed at rather than the one that was up is
 * exactly the silent failure this file exists to stop.
 */
async function shotCoach(ws, step) {
  const up = await evaluate(ws, `!!document.querySelector('[data-coach="${step}"]')`)
  if (!up) {
    const showing = await evaluate(
      ws,
      `document.querySelector('[data-coach]')?.dataset.coach ?? 'none'`,
    )
    problems.push(`coach step "${step}" was due but "${showing}" was on screen`)
    return
  }
  if (!written.has(`coach-${step}`)) await shot(ws, `coach-${step}`)
}

/**
 * Steps 2 to 4 — pick a chip up, put it down, see the placement cap — which are
 * three single clicks into the first turn.
 *
 * The one placement goes into the ring `__playTurn` builds around (2,2), so the
 * drifter still lands on four neighbours two rounds later (GDD 3-3) and this chip
 * is not spent somewhere the rest of the run has to work around.
 */
async function walkCoach(ws) {
  await shotCoach(ws, 'hand')

  await evaluate(ws, `window.__hand().find(c => c.dataset.kind !== 'drifter')?.click()`)
  await sleep(300)
  await shotCoach(ws, 'board')

  await evaluate(ws, `window.__cells()[window.__RING[0]]?.click()`)
  await sleep(300)
  await shotCoach(ws, 'limit')
}

/**
 * CONSTELLATION LOG (GDD 8-4) closes a round, and иєвυℓα waits behind it. Two of
 * them are photographed — the first round, where the convergence list is a
 * single point and there is nothing to compare against yet, and the last, where
 * three rounds of it are stacked up. They are the two states of the same screen
 * that had to be reviewed side by side.
 */
async function closeReport(ws, name) {
  const present = await evaluate(ws, `!!document.querySelector('[data-panel="report"]')`)
  if (!present) {
    // What is on screen instead, because "it did not open" alone cannot tell a
    // missed target from a broken dismissal.
    const showing = await evaluate(ws, `document.body.innerText.replace(/\\s+/g, ' ').slice(0, 200)`)
    problems.push(`the round-end report did not open${name ? ` (${name})` : ''} — showing: ${showing}`)
    return false
  }

  const fit = await evaluate(
    ws,
    `(() => {
       const el = document.querySelector('[data-panel="report"]');
       return { scroll: el.scrollHeight, client: el.clientHeight };
     })()`,
  )
  if (fit.scroll > fit.client) {
    problems.push(`the report panel clips its own content: ${fit.scroll} > ${fit.client}`)
  }

  if (name && !written.has(name)) await shot(ws, name)

  await evaluate(ws, `document.querySelector('[data-panel="report"] button')?.click()`)
  await sleep(900)
  return true
}

/**
 * Every special chip the purse reaches, at whichever shop is open (GDD 9-2).
 *
 * The tool places into the first free cell, which builds no run of one suit and
 * fires no constellation at all — a full board scores 40+80+120+160+200 flat,
 * and GDD 12-4's third booth target is 640. A special is one card judged as two
 * suits (GDD 3-2), so each one placed is worth twice the flat rate, and buying
 * them is what carries the run to a third round without the tool having to learn
 * to play.
 *
 * Bought rather than injected through the DEV panel on purpose: a purchase lands
 * in `ownedDeck` between rounds, so the next round's population snapshot picks it
 * up and CONSTELLATION LOG measures each round against the deck it really had
 * (GDD 8-4). DEV adds a chip mid-round, which the snapshot has already passed.
 */
async function buySpecials(ws) {
  // Mirrors SHOP_PRICES.specialChip. Core refuses what the purse cannot reach,
  // so clicking every one of them buys as many as are affordable and no more.
  await evaluate(
    ws,
    `(async () => {
       for (const button of [...document.querySelectorAll('button')]) {
         if (button.textContent.trim() !== '✦ 8') continue;
         button.click();
         await window.__wait(220);
       }
     })()`,
  )
  await sleep(400)
}

async function playRound(ws, reportShot) {
  for (let turn = 0; turn < 5; turn++) {
    await sleep(700)
    await answerWager(ws)
    await evaluate(ws, `window.__playTurn()`)
    await sleep(350)
    await evaluate(ws, `window.__t('턴 종료')?.click()`)
    await sleep(700)
    await answerOracle(ws)

    // Coach step 5 (BOOTH-6b): the round total and its target, up only over the
    // first settlement of round 1. This is the one moment in the whole run it
    // exists, so it is taken here rather than in `walkCoach`.
    if (!written.has('coach-target')) {
      const up = await evaluate(ws, `!!document.querySelector('[data-coach="target"]')`)
      if (up) await shot(ws, 'coach-target')
    }

    await evaluate(ws, `(window.__t('건너뛰기') ?? window.__t('다음 턴'))?.click()`)
    await sleep(300)
    await evaluate(ws, `window.__t('다음 턴')?.click()`)
    await sleep(500)
  }
  await sleep(1200)
  if (!(await closeReport(ws, reportShot))) return false

  // Not the shop's own title: иєвυℓα is drawn as a sprite now (GDD 11-9), so her
  // name is no longer in `innerText`. BLACK-HOLE is text, and shop-only.
  return evaluate(ws, `document.body.innerText.includes('BLACK-HOLE')`)
}

/**
 * A fresh page load through to the shop after round 2, taking the three shots on
 * the way.
 *
 * Every failure here is a real one now that the seed is pinned: the same seed
 * plays the same run, so a round that stops clearing means something changed in
 * the rules or the screen, not that the dice went the other way.
 */
async function playToSecondShop(ws) {
  await evaluate(ws, `location.href = ${JSON.stringify(`${APP}?seed=${SEED}`)}`)
  await sleep(2500)
  await evaluate(ws, HELPERS)
  await shot(ws, 'title')

  // The app opens on the title now, so there is no game to photograph until it
  // has been answered. The mode defaults to booth and is left alone — its first
  // two rounds are full's (GDD 12-4), which is what the shop shots play through.
  // The starting constellation has no default by design (GDD 13-5), so it is the
  // one thing that must be clicked.
  await evaluate(ws, `document.querySelector('[data-choice="starting"]')?.click()`)
  await sleep(300)
  await evaluate(ws, `window.__t('시작')?.click()`)
  await sleep(1500)

  // Without this the next twenty steps click at a title screen and every PNG
  // after it is the same picture — the failure this file exists to make loud.
  if (!(await evaluate(ws, `!!window.__t('턴 종료')`))) {
    throw new Error('the title screen did not start a run')
  }

  // A run opens on its first wager, not on a hand (GDD 8-2), so the play screen
  // is only photographable once that one has been answered and read. Coach step 1
  // is over that same modal (BOOTH-6b) and has to be taken before it is answered.
  await shotCoach(ws, 'wager')
  await answerWager(ws)

  // Steps 2 to 4, and then the rest of the turn filled in, so `game.png` is a
  // board with chips on it rather than an empty one. It is taken here and not
  // before the walk because every frame of turn 1 carries a caption, and the two
  // shots would otherwise be one image under two names.
  await walkCoach(ws)
  await evaluate(ws, `window.__playTurn()`)
  await sleep(350)
  await shot(ws, 'game')

  // The ? summary (GDD 12-2 ①) — the way back in for a player who lost the
  // thread, so it is reviewed on its own rather than only in passing.
  await evaluate(ws, `document.querySelector('[data-help="open"]')?.click()`)
  await sleep(500)
  if (!(await evaluate(ws, `!!document.querySelector('[data-panel="help"]')`))) {
    problems.push('the ? summary did not open')
  } else {
    await shot(ws, 'help')
  }
  await evaluate(ws, `window.__t('닫기')?.click()`)
  await sleep(400)

  // Four constellations, so the replacement prompt is reachable at all (GDD 6).
  await evaluate(ws, `window.__t('DEV')?.click()`)
  await sleep(500)
  await evaluate(ws, `(async () => {
    let ticked = 0;
    for (const box of document.querySelectorAll('input[type=checkbox]')) {
      if (ticked >= 3 || box.checked) continue;
      box.click();
      await window.__wait(120);
      ticked++;
    }
  })()`)
  await sleep(400)
  await evaluate(ws, `window.__t('✕')?.click()`)
  await sleep(400)

  if (!(await playRound(ws, 'report-round1'))) problems.push('round 1 did not end in the shop')
  await shot(ws, 'shop')
  await buySpecials(ws)

  // A constellation costs 10 and round 1 pays 6–11, so a second round is what
  // makes the purchase — and therefore the prompt — affordable.
  await evaluate(ws, `window.__t('라운드 2 시작')?.click()`)
  await sleep(1500)
  if (!(await playRound(ws))) problems.push('round 2 did not end in the shop')
}

async function main() {
  await mkdir(OUT, { recursive: true })

  // Before Chrome, because without the dev server every screenshot below is the
  // same "unable to connect" page and the run would otherwise look like it worked.
  const serving = await fetch(APP)
    .then((r) => r.ok)
    .catch(() => false)
  if (!serving) throw new Error(`nothing serving ${APP} — run \`npm run dev\` first`)

  const binary = CHROME.find((path) => existsSync(path))
  if (!binary) throw new Error('no Chrome found — add its path to CHROME in this file')

  const chrome = spawn(binary, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${WINDOW.width},${WINDOW.height}`,
    '--user-data-dir=' + (process.env.TEMP ?? '/tmp') + '/sta-mble-shots',
    'about:blank',
  ])
  chrome.on('error', (e) => console.error('chrome:', e.message))
  await sleep(3000)

  const targets = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json())
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  await rpc(ws, 'Page.enable')
  await rpc(ws, 'Runtime.enable')

  await playToSecondShop(ws)

  await evaluate(ws, `window.__t('✦ 10')?.click()`)
  await sleep(800)
  const opened = await evaluate(ws, `document.body.innerText.includes('바꿀 카드를 고르세요')`)
  if (!opened) problems.push('the replacement prompt did not open')
  await shot(ws, 'shop-replace')

  await evaluate(ws, `[...document.querySelectorAll('button')].find(b => b.textContent.trim() === '그만두기')?.click()`)
  await sleep(600)

  // иєвυℓα close up, measured off her own <img> rather than computed from
  // WINDOW. The canvas is centred in the *viewport*, which is shorter than the
  // window it was being derived from, and the difference cropped her head off.
  const box = await evaluate(
    ws,
    `(() => {
       const img = document.querySelector('img[alt="иєвυℓα"]');
       if (!img) return null;
       const r = img.getBoundingClientRect();
       return { x: r.x, y: r.y, width: r.width, height: r.height };
     })()`,
  )
  if (box === null) {
    problems.push('иєвυℓα is not on the shop screen')
  } else {
    const pad = 12
    await shot(ws, 'nebula', {
      x: box.x - pad,
      y: box.y - pad,
      width: box.width + pad * 2,
      height: box.height + pad * 2,
      scale: 3,
    })
  }

  // The booth run is three rounds (GDD 12-3), so this is the last report there
  // is — and the only one with a convergence list long enough to read as one.
  // The constellation was cancelled out of above, so the purse is still full.
  await buySpecials(ws)
  await evaluate(ws, `window.__t('라운드 3 시작')?.click()`)
  await sleep(1500)
  await playRound(ws, 'report-round3')

  ws.close()
  chrome.kill()

  // Both wager verdicts have to have come up. Ten or so questions at roughly
  // even odds should produce each of them; never seeing one means the answers
  // are not landing where core says they do.
  for (const name of ['wager', 'wager-correct', 'wager-correct-brief', 'wager-wrong']) {
    if (!written.has(name)) problems.push(`${name}.png was never reached`)
  }

  // The oracle is round 2 or later — the drifter is handed over at the first
  // shop (GDD 13-4) — and `__playTurn` keeps (2,2) free for it, so on the pinned
  // seed all three states are reached. Missing one means the drifter stopped
  // getting placed or the modal stopped opening.
  for (const name of ['oracle', 'oracle-correct', 'oracle-wrong']) {
    if (!written.has(name)) problems.push(`${name}.png was never reached`)
  }

  // Round 1 and round 3, so the convergence list is seen with one point and with
  // three. Missing the second one means round 3 stopped clearing.
  for (const name of ['report-round1', 'report-round3']) {
    if (!written.has(name)) problems.push(`${name}.png was never reached`)
  }

  // All five coach captions and the ? summary (GDD 12-2 ①). They are the tutorial
  // a booth participant starts on unaided, so a step that stopped appearing is the
  // one failure here that nobody would notice from a test.
  for (const step of ['wager', 'hand', 'board', 'limit', 'target']) {
    if (!written.has(`coach-${step}`)) problems.push(`coach-${step}.png was never reached`)
  }
  if (!written.has('help')) problems.push('help.png was never reached')

  // Two PNGs the same length to the byte are the same PNG under two names, which
  // is what a run against an error page produces.
  const byLength = new Map()
  for (const [name, length] of written) {
    const earlier = byLength.get(length)
    if (earlier !== undefined) problems.push(`${earlier}.png and ${name}.png are the same image`)
    else byLength.set(length, name)
  }

  if (problems.length > 0) {
    console.error('\nFAILED:')
    for (const problem of problems) console.error('  -', problem)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
