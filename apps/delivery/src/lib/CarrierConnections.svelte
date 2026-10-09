<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { Truck, Save, Trash2, RefreshCw, ShieldCheck, ExternalLink } from '@lucide/svelte';

	type Metadata = { configured: boolean; ready: boolean; verified: boolean };
	type Connection = {
		id: string; name: string; note: string; key: string;
		metadata: Metadata | null; pending: boolean; error: string;
	};
	let connections: Connection[] = $state([
		{ id: 'nova-poshta', name: 'Нова пошта', note: 'Ключ перевіряється через API Нової пошти.', key: '', metadata: null, pending: false, error: '' },
		{ id: 'ukrposhta', name: 'Укрпошта', note: 'Збереження ключа не підтверджує доступ до API Укрпошти.', key: '', metadata: null, pending: false, error: '' },
		{ id: 'meest', name: 'Meest', note: 'Токен Meest має строк дії. Після завершення замініть його новим; збереження не є перевіркою у Meest.', key: '', metadata: null, pending: false, error: '' }
	]);
	const controller = new AbortController();
	let destroyed = false;

	function readMetadata(value: unknown): Metadata {
		if (!value || typeof value !== 'object') throw new Error('Invalid metadata');
		const metadata = value as Record<string, unknown>;
		if (typeof metadata.configured !== 'boolean' || typeof metadata.ready !== 'boolean' || typeof metadata.verified !== 'boolean') {
			throw new Error('Invalid metadata');
		}
		return { configured: metadata.configured, ready: metadata.ready, verified: metadata.verified };
	}

	async function request(connection: Connection, method: 'GET' | 'POST' | 'DELETE') {
		if (connection.pending || destroyed) return;
		const key = connection.key.trim();
		connection.key = '';
		if (method === 'POST' && !key) return;
		connection.pending = true;
		connection.error = '';
		try {
			const response = await fetch(`/api/v1/${connection.id}/credentials`, {
				method,
				credentials: 'same-origin',
				signal: controller.signal,
				...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) } : {})
			});
			if (!response.ok) {
				connection.error = response.status === 401 || response.status === 403
					? 'Сесія завершилась або немає доступу. Увійдіть знову.'
					: method === 'GET' ? 'Не вдалося отримати стан ключа.'
						: method === 'DELETE' ? 'Не вдалося видалити ключ.' : 'Не вдалося зберегти ключ. Перевірте його та спробуйте ще раз.';
				return;
			}
			const metadata = method === 'DELETE' && response.status === 204
				? { configured: false, ready: false, verified: false }
				: readMetadata(await response.json());
			if (!destroyed) connection.metadata = metadata;
		} catch {
			if (!destroyed) connection.error = 'Не вдалося підтвердити стан ключа. Оновіть стан та спробуйте ще раз.';
		} finally {
			connection.key = '';
			connection.pending = false;
		}
	}

	onMount(() => { connections.forEach(connection => { void request(connection, 'GET'); }); });
	onDestroy(() => {
		destroyed = true;
		controller.abort();
		connections.forEach(connection => { connection.key = ''; });
	});
</script>

<section aria-label="Ключі перевізників" class="space-y-6">
	<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
		{#each connections as connection (connection.id)}
			<article data-carrier={connection.id} aria-busy={connection.pending} class="min-w-0 bg-white border border-[var(--color-border-subtle)] rounded-lg p-5 space-y-4">
				<h2 class="flex items-center gap-2 text-[16px] font-semibold"><Truck size={18} class="text-brand-500 shrink-0" />{connection.name}</h2>
				<div aria-live="polite" class="text-[13px] space-y-1 min-h-[60px]">
					{#if connection.metadata}
						<p class="font-medium">{connection.metadata.configured ? 'Ключ збережено' : 'Ключ не збережено'}</p>
						{#if connection.metadata.configured}
							<p>{connection.metadata.ready ? 'Готовий до використання' : 'Ще не готовий до використання'}</p>
							<p class="flex items-center gap-1 text-text-secondary">
								{#if connection.id === 'nova-poshta' && connection.metadata.verified}<ShieldCheck size={16} />Перевірено Новою поштою
								{:else}Не перевірено у перевізника{/if}
							</p>
						{/if}
					{:else}<p class="text-text-secondary">{connection.pending ? 'Завантаження стану…' : 'Стан ключа невідомий'}</p>{/if}
				</div>
				<p class="text-[13px] text-text-secondary">{connection.note}</p>
				{#if connection.id === 'nova-poshta'}
					<a href="https://my.novaposhta.ua/settings/index#apikeys" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-[13px] text-brand-600">Отримати API-ключ<ExternalLink size={14} /></a>
					{#if connection.metadata?.configured && connection.metadata.ready}
						<a href={resolve('/(business)/business')} class="inline-flex items-center gap-1 text-[13px] text-brand-600"><Truck size={16} />Мої відправлення</a>
					{/if}
				{/if}
				<form onsubmit={(event) => { event.preventDefault(); void request(connection, 'POST'); }} class="space-y-3">
					<label for={`carrier-key-${connection.id}`} class="block text-[13px] font-medium">{connection.id === 'meest' ? 'Новий токен Meest' : `Новий API-ключ: ${connection.name}`}</label>
					<input id={`carrier-key-${connection.id}`} type="password" bind:value={connection.key} disabled={connection.pending} required autocomplete="off" spellcheck="false" class="w-full min-w-0 px-3 py-2 border border-[var(--color-border-default)] rounded-lg text-[14px]" />
					<div class="flex flex-wrap gap-2">
						<button type="submit" disabled={connection.pending || !connection.key.trim()} class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-500 text-white text-[13px] disabled:opacity-50"><Save size={16} />Зберегти</button>
						<button type="button" onclick={() => request(connection, 'GET')} disabled={connection.pending} aria-label={`Оновити стан: ${connection.name}`} title="Оновити стан" class="p-2 border border-[var(--color-border-default)] rounded-lg disabled:opacity-50"><RefreshCw size={16} /></button>
						<button type="button" onclick={() => request(connection, 'DELETE')} disabled={connection.pending || !connection.metadata?.configured} aria-label={`Видалити ключ: ${connection.name}`} title="Видалити ключ" class="p-2 border border-[var(--color-border-default)] rounded-lg text-warning-text disabled:opacity-50"><Trash2 size={16} /></button>
					</div>
				</form>
				{#if connection.pending}<p role="status" class="text-[13px] text-text-secondary">Запит виконується…</p>{/if}
				{#if connection.error}<p role="alert" class="text-[13px] text-warning-text">{connection.error}</p>{/if}
			</article>
		{/each}
	</div>
	<div class="border-t border-[var(--color-border-subtle)] pt-5 space-y-3">
		{#each [{ name: 'SAT', href: 'https://www.sat.ua/' }, { name: 'Delivery', href: 'https://www.delivery-auto.com/' }] as provider (provider.name)}
			<div class="text-[13px]">
				<a href={provider.href} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-semibold text-brand-600">{provider.name}<ExternalLink size={14} /></a>
				<p class="text-text-secondary">Очікуємо endpoint і погоджений API-контракт. Керування ключами ще недоступне.</p>
			</div>
		{/each}
	</div>
</section>