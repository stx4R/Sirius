import { StrictMode, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { useGame } from './store/gameStore'
import { Game } from './ui/Game'
import { Shop } from './ui/Shop'
import { SpriteGallery } from './ui/SpriteGallery'

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/**
 * Which screen is up is core's phase, not a route (GDD 4-1). `endRound` puts the
 * run in the shop and nothing but `leaveShop` takes it out, so the two screens
 * cannot disagree about where the round stands.
 */
function Play() {
  const phase = useGame((state) => state.game.phase)
  return phase === 'shop' ? <Shop /> : <Game />
}

/** The game is the app; `#gallery` reaches the P3-A sprite sheet for inspection. */
function Root() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return hash === '#gallery' ? <SpriteGallery /> : <Play />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
