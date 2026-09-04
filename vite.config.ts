import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const docsDirectory = resolve(import.meta.dirname, 'docs');

function apiDocsDevServer(): Plugin {
	return {
		name: 'api-docs-dev-server',
		configureServer(server) {
			server.middlewares.use(async (request, response, next) => {
				if (request.method !== 'GET' && request.method !== 'HEAD') {
					next();
					return;
				}

				const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
				const file =
					pathname === '/docs' || pathname === '/docs/'
						? { name: 'index.html', type: 'text/html; charset=utf-8' }
						: pathname === '/docs/openapi.yaml'
							? { name: 'openapi.yaml', type: 'application/yaml; charset=utf-8' }
							: undefined;

				if (!file) {
					next();
					return;
				}

				try {
					const content = await readFile(resolve(docsDirectory, file.name));
					response.statusCode = 200;
					response.setHeader('Content-Type', file.type);
					response.setHeader('Content-Length', content.byteLength);
					response.end(request.method === 'HEAD' ? undefined : content);
				} catch (error) {
					next(error);
				}
			});
		}
	};
}

export default defineConfig({
	plugins: [
		apiDocsDevServer(),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				pages: 'build',
				assets: 'build',
				fallback: '200.html'
			})
		})
	],
	server: {
		fs: {
			allow: ['.']
		},
		proxy: {
			'/dashboard/api': {
				target: 'http://localhost:8787',
				rewrite: (path) => path.slice('/dashboard'.length)
			}
		}
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
