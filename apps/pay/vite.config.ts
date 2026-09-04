import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_URL || '/pay/',
  envDir: '../..',
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [svelte()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:8787'
    }
  },
  build: {
    sourcemap: false,
    target: 'es2022'
  }
});
