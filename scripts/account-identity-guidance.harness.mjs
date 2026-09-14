import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { rolldown } from 'rolldown';
import { compile } from 'svelte/compiler';

const root = fileURLToPath(new URL('../', import.meta.url));
const component = resolve(root, 'apps/merchant-app/src/auth/AccountIdentityGuidance.svelte');

// Compile only the real guidance + LoginOptions, never App/auth gateways or an SDK.
// All assets are bundled in memory; nothing enters the deployment dist directory.
export async function createHarness() {
	const wrapper = `<script>
		import Guidance from ${JSON.stringify(component.replaceAll('\\', '/'))};
		import LoginOptions from ${JSON.stringify(resolve(dirname(component), 'LoginOptions.svelte').replaceAll('\\', '/'))};
		let fixture = $state({ context: 'guest', user: undefined, login: false, enabled: true, visible: true });
		globalThis.guidanceFixture = (patch) => { Object.assign(fixture, patch); };
		globalThis.authCalls = 0;
	</script>
	{#if fixture.visible}
		{#if fixture.login}
			<LoginOptions enabled={fixture.enabled} onTelegram={() => globalThis.authCalls++}>
				<button type="button" onclick={() => globalThis.authCalls++}>Synthetic Google sign-in</button>
			</LoginOptions>
		{:else}<Guidance context={fixture.context} user={fixture.user} />{/if}
	{/if}`;
	const entry = resolve(root, 'scripts/__identity_entry.js').replaceAll('\\', '/');
	const fixturePath = resolve(root, 'scripts/__identity_fixture.svelte').replaceAll('\\', '/');
	const bundle = await rolldown({
		cwd: root, input: entry, platform: 'browser', resolve: { conditionNames: ['browser', 'import', 'default'] },
		plugins: [{ name: 'isolated-guidance',
			resolveId(source) { if (source === entry || source === fixturePath) return source; },
			async load(path) {
				if (path === entry) return `import { mount } from 'svelte'; import Harness from ${JSON.stringify(fixturePath.replaceAll('\\', '/'))}; mount(Harness, { target: document.querySelector('#fixture') });`;
				if (path.endsWith('.svelte')) return compile(path === fixturePath ? wrapper : await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code;
			}
		}]
	});
	const result = await bundle.generate({ format: 'esm', codeSplitting: false });
	await bundle.close();
	const js = result.output.find(output => output.type === 'chunk').code;
	const css = await readFile(resolve(root, 'apps/merchant-app/src/app.css'), 'utf8');
	const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Account guidance · local UI only</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/app.css"><style>
		body { margin: 0; font-family: 'Segoe UI', sans-serif; background: #222; }
		main { padding: 24px; min-height: 110vh; }
		.preview-label { margin: 0 0 28px; font-size: 12px; color: #9098a5; }
		.preview-title { margin: 0 0 24px; font-size: 30px; }
	</style></head><body><main class="app-shell auth-active"><p class="preview-label">LOCAL PREVIEW · NO AUTH</p><h1 class="preview-title">Один профіль.<br>Ваш бізнес.</h1><div class="auth-message" id="fixture"></div><button id="outside" type="button">Outside focus target</button></main><script type="module" src="/harness.js"></script></body></html>`;
	const resources = new Map([['/', ['text/html; charset=utf-8', html]], ['/harness.js', ['text/javascript; charset=utf-8', js]], ['/app.css', ['text/css; charset=utf-8', css]]]);
	return { resources, async serve(port = 0) {
		const server = createServer((request, response) => {
			const resource = request.method === 'GET' && resources.get(new URL(request.url, 'http://localhost').pathname);
			response.writeHead(resource ? 200 : 404, { 'Content-Type': resource ? resource[0] : 'text/plain', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'" });
			response.end(resource ? resource[1] : 'Not found');
		});
		await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', accept); });
		return { server, url: `http://127.0.0.1:${server.address().port}/` };
	} };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { url } = await (await createHarness()).serve(8796);
	console.log(`Isolated guidance preview (no auth/network): ${url}`);
}