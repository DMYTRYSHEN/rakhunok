import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import net from 'node:net';

const docsDirectory = resolve(import.meta.dirname, 'docs');

let lastConfCheckTime = 0;
let isConfServerAlive = false;
const CONF_CHECK_TTL_MS = 1500;

function isPortOpen(port: number, host = '127.0.0.1', timeout = 100): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = new net.Socket();
		let called = false;
		const done = (open: boolean) => {
			if (called) return;
			called = true;
			socket.destroy();
			resolve(open);
		};
		socket.setTimeout(timeout);
		socket.once('connect', () => done(true));
		socket.once('timeout', () => done(false));
		socket.once('error', () => done(false));
		socket.connect(port, host);
	});
}

async function isConfUp(): Promise<boolean> {
	const now = Date.now();
	if (now - lastConfCheckTime < CONF_CHECK_TTL_MS) {
		return isConfServerAlive;
	}
	isConfServerAlive = await isPortOpen(5176, '127.0.0.1', 80);
	lastConfCheckTime = now;
	return isConfServerAlive;
}

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

export default defineConfig(({ mode }) => ({
	plugins: [
		apiDocsDevServer(),
		tailwindcss(),
		sveltekit({
			...(mode === 'dashboard-isolated'
				? {
						appDir: 'dashboard/_app',
						outDir: '.svelte-kit-dashboard',
						paths: { base: '', assets: '', relative: false }
					}
				: {}),
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				pages: mode === 'dashboard-isolated' ? 'build-dashboard' : 'build',
				assets: mode === 'dashboard-isolated' ? 'build-dashboard' : 'build',
				fallback: '200.html'
			})
		})
	],
	server: {
		fs: {
			allow: ['.']
		},
		proxy: {
			'/conf': {
				target: 'http://127.0.0.1:5176',
				changeOrigin: true,
				bypass: async (req) => {
					// If the standalone conf dev server (apps/conf on port 5176) is not running,
					// bypass the proxy so SvelteKit handles the request with src/routes/conf/+page.svelte
					// and prevent AggregateError [ECONNREFUSED] proxy crashes.
					const alive = await isConfUp();
					if (!alive) {
						return req.url;
					}
					return undefined;
				},
				configure: (proxy) => {
					proxy.on('error', (_err, _req, res) => {
						if ('writeHead' in res && !res.headersSent && !res.writableEnded) {
							res.writeHead(302, { Location: '/conf' });
							res.end();
						}
					});
				}
			},
			'/dashboard/api': {
				target: 'http://127.0.0.1:8787',
				rewrite: (path) => path.slice('/dashboard'.length),
				configure: (proxy) => {
					proxy.on('error', (_err, _req, res) => {
						if ('writeHead' in res && !res.headersSent && !res.writableEnded) {
							res.writeHead(503, { 'Content-Type': 'application/json' });
							res.end(JSON.stringify({ error: 'Worker dev server (port 8787) is not running' }));
						}
					});
				}
			},
			'/pay': {
				target: 'http://127.0.0.1:8787',
				configure: (proxy) => {
					proxy.on('error', (_err, _req, res) => {
						if ('writeHead' in res && !res.headersSent && !res.writableEnded) {
							res.writeHead(503, { 'Content-Type': 'text/plain' });
							res.end('Worker dev server (port 8787) is not running');
						}
					});
				}
			},
			'/o': {
				target: 'http://127.0.0.1:8787'
			},
			'/t': {
				target: 'http://127.0.0.1:8787'
			},
			'/pos': {
				target: 'http://127.0.0.1:8787'
			},
			'/tag': {
				target: 'http://127.0.0.1:8787'
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
}));
