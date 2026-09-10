import { defineConfig } from '@playwright/test';

// Reuse the existing local Vite server without touching assets locked by Wrangler.
export default defineConfig({
	testMatch: ['**/business-settings.e2e.ts', '**/dashboard.svelte.e2e.ts'],
	use: { baseURL: 'http://localhost:5173' },
	workers: 1
});