<script lang="ts">
	import { CheckCircle2, Circle, CreditCard, ExternalLink, FilePlus2, Link2 } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import type { InvoiceEvent } from '../types';

	let {
		events,
		loading = false,
		error = null,
		onRetry
	}: {
		events: InvoiceEvent[];
		loading?: boolean;
		error?: string | null;
		onRetry?: () => void;
	} = $props();

	const eventPresentation: Record<string, { label: string; icon: Component }> = {
		order_created: { label: 'Створено рахунок', icon: FilePlus2 },
		link_generated: { label: 'Створено посилання', icon: Link2 },
		link_shared: { label: 'Посилання надіслано', icon: Link2 },
		checkout_opened: { label: 'Клієнт відкрив чек', icon: ExternalLink },
		checkout_reopened: { label: 'Клієнт повторно відкрив чек', icon: ExternalLink },
		bank_selected: { label: 'Обрано банк', icon: CreditCard },
		bank_switched: { label: 'Змінено банк', icon: CreditCard },
		payment_initiated: { label: 'Розпочато оплату', icon: CreditCard },
		payment_succeeded: { label: 'Оплату підтверджено', icon: CheckCircle2 },
		payment_success: { label: 'Оплату підтверджено', icon: CheckCircle2 },
		order_cancelled: { label: 'Рахунок скасовано', icon: Circle }
	};

	function presentation(event: InvoiceEvent) {
		return eventPresentation[event.type] || { label: event.type, icon: Circle };
	}

	function details(event: InvoiceEvent) {
		if (event.previousBankCode && event.bankCode) {
			return `${event.previousBankCode} → ${event.bankCode}`;
		}
		if (event.bankCode) return `Банк: ${event.bankCode}`;
		return event.actorName;
	}
</script>

<section
	class="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6"
	aria-labelledby="timeline-title"
>
	<header>
		<p class="text-xs font-bold tracking-[0.12em] text-blue-700 uppercase">Аудит</p>
		<h2 id="timeline-title" class="mt-2 text-base font-bold">Хронологія рахунку</h2>
	</header>

	{#if loading}
		<p class="mt-5 text-sm text-zinc-500" role="status">Завантажуємо історію подій...</p>
	{:else if error}
		<div class="mt-5" role="alert">
			<p class="text-sm text-red-700">{error}</p>
			{#if onRetry}
				<button
					type="button"
					class="mt-3 rounded-md border border-zinc-300 px-3 py-2 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
					onclick={onRetry}
				>
					Спробувати ще раз
				</button>
			{/if}
		</div>
	{:else if events.length === 0}
		<p class="mt-5 text-sm text-zinc-500">Для цього рахунку ще немає зафіксованих подій.</p>
	{:else}
		<ol class="mt-5 space-y-1">
			{#each events as event (event.id)}
				{@const config = presentation(event)}
				<li
					class="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-zinc-100 py-3 last:border-0"
				>
					<span class="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-600">
						<config.icon size={15} aria-hidden="true" />
					</span>
					<div class="min-w-0">
						<p class="text-sm font-bold text-zinc-900">{config.label}</p>
						{#if details(event)}<p class="mt-0.5 text-xs text-zinc-500">{details(event)}</p>{/if}
					</div>
					<time class="pt-1 text-xs text-zinc-500 tabular-nums" datetime={event.createdAt}>
						{new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(
							new Date(event.createdAt)
						)}
					</time>
				</li>
			{/each}
		</ol>
	{/if}
</section>
