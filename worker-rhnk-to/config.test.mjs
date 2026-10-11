import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';

test('rhnk.to Workers and service dependencies are isolated from existing domains', () => {
	const configs = readdirSync(import.meta.dirname).filter(name => /^wrangler\..+\.jsonc$/.test(name)).map(name => {
		const parsed = ts.parseConfigFileTextToJson(name, readFileSync(new URL(name, import.meta.url), 'utf8'));
		assert.equal(parsed.error, undefined);
		return parsed.config;
	});
	const names = new Set(configs.map(config => config.name));
	assert.equal(names.size, configs.length);
	for (const config of configs) {
		assert.ok(config.name.startsWith('rhnk-to-'));
		assert.equal(config.account_id, '753ff9292511c16a281c5cfa8e105c63');
		assert.equal(config.workers_dev, false);
		assert.deepEqual(config.triggers?.crons ?? [], []);
		for (const binding of config.services ?? []) {
			assert.ok(binding.service.startsWith('rhnk-to-'));
			assert.ok(names.has(binding.service), `Missing new backend: ${binding.service}`);
		}
		for (const route of config.routes ?? []) {
			assert.match(route.pattern, /^(?:[a-z-]+\.)?rhnk\.to(?:\/|$)/);
			if (route.zone_name) assert.equal(route.zone_name, 'rhnk.to');
			assert.ok(!route.pattern.includes('telegram/webhook'));
			assert.ok(!route.pattern.includes('setup-webhook'));
		}
		for (const workflow of config.workflows ?? []) assert.ok(workflow.name.startsWith('rhnk-to-'));
	}
	for (const name of ['rhnk-to-web', 'rhnk-to-corex-api']) {
		assert.deepEqual(configs.find(config => config.name === name).routes, []);
	}
});