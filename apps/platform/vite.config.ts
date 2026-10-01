import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const base = process.env.BASE_URL || '/platform/';

function redirectBareBase(): Plugin {
	const configure = (server: Pick<ViteDevServer, 'middlewares'>) => {
		server.middlewares.use((request, response, next) => {
			const url = new URL(request.url || '/', 'http://localhost');
			if (url.pathname === '/dac7' || url.pathname === '/dac7/') {
				response.writeHead(302, { Location: `${base}${url.search}` });
				response.end();
				return;
			}
			if (base !== '/' && base.endsWith('/') && url.pathname === base.slice(0, -1)) {
				response.writeHead(302, { Location: `${base}${url.search}` });
				response.end();
				return;
			}
			next();
		});
	};
	return {
		name: 'platform-bare-base',
		configureServer: configure,
		configurePreviewServer: configure
	};
}

export default defineConfig({
	base,
	envDir: fileURLToPath(new URL('../..', import.meta.url)),
	envPrefix: ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY', 'PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'PUBLIC_GOOGLE_CLIENT_ID'],
	plugins: [redirectBareBase(), tailwindcss(), svelte({ configFile: false })],
	server: { port: 5178, strictPort: true },
	build: { outDir: 'dist', target: 'es2022', sourcemap: false }
});