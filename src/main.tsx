import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { SpriteGallery } from './ui/SpriteGallery'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SpriteGallery />
  </StrictMode>,
)
