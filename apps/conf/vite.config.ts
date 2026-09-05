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
    port: 5176
  },
  build: {
    sourcemap: false,
    target: 'es2022'
  }
});
