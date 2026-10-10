import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@sveltejs/adapter-cloudflare';

export default defineConfig(({ command }) => ({
	resolve: {
		alias: command === 'build' ? [{ find: /^@libsql\/client$/, replacement: '@libsql/client/web' }] : []
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: command === 'build' ? cloudflare() : undefined,
			paths: { base: command === 'build' ? '/delivery' : '' }
		})
	]
}));
