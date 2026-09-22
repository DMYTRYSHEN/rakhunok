import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test, { after, before } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = await readFile(
	new URL('../../../supabase/migrations/20260922120000_order_short_id_authority.sql', import.meta.url),
	'utf8'
);
const scalar = async (sql, params = []) => Object.values((await db.query(sql, params)).rows[0])[0];

before(async () => {
	await db.exec(`
		create role anon;
		create role authenticated;
		create schema checkout_private;
		create table public.orders (
			id uuid primary key default gen_random_uuid(),
			short_id text,
			title text
		);
		create unique index legacy_orders_short_id_key on public.orders(short_id);
		insert into public.orders(short_id, title) values ('tinOSq', 'preserved'), (null, 'backfilled');
	`);
	await db.exec(migration);
});

after(() => db.close());

test('migration preserves existing IDs and backfills a valid unique value', async () => {
	assert.equal(await scalar("select short_id from public.orders where title = 'preserved'"), 'tinOSq');
	const generated = await scalar("select short_id from public.orders where title = 'backfilled'");
	assert.match(generated, /^[A-Za-z0-9]{6}$/);
	assert.notEqual(generated, 'tinOSq');
	assert.equal(await scalar(`
		select is_nullable
		from information_schema.columns
		where table_schema = 'public' and table_name = 'orders' and column_name = 'short_id'
	`), 'NO');
});

test('new orders receive server-generated IDs and supplied IDs are rejected', async () => {
	const generated = await scalar("insert into public.orders(title) values ('new') returning short_id");
	assert.match(generated, /^[A-Za-z0-9]{6}$/);
	await assert.rejects(
		db.query("insert into public.orders(short_id, title) values ('Client1', 'forged')"),
		/order_short_id_server_generated/
	);
});

test('short IDs are immutable after insert', async () => {
	await assert.rejects(
		db.query("update public.orders set short_id = 'Change1' where title = 'preserved'"),
		/order_short_id_immutable/
	);
	assert.equal(await scalar("select short_id from public.orders where title = 'preserved'"), 'tinOSq');
});

test('reservation retries after a constraint collision', async () => {
	await db.exec(`
		create sequence checkout_private.short_id_test_sequence;
		create or replace function checkout_private.generate_order_short_id()
		returns text language sql volatile set search_path = '' as $$
			select case nextval('checkout_private.short_id_test_sequence') when 1 then 'tinOSq' else 'Retry1' end
		$$;
	`);
	const generated = await scalar("insert into public.orders(title) values ('collision') returning short_id");
	assert.equal(generated, 'Retry1');
	assert.equal(await scalar("select count(*) from checkout_private.order_short_id_reservations where short_id = 'Retry1'"), 1);
});