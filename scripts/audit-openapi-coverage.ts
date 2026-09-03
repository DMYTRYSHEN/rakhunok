import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

type Consumer = 'dashboard' | 'merchant-app' | 'checkout';
type ApiUse = { consumer: Consumer; method: string; path: string; source: string };
type ImplementedOperation = {
	method: string;
	path: string;
	source: string;
	availability?: 'development-only';
};
type OpenApiOperation = { operationId?: string; summary?: string };
type OpenApiDocument = {
	servers?: Array<{ url: string }>;
	paths?: Record<string, Record<string, OpenApiOperation>>;
};

const root = resolve(import.meta.dirname, '..');
const contractFile = resolve(root, 'docs/openapi.yaml');
const outputFile = resolve(root, 'docs/api-coverage.generated.json');

const implementedOperations: ImplementedOperation[] = [
	{ method: 'GET', path: '/api/v1/health', source: '../core/worker/src/index.ts' },
	{ method: 'GET', path: '/api/v1/auth/config', source: '../core/worker/src/routes/auth.ts' },
	{
		method: 'POST',
		path: '/api/v1/auth/demo-session',
		source: '../core/worker/src/routes/auth.ts'
	},
	{ method: 'GET', path: '/api/v1/merchant/me', source: '../core/worker/src/routes/merchants.ts' },
	{ method: 'PUT', path: '/api/v1/merchant/me', source: '../core/worker/src/routes/merchants.ts' },
	{
		method: 'POST',
		path: '/api/v1/merchant/onboarding',
		source: '../core/worker/src/routes/merchants.ts'
	},
	{ method: 'GET', path: '/api/v1/orders', source: '../core/worker/src/routes/orders.ts' },
	{ method: 'POST', path: '/api/v1/orders', source: '../core/worker/src/routes/orders.ts' },
	{ method: 'GET', path: '/api/v1/orders/{id}', source: '../core/worker/src/routes/orders.ts' },
	{ method: 'PATCH', path: '/api/v1/orders/{id}', source: '../core/worker/src/routes/orders.ts' },
	{ method: 'GET', path: '/api/v1/checkout/{id}', source: '../core/worker/src/routes/checkout.ts' },
	{
		method: 'POST',
		path: '/api/v1/checkout/{id}/event',
		source: '../core/worker/src/routes/checkout.ts'
	},
	{
		method: 'GET',
		path: '/api/v1/checkout/{id}/events',
		source: '../core/worker/src/routes/checkout.ts'
	},
	{
		method: 'POST',
		path: '/api/v1/checkout/{id}/initiate',
		source: '../core/worker/src/routes/checkout.ts'
	},
	{
		method: 'GET',
		path: '/api/v1/checkout/{id}/status',
		source: '../core/worker/src/routes/checkout.ts'
	},
	{
		method: 'POST',
		path: '/api/v1/checkout/{id}/apply-promo',
		source: '../core/worker/src/routes/checkout.ts'
	},
	{
		method: 'POST',
		path: '/api/v1/checkout/{id}/delivery',
		source: '../core/worker/src/routes/checkout.ts'
	},
	{ method: 'GET', path: '/api/v1/banks', source: '../core/worker/src/routes/banks.ts' },
	{ method: 'GET', path: '/api/v1/banks/{idOrCode}', source: '../core/worker/src/routes/banks.ts' },
	{ method: 'GET', path: '/api/v1/logos', source: '../core/worker/src/routes/logos.ts' },
	{
		method: 'POST',
		path: '/api/v1/kso/checkout-requests',
		source: '../core/worker/src/routes/kso.ts'
	},
	{
		method: 'GET',
		path: '/api/v1/kso/checkout-requests/{id}',
		source: '../core/worker/src/routes/kso.ts'
	},
	{
		method: 'POST',
		path: '/api/v1/webhooks/simulate',
		source: '../core/worker/src/routes/webhooks.ts',
		availability: 'development-only'
	},
	{
		method: 'POST',
		path: '/api/v1/webhooks/{bankCode}',
		source: '../core/worker/src/routes/webhooks.ts'
	},
	{ method: 'GET', path: '/api/v1/stats/summary', source: '../core/worker/src/routes/stats.ts' }
];

const implementationAliases = [
	{
		method: 'POST',
		path: '/api/v1/checkout/{id}/pay',
		canonicalOperation: 'POST /api/v1/checkout/{id}/initiate',
		source: '../core/worker/src/routes/checkout.ts'
	}
];

const apiUses: ApiUse[] = [
	{
		consumer: 'dashboard',
		method: 'POST',
		path: '/api/v1/merchant/onboarding',
		source: 'src/lib/features/dashboard/api/dashboard-gateway.ts'
	},
	{
		consumer: 'dashboard',
		method: 'POST',
		path: '/api/v1/orders',
		source: 'src/lib/features/dashboard/api/dashboard-gateway.ts'
	},
	{
		consumer: 'dashboard',
		method: 'PATCH',
		path: '/api/v1/orders/{id}',
		source: 'src/lib/features/dashboard/api/dashboard-gateway.ts'
	},
	{
		consumer: 'dashboard',
		method: 'GET',
		path: '/api/v1/checkout/{id}/events',
		source: 'src/lib/features/dashboard/api/dashboard-gateway.ts'
	},
	{
		consumer: 'merchant-app',
		method: 'POST',
		path: '/api/v1/orders',
		source: 'apps/merchant-app/src/data/merchant-data-gateway.ts'
	},
	{
		consumer: 'merchant-app',
		method: 'PATCH',
		path: '/api/v1/orders/{id}',
		source: 'apps/merchant-app/src/data/merchant-data-gateway.ts'
	},
	{
		consumer: 'checkout',
		method: 'GET',
		path: '/api/v1/checkout/{id}',
		source: 'apps/checkout/js/checkout-api.js'
	},
	{
		consumer: 'checkout',
		method: 'GET',
		path: '/api/v1/checkout/{id}',
		source: 'apps/checkout/js/app.js'
	},
	{
		consumer: 'checkout',
		method: 'POST',
		path: '/api/v1/checkout/{id}/initiate',
		source: 'apps/checkout/js/deep-link.js'
	},
	{
		consumer: 'checkout',
		method: 'GET',
		path: '/api/v1/checkout/{id}/status',
		source: 'apps/checkout/js/status-poller.js'
	},
	{
		consumer: 'checkout',
		method: 'GET',
		path: '/api/v1/banks',
		source: 'apps/checkout/js/bank-carousel.js'
	}
];

const supabaseDependencies = [
	{
		consumer: 'dashboard',
		resource: 'auth.session',
		source: 'src/lib/features/dashboard/api/dashboard-gateway.ts'
	},
	{
		consumer: 'dashboard',
		resource: 'business_entities',
		source: 'src/lib/features/dashboard/api/dashboard-gateway.ts'
	},
	{
		consumer: 'dashboard',
		resource: 'merchants',
		source: 'src/lib/features/dashboard/api/dashboard-gateway.ts'
	},
	{
		consumer: 'dashboard',
		resource: 'order_events',
		source: 'src/lib/features/dashboard/api/dashboard-gateway.ts'
	},
	{
		consumer: 'dashboard',
		resource: 'orders',
		source: 'src/lib/features/dashboard/api/dashboard-gateway.ts'
	},
	{
		consumer: 'dashboard',
		resource: 'terminals',
		source: 'src/lib/features/dashboard/api/dashboard-gateway.ts'
	},
	{
		consumer: 'merchant-app',
		resource: 'auth.session',
		source: 'apps/merchant-app/src/auth/auth-gateway.ts'
	},
	{
		consumer: 'merchant-app',
		resource: 'business_entities',
		source: 'apps/merchant-app/src/data/merchant-data-gateway.ts'
	},
	{
		consumer: 'merchant-app',
		resource: 'merchants',
		source: 'apps/merchant-app/src/auth/auth-gateway.ts'
	},
	{
		consumer: 'merchant-app',
		resource: 'orders',
		source: 'apps/merchant-app/src/data/merchant-data-gateway.ts'
	},
	{
		consumer: 'merchant-app',
		resource: 'terminals',
		source: 'apps/merchant-app/src/data/merchant-data-gateway.ts'
	}
];

function basePath(serverUrl: string | undefined): string {
	if (!serverUrl) return '';
	const pathname = new URL(serverUrl).pathname.replace(/\/$/, '');
	return pathname === '/' ? '' : pathname;
}

function key(method: string, path: string): string {
	const normalizedPath = path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '{}').replace(/\{[^}]+\}/g, '{}');
	return `${method.toUpperCase()} ${normalizedPath}`;
}

const document = parseYaml(await readFile(contractFile, 'utf8')) as OpenApiDocument;
const prefix = basePath(document.servers?.[0]?.url);
const operations = Object.entries(document.paths ?? {}).flatMap(([path, pathItem]) =>
	Object.entries(pathItem)
		.filter(([method]) => /^(get|post|put|patch|delete|options|head)$/i.test(method))
		.map(([method, operation]) => ({
			method: method.toUpperCase(),
			path: `${prefix}${path}`,
			operationId: operation.operationId ?? null,
			summary: operation.summary ?? null
		}))
);
const operationsByKey = new Map(
	operations.map((operation) => [key(operation.method, operation.path), operation])
);
const productionImplementedOperations = implementedOperations.filter(
	(operation) => operation.availability !== 'development-only'
);
const developmentOnlyOperations = implementedOperations.filter(
	(operation) => operation.availability === 'development-only'
);
const implementationByKey = new Map(
	productionImplementedOperations.map((operation) => [
		key(operation.method, operation.path),
		operation
	])
);
const usesByKey = new Map<string, ApiUse[]>();
for (const use of apiUses) {
	const useKey = key(use.method, use.path);
	usesByKey.set(useKey, [...(usesByKey.get(useKey) ?? []), use]);
}

const consumedOperations = [...usesByKey].map(([operationKey, uses]) => ({
	key: operationKey,
	documented: operationsByKey.has(operationKey),
	implemented: implementationByKey.has(operationKey),
	operationId: operationsByKey.get(operationKey)?.operationId ?? null,
	consumers: [...new Set(uses.map((use) => use.consumer))],
	sources: [...new Set(uses.map((use) => use.source))]
}));
const implementedButUndocumented = productionImplementedOperations.filter(
	(operation) => !operationsByKey.has(key(operation.method, operation.path))
);
const documentedButNotImplemented = operations.filter(
	(operation) => !implementationByKey.has(key(operation.method, operation.path))
);
const consumedButNotImplemented = consumedOperations.filter((operation) => !operation.implemented);
const report = {
	contract: relative(root, contractFile).replaceAll('\\', '/'),
	generatedAt: new Date().toISOString(),
	summary: {
		openApiOperations: operations.length,
		implementedOperations: productionImplementedOperations.length,
		developmentOnlyOperations: developmentOnlyOperations.length,
		consumedOperations: consumedOperations.length,
		documentedConsumedOperations: consumedOperations.filter((operation) => operation.documented)
			.length,
		missingConsumedOperations: consumedOperations.filter((operation) => !operation.documented)
			.length,
		consumedButNotImplemented: consumedButNotImplemented.length,
		implementedButUndocumented: implementedButUndocumented.length,
		documentedButNotImplemented: documentedButNotImplemented.length,
		operationsWithoutOperationId: operations.filter((operation) => !operation.operationId).length,
		directSupabaseDependencies: new Set(
			supabaseDependencies.map((dependency) => dependency.resource)
		).size
	},
	consumedOperations,
	implementedOperations: productionImplementedOperations,
	developmentOnlyOperations,
	implementedButUndocumented,
	documentedButNotImplemented,
	implementationAliases,
	openApiOnlyOperations: operations.filter(
		(operation) => !usesByKey.has(key(operation.method, operation.path))
	),
	directSupabaseDependencies: supabaseDependencies
};

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary));

if (
	report.summary.missingConsumedOperations > 0 ||
	report.summary.consumedButNotImplemented > 0 ||
	report.summary.implementedButUndocumented > 0 ||
	report.summary.documentedButNotImplemented > 0 ||
	report.summary.operationsWithoutOperationId > 0
) {
	process.exitCode = 1;
}
