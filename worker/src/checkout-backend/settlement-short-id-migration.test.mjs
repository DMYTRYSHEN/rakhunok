import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(
	new URL('../../../supabase/migrations/20260922130000_checkout_settlement_short_id.sql', import.meta.url),
	'utf8'
);

test('migration is inert when the optional settlement ledger is absent', async () => {
	const db = new PGlite();
	try {
		await db.exec(`
			create role anon;
			create role authenticated;
			create role service_role;
			create schema checkout_private;
		`);
		await db.exec(migration);
		const result = await db.query(`
			select to_regprocedure(
				'public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz)'
			) as settlement_rpc
		`);
		assert.equal(result.rows[0].settlement_rpc, null);
	} finally {
		await db.close();
	}
});

test('migration hardens reference authority when the settlement ledger exists', async () => {
	const db = new PGlite();
	try {
		await db.exec(`
			create role anon;
			create role authenticated;
			create role service_role;
			create schema checkout_private;
			create table public.orders (
				id uuid primary key,
				status text,
				checkout_revision bigint,
				short_id text,
				paid_at timestamptz,
				paid_amount numeric,
				payment_reference text
			);
			create table checkout_private.attempts (
				id uuid primary key,
				quote jsonb not null,
				created_at timestamptz not null
			);
			create table checkout_private.settlements (
				provider text,
				event_id text,
				attempt_id uuid,
				event jsonb,
				outcome text
			);
			create function checkout_private.gate() returns void
			language sql as $$ select $$;
			create function public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz)
			returns jsonb language sql as $$ select '{}'::jsonb $$;
		`);
		await db.exec(migration);
		const result = await db.query(`
			select pg_get_functiondef(
				'public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz)'::regprocedure
			) as definition,
			has_function_privilege('anon',
				'public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz)', 'execute') as anon_execute,
			has_function_privilege('authenticated',
				'public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz)', 'execute') as authenticated_execute,
			has_function_privilege('service_role',
				'public.checkout_record_settlement(text,text,uuid,bigint,text,text,text,timestamptz)', 'execute') as service_execute
		`);
		assert.match(result.rows[0].definition, /p_reference\s*=\s*o\.short_id/);
		assert.equal(result.rows[0].anon_execute, false);
		assert.equal(result.rows[0].authenticated_execute, false);
		assert.equal(result.rows[0].service_execute, true);
	} finally {
		await db.close();
	}
});