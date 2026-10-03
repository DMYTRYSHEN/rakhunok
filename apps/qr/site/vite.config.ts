import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/qr/',
  plugins: [{
    name: 'qr-entrypoint',
    closeBundle() {
      copyFileSync(resolve(import.meta.dirname, 'dist/index.html'), resolve(import.meta.dirname, 'dist/qr-entry.txt'))
    }
  }]
})