<script lang="ts">
	import { CircleAlert, LoaderCircle, RotateCcw } from '@lucide/svelte';

	let {
		loading = false,
		message = '',
		onRetry
	}: { loading?: boolean; message?: string; onRetry?: () => void } = $props();
</script>

<main class="grid min-h-screen place-items-center bg-[#f6f7f8] px-5 text-zinc-950">
	<div class="max-w-sm text-center">
		<div
			class="mx-auto grid size-11 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-700"
		>
			{#if loading}
				<LoaderCircle size={20} class="animate-spin" aria-hidden="true" />
			{:else}
				<CircleAlert size={20} class="text-red-600" aria-hidden="true" />
			{/if}
		</div>
		<h1 class="mt-5 text-lg font-bold">
			{loading ? 'Відновлюємо сесію' : 'Не вдалося відкрити dashboard'}
		</h1>
		<p class="mt-2 text-sm leading-6 text-zinc-500">
			{loading ? 'Перевіряємо доступ до вашого бізнесу.' : message}
		</p>
		{#if !loading && onRetry}
			<button
				type="button"
				class="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-bold text-white"
				onclick={onRetry}
			>
				<RotateCcw size={16} aria-hidden="true" />
				Спробувати ще раз
			</button>
		{/if}
	</div>
</main>
