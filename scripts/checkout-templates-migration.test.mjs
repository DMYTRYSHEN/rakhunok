import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
	'../supabase/migrations/20260916170000_checkout_templates_integrity.sql',
	import.meta.url
);
const sql = await readFile(migrationUrl, 'utf8');

test('checkout-template RLS requires authenticated active membership', () => {
	assert.match(sql, /for select to authenticated/);
	assert.match(sql, /status = 'active'/);
	assert.match(sql, /for update to authenticated[\s\S]+with check/);
	assert.doesNotMatch(sql, /for (select|insert|update|delete)\s*\n\s*using/);
});

test('checkout-template mutations use merchant-scoped atomic RPCs', () => {
	for (const name of [
		'create_checkout_template',
		'update_checkout_template',
		'delete_checkout_template',
		'set_checkout_template_default'
	]) {
		assert.match(sql, new RegExp(`create or replace function public\\.${name}`));
		assert.match(sql, new RegExp(`grant execute on function public\\.${name}`));
	}
	assert.equal((sql.match(/pg_advisory_xact_lock/g) ?? []).length, 3);
	assert.match(sql, /where id = p_template_id and merchant_id = p_merchant_id/);
});

test('checkout-template constraints validate name, scenario and JSON object fields', () => {
	const backfillStart = sql.indexOf('update public.checkout_templates');
	const constraintsStart = sql.indexOf('alter table public.checkout_templates');
	const constraints = sql.slice(
		sql.indexOf('alter table public.checkout_templates'),
		sql.indexOf('drop policy')
	);
	assert.ok(backfillStart >= 0 && backfillStart < constraintsStart);
	assert.match(
		sql,
		/jsonb_build_object\([\s\S]+\) \|\| case when jsonb_typeof\(scenario_config\) = 'object'/
	);
	assert.match(constraints, /alter column scenario_config drop default/);
	assert.match(sql, /char_length\(btrim\(name\)\) between 1 and 120/);
	assert.match(sql, /scenario_type ~ '\^\[a-z\]\[a-z0-9_\]\{0,63\}\$'/);
	assert.match(sql, /jsonb_typeof\(scenario_config\) = 'object'/);
	assert.match(sql, /scenario_config -> 'checkout_flow' ->> 'id' = scenario_type/);
	assert.match(sql, /scenario_config -> 'checkout_flow' -> 'version' = '1'::jsonb/);
	assert.match(
		constraints,
		/scenario_type in \('fixed', 'open_amount', 'table', 'delivery', 'tips'\)[\s\S]+and not scenario_config \? 'checkout_flow'/
	);
	assert.match(constraints, /and \(\([\s\S]+\) is true\)/);
	assert.match(
		sql,
		/scenario_config -> 'checkout_flow' ->> 'invoice_type'[\s\S]+in \('fixed', 'open_amount', 'table', 'delivery'\)/
	);
	assert.match(sql, /jsonb_typeof\(scenario_config -> 'flow_data'\) = 'object'/);
	assert.doesNotMatch(constraints, /select\s/i);
});
