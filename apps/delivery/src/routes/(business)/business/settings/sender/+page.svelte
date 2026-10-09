<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { ArrowLeft, Save, RotateCcw, LoaderCircle } from '@lucide/svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let senderRef = $state('');
	let contactRef = $state('');
	let contacts = $state<{ ref: string; name: string; phone: string }[]>([]);
	let busy = $state(false);
	let pending = $state(false);
	let message = $state('');
	let controller: AbortController | undefined;
	let sequence = 0;
	function resetSelection() {
		senderRef = data.defaultSenderRef;
		contactRef = data.defaultContactRef;
		contacts = data.contacts;
	}
	onMount(() => { resetSelection(); return () => { sequence++; controller?.abort(); }; });
	async function loadContacts() {
		const current = ++sequence;
		controller?.abort();
		contactRef = ''; contacts = []; message = ''; busy = false;
		if (!senderRef) return;
		const requestController = new AbortController();
		controller = requestController;
		const timeout = setTimeout(() => requestController.abort(), 20000);
		busy = true;
		try {
			const response = await fetch(`${resolve('/api/v1/nova-poshta/account')}?${new URLSearchParams({ sender: senderRef })}`, { cache: 'no-store', signal: requestController.signal });
			if (!response.ok) throw new Error('Account unavailable');
			const result = await response.json();
			if (current !== sequence) return;
			if (!Array.isArray(result.contacts)) throw new Error('Invalid contacts');
			contacts = result.contacts;
			if (contacts.length === 1) contactRef = contacts[0].ref;
			if (!contacts.length) message = 'Немає доступних контактів відправника.';
		} catch { if (current === sequence) message = 'Не вдалося завантажити контакти.'; }
		finally { clearTimeout(timeout); if (current === sequence) busy = false; }
	}
</script>

<svelte:head><title>Відправник Нової пошти | Rahunok Delivery</title></svelte:head>
<main>
	<a class="back" href={resolve('/(business)/business/settings')}><ArrowLeft size={18} />Налаштування</a>
	<h1>Відправник Нової пошти</h1>
	{#if data.accountError}<p role="alert">{data.accountError}</p><a href={resolve('/(business)/business/integrations')}>Інтеграції</a>{/if}
	{#if data.defaultsWarning}<p role="status">{data.defaultsWarning}</p>{/if}
	<form method="POST" use:enhance={() => {
		pending = true;
		return async ({ update, result }) => {
			try { await update({ reset: false }); if (result.type === 'success') resetSelection(); }
			finally { pending = false; }
		};
	}}>
		<label>Відправник за замовчуванням
			<select name="senderRef" bind:value={senderRef} onchange={loadContacts} disabled={pending || !!data.accountError} required>
				<option value="">Оберіть відправника</option>
				{#each data.senders as sender (sender.ref)}<option value={sender.ref}>{sender.name}</option>{/each}
			</select>
		</label>
		<label>Контакт відправника
			<select name="contactRef" bind:value={contactRef} disabled={pending || busy || !senderRef || !!data.accountError} required>
				<option value="">{busy ? 'Завантаження…' : 'Оберіть контакт'}</option>
				{#each contacts as contact (contact.ref)}<option value={contact.ref}>{contact.name} · {contact.phone}</option>{/each}
			</select>
		</label>
		{#if message}<p role="status">{message}</p><button type="button" onclick={loadContacts} disabled={busy || pending}><RotateCcw size={18} />Повторити</button>{/if}
		{#if form?.message}<p role="status">{form.message}</p>{/if}
		<div class="actions">
			<button class="primary" type="submit" name="intent" value="save" disabled={pending || busy || !senderRef || !contactRef || !!data.accountError}>{#if pending}<LoaderCircle size={18} />{:else}<Save size={18} />{/if}Зберегти</button>
			<button type="submit" name="intent" value="clear" formnovalidate disabled={pending || busy}><RotateCcw size={18} />Скинути</button>
		</div>
	</form>
	<a class="back" href={resolve('/(business)/business/new')}>Нова відправка</a>
</main>

<style>
	main { max-width: 720px; padding: 28px 24px 110px; }
	h1 { font-size: 24px; font-weight: 600; margin: 24px 0; }
	form { display: grid; gap: 22px; margin-bottom: 28px; }
	label { display: grid; gap: 8px; font-size: 14px; }
	select { width: 100%; min-width: 0; min-height: 44px; border: 1px solid var(--color-border-default); border-radius: 6px; padding: 10px; background: var(--color-surface); color: inherit; }
	.actions { display: flex; flex-wrap: wrap; gap: 12px; }
	button, .back { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
	button { padding: 10px 16px; border: 1px solid var(--color-border-default); border-radius: 6px; cursor: pointer; }
	button.primary { background: var(--color-brand-600, #047857); color: white; }
	button:disabled { opacity: .5; cursor: default; }
	p { overflow-wrap: anywhere; }
</style>