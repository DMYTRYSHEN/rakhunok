import { copyFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/qr/',
  plugins: [{
    name: 'qr-entrypoint',
    closeBundle() {
      copyFileSync(resolve(import.meta.dirname, 'dist/index.html'), resolve(import.meta.dirname, 'dist/qr-entry.txt'))
      rmSync(resolve(import.meta.dirname, 'dist/models/rahunok-snow.glb'), { force: true })
    }
  }]
})