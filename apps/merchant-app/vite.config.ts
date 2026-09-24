import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, '../..', 'PUBLIC_');
  if (command === 'build' && ['PUBLIC_GOOGLE_CLIENT_ID', 'PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY'].some((key) => !env[key]?.trim())) {
    throw new Error('Merchant app build requires Google and Supabase public configuration');
  }
  if (command === 'build' && (env.PUBLIC_TELEGRAM_AUTH_ENABLED !== 'true' || !['direct', 'redirect'].includes(env.PUBLIC_TELEGRAM_AUTH_MODE) || (env.PUBLIC_TELEGRAM_AUTH_MODE === 'direct' && !/^[1-9]\d*$/.test(env.PUBLIC_TELEGRAM_CLIENT_ID ?? '')))) {
    throw new Error('Merchant app build requires enabled Telegram auth, a supported mode, and a numeric direct-mode client ID');
  }
  return {
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
  };
});
