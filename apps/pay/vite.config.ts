import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_URL || '/pay/',
  envDir: '../..',
  envPrefix: ['VITE_', 'PUBLIC_'],
  define: {
    'import.meta.env.VITE_CHECKOUT_SYNTHETIC': JSON.stringify(process.env.CHECKOUT_LOCAL_HARNESS === '1' ? '1' : '0')
  },
  plugins: [svelte()],
  server: {
    port: 5174,
    proxy: {
      ...(process.env.CHECKOUT_LOCAL_HARNESS === '1' ? {} : { '/api': 'http://localhost:8787' })
    }
  },
  build: {
    sourcemap: false,
    target: 'es2022'
  }
});
