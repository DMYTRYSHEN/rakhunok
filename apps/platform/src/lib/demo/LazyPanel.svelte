<script lang="ts" generics="Props extends Record<string, unknown>">
	import type { Component, Snippet } from 'svelte';
	let { load, children }: { load: () => Promise<{ default: Component<Props> }>; children: Snippet<[Component<Props>]> } = $props();
	const pending = $derived(load());
</script>

{#await pending}
	<div class="panel-loading" role="status" aria-live="polite">Завантаження розділу...</div>
{:then module}
	{@render children(module.default)}
{:catch}
	<div class="panel-loading"><p role="alert">Не вдалося завантажити розділ.</p><button onclick={() => window.location.reload()}>Спробувати знову</button></div>
{/await}

<style>
	.panel-loading { min-height: 240px; padding: 24px 0; font-size: 13px; color: #60666f; }
</style>