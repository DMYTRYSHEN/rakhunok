import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('./DashboardPage.svelte', import.meta.url), 'utf8');
const script = source.split('<script lang="ts">')[1].split('</script>')[0];
const parsed = ts.createSourceFile('dashboard.ts', script, ts.ScriptTarget.Latest, true);
const declaration = parsed.statements.find(
	(node) => ts.isFunctionDeclaration(node) && node.name?.text === 'lazyModule'
);

if (!declaration) throw new Error('Missing lazyModule');

const code = ts.transpileModule(declaration.getText(parsed), {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const lazyModule = new Function(`${code}; return lazyModule;`)() as <T>(
	loader: () => Promise<T>
) => () => Promise<T>;

describe('Dashboard lazy module loading', () => {
	it('shares a successful in-flight module request', async () => {
		const module = { default: 'component' };
		const loader = vi.fn().mockResolvedValue(module);
		const load = lazyModule(loader);

		expect(load()).toBe(load());
		await expect(load()).resolves.toBe(module);
		expect(loader).toHaveBeenCalledOnce();
	});

	it('retries after a failed module request', async () => {
		const module = { default: 'component' };
		const loader = vi
			.fn<() => Promise<typeof module>>()
			.mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
			.mockResolvedValueOnce(module);
		const load = lazyModule(loader);

		await expect(load()).rejects.toThrow('Failed to fetch dynamically imported module');
		await expect(load()).resolves.toBe(module);
		expect(loader).toHaveBeenCalledTimes(2);
	});
});