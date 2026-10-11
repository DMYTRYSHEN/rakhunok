import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const base = process.env.BASE_URL || '/main/';

function redirectBareBase(): Plugin {
	const configure = (server: Pick<ViteDevServer, 'middlewares'>) => {
		server.middlewares.use((request, response, next) => {
			const url = new URL(request.url || '/', 'http://localhost');
			if (url.pathname === '/' || url.pathname === '') {
				response.writeHead(302, { Location: base });
				response.end();
				return;
			}
			next();
		});
	};
	return {
		name: 'main-bare-base',
		configureServer: configure,
		configurePreviewServer: configure
	};
}

export default defineConfig({
	base,
	plugins: [redirectBareBase(), svelte({ configFile: false })],
	server: {
		port: 5172,
		strictPort: false
	},
	build: {
		outDir: 'dist',
		target: 'es2022'
	}
});
