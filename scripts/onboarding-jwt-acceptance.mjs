import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import { handleMerchantOnboarding } from '../worker/src/merchant-onboarding.ts';

const sharedProject = 'mwaeazabpvbxqfrceogr';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function acceptanceConfig(env) {
	const url = new URL(env.ONBOARDING_TEST_URL);
	assert.equal(url.protocol, 'https:', 'An isolated hosted HTTPS project is required');
	assert.equal(url.hostname, `${env.ONBOARDING_TEST_PROJECT}.supabase.co`, 'Project and URL must match');
	assert.notEqual(env.ONBOARDING_TEST_PROJECT, sharedProject, 'Shared DAC7 is prohibited');
	assert.equal(url.pathname, '/', 'Only a project origin is accepted');
	assert.equal(url.search + url.hash + url.username + url.password, '', 'Invalid project URL');
	for (const owner of [env.ONBOARDING_NEW_OWNER_ID, env.ONBOARDING_EXISTING_OWNER_ID]) {
		assert.match(owner ?? '', uuidPattern, 'Two explicit test owner UUIDs are required');
	}
	assert.notEqual(env.ONBOARDING_NEW_OWNER_ID, env.ONBOARDING_EXISTING_OWNER_ID, 'Test owners must differ');
	assert.equal(env.ONBOARDING_ALLOW_TEST_WRITES, 'yes', 'Explicit test fixture write approval is required');
	assert.match(env.ONBOARDING_TEST_KEY ?? '', /^sb_publishable_/, 'Use an isolated project publishable key, never a secret');
	return { url: url.origin, publishableKey: env.ONBOARDING_TEST_KEY,
		newOwner: env.ONBOARDING_NEW_OWNER_ID, existingOwner: env.ONBOARDING_EXISTING_OWNER_ID };
}

function client(config) {
	return createClient(config.url, config.publishableKey, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
}

async function login(browser, config, expectedOwner, label) {
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.setContent('<!doctype html><html lang="en"><title>Isolated JWT acceptance</title><main><h1></h1><form><label>Email <input name="email" type="email" required autocomplete="off"></label><label>Password <input name="password" type="password" required autocomplete="off"></label><button>Sign in</button></form><p role="status"></p></main></html>');
	await page.locator('h1').evaluate((element, title) => { element.textContent = title; }, label);
	await page.locator('form').evaluate(element => {
		element.addEventListener('submit', event => {
			event.preventDefault();
			element.dataset.submitted = 'yes';
		});
	});
	const supabase = client(config);
	try {
		await page.locator('form[data-submitted="yes"]').waitFor({ timeout: 0 });
		const email = await page.locator('[name="email"]').inputValue();
		const password = await page.locator('[name="password"]').inputValue();
		await page.locator('[name="password"]').fill('');
		const signedIn = await supabase.auth.signInWithPassword({ email, password });
		assert.equal(signedIn.error, null, 'Test account sign-in failed');
		const verified = await supabase.auth.getUser();
		assert.equal(verified.error, null, 'Server identity verification failed');
		assert.equal(verified.data.user?.id, expectedOwner, 'Signed-in user is not the approved test owner');
		return { supabase, token: signedIn.data.session.access_token };
	} catch {
		await supabase.auth.signOut();
		throw new Error(`${label}: sign-in or approved identity verification failed`);
	} finally {
		await context.close();
	}
}

export async function cleanupFixtures(fixtures, merchant) {
	const outstanding = [];
	const records = fixtures.map(([session, owner, id]) => ({ session, owner, id, table: 'business_entities' })).reverse();
	if (merchant) records.push({ ...merchant, table: 'merchants' });
	for (const { session, owner, id, table } of records) {
		try {
			const removed = await session.supabase.from(table).delete().eq('id', id).eq('user_id', owner).select('id');
			assert.equal(removed.error, null);
			assert.deepEqual(removed.data, [{ id }]);
		} catch {
			outstanding.push({ table, id, owner });
		}
	}
	return outstanding;
}

export async function runAcceptance(config, first, second) {
	const fixtures = [];
	let createdMerchant;
	let acceptanceFailure;
	const input = { business_type: 'self_employed', business_name: 'JWT Acceptance Fixture',
		display_name: 'JWT Acceptance Fixture', tax_id: '1234567890',
		iban: 'UA663052990000026007123456789', bank_name: 'Acceptance Bank',
		phone: '+380671234567', contact_email: 'acceptance@example.com', website: 'https://example.com/' };
	const rest = async (path, token, init = {}) => fetch(`${config.url}/rest/v1/${path}`, {
		...init, signal: AbortSignal.timeout(30000),
		headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
	});
	const reload = async (session, owner, entityId) => {
		const response = await rest(`business_entities?id=eq.${entityId}&user_id=eq.${owner}&select=*,business_entity_contacts(phone,contact_email,website)`, session.token);
		assert.equal(response.status, 200, 'PostgREST embedded reload failed');
		const rows = await response.json();
		assert.equal(rows.length, 1, 'Owner-scoped reload must return exactly one entity');
		assert.equal(rows[0].user_id, owner);
		assert.ok(rows[0].business_entity_contacts && !Array.isArray(rows[0].business_entity_contacts), 'Expected one-to-one private relation');
		return rows[0];
	};
	const save = async (session, entityId, payload) => {
		const result = await session.supabase.rpc('save_business_entity', { p_entity_id: entityId, p_input: payload });
		assert.equal(result.error, null, 'Owner RPC save failed');
		assert.match(result.data.id, uuidPattern);
		return result.data;
	};
	try {
		for (const [session, owner, mustExist] of [[first, config.newOwner, false], [second, config.existingOwner, true]]) {
			const result = await session.supabase.from('merchants').select('id').eq('user_id', owner);
			assert.equal(result.error, null, 'Merchant preflight failed');
			assert.equal(result.data.length, mustExist ? 1 : 0, 'Account does not match new/existing test role');
			const contacts = await rest('business_entity_contacts?select=entity_id&limit=0', session.token);
			assert.equal(contacts.status, 200, 'Private relation migration must be present before writes');
		}
		const onboard = () => handleMerchantOnboarding(new Request('http://localhost/api/merchant/onboarding', {
			method: 'POST', headers: { Authorization: `Bearer ${first.token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(input)
		}), config);
		const response = await onboard();
		assert.equal(response.status, 200, 'Real JWT Worker onboarding failed');
		const initialized = await response.json();
		if (initialized.created === true && initialized.merchant?.user_id === config.newOwner &&
			uuidPattern.test(initialized.merchant?.id ?? '')) createdMerchant = initialized.merchant.id;
		if (initialized.created === true && initialized.entity?.user_id === config.newOwner &&
			uuidPattern.test(initialized.entity?.id ?? '')) fixtures.push([first, config.newOwner, initialized.entity.id]);
		assert.equal(initialized.created, true);
		assert.equal(initialized.merchant.user_id, config.newOwner);
		assert.equal(initialized.entity.user_id, config.newOwner);
		assert.match(initialized.merchant.id, uuidPattern);
		assert.match(initialized.entity.id, uuidPattern);
		const retries = await Promise.all([onboard(), onboard()]);
		for (const retry of retries) {
			assert.equal(retry.status, 200);
			const result = await retry.json();
			assert.equal(result.created, false);
			assert.equal(result.merchant.id, createdMerchant);
		}
		const entity = await save(second, null, { ...input, business_type: 'tov', tax_id: '12345678' });
		if (entity.user_id === config.existingOwner) fixtures.push([second, config.existingOwner, entity.id]);
		assert.equal(entity.user_id, config.existingOwner);
		for (const [session, owner, entityId] of fixtures) {
			assert.equal((await reload(session, owner, entityId)).business_entity_contacts.phone, input.phone);
			await save(session, entityId, { ...input, phone: '+380681234567' });
			assert.equal((await reload(session, owner, entityId)).business_entity_contacts.phone, '+380681234567');
			const omitted = { ...input };
			delete omitted.phone;
			delete omitted.contact_email;
			delete omitted.website;
			await save(session, entityId, omitted);
			assert.equal((await reload(session, owner, entityId)).business_entity_contacts.phone, '+380681234567');
			await save(session, entityId, { ...input, phone: null, contact_email: null, website: null });
			assert.deepEqual((await reload(session, owner, entityId)).business_entity_contacts, { phone: null, contact_email: null, website: null });
		}
		const foreignId = initialized.entity.id;
		const forbidden = await second.supabase.rpc('save_business_entity', { p_entity_id: foreignId, p_input: input });
		assert.equal(forbidden.error?.code, '42501', 'Cross-owner update must fail');
		const foreignContacts = await rest(`business_entity_contacts?entity_id=eq.${foreignId}&select=*`, second.token);
		assert.equal(foreignContacts.status, 200);
		assert.deepEqual(await foreignContacts.json(), [], 'Cross-owner contacts must be invisible');
		const publicResult = await fetch(`${config.url}/rest/v1/business_entities?id=eq.${foreignId}&select=id,business_name,tax_id,iban`, {
			headers: { apikey: config.publishableKey }, signal: AbortSignal.timeout(30000)
		});
		assert.equal(publicResult.status, 200, 'Public recipient contract must remain available');
		assert.equal((await publicResult.json())[0]?.id, foreignId);
		const anonymous = await fetch(`${config.url}/rest/v1/business_entity_contacts?entity_id=eq.${foreignId}`, {
			headers: { apikey: config.publishableKey }, signal: AbortSignal.timeout(30000)
		});
		assert.ok([401, 403].includes(anonymous.status), 'Anonymous contacts must be denied');
	} catch (error) {
		acceptanceFailure = error;
	}
	const outstanding = await cleanupFixtures(fixtures, createdMerchant
		? { session: first, owner: config.newOwner, id: createdMerchant } : null);
	if (outstanding.length) {
		const error = new Error('Fixture cleanup incomplete', { cause: acceptanceFailure });
		error.outstandingFixtures = outstanding;
		throw error;
	}
	if (acceptanceFailure) throw acceptanceFailure;
	return { newOwner: 'passed', existingOwner: 'passed', retry: 'passed', privacy: 'passed', reload: 'passed' };
}

async function main() {
	const config = acceptanceConfig(process.env);
	const browser = await chromium.launch({ headless: false });
	const sessions = [];
	try {
		console.log('Enter test credentials directly in the opened browser. No traces, screenshots or session files are recorded.');
		sessions.push(await login(browser, config, config.newOwner, 'New test owner'));
		sessions.push(await login(browser, config, config.existingOwner, 'Existing test owner'));
		console.log(JSON.stringify(await runAcceptance(config, ...sessions)));
	} finally {
		for (const session of sessions) await session.supabase.auth.signOut();
		await browser.close();
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch(error => {
		console.error('JWT acceptance failed; inspect isolated test fixtures before retrying. No release approval.');
		if (error.outstandingFixtures) console.error(JSON.stringify({ outstandingFixtures: error.outstandingFixtures }));
		process.exitCode = 1;
	});
}