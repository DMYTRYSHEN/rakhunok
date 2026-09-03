<script lang="ts">
	import { Check, ChevronDown, ChevronRight, Copy } from '@lucide/svelte';

	let {
		data,
		label = 'Payload',
		defaultExpanded = true
	}: { data: unknown; label?: string; defaultExpanded?: boolean } = $props();

	let copied = $state(false);

	let parsedData = $derived.by(() => {
		if (data === null || data === undefined) return null;
		if (typeof data === 'object') return data;
		if (typeof data === 'string') {
			try {
				return JSON.parse(data);
			} catch {
				return data;
			}
		}
		return data;
	});

	async function copyJson() {
		try {
			const str =
				typeof parsedData === 'object'
					? JSON.stringify(parsedData, null, 2)
					: String(parsedData ?? '');
			await navigator.clipboard.writeText(str);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1800);
		} catch {
			// ignore
		}
	}
</script>

{#snippet treeNode(key: string | null, value: unknown, depth: number, isLast: boolean)}
	{@const isObj = value !== null && typeof value === 'object'}
	{@const isArr = Array.isArray(value)}
	{@const entries = isObj
		? isArr
			? value.map((v, i) => [String(i), v] as const)
			: Object.entries(value as Record<string, unknown>)
		: []}

	{#if isObj}
		<details
			open={depth < 2 || defaultExpanded}
			class="tree-details"
			style="margin-left: {depth * 10}px;"
		>
			<summary class="tree-summary">
				<span class="chevron"
					><ChevronRight size={11} class="closed-icon" /><ChevronDown
						size={11}
						class="open-icon"
					/></span
				>
				{#if key !== null}
					<span class="key-name">{key}:</span>
				{/if}
				<span class="type-bracket"
					>{isArr ? `Array(${entries.length})` : `Object{${entries.length}}`}</span
				>
			</summary>
			<div class="tree-children">
				{#each entries as [childKey, childValue], i (childKey)}
					{@render treeNode(childKey, childValue, depth + 1, i === entries.length - 1)}
				{/each}
			</div>
		</details>
	{:else}
		<div class="tree-leaf" style="margin-left: {depth * 10}px;">
			{#if key !== null}
				<span class="key-name">{key}:</span>
			{/if}
			{#if typeof value === 'string'}
				<span class="val-string">"{value}"</span>
			{:else if typeof value === 'number'}
				<span class="val-number">{value}</span>
			{:else if typeof value === 'boolean'}
				<span class="val-boolean">{value}</span>
			{:else if value === null}
				<span class="val-null">null</span>
			{:else}
				<span class="val-other">{String(value)}</span>
			{/if}
			{#if !isLast}<span class="comma">,</span>{/if}
		</div>
	{/if}
{/snippet}

<div class="json-tree-container">
	<div class="json-header">
		<span class="json-label">{label}</span>
		<button
			type="button"
			class="copy-btn"
			onclick={copyJson}
			title="Copy JSON"
			aria-label="Copy JSON"
		>
			{#if copied}
				<Check size={11} class="text-green" /> <span class="copied-text">Copied!</span>
			{:else}
				<Copy size={11} /> <span>Copy</span>
			{/if}
		</button>
	</div>
	<div class="tree-body">
		{#if parsedData === null || parsedData === undefined}
			<span class="empty-val">null</span>
		{:else if typeof parsedData !== 'object'}
			<div class="tree-leaf">
				<span class="val-string">{String(parsedData)}</span>
			</div>
		{:else}
			{@render treeNode(null, parsedData, 0, true)}
		{/if}
	</div>
</div>

<style>
	.json-tree-container {
		border: 1px solid #e8ecf2;
		border-radius: 8px;
		background: #f8fafd;
		font-family: 'SF Mono', Monaco, Menlo, 'Courier New', monospace;
		font-size: 10px;
		line-height: 1.5;
		overflow: hidden;
		margin-top: 6px;
	}
	.json-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 8px;
		background: #f1f4f8;
		border-bottom: 1px solid #e8ecf2;
	}
	.json-label {
		font-weight: 750;
		color: #475569;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-family: 'Manrope', sans-serif;
	}
	.copy-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		padding: 2px 6px;
		background: #ffffff;
		color: #5f6368;
		font-size: 9px;
		font-family: 'Manrope', sans-serif;
		font-weight: 700;
		cursor: pointer;
		transition: all 120ms ease;
	}
	.copy-btn:hover {
		border-color: #1a73e8;
		color: #1a73e8;
		background: #f8fafd;
	}
	.tree-body {
		padding: 6px 8px;
		max-height: 200px;
		overflow-y: auto;
		scrollbar-width: thin;
	}
	.tree-details {
		margin: 1px 0;
	}
	.tree-summary {
		display: flex;
		align-items: center;
		gap: 3px;
		cursor: pointer;
		list-style: none;
		user-select: none;
		color: #1e293b;
	}
	.tree-summary::-webkit-details-marker {
		display: none;
	}
	.chevron {
		width: 12px;
		height: 12px;
		display: inline-grid;
		place-items: center;
		color: #94a3b8;
	}
	.tree-details:not([open]) :global(.open-icon) {
		display: none;
	}
	.tree-details[open] :global(.closed-icon) {
		display: none;
	}

	.key-name {
		color: #1a73e8;
		font-weight: 700;
	}
	.type-bracket {
		color: #94a3b8;
		font-size: 8.5px;
	}
	.tree-children {
		border-left: 1px dashed #d2e3fc;
		margin-left: 5px;
		padding-left: 2px;
	}
	.tree-leaf {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 1px 0;
		white-space: pre-wrap;
		word-break: break-all;
	}
	.val-string {
		color: #16a34a;
	}
	.val-number {
		color: #d97706;
		font-weight: 700;
	}
	.val-boolean {
		color: #9333ea;
		font-weight: 700;
	}
	.val-null {
		color: #dc2626;
		font-style: italic;
	}
	.val-other {
		color: #475569;
	}
	.comma {
		color: #94a3b8;
	}
	.empty-val {
		color: #94a3b8;
		font-style: italic;
	}
	:global(.text-green) {
		color: #16a34a;
	}
	.copied-text {
		color: #16a34a;
	}
</style>
