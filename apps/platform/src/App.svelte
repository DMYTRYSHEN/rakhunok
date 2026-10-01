<script lang="ts">
	import type { PlatformConfig } from './lib/config';

	let { config, demo = false, role = null }: { config: PlatformConfig; demo?: boolean; role?: string | null } = $props();
	const useDemoWorkspace = $derived.by(() => {
		const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
		return demo && params.get('workspace') !== 'legacy' && (params.has('persona') || !role || role === 'seller' || role === 'platform');
	});
</script>

<svelte:head><title>Rahunok Platform | DAC7</title></svelte:head>

{#if useDemoWorkspace}
		{#await import('./lib/demo/DemoWorkspace.svelte')}
			<p role="status">Завантаження Platform...</p>
		{:then workspace}
			<workspace.default {role} onSignOut={() => window.location.assign(window.location.pathname)} />
		{:catch}
			<p role="alert">Не вдалося завантажити кабінет.</p><button onclick={() => window.location.reload()}>Спробувати знову</button>
		{/await}
{:else}
		{#await import('./AuthWorkspace.svelte')}
			<p role="status">Завантаження кабінету...</p>
		{:then workspace}
			<workspace.default {config} {demo} {role} />
		{:catch}
			<p role="alert">Не вдалося завантажити кабінет.</p><button onclick={() => window.location.reload()}>Спробувати знову</button>
		{/await}
{/if}