import { StrictMode, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Game } from './ui/Game'
import { SpriteGallery } from './ui/SpriteGallery'

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** The game is the app; `#gallery` reaches the P3-A sprite sheet for inspection. */
function Root() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return hash === '#gallery' ? <SpriteGallery /> : <Game />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
