import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/app/',
  envDir: '../..',
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [svelte()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8787'
    }
  },
  build: {
    sourcemap: false,
    target: 'es2022'
  }
});
