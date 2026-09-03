import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import prettier from 'prettier';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';

type WorkerRoute = {
	method: string;
	path: string;
	match: 'exact' | 'prefix';
	status: 'implemented';
	source: string;
};

type WorkerService = { binding: string; service: string };
type WorkerAssets = { binding?: string; directory?: string };
type WorkerConfig = {
	name: string;
	main: string;
	services?: WorkerService[];
	assets?: WorkerAssets;
	env?: {
		production?: {
			name?: string;
			services?: WorkerService[];
			assets?: WorkerAssets;
			routes?: Array<{ pattern: string }>;
		};
	};
};
type OpenApiOperation = {
	operationId?: string;
	summary?: string;
	tags?: string[];
};
type OpenApiDocument = { paths?: Record<string, Record<string, OpenApiOperation>> };

const root = resolve(import.meta.dirname, '..');
const workerRoot = resolve(root, 'worker');
const outputFile = resolve(root, 'src/lib/features/corex/generated/process-manifest.json');
const workerConfigs = [
	'wrangler.jsonc',
	'wrangler.dashboard.jsonc',
	'wrangler.app.jsonc',
	'wrangler.checkout.jsonc',
	'wrangler.corex.jsonc'
];

function workspacePath(file: string): string {
	return relative(root, file).replaceAll('\\', '/');
}

function readJsonc(text: string, file: string): Record<string, unknown> {
	const parsed = ts.parseConfigFileTextToJson(file, text);
	if (parsed.error)
		throw new Error(ts.flattenDiagnosticMessageText(parsed.error.messageText, '\n'));
	return parsed.config;
}

function enclosingFunction(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
	for (let parent = node.parent; parent; parent = parent.parent) {
		if (ts.isFunctionLike(parent)) return parent;
	}
	return undefined;
}

function methodsIn(node: ts.Node | undefined): string[] {
	if (!node) return [];
	const methods = new Set<string>();
	function visit(current: ts.Node) {
		if (
			ts.isBinaryExpression(current) &&
			(current.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
				current.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
		) {
			const operands = [current.left, current.right];
			const literal = operands.find(ts.isStringLiteral);
			const property = operands.find(
				(value): value is ts.PropertyAccessExpression =>
					ts.isPropertyAccessExpression(value) && value.name.text === 'method'
			);
			if (literal && property && /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/.test(literal.text)) {
				methods.add(literal.text);
			}
		}
		ts.forEachChild(current, visit);
	}
	visit(node);
	return [...methods].sort();
}

function extractWorkerRoutes(sourceText: string, sourceFileName: string): WorkerRoute[] {
	const sourceFile = ts.createSourceFile(
		sourceFileName,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		sourceFileName.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS
	);
	const routes = new Map<string, WorkerRoute>();

	function addRoute(node: ts.Node, path: string, match: WorkerRoute['match']) {
		if (!path.startsWith('/')) return;
		const methods = methodsIn(enclosingFunction(node));
		for (const method of methods.length ? methods : ['ANY']) {
			routes.set(`${method}:${path}:${match}`, {
				method,
				path,
				match,
				status: 'implemented',
				source: sourceFileName
			});
		}
	}

	function visit(node: ts.Node) {
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === 'startsWith' &&
			node.arguments.length === 1 &&
			ts.isStringLiteral(node.arguments[0])
		) {
			addRoute(node, node.arguments[0].text, 'prefix');
		}
		if (
			ts.isBinaryExpression(node) &&
			(node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
				node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken)
		) {
			const literal = [node.left, node.right].find(ts.isStringLiteral);
			if (literal) addRoute(node, literal.text, 'exact');
		}
		ts.forEachChild(node, visit);
	}

	visit(sourceFile);
	return [...routes.values()].sort((left, right) =>
		`${left.path}:${left.method}:${left.match}`.localeCompare(
			`${right.path}:${right.method}:${right.match}`
		)
	);
}

function bindingInventory(config: WorkerConfig) {
	const production = config.env?.production ?? {};
	const services = [...(config.services ?? []), ...(production.services ?? [])];
	const bindings = new Map(
		services.map((service) => [
			`service:${service.binding}`,
			{ name: service.binding, type: 'service', target: service.service }
		])
	);
	const assets = production.assets ?? config.assets;
	if (assets?.binding) {
		bindings.set(`assets:${assets.binding}`, {
			name: assets.binding,
			type: 'assets',
			target: assets.directory
		});
	}
	return [...bindings.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function workerInventory(configName: string) {
	const configFile = resolve(workerRoot, configName);
	const config = readJsonc(await readFile(configFile, 'utf8'), configFile) as WorkerConfig;
	const production = config.env?.production ?? {};
	const entrypointFile = resolve(workerRoot, config.main);
	const entrypoint = workspacePath(entrypointFile);
	return {
		id: production.name ?? config.name,
		name: production.name ?? config.name,
		entrypoint,
		config: workspacePath(configFile),
		publicRoutes: (production.routes ?? [])
			.map((route: { pattern: string }) => route.pattern)
			.sort(),
		bindings: bindingInventory(config),
		routes: extractWorkerRoutes(await readFile(entrypointFile, 'utf8'), entrypoint)
	};
}

function serverBasePath(serverUrl: string | undefined): string {
	if (!serverUrl) return '';
	try {
		const pathname = new URL(serverUrl).pathname.replace(/\/$/, '');
		return pathname === '/' ? '' : pathname;
	} catch {
		return '';
	}
}

async function openApiInventory(fileName: string, id: string) {
	const file = resolve(root, fileName);
	const document = parseYaml(await readFile(file, 'utf8')) as OpenApiDocument;
	const servers = (document.servers ?? []).map((server: { url: string }) => server.url);
	const basePath = serverBasePath(servers[0]);
	const routes = Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
		Object.entries(pathItem)
			.filter(([method]) => /^(get|post|put|patch|delete|options|head)$/i.test(method))
			.map(([method, operation]) => ({
				method: method.toUpperCase(),
				path: `${basePath}${path}`,
				operationId: operation.operationId ?? null,
				summary: operation.summary ?? null,
				tags: operation.tags ?? [],
				status: 'planned',
				source: workspacePath(file)
			}))
	);
	return {
		id,
		title: document.info?.title ?? fileName,
		version: String(document.info?.version ?? 'unknown'),
		servers,
		routes
	};
}

const manifest = {
	schemaVersion: 1,
	workers: await Promise.all(workerConfigs.map(workerInventory)),
	contracts: [
		await openApiInventory('docs/openapi.yaml', 'rahunok-edge-api'),
		await openApiInventory('docs/kso-mobile-openapi.yaml', 'kso-mobile-api')
	]
};

await mkdir(dirname(outputFile), { recursive: true });
const prettierConfig = (await prettier.resolveConfig(outputFile)) ?? {};
const output = await prettier.format(JSON.stringify(manifest), {
	...prettierConfig,
	filepath: outputFile
});
await writeFile(outputFile, output);
console.log(
	`Generated ${workspacePath(outputFile)} with ${manifest.workers.length} workers and ${manifest.contracts.reduce((total, contract) => total + contract.routes.length, 0)} contract routes.`
);
