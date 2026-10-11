<script lang="ts">
	import { untrack } from 'svelte';
	import { ArrowLeft, ArrowRight, Building2, Check, Landmark, LoaderCircle, LogOut } from '@lucide/svelte';
	import { ibanBank, normalizePhone, normalizeWebsite, validContactEmail } from './onboarding';
	import type { DashboardUser, MerchantOnboardingInput } from '../types';

	let {
		user,
		onComplete,
		onSignOut
	}: { user: DashboardUser; onComplete: (input: MerchantOnboardingInput) => Promise<void>; onSignOut?: () => Promise<void> } =
		$props();

	let businessName = $state('');
	let step = $state(1);
	let attempted = $state(false);
	let phone = $state('');
	let contactEmail = $state(untrack(() => user.email ?? ''));
	let website = $state('');
	let businessType = $state<MerchantOnboardingInput['businessType']>('fop');
	let vatStatus = $state<MerchantOnboardingInput['vatStatus'] | ''>('');
	let taxId = $state('');
	let iban = $state('');
	let pending = $state(false);
	let signingOut = $state(false);
	let message = $state<string | null>(null);
	const busy = $derived(pending || signingOut);

	async function changeAccount() {
		if (!onSignOut || busy) return;
		signingOut = true;
		message = null;
		try {
			await onSignOut();
		} catch {
			message = 'Не вдалося вийти. Спробуйте ще раз.';
		} finally {
			signingOut = false;
		}
	}

	const normalizedIban = $derived(iban.replace(/\s+/g, '').toUpperCase());
	const personalIdentifier = $derived(businessType === 'fop' || businessType === 'self_employed');
	const validTaxId = $derived((personalIdentifier ? /^\d{10}$/ : /^\d{8}$/).test(taxId.trim()));
	const bank = $derived(ibanBank(iban));
	const validIban = $derived(bank !== null);
	const canSubmit = $derived(
		businessName.trim().length >= 2 && validTaxId && validIban && vatStatus !== '' && !busy
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		attempted = true;
		if (!canSubmit) return;
		if (step === 1) { step = 2; attempted = false; return; }
		if (!normalizePhone(phone) || !validContactEmail(contactEmail) || normalizeWebsite(website) === null) return;
		pending = true;
		message = null;

		try {
			await onComplete({
				businessName: businessName.trim(),
				businessType,
				vatStatus: vatStatus as MerchantOnboardingInput['vatStatus'],
				taxId: taxId.trim(),
				iban: normalizedIban,
				displayName: businessName.trim().slice(0, 100),
				bankName: bank?.name ?? '',
				phone: normalizePhone(phone)!,
				contactEmail: contactEmail.trim().toLowerCase(),
				website: normalizeWebsite(website) ?? ''
			});
		} catch (error) {
			message = error instanceof Error ? error.message : 'Не вдалося створити профіль бізнесу.';
			pending = false;
		}
	}
</script>

<main class="onboarding">
	<header class="brandbar"><a href="/" class="brand"><span class="brandmark"><Building2 size={20} aria-hidden="true" /></span>Рахунок <span class="brand-label">Бізнес</span></a><div class="account-controls"><span class="account">{user.email ?? 'Google-акаунт'}</span>{#if onSignOut}<button type="button" class="switch-account" disabled={busy} onclick={changeAccount}>{#if signingOut}<LoaderCircle size={16} class="spinner" aria-hidden="true" />{:else}<LogOut size={16} aria-hidden="true" />{/if}Змінити акаунт</button>{/if}</div></header>
	<div class="workspace">
		<aside class="progress"><p class="eyebrow">Профіль бізнесу</p><h1>Почнемо<br />з головного.</h1><ol aria-label="Етапи створення профілю"><li class:current={step === 1} aria-current={step === 1 ? 'step' : undefined}><span class="step-number">{#if step === 2}<Check size={16} aria-hidden="true" />{:else}01{/if}</span><span><strong>Реквізити</strong><small>Бізнес і банківський рахунок</small></span></li><li class:current={step === 2} aria-current={step === 2 ? 'step' : undefined}><span class="step-number">02</span><span><strong>Контакти</strong><small>Телефон, email і сайт</small></span></li></ol><p class="account-note">Акаунт<br /><strong>{user.email ?? 'Google'}</strong></p></aside>
		<section class="form-section" aria-labelledby="step-heading"><div class="form-heading"><p class="eyebrow">Крок {step} із 2</p><h2 id="step-heading">{step === 1 ? 'Реквізити бізнесу' : 'Контакти бізнесу'}</h2></div>
			<form onsubmit={submit} novalidate aria-busy={busy}><fieldset disabled={busy}>
			{#if step === 1}
				<div class="field"><label for="business-type">Організаційна форма</label><select id="business-type" bind:value={businessType}><option value="fop">ФОП</option><option value="tov">ТОВ</option><option value="self_employed">Самозайнята особа</option><option value="ngo">Громадська організація</option></select></div>
				<div class="field"><label for="vat-status">Статус ПДВ</label><select id="vat-status" bind:value={vatStatus} required aria-invalid={attempted && vatStatus === ''} aria-describedby="vat-error"><option value="" disabled>Оберіть статус</option><option value="vat">Платник ПДВ</option><option value="no-vat">Не платник ПДВ</option></select>{#if attempted && vatStatus === ''}<p id="vat-error" class="error">Оберіть статус ПДВ.</p>{/if}</div>
				<div class="field"><label for="legal-name">Юридична назва</label><input id="legal-name" bind:value={businessName} autocomplete="organization" maxlength="200" placeholder={businessType === 'fop' ? 'ФОП Іваненко Іван Іванович' : 'ТОВ «Назва компанії»'} required aria-invalid={attempted && businessName.trim().length < 2} aria-describedby="name-error" />{#if attempted && businessName.trim().length < 2}<p id="name-error" class="error">Вкажіть юридичну назву.</p>{/if}</div>
				<div class="field"><label for="tax-id">{personalIdentifier ? 'РНОКПП' : 'ЄДРПОУ'}</label><input id="tax-id" bind:value={taxId} inputmode="numeric" maxlength={personalIdentifier ? 10 : 8} placeholder={personalIdentifier ? '10 цифр' : '8 цифр'} required aria-invalid={attempted && !validTaxId} aria-describedby="tax-error" />{#if attempted && !validTaxId}<p id="tax-error" class="error">Вкажіть {personalIdentifier ? 10 : 8} цифр.</p>{/if}</div>
				<div class="field"><label for="iban">IBAN</label><input id="iban" class="iban" bind:value={iban} maxlength="40" spellcheck="false" placeholder="UA00 000000 0000000000000000000" required aria-invalid={attempted && !validIban} aria-describedby="iban-status" /><div id="iban-status" class="bank-status" class:invalid={attempted && !bank}>{#if bank}<Landmark size={16} aria-hidden="true" /><span>{bank.name ?? `МФО ${bank.code}`}</span><Check size={14} aria-hidden="true" />{:else if attempted}<span>Перевірте формат і контрольну суму IBAN.</span>{:else}<span>UA та 27 цифр</span>{/if}</div></div>
			{:else}
				<div class="business-summary"><Building2 size={20} aria-hidden="true" /><span><strong>{businessName}</strong><small>{bank?.name ?? `МФО ${bank?.code}`} · {taxId}</small></span></div>
				<div class="field"><label for="phone">Телефон</label><input id="phone" type="tel" bind:value={phone} autocomplete="tel" maxlength="30" placeholder="+380 67 123 45 67" required aria-invalid={attempted && !normalizePhone(phone)} aria-describedby="phone-error" />{#if attempted && !normalizePhone(phone)}<p id="phone-error" class="error">Вкажіть коректний номер телефону.</p>{/if}</div>
				<div class="field"><label for="contact-email">Email</label><input id="contact-email" type="email" bind:value={contactEmail} autocomplete="email" maxlength="254" required aria-invalid={attempted && !validContactEmail(contactEmail)} aria-describedby="email-error" />{#if attempted && !validContactEmail(contactEmail)}<p id="email-error" class="error">Вкажіть коректний email.</p>{/if}</div>
				<div class="field"><label for="website">Сайт <span class="optional">Необов’язково</span></label><input id="website" bind:value={website} inputmode="url" autocomplete="url" maxlength="2048" placeholder="example.com" aria-invalid={attempted && normalizeWebsite(website) === null} aria-describedby="website-error" />{#if attempted && normalizeWebsite(website) === null}<p id="website-error" class="error">Вкажіть адресу сайту з http або https.</p>{/if}</div>
			{/if}</fieldset>
			{#if message}<p class="submit-error" role="alert">{message}</p>{/if}
			<footer class="actions">{#if step === 2}<button type="button" class="back" disabled={busy} onclick={() => { step = 1; attempted = false; message = null; }}><ArrowLeft size={17} aria-hidden="true" />Назад</button>{:else}<span class="step-caption">01 / 02</span>{/if}<button type="submit" class="primary" disabled={busy}>{#if pending}<LoaderCircle size={17} class="spinner" aria-hidden="true" />Створюємо…{:else}{step === 1 ? 'Продовжити' : 'Створити профіль'}<ArrowRight size={17} aria-hidden="true" />{/if}</button></footer></form>
		</section>
	</div>
</main>

<style>
	.onboarding { --ink: #202522; --muted: #727a75; --line: #dfe5e1; --accent: #176b50; min-height: 100svh; color: var(--ink); background: linear-gradient(110deg, #f0f4f1, #fafbfa 52%, #fff); font-family: 'Manrope', sans-serif; letter-spacing: 0; }
	.brandbar { min-height: 88px; padding: 20px 5%; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 20px; }
	.brand { display: flex; align-items: center; gap: 12px; color: var(--ink); text-decoration: none; font-size: 21px; font-weight: 800; }
	.brandmark { width: 36px; height: 36px; border-radius: 6px; background: var(--accent); color: white; display: grid; place-items: center; }
	.brand-label, .account { font-size: 12px; font-weight: 500; color: var(--muted); }
	.account { overflow-wrap: anywhere; }
	.account-controls { display: flex; align-items: center; gap: 16px; min-width: 0; }
	.switch-account { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; flex-shrink: 0; border: 0; background: transparent; color: var(--ink); font-size: 12px; font-weight: 600; padding: 0; }
	.workspace { max-width: 1000px; margin: 0 auto; padding: 64px 32px 72px; display: grid; grid-template-columns: 300px minmax(0, 480px); justify-content: space-between; gap: 64px; }
	.eyebrow { font-size: 11px; font-weight: 700; color: var(--accent); margin: 0 0 16px; }
	h1 { font-size: 38px; font-weight: 650; line-height: 1.2; margin: 0; }
	ol { list-style: none; padding: 0; margin: 40px 0 0; display: grid; gap: 28px; }
	li { display: flex; align-items: center; gap: 14px; color: #8b948e; }
	.step-number { width: 36px; height: 36px; flex-shrink: 0; display: grid; place-items: center; border: 1px solid #d6ddd8; border-radius: 50%; font-size: 11px; font-weight: 700; }
	li strong { font-size: 13px; font-weight: 700; display: block; }
	li small { font-size: 11px; display: block; margin-top: 5px; }
	li.current { color: var(--ink); }
	li.current .step-number { color: white; border-color: var(--accent); background: var(--accent); }
	.account-note { border-top: 1px solid var(--line); margin-top: 56px; padding-top: 22px; color: var(--muted); font-size: 11px; line-height: 1.7; }
	.account-note strong { font-weight: 500; overflow-wrap: anywhere; }
	.form-section { min-width: 0; }
	.form-heading { margin-bottom: 32px; }
	.form-heading .eyebrow { margin-bottom: 10px; }
	h2 { font-size: 25px; line-height: 1.3; font-weight: 700; margin: 0; }
	fieldset { padding: 0; margin: 0; border: 0; min-width: 0; display: grid; gap: 23px; }
	label { display: block; font-size: 12px; font-weight: 650; margin-bottom: 9px; }
	input, select { width: 100%; box-sizing: border-box; height: 48px; border: 1px solid #d8dfda; border-radius: 6px; background: white; color: var(--ink); padding: 0 14px; font: inherit; font-size: 13px; }
	input::placeholder { color: #929a95; }
	input:focus, select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px #176b5012; }
	input[aria-invalid='true'] { border-color: #ba4747; }
	.iban { font-family: monospace; font-size: 13px; text-transform: uppercase; }
	button { font-family: inherit; cursor: pointer; }
	.bank-status { min-height: 22px; margin-top: 9px; display: flex; align-items: center; gap: 7px; color: var(--accent); font-size: 11px; }
	.bank-status.invalid, .error { color: #a43737; }
	.error { font-size: 11px; margin: 8px 0 0; line-height: 1.5; }
	.optional { float: right; color: var(--muted); font-size: 10px; font-weight: 400; }
	.business-summary { border-block: 1px solid var(--line); padding: 16px 0; display: flex; align-items: center; gap: 12px; margin-bottom: 2px; }
	.business-summary > span { min-width: 0; }
	.business-summary strong { display: block; font-size: 12px; overflow-wrap: anywhere; }
	.business-summary small { display: block; font-size: 10px; color: var(--muted); margin-top: 5px; }
	.actions { border-top: 1px solid var(--line); margin-top: 32px; padding-top: 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
	.step-caption { color: #929b95; font-size: 11px; }
	.primary, .back { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 46px; border: 0; font-size: 12px; font-weight: 700; }
	.primary { background: var(--accent); color: white; border-radius: 6px; padding: 0 20px; }
	.primary:hover { background: #10543d; }
	.back { color: var(--muted); background: transparent; padding: 0; }
	button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
	button:disabled { opacity: .6; cursor: wait; }
	.submit-error { background: #fff1f1; color: #a43737; padding: 12px; border-radius: 4px; font-size: 12px; line-height: 1.5; }
	:global(.onboarding .spinner) { animation: spin 1s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }
	@media (max-width: 760px) { .brandbar { min-height: 72px; padding: 16px 24px; } .account { display: none; } .workspace { padding: 32px 24px 48px; display: block; max-width: 520px; } h1, .progress > .eyebrow, .account-note { display: none; } ol { margin: 0 0 34px; grid-template-columns: 1fr 1fr; gap: 16px; } li { gap: 9px; } li small { display: none; } .step-number { width: 30px; height: 30px; } h2 { font-size: 23px; } .form-heading { margin-bottom: 26px; } }
	@media (prefers-reduced-motion: reduce) { :global(.onboarding .spinner) { animation: none; } }
</style>
