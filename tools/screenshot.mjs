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
window.__playTurn = async () => {
  let placed = 0;
  for (let i = 0; i < 4; i++) {
    const chip = window.__hand()[0];
    if (!chip) break;
    chip.click();
    await window.__wait(140);
    const cell = window.__cells().find(c => !c.disabled);
    if (!cell) break;
    cell.click();
    await window.__wait(140);
    placed++;
  }
  return placed;
};
'ready'
`

async function playRound(ws) {
  for (let turn = 0; turn < 5; turn++) {
    await sleep(700)
    await evaluate(ws, `window.__playTurn()`)
    await sleep(350)
    await evaluate(ws, `window.__t('턴 종료')?.click()`)
    await sleep(700)
    await evaluate(ws, `(window.__t('건너뛰기') ?? window.__t('다음 턴'))?.click()`)
    await sleep(300)
    await evaluate(ws, `window.__t('다음 턴')?.click()`)
    await sleep(500)
  }
  await sleep(1200)
  return evaluate(ws, `document.body.innerText.includes('иєвυℓα의 상점')`)
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

  await evaluate(ws, `location.href = ${JSON.stringify(APP)}`)
  await sleep(2500)
  await evaluate(ws, HELPERS)
  await shot(ws, 'game')

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

  if (!(await playRound(ws))) problems.push('round 1 did not end in the shop')
  await shot(ws, 'shop')

  // A constellation costs 10 and round 1 pays 6–11, so a second round is what
  // makes the purchase — and therefore the prompt — affordable.
  await evaluate(ws, `window.__t('라운드 2 시작')?.click()`)
  await sleep(1500)
  if (!(await playRound(ws))) problems.push('round 2 did not end in the shop')

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

  ws.close()
  chrome.kill()

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
