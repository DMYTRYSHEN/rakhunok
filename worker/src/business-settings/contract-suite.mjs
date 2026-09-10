import assert from 'node:assert/strict';
import { candidate, prefixAlphabet, rejectedPrefixes, ids, document, seller, identity, read, save, operativeSnapshot, settingsSnapshot } from './fixtures.mjs';

export async function contractSuite(t, db) {
  async function scenario(name, fn) {
    await t.test(name, async () => {
      await db.query('RESET ROLE');
      await db.query('BEGIN');
      try { await identity(db); await fn(); }
      finally { await db.query('ROLLBACK'); await db.query('RESET ROLE'); }
    });
  }
  async function rejected(fn, code) {
    await db.query('SAVEPOINT rejected');
    try { await assert.rejects(fn, error => (Array.isArray(code) ? code : [code]).includes(error.code)); }
    finally { await db.query('ROLLBACK TO SAVEPOINT rejected'); }
  }

  await scenario('exact absent/read/save contract; replacement and server revisions', async () => {
    assert.deepEqual(await read(db), { revision: 0, document: null });
    const value = document();
    assert.deepEqual(await save(db, 0, value), { revision: 1, document: value });
    assert.deepEqual(await read(db), { revision: 1, document: value });
    const replacement = document({ mode: 'finance-company', sellers: { [ids.second]: seller({ vatStatus: 'vat' }) } });
    assert.deepEqual(await save(db, 1, replacement), { revision: 2, document: replacement });
    assert.deepEqual(await read(db), { revision: 2, document: replacement });
    await save(db, 2, document({ sellers: {} }));
    assert.deepEqual((await read(db)).document.sellers, {});
    assert.equal((await save(db, 3, document({ sellers: {} }))).revision, 4);
  });

  await scenario('same-user entities reusable across merchants without invented brand relation', async () => {
    const value = document({ sellers: { [ids.seller]: seller(), [ids.second]: seller() } });
    await save(db, 0, value);
    await save(db, 0, value, ids.sibling);
    assert.deepEqual((await read(db, ids.sibling)).document, value);
  });

  await scenario('broad legacy SELECT does not authorize foreign or nonexistent merchant/entity', async () => {
    assert.equal((await db.query('SELECT * FROM public.merchants')).rows.length, 3);
    assert.equal((await db.query('SELECT * FROM public.business_entities')).rows.length, 3);
    for (const merchant of [ids.foreign, ids.missing, null]) {
      await rejected(() => read(db, merchant), '42501');
      await rejected(() => save(db, 0, document(), merchant), '42501');
    }
    for (const id of [ids.foreignSeller, ids.missing]) {
      await rejected(() => save(db, 0, document({ sellers: { [ids.seller]: seller(), [id]: seller() } })), '42501');
      assert.deepEqual(await read(db), { revision: 0, document: null });
    }
  });

  await scenario('real anon role denied RPCs and table reads; missing authenticated uid denied', async () => {
    await identity(db, ids.user, 'anon');
    await rejected(() => read(db), '42501');
    await rejected(() => save(db), '42501');
    for (const table of ['business_settings', 'business_settings_sellers']) {
      await rejected(() => db.query(`SELECT * FROM public.${table}`), '42501');
    }
    await identity(db, null);
    await rejected(() => read(db), '42501');
    await rejected(() => save(db), '42501');
  });

  await scenario('authenticated direct reads/writes/helper calls denied', async () => {
    await save(db);
    for (const table of ['business_settings', 'business_settings_sellers']) {
      for (const sql of [`SELECT * FROM public.${table}`, `DELETE FROM public.${table}`,
        `UPDATE public.${table} SET config = '{}'::jsonb`, `INSERT INTO public.${table} DEFAULT VALUES`,
        `TRUNCATE public.${table}`]) await rejected(() => db.query(sql), '42501');
    }
    await rejected(() => db.query("SELECT business_settings_private.valid_document('{}'::jsonb)"), '42501');
  });

  await scenario('RLS default deny survives accidentally granted table privileges', async () => {
    await save(db);
    await db.query('RESET ROLE');
    await db.query('GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_settings,public.business_settings_sellers TO authenticated,anon');
    for (const role of ['authenticated', 'anon']) {
      await identity(db, ids.user, role);
      for (const table of ['business_settings', 'business_settings_sellers']) {
        assert.equal((await db.query(`SELECT * FROM public.${table}`)).rows.length, 0);
        assert.equal((await db.query(`DELETE FROM public.${table} RETURNING *`)).rows.length, 0);
        assert.equal((await db.query(`UPDATE public.${table} SET config = '{}' RETURNING *`)).rows.length, 0);
      }
      await rejected(() => db.query(`INSERT INTO public.business_settings VALUES ($1,$2,1,$3)`,
        [ids.sibling, ids.user, JSON.stringify(document({ sellers: undefined }))]), '42501');
    }
    await identity(db);
    assert.equal((await read(db)).revision, 1);
  });

  await scenario('CAS stale/future/null/negative revisions and overflow fail without changes', async () => {
    await rejected(() => save(db, 1), '40001');
    await rejected(() => save(db, null), '22023');
    await rejected(() => save(db, -1), '22023');
    await save(db);
    for (const revision of [0, 2]) await rejected(() => save(db, revision), '40001');
    assert.deepEqual(await read(db), { revision: 1, document: document() });
    await db.query('RESET ROLE');
    await db.query('UPDATE public.business_settings SET revision=2147483647');
    await identity(db);
    await rejected(() => save(db, 2147483647), '40001');
    assert.equal((await read(db)).revision, 2147483647);
  });

  const invalid = [
    ['SQL-like JSON null', () => null], ['array', () => []], ['scalar', () => 'settings'],
    ['version1', d => ({ ...d, version: 1 })], ['string version', d => ({ ...d, version: '2' })],
    ['selectedSellerId', d => ({ ...d, selectedSellerId: ids.seller })],
    ['extra field', d => ({ ...d, verified: true })], ['unknown mode', d => ({ ...d, mode: 'active' })],
    ['sellers array', d => ({ ...d, sellers: [] })], ['sellers null', d => ({ ...d, sellers: null })],
    ['non UUID key', d => ({ ...d, sellers: { nope: seller() } })],
    ['uppercase UUID key', d => ({ ...d, sellers: { [ids.seller.toUpperCase()]: seller() } })],
    ['UUID alias collision', d => ({ ...d, sellers: { [ids.seller]: seller(), [ids.seller.toUpperCase()]: seller() } })],
    ['prototype key', d => ({ ...d, sellers: JSON.parse('{"__proto__":{}}') })],
    ['short IBAN', d => ({ ...d, financeIban: 'UA123' })],
    ['lowercase IBAN', d => ({ ...d, financeIban: `ua${'1'.repeat(27)}` })],
    ['bad tax', d => ({ ...d, financeTaxId: '123456789' })],
    ['long name', d => ({ ...d, financeName: 'a'.repeat(201) })],
    ['long finance template', d => ({ ...d, financePurposeTemplate: 'a'.repeat(1001) })],
    ['empty finance template', d => ({ ...d, financePurposeTemplate: '' })],
    ...[' ', '{number}', '{unknown}', '{{payment_id}}', '{payment_id', 'payment_id}', '{}', '{payment_id}{bad}']
      .map(value => [`finance template ${value}`, d => ({ ...d, financePurposeTemplate: value })]),
    ...Object.keys(document()).map(key => [`missing ${key}`, d => { delete d[key]; return d; }]),
    ...Object.keys(document()).map(key => [`null ${key}`, d => ({ ...d, [key]: null })]),
    ...Object.keys(seller()).map(key => [`seller missing ${key}`, d => { delete d.sellers[ids.seller][key]; return d; }]),
    ...Object.keys(seller()).map(key => [`seller null ${key}`, d => { d.sellers[ids.seller][key] = null; return d; }]),
    ...Object.entries({ vatStatus: 'verified', prefix: 'bad!', nextNumber: 0, padding: 0,
      purposeTemplate: '{secret}', providerSellerId: 7, providerCode: {}, contractReference: [],
      qrCategory: 'epay/MP2B', qrFunction: 'BAD', allowAmountEdit: 'false', extra: true })
      .map(([key, value]) => [`seller malformed ${key}`, d => { d.sellers[ids.seller][key] = value; return d; }]),
    ...[['prefix', 'a'.repeat(21)], ['prefix', '😀'], ['nextNumber', 1.5], ['nextNumber', '1'],
      ['nextNumber', 1e12], ['padding', 13], ['padding', 1.5], ['purposeTemplate', ''],
      ['purposeTemplate', '{{number}}'], ['purposeTemplate', 'a'.repeat(421)],
      ['providerSellerId', 'a'.repeat(201)], ['providerCode', 'a'.repeat(201)],
      ['contractReference', 'a'.repeat(201)], ['qrCategory', 'EPAY/MP2BB']]
      .map(([key, value]) => [`seller bounds ${key} ${String(value).slice(0, 15)}`, d => { d.sellers[ids.seller][key] = value; return d; }]),
    ...['\n', '\t', '\r', '\u001f', '\u007f', '\u0085', '\u009f'].flatMap(control => [
      ...['mode', 'financeName', 'financeIban', 'financeTaxId', 'financePurposeTemplate'].map(key =>
        [`control ${control.charCodeAt(0)} ${key}`, d => ({ ...d, [key]: `a${control}b` })]),
      ...Object.entries(seller()).filter(([, value]) => typeof value === 'string').map(([key]) =>
        [`control ${control.charCodeAt(0)} seller ${key}`, d => { d.sellers[ids.seller][key] = `a${control}b`; return d; }])
    ])
  ];
  for (const [name, mutate] of invalid) {
    await scenario(`reject malformed: ${name}`, async () => {
      await save(db);
      await rejected(() => save(db, 1, mutate(document())), '22023');
      assert.deepEqual(await read(db), { revision: 1, document: document() });
    });
  }

  await scenario('SQL NULL and invalid JSON rejected', async () => {
    await rejected(() => db.query('SELECT public.save_business_settings($1,0,NULL)', [ids.merchant]), '22023');
    await rejected(() => db.query('SELECT public.save_business_settings($1,0,$2::jsonb)', [ids.merchant, '{']), '22P02');
    await rejected(() => save(db, 0, document({ financeName: '\u0000' })), '22P05');
  });

  await scenario('valid Unicode, upper bounds, all modes/enums/tokens and canonical UUID roundtrip', async () => {
    const value = document({ financeName: 'Я'.repeat(200), financeIban: `UA${'1'.repeat(27)}`,
      financeTaxId: '12345678', financePurposeTemplate: '{business_purpose}{seller_name}{seller_iban}{seller_tax_id}{provider_code}{provider_seller_id}{contract_reference}{payment_id}',
      sellers: { [ids.seller]: seller({ prefix: 'ІЇЄҐіїєґA9_-', nextNumber: 999999999999,
        padding: 12, purposeTemplate: 'Ї'.repeat(420), providerSellerId: 'a'.repeat(200),
        providerCode: 'a'.repeat(200), contractReference: 'a'.repeat(200), allowAmountEdit: true }) } });
    let revision = 0;
    for (const [mode, vatStatus, qrFunction] of [['unconfigured','unknown','UCT'], ['direct','vat','ICT'], ['finance-company','no-vat','XCT']]) {
      value.mode = mode; value.sellers[ids.seller].vatStatus = vatStatus;
      value.sellers[ids.seller].qrFunction = qrFunction;
      assert.deepEqual(await save(db, revision++, value), { revision, document: value });
      assert.deepEqual((await read(db)).document, value);
    }
    value.financeTaxId = '1234567890'; value.financePurposeTemplate = 'a'.repeat(1000);
    value.sellers[ids.seller].prefix = '';
    await save(db, revision, value);
  });

  await scenario('exact shared prefix alphabet accepts every member and rejects Unicode-category expansions', async () => {
    assert.equal(candidate.match(/prefix_alphabet constant text := '([^']+)'/)[1], prefixAlphabet);
    assert.match(candidate, /SET LOCAL lock_timeout = '2s';/);
    assert.match(candidate, /SET LOCAL statement_timeout = '30s';/);
    await db.query('RESET ROLE');
    for (const prefix of ['', ...prefixAlphabet, 'ІЇЄҐіїєґ_Ab09-', 'Я'.repeat(20), ...rejectedPrefixes, 'Я'.repeat(21)]) {
      const actual = (await db.query('SELECT business_settings_private.valid_seller($1::jsonb) AS valid',
        [JSON.stringify(seller({ prefix }))])).rows[0].valid;
      assert.equal(actual, prefix.length <= 20 && [...prefix].every(char => prefixAlphabet.includes(char)), JSON.stringify(prefix));
    }
    await identity(db);
    for (const prefix of rejectedPrefixes) {
      await rejected(() => save(db, 0, document({ sellers: { [ids.seller]: seller({ prefix }) } })), '22023');
    }
    assert.deepEqual(await read(db), { revision: 0, document: null });
  });

  await scenario('UTF16 limits match JS for supplementary and mixed free-text strings', async () => {
    let revision = 0;
    for (const [key, limit, nested, char] of [
      ['financeName', 200, false, '\u{1f600}'], ['financePurposeTemplate', 1000, false, '\u{1f600}'],
      ['purposeTemplate', 420, true, '\u{1f600}'], ['providerSellerId', 200, true, '\u{1f600}'],
      ['providerCode', 200, true, '\u{1f600}'], ['contractReference', 200, true, '\u{1f600}']
    ]) {
      const value = document();
      const target = nested ? value.sellers[ids.seller] : value;
      target[key] = char.repeat(limit / 2);
      assert.equal(target[key].length, limit);
      await save(db, revision++, value);
      assert.deepEqual(await read(db), { revision, document: value });
      target[key] += 'a';
      await rejected(() => save(db, revision, value), '22023');
      target[key] = char.repeat(limit / 2 - 1) + 'ab';
      await save(db, revision++, value);
    }
  });

  await scenario('exact JS trim whitespace including BOM; all C0 DEL C1 rejected', async () => {
    await db.query('RESET ROLE');
    const whitespace = '\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';
    for (const text of [...whitespace, whitespace, '\u0085', '\u180e', '\u200b', '\u2060', 'x\ufeff', '\ufeffx']) {
      const actual = (await db.query('SELECT business_settings_private.valid_template($1::jsonb,1000,$2) AS valid',
        [JSON.stringify(text), 'payment_id'])).rows[0].valid;
      assert.equal(actual, text.trim().length > 0 && !/[\u0000-\u001f\u007f-\u009f]/u.test(text), JSON.stringify(text));
    }
    for (const code of [...Array.from({ length: 31 }, (_, i) => i + 1), ...Array.from({ length: 33 }, (_, i) => i + 127)]) {
      const actual = (await db.query('SELECT business_settings_private.valid_text($1::jsonb,200) AS valid',
        [JSON.stringify(`a${String.fromCodePoint(code)}b`)])).rows[0].valid;
      assert.equal(actual, false, `control U+${code.toString(16)}`);
    }
    await identity(db);
    for (const key of ['financePurposeTemplate', 'purposeTemplate']) {
      const value = document();
      (key === 'purposeTemplate' ? value.sellers[ids.seller] : value)[key] = '\ufeff\u00a0';
      await rejected(() => save(db, 0, value), '22023');
    }
  });

  await scenario('1000 sellers accepted; 1001 and >2MiB canonical JSON rejected atomically', async () => {
    await db.query('RESET ROLE');
    await db.query(`INSERT INTO public.business_entities(id,user_id)
      SELECT ('bbbbbbbb-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,$1::uuid FROM generate_series(1,1001) n`, [ids.user]);
    await identity(db);
    const sellers = Object.fromEntries(Array.from({ length: 1000 }, (_, i) =>
      [`bbbbbbbb-0000-0000-0000-${String(i + 1).padStart(12, '0')}`, seller()]));
    const value = document({ sellers });
    await save(db, 0, value);
    assert.deepEqual((await read(db)).document, value);
    await rejected(() => save(db, 1, document({ sellers: { ...sellers, [ids.seller]: seller() } })), '22023');
    const oversized = structuredClone(value);
    for (const config of Object.values(oversized.sellers)) {
      // BMP characters keep every UTF16 field valid while exceeding the byte budget.
      config.purposeTemplate = '漢'.repeat(420);
      config.providerSellerId = config.providerCode = config.contractReference = '漢'.repeat(200);
    }
    assert.ok(Buffer.byteLength(JSON.stringify(oversized)) > 2097152);
    await rejected(() => save(db, 1, oversized), '22023');
    assert.equal((await read(db)).revision, 1);
  });

  await scenario('entity transfer fails whole read and save closed, even if omitted', async () => {
    await save(db);
    await db.query('RESET ROLE');
    await db.query('UPDATE public.business_entities SET user_id=$1 WHERE id=$2', [ids.other, ids.seller]);
    await identity(db);
    await rejected(() => read(db), '42501');
    await rejected(() => save(db, 1, document({ sellers: {} })), '42501');
    await identity(db, ids.other);
    await rejected(() => read(db), '42501');
  });

  await scenario('merchant transfer cannot expose or overwrite previous owner settings', async () => {
    await save(db, 0, document({ sellers: {} }));
    await db.query('RESET ROLE');
    await db.query('UPDATE public.merchants SET user_id=$1 WHERE id=$2', [ids.other, ids.merchant]);
    for (const user of [ids.user, ids.other]) {
      await identity(db, user);
      await rejected(() => read(db), '42501');
      await rejected(() => save(db, 1, document({ sellers: {} })), '42501');
    }
  });

  await scenario('entity deletion leaves every draft tuple unchanged; orphan reads/replacements fail closed', async () => {
    const remaining = seller({ nextNumber: 73, providerCode: 'retained' });
    const value = document({ sellers: { [ids.seller]: seller(), [ids.second]: remaining } });
    await save(db, 0, value);
    await save(db, 0, value, ids.sibling);
    const drafts = await settingsSnapshot(db);
    const before = await operativeSnapshot(db);
    await db.query('DELETE FROM public.business_entities WHERE id=$1', [ids.seller]);
    const expected = structuredClone(before);
    expected.business_entities = expected.business_entities.filter(entry => entry.row.id !== ids.seller);
    assert.deepEqual(await operativeSnapshot(db), expected);
    assert.deepEqual(await settingsSnapshot(db), drafts);
    await identity(db);
    const survivor = document({ sellers: { [ids.second]: remaining } });
    for (const merchant of [ids.merchant, ids.sibling]) {
      await rejected(() => read(db, merchant), '42501');
      for (const revision of [0, 1, 2]) {
        await rejected(() => save(db, revision, survivor, merchant), '42501');
        await rejected(() => save(db, revision, document({ sellers: {} }), merchant), '42501');
      }
    }
    await db.query('RESET ROLE');
    await db.query('DELETE FROM public.business_entities WHERE id=$1', [ids.foreignSeller]);
    assert.deepEqual(await settingsSnapshot(db), drafts);
    await db.query('DELETE FROM public.merchants WHERE id=$1', [ids.merchant]);
    assert.deepEqual(await settingsSnapshot(db), drafts);
    await identity(db);
    await rejected(() => read(db), '42501');
    await rejected(() => save(db, 1, document({ sellers: {} })), '42501');
    await rejected(() => read(db, ids.sibling), '42501');
  });

  await scenario('multi-entity deletion never mutates drafts; operative rollback restores access', async () => {
    const value = document({ sellers: { [ids.seller]: seller(), [ids.second]: seller() } });
    await save(db, 0, value);
    const drafts = await settingsSnapshot(db);
    await db.query('SAVEPOINT deletion');
    await db.query('DELETE FROM public.business_entities WHERE user_id=$1', [ids.user]);
    assert.deepEqual(await settingsSnapshot(db), drafts);
    await identity(db);
    await rejected(() => read(db), '42501');
    await rejected(() => save(db, 1, document({ sellers: {} })), '42501');
    await db.query('ROLLBACK TO SAVEPOINT deletion');
    await identity(db);
    assert.deepEqual(await read(db), { revision: 1, document: value });
  });

  await scenario('exhausted draft revisions cannot prevent operative entity or merchant deletion', async () => {
    await save(db);
    await db.query('RESET ROLE');
    await db.query('UPDATE public.business_settings SET revision=2147483647');
    const drafts = await settingsSnapshot(db);
    await db.query('DELETE FROM public.business_entities WHERE id=$1', [ids.seller]);
    await db.query('DELETE FROM public.merchants WHERE id=$1', [ids.merchant]);
    assert.deepEqual(await settingsSnapshot(db), drafts);
    await identity(db);
    await rejected(() => read(db), '42501');
    await rejected(() => save(db, 2147483647, document({ sellers: {} })), '42501');
  });

  await scenario('injected mid-seller failure rolls back parent revision, deletes and earlier inserts', async () => {
    await save(db);
    await db.query('RESET ROLE');
    await db.query(`CREATE FUNCTION public.test_settings_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.entity_id = '${ids.second}'::uuid THEN RAISE EXCEPTION 'injected' USING ERRCODE='23514'; END IF;
      RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER test_failure BEFORE INSERT ON public.business_settings_sellers FOR EACH ROW EXECUTE FUNCTION public.test_settings_failure()');
    await identity(db);
    await rejected(() => save(db, 1, document({ financeName: 'must roll back', sellers: {
      [ids.seller]: seller({ nextNumber: 99 }), [ids.second]: seller() } })), '23514');
    assert.deepEqual(await read(db), { revision: 1, document: document() });
  });

  await scenario('injected first-save failure also rolls back speculative parent and all children', async () => {
    await db.query('RESET ROLE');
    await db.query(`CREATE FUNCTION public.test_first_settings_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected' USING ERRCODE='23514'; END $$`);
    await db.query('CREATE TRIGGER test_failure BEFORE INSERT ON public.business_settings_sellers FOR EACH ROW EXECUTE FUNCTION public.test_first_settings_failure()');
    await identity(db);
    await rejected(() => save(db), '23514');
    assert.deepEqual(await read(db), { revision: 0, document: null });
    assert.deepEqual(await settingsSnapshot(db), { business_settings: [], business_settings_sellers: [] });
  });

  await scenario('savepoint rollback restores successful aggregate and operative tuples never change', async () => {
    const before = await operativeSnapshot(db);
    await identity(db);
    await db.query('SAVEPOINT undo_save');
    await save(db);
    await save(db, 1, document({ mode: 'finance-company' }));
    await db.query('ROLLBACK TO SAVEPOINT undo_save');
    assert.deepEqual(await read(db), { revision: 0, document: null });
    await save(db);
    assert.deepEqual(await operativeSnapshot(db), before);
  });

  await scenario('catalog: hardened definers/RLS, only internal parent FK, no operative triggers', async () => {
    await save(db);
    await db.query('RESET ROLE');
    const functions = (await db.query(`SELECT proname,prosecdef,provolatile,proconfig,
      has_function_privilege('anon',oid,'EXECUTE') AS anon,
      has_function_privilege('authenticated',oid,'EXECUTE') AS authenticated
      FROM pg_proc WHERE proname IN ('read_business_settings','save_business_settings') ORDER BY proname`)).rows;
    assert.equal(functions.length, 2);
    for (const fn of functions) {
      assert.equal(fn.prosecdef, true); assert.equal(fn.provolatile, 'v');
      assert.ok(fn.proconfig.includes('search_path=""'));
      assert.equal(fn.anon, false); assert.equal(fn.authenticated, true);
    }
    const tables = (await db.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class
      WHERE oid IN ('public.business_settings'::regclass,'public.business_settings_sellers'::regclass)`)).rows;
    assert.equal(tables.length, 2);
    assert.ok(tables.every(row => row.relrowsecurity && row.relforcerowsecurity));
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE contype='f'
      AND conrelid IN ('public.business_settings'::regclass,'public.business_settings_sellers'::regclass)`)).rows[0].n, 1);
    assert.equal((await db.query(`SELECT confdeltype FROM pg_constraint WHERE contype='f'
      AND conrelid='public.business_settings_sellers'::regclass
      AND confrelid='public.business_settings'::regclass`)).rows[0].confdeltype, 'c');
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM pg_trigger WHERE
      tgrelid IN ('public.merchants'::regclass,'public.business_entities'::regclass,
        'public.merchant_settings'::regclass,'public.orders'::regclass)`)).rows[0].n, 0);
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM pg_trigger WHERE NOT tgisinternal
      AND tgrelid IN ('public.business_settings'::regclass,'public.business_settings_sellers'::regclass)`)).rows[0].n, 0);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_proc WHERE proname='entity_delete_revision'")).rows[0].n, 0);
    await rejected(() => db.query('UPDATE public.business_settings_sellers SET seller_key=upper(seller_key)'), '23514');
    await db.query('DELETE FROM public.business_settings WHERE merchant_id=$1', [ids.merchant]);
    assert.equal((await db.query('SELECT * FROM public.business_settings_sellers')).rows.length, 0, 'internal parent cascade retained');
  });
}