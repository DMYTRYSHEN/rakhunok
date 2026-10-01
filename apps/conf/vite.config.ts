import tailwindcss from '@tailwindcss/vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_URL || '/conf/',
  envDir: '../..',
  envPrefix: ['VITE_', 'PUBLIC_'],
  plugins: [
    tailwindcss(),
    svelte()
  ],
  server: {
    host: true,
    port: 5176,
    proxy: {
      '^/conf/api/banks/sync$': {
        target: 'http://127.0.0.1:8796',
        changeOrigin: false
      }
    }
  },
  build: {
    sourcemap: false,
    target: 'es2022'
  }
});
