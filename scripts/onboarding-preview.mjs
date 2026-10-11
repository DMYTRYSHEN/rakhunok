import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { rolldown } from 'rolldown';
import { compile } from 'svelte/compiler';

const root = fileURLToPath(new URL('../', import.meta.url));
const component = resolve(root, 'src/lib/features/dashboard/auth/MerchantOnboarding.svelte').replaceAll('\\', '/');
const entry = resolve(root, 'scripts/__onboarding_preview.js').replaceAll('\\', '/');
const fixture = resolve(root, 'scripts/__onboarding_preview.svelte').replaceAll('\\', '/');
const wrapper = `<script>
 import Onboarding from ${JSON.stringify(component)};
 let complete = $state(false);
 async function submit(input) { globalThis.previewSubmission = input; complete = true; }
</script>
{#if complete}
 <main class="result"><h1>Профіль готовий</h1><p>Це локальний перегляд. Дані не записані в базу.</p><button onclick={() => complete = false}>Повернутися до форми</button></main>
{:else}
 <Onboarding user={{ id: 'preview-only', email: 'owner@example.com' }} onComplete={submit} />
{/if}
<style>.result {max-width: 600px; margin: 80px auto; padding: 24px; font-family: 'Segoe UI', sans-serif;} button {padding: 12px 20px; cursor: pointer;}</style>`;
const bundle = await rolldown({
 cwd: root, input: entry, platform: 'browser', resolve: { conditionNames: ['browser', 'import', 'default'] },
 plugins: [{ name: 'onboarding-preview',
  resolveId(source) { if (source === entry || source === fixture) return source; },
  async load(path) {
   if (path === entry) return `import { mount } from 'svelte'; import Fixture from ${JSON.stringify(fixture)}; mount(Fixture, { target: document.querySelector('#preview') });`;
   if (path.endsWith('.svelte')) return compile(path === fixture ? wrapper : await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code;
  }
 }]
});
const output = await bundle.generate({ format: 'esm', codeSplitting: false });
await bundle.close();
const script = output.output.find(item => item.type === 'chunk').code;
const html = '<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Onboarding preview</title><link rel="icon" href="data:,"><style>body{margin:0}*,*::before,*::after{box-sizing:border-box}</style></head><body><div id="preview"></div><script type="module" src="/preview.js"></script></body></html>';
const resources = new Map([['/', ['text/html; charset=utf-8', html]], ['/preview.js', ['text/javascript; charset=utf-8', script]]]);
const server = createServer((request, response) => {
 const resource = request.method === 'GET' && resources.get(new URL(request.url, 'http://localhost').pathname);
 response.writeHead(resource ? 200 : 404, { 'Content-Type': resource ? resource[0] : 'text/plain', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'" });
 response.end(resource ? resource[1] : 'Not found');
});
server.listen(0, '127.0.0.1', () => console.log(`Onboarding preview: http://127.0.0.1:${server.address().port}/`));