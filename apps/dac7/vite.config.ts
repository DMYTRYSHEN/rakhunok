import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

const base = '/dac7/';

function redirectBareBase(): Plugin {
	const configure = (server: Pick<ViteDevServer, 'middlewares'>) => {
		server.middlewares.use((request, response, next) => {
			const url = new URL(request.url || '/', 'http://localhost');
			if (url.pathname === '/' || url.pathname === '/dac7') {
				response.writeHead(302, { Location: `${base}${url.search}` });
				response.end();
				return;
			}
			next();
		});
	};
	return { name: 'dac7-bare-base', configureServer: configure, configurePreviewServer: configure };
}

export default defineConfig({
	base,
	plugins: [redirectBareBase(), tailwindcss(), svelte({ configFile: false })],
	server: { port: 5194, strictPort: true },
	build: { outDir: 'dist', target: 'es2022', sourcemap: false }
});