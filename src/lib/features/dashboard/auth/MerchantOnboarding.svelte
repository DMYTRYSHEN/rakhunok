<script lang="ts">
	import { Building2, Check, LoaderCircle } from '@lucide/svelte';
	import type { DashboardUser, MerchantOnboardingInput } from '../types';

	let {
		user,
		onComplete
	}: { user: DashboardUser; onComplete: (input: MerchantOnboardingInput) => Promise<void> } =
		$props();

	let businessName = $state('');
	let displayName = $state('');
	let businessType = $state<'fop' | 'tov'>('fop');
	let taxId = $state('');
	let iban = $state('');
	let bankName = $state('');
	let pending = $state(false);
	let message = $state<string | null>(null);

	const normalizedIban = $derived(iban.replace(/\s+/g, '').toUpperCase());
	const validTaxId = $derived(/^\d{8,10}$/.test(taxId.trim()));
	const validIban = $derived(/^UA[A-Z0-9]{27}$/.test(normalizedIban));
	const canSubmit = $derived(
		businessName.trim().length >= 2 && validTaxId && validIban && !pending
	);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!canSubmit) return;
		pending = true;
		message = null;

		try {
			await onComplete({
				businessName: businessName.trim(),
				businessType,
				taxId: taxId.trim(),
				iban: normalizedIban,
				displayName: displayName.trim() || businessName.trim(),
				bankName: bankName.trim()
			});
		} catch (error) {
			message = error instanceof Error ? error.message : 'Не вдалося створити профіль бізнесу.';
			pending = false;
		}
	}
</script>

<main class="min-h-screen bg-[#f5f6f7] px-4 py-8 text-zinc-950 sm:px-6 lg:py-12">
	<div class="mx-auto max-w-3xl">
		<header class="mb-8">
			<div class="grid size-11 place-items-center rounded-md bg-blue-600 text-white">
				<Building2 size={21} aria-hidden="true" />
			</div>
			<p class="mt-6 text-xs font-bold tracking-[0.12em] text-blue-700 uppercase">Перший вхід</p>
			<h1 class="mt-2 text-3xl font-extrabold">Створіть профіль бізнесу</h1>
			<p class="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
				Вітаємо{user.fullName ? `, ${user.fullName}` : ''}. Ці реквізити потрібні для рахунків, QR
				та приймання оплат. Профіль буде прив’язано до {user.email || 'вашого Google-акаунта'}.
			</p>
		</header>

		<form onsubmit={submit} class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
			<div class="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">
				<label class="sm:col-span-2">
					<span class="mb-2 block text-xs font-bold text-zinc-600">Юридична назва</span>
					<input
						bind:value={businessName}
						autocomplete="organization"
						placeholder="ФОП Іваненко Іван Іванович"
						class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
					/>
				</label>

				<label>
					<span class="mb-2 block text-xs font-bold text-zinc-600">Організаційна форма</span>
					<select
						bind:value={businessType}
						class="h-12 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-blue-600"
					>
						<option value="fop">ФОП</option>
						<option value="tov">ТОВ</option>
					</select>
				</label>

				<label>
					<span class="mb-2 block text-xs font-bold text-zinc-600">РНОКПП / ЄДРПОУ</span>
					<input
						bind:value={taxId}
						inputmode="numeric"
						maxlength="10"
						placeholder="8 або 10 цифр"
						class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
					/>
				</label>

				<label class="sm:col-span-2">
					<span class="mb-2 block text-xs font-bold text-zinc-600">IBAN</span>
					<input
						bind:value={iban}
						maxlength="34"
						spellcheck="false"
						placeholder="UA00 0000 0000 0000 0000 0000 000"
						class="h-12 w-full rounded-md border border-zinc-200 px-3 font-mono text-sm uppercase outline-none focus:border-blue-600"
					/>
					<p class="mt-1.5 text-xs {iban && !validIban ? 'text-red-700' : 'text-zinc-500'}">
						Український IBAN: UA та 27 символів.
					</p>
				</label>

				<label>
					<span class="mb-2 block text-xs font-bold text-zinc-600">Публічна назва</span>
					<input
						bind:value={displayName}
						placeholder={businessName || 'Назва для клієнтів'}
						class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
					/>
				</label>

				<label>
					<span class="mb-2 block text-xs font-bold text-zinc-600">Банк</span>
					<input
						bind:value={bankName}
						autocomplete="organization"
						placeholder="Назва банку"
						class="h-12 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
					/>
				</label>
			</div>

			<div
				class="flex flex-col gap-4 border-t border-zinc-200 bg-zinc-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7"
			>
				<p class="flex items-center gap-2 text-xs text-zinc-600">
					<Check size={15} class="text-emerald-700" aria-hidden="true" /> Один профіль на Google-акаунт
				</p>
				<button
					type="submit"
					disabled={!canSubmit}
					class="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-extrabold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
				>
					{#if pending}<LoaderCircle size={17} class="animate-spin" aria-hidden="true" /> Створюємо…{:else}Продовжити
						до dashboard{/if}
				</button>
			</div>
			{#if message}<p
					class="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800"
					role="alert"
				>
					{message}
				</p>{/if}
		</form>
	</div>
</main>
