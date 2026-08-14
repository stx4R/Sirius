import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Electron loads the built page off the disk, where Vite's default absolute
  // `/assets/…` resolves against the drive root and 404s into a black window. The
  // web build keeps the default: `npm run build` has to stay byte-for-byte what it
  // was, or the Pages deploy changes underneath us.
  base: process.env.ELECTRON ? './' : '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
