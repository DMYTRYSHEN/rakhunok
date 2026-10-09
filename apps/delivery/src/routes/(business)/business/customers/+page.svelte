<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { Users, Save, Pencil, Trash2, Plus, X } from '@lucide/svelte';
	import type { PageProps } from './$types';
	let { data, form }: PageProps = $props();
	let query = $state('');
	let id = $state('');
	let name = $state('');
	let phone = $state('');
	let editor: HTMLInputElement;
	onMount(() => { if (form?.values) ({ id, name, phone } = form.values); });
	const filtered = $derived(data.customers.filter(customer => `${customer.name} ${customer.phone}`.toLocaleLowerCase('uk').includes(query.trim().toLocaleLowerCase('uk'))));
	function reset() { id = ''; name = ''; phone = ''; editor.focus(); }
</script>

<svelte:head><title>Клієнти | Rahunok Delivery</title></svelte:head>
<main>
	<header><h1><Users size={24} />Клієнти</h1><a href={resolve('/(business)/business/new')}><Plus size={18} />Нова відправка</a></header>
	{#if data.customersError}<p role="alert">{data.customersError}</p>{/if}
	{#if form?.message}<p role="status">{form.message}</p>{/if}
	<form method="POST" class="editor">
		<h2>{id ? 'Редагування клієнта' : 'Новий клієнт'}</h2>
		<input type="hidden" name="id" value={id} />
		<label>Прізвище та ім’я<input bind:this={editor} name="name" bind:value={name} required minlength="3" maxlength="150" autocomplete="off" /></label>
		<label>Телефон<input name="phone" type="tel" bind:value={phone} required maxlength="24" autocomplete="off" placeholder="+380" /></label>
		<div class="actions"><button type="submit" name="intent" value="save" disabled={!!data.customersError}><Save size={18} />Зберегти</button>{#if id}<button type="button" onclick={reset}><X size={18} />Скасувати</button>{/if}</div>
	</form>
	<label class="search">Пошук клієнтів<input type="search" bind:value={query} placeholder="Ім’я або телефон" /></label>
	<p class="count" role="status">Знайдено: {filtered.length}</p>
	<ul>
		{#each filtered as customer (customer.id)}
			<li><div><strong>{customer.name}</strong><a href={`tel:${customer.phone}`}>{customer.phone}</a></div><div class="actions">
				<button type="button" title="Редагувати клієнта" aria-label={`Редагувати ${customer.name}`} onclick={() => { ({ id, name, phone } = customer); editor.focus(); }}><Pencil size={18} /></button>
				<form method="POST" onsubmit={(event) => { if (!confirm(`Видалити клієнта ${customer.name}?`)) event.preventDefault(); }}><input type="hidden" name="id" value={customer.id} /><button type="submit" name="intent" value="delete" title="Видалити клієнта" aria-label={`Видалити ${customer.name}`}><Trash2 size={18} /></button></form>
			</div></li>
		{/each}
	</ul>
	{#if !filtered.length && !data.customersError}<p>{query ? 'Клієнтів не знайдено.' : 'Клієнтів ще немає.'}</p>{/if}
</main>

<style>
	main { max-width: 960px; padding: 28px 24px 100px; }
	header, h1, .actions, header a { display: flex; align-items: center; gap: 12px; }
	header { justify-content: space-between; flex-wrap: wrap; margin-bottom: 24px; }
	h1 { font-size: 24px; } h2 { font-size: 18px; }
	.editor { display: grid; gap: 16px; max-width: 580px; padding-block: 20px; border-block: 1px solid var(--color-border-default); }
	label { display: grid; gap: 8px; font-size: 14px; }
	input { width: 100%; min-width: 0; min-height: 44px; padding: 10px; border: 1px solid var(--color-border-default); border-radius: 6px; background: var(--color-surface); color: inherit; }
	button { min-height: 44px; min-width: 44px; display: inline-flex; gap: 8px; align-items: center; justify-content: center; padding: 10px; border: 1px solid var(--color-border-default); border-radius: 6px; cursor: pointer; }
	button:disabled { opacity: .5; } .search { margin-top: 28px; max-width: 580px; }
	.count { margin-block: 12px; color: var(--color-text-secondary); }
	ul { padding: 0; list-style: none; } li { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-block: 16px; border-top: 1px solid var(--color-border-default); }
	li > div:first-child { min-width: 0; display: grid; gap: 6px; overflow-wrap: anywhere; } .actions { flex-shrink: 0; }
</style>