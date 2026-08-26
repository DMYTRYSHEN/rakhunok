import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/app/',
  envDir: '../..',
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [svelte()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787'
    }
  },
  build: {
    sourcemap: false,
    target: 'es2022'
  }
});
