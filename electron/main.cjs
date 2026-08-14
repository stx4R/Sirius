// The Electron shell around the built game — what makes `Sirius-v7.0.0-portable.exe`
// a thing a booth PC can double-click with no install, no runtime and no network.
//
// ★ CommonJS, on purpose. `package.json` is `"type": "module"`, so a `.js` file here
// would be parsed as ESM; `.cjs` is what keeps `require` working without a second
// package.json. It is also plain JavaScript rather than TypeScript so it stays out of
// `tsc --noEmit` — `tsconfig.json` includes `src`, `tests`, `sim` and the vite config
// and nothing else, so no `exclude` is needed for it.
//
// ★ It holds no game logic and never will. The rule that `core/game.ts` is the only
// state machine (CLAUDE.md §5) applies here as much as to `sim/` and `store/`: this
// file opens a window onto `dist/index.html` and stops. Everything the player sees is
// the same build the browser gets.

const { app, BrowserWindow, Menu } = require('electron')
const path = require('node:path')

// Chromium blocks audio until the page has been clicked. The game is silent today
// (howler is a dependency but is imported nowhere in `src/`), so this changes nothing
// yet — it is here so that the day a sound is added, it does not arrive as a bug that
// only reproduces in the packaged build.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

/** GDD 11-10's canvas, exactly. `useContentSize` makes these the page, not the frame. */
const CANVAS = { width: 1120, height: 630 }

// PALETTE.void. Duplicated rather than imported because this file cannot reach into
// `src/assets/palette.ts` — it is CommonJS running before the bundle exists. It paints
// the window before the first frame so the launch is void-to-game, never white-to-game.
const VOID = '#0A0A12'

function createWindow() {
  const win = new BrowserWindow({
    ...CANVAS,
    useContentSize: true,
    backgroundColor: VOID,
    title: 'Sirius',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // No menu bar. A booth machine has no use for File/Edit, and the bar would eat 30px
  // off a window whose content height is a fixed rule.
  Menu.setApplicationMenu(null)

  // Losing the menu also loses the accelerators that came with it, so the three worth
  // keeping are bound by hand. F11 and Esc are for the booth; the devtools binding is
  // for whoever has to debug the machine at the booth.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen())
      event.preventDefault()
      return
    }

    // Only when there is fullscreen to leave — Esc is a key the game itself uses
    // (the pause screen), and swallowing it in a window would break that.
    if (input.key === 'Escape' && win.isFullScreen()) {
      win.setFullScreen(false)
      event.preventDefault()
      return
    }

    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  // Nothing in the game opens a window, and a portable exe on a school PC should not
  // be able to become a browser. Denied rather than handed to the system browser.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  load(win)
}

/**
 * The packaged exe reads the build off the disk; `npm run electron:dev` points at the
 * vite dev server so a change shows up without repackaging.
 *
 * `app.isPackaged` is the switch rather than an env var, because setting one portably
 * from an npm script needs `cross-env`, and the dependency list for this is exactly
 * electron and electron-builder.
 *
 * The retry exists because `electron:dev` starts vite and electron together and
 * electron usually wins the race. Without it the dev window is a Chromium error page
 * that only a manual reload clears.
 */
function load(win) {
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    return
  }

  const url = 'http://localhost:5173/'
  win.webContents.on('did-fail-load', () => setTimeout(() => win.loadURL(url), 300))
  win.loadURL(url)
}

app.whenReady().then(createWindow)

// One window is the whole app, so closing it ends the process on every platform. The
// usual macOS exception does not apply: the only target is a Windows portable exe.
app.on('window-all-closed', () => app.quit())
