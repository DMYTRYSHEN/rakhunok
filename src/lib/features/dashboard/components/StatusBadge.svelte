<script lang="ts">
	import { CircleCheck, Clock3, CircleX, Ban } from '@lucide/svelte';
	import type { InvoiceStatus } from '../types';

	let { status }: { status: InvoiceStatus } = $props();

	const labels: Record<InvoiceStatus, string> = {
		paid: 'Оплачено',
		pending: 'Очікує',
		failed: 'Помилка',
		cancelled: 'Скасовано'
	};
</script>

<span
	class:bg-emerald-50={status === 'paid'}
	class:text-emerald-700={status === 'paid'}
	class:bg-amber-50={status === 'pending'}
	class:text-amber-700={status === 'pending'}
	class:bg-red-50={status === 'failed'}
	class:text-red-700={status === 'failed'}
	class:bg-zinc-100={status === 'cancelled'}
	class:text-zinc-600={status === 'cancelled'}
	class="inline-flex w-fit items-center gap-1.5 rounded-sm px-2 py-1 text-[0.6875rem] font-bold"
>
	{#if status === 'paid'}
		<CircleCheck size={13} strokeWidth={2.25} aria-hidden="true" />
	{:else if status === 'pending'}
		<Clock3 size={13} strokeWidth={2.25} aria-hidden="true" />
	{:else if status === 'failed'}
		<CircleX size={13} strokeWidth={2.25} aria-hidden="true" />
	{:else}
		<Ban size={13} strokeWidth={2.25} aria-hidden="true" />
	{/if}
	{labels[status]}
</span>
