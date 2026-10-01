<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';

	let {
		currentPage = $bindable(1),
		totalItems = 0,
		pageSize = $bindable(5),
		pageSizeOptions = [5, 10, 20]
	}: {
		currentPage: number;
		totalItems: number;
		pageSize?: number;
		pageSizeOptions?: number[];
	} = $props();

	const totalPages = $derived(Math.max(1, Math.ceil(totalItems / (pageSize || 5))));
	const startItem = $derived(totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1);
	const endItem = $derived(Math.min(currentPage * pageSize, totalItems));

	function prevPage() {
		if (currentPage > 1) {
			currentPage -= 1;
		}
	}

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage += 1;
		}
	}

	function setPage(p: number) {
		if (p >= 1 && p <= totalPages) {
			currentPage = p;
		}
	}
</script>

{#if totalItems > 0}
	<div
		class="flex flex-col items-center justify-between gap-3 border-t border-stone-100 bg-stone-50/50 px-5 py-3 text-xs text-stone-500 sm:flex-row"
	>
		<div class="flex items-center gap-2">
			<span
				>Показано <b class="font-semibold text-stone-800">{startItem}–{endItem}</b> з
				<b class="font-semibold text-stone-800">{totalItems}</b></span
			>
			{#if pageSizeOptions.length > 1}
				<span class="text-stone-300">·</span>
				<div class="flex items-center gap-1.5">
					<span>Рядків:</span>
					<select
						bind:value={pageSize}
						onchange={() => (currentPage = 1)}
						class="cursor-pointer rounded-md border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-700 outline-none focus:border-stone-400"
					>
						{#each pageSizeOptions as opt}
							<option value={opt}>{opt}</option>
						{/each}
					</select>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-1.5">
			<button
				type="button"
				onclick={prevPage}
				disabled={currentPage <= 1}
				class="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-40"
			>
				<ChevronLeft class="size-3.5" />
				<span>Попередня</span>
			</button>

			<div class="flex items-center gap-1 px-1">
				{#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
					{#if totalPages <= 7 || p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)}
						<button
							type="button"
							onclick={() => setPage(p)}
							class="h-6 min-w-6 cursor-pointer rounded-md px-1.5 text-xs font-semibold transition {currentPage ===
							p
								? 'bg-stone-900 text-white'
								: 'text-stone-600 hover:bg-stone-200/70'}"
						>
							{p}
						</button>
					{:else if p === currentPage - 2 || p === currentPage + 2}
						<span class="px-0.5 text-stone-400">…</span>
					{/if}
				{/each}
			</div>

			<button
				type="button"
				onclick={nextPage}
				disabled={currentPage >= totalPages}
				class="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-100 disabled:pointer-events-none disabled:opacity-40"
			>
				<span>Наступна</span>
				<ChevronRight class="size-3.5" />
			</button>
		</div>
	</div>
{/if}
