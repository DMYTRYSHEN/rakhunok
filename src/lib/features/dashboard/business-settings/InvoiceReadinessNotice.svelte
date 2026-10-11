<script lang="ts">
	import { resolve } from '$app/paths';
	import { RefreshCw, X } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { readinessNoticeSession } from './readiness-notice-session';
	import type { InvoiceReadinessIssue } from './invoice-readiness';

	let { issues, scope = null, error = '', pending = false, onCheck }: {
		issues: InvoiceReadinessIssue[];
		scope?: string | null;
		error?: string;
		pending?: boolean;
		onCheck: () => void;
	} = $props();
	let acknowledged = $state(true);
	let reducedMotion = $state(true);
	const blockers = $derived(issues.filter((issue) => issue.severity === 'blocker'));
	const advisories = $derived(scope && !acknowledged ? issues.filter((issue) => issue.severity === 'advisory') : []);
	const hasAdvice = $derived(issues.some((issue) => issue.severity === 'advisory'));
	const record = $derived(scope ? readinessNoticeSession().forScope(scope) : null);

	$effect(() => {
		const media = matchMedia('(prefers-reduced-motion: reduce)');
		const update = () => { reducedMotion = media.matches; };
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});

	$effect(() => {
		acknowledged = true;
		if (!record) return;
		return record.subscribe((state) => { acknowledged = state.acknowledged; });
	});
	$effect(() => {
		if (!record || !hasAdvice) return;
		const deadline = record.start();
		if (deadline === null) return;
		const timer = setTimeout(() => record?.acknowledge(), Math.max(0, deadline - Date.now()));
		return () => clearTimeout(timer);
	});
</script>

{#if blockers.length || advisories.length || error || pending}
	<section class="border-b border-zinc-200 py-4" aria-labelledby="invoice-readiness-title">
		<h2 id="invoice-readiness-title" class="text-base font-semibold">Налаштування рахунків</h2>
		{#if error}<p role="alert" class="mt-2 break-words text-sm text-red-700">{error}</p>{/if}
		{#if blockers.length}
			<div class="readiness-blockers">
				<h3 class="text-sm font-semibold">Перешкоджає створенню рахунку</h3>
				<ul class="mt-2 space-y-2 break-words text-sm">
					{#each blockers as issue (`${issue.section}:${issue.entityId ?? ''}`)}
						<li><a class="underline" href={resolve(issue.entityId ? `/dashboard/${issue.section}?entityId=${encodeURIComponent(issue.entityId)}` : `/dashboard/${issue.section}`)}><strong>{issue.label}</strong></a></li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if advisories.length}
			<div class="readiness-advisories" transition:fly={{ y: 4, duration: reducedMotion ? 0 : 180, easing: (progress) => 1 - Math.pow(1 - progress, 3) }}>
				<div class="readiness-advisory-header">
					<h3 class="text-sm font-semibold">Рекомендовано доповнити</h3>
					<button class="readiness-close" type="button" aria-label="Закрити рекомендації" title="Закрити рекомендації" onclick={() => record?.acknowledge()}><X size={18} aria-hidden="true" /></button>
				</div>
				<ul class="mt-2 space-y-2 break-words text-sm">
					{#each advisories as issue (`${issue.section}:${issue.entityId ?? ''}`)}
						<li><a class="underline" href={resolve(issue.entityId ? `/dashboard/${issue.section}?entityId=${encodeURIComponent(issue.entityId)}` : `/dashboard/${issue.section}`)}>{issue.label}</a></li>
					{/each}
				</ul>
			</div>
		{/if}
		<button type="button" class="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold underline disabled:opacity-50" disabled={pending} onclick={onCheck}>
			<RefreshCw size={16} aria-hidden="true" />
			{pending ? 'Перевіряємо…' : 'Перевірити після збереження'}
		</button>
	</section>
{/if}

<style>
	.readiness-blockers { margin-top: 0.75rem; border-left: 4px solid #b91c1c; background: #fef2f2; padding: 0.75rem 1rem; color: #991b1b; overflow-wrap: anywhere; }
	.readiness-advisories { margin-top: 0.75rem; color: #52525b; overflow-wrap: anywhere; }
	.readiness-advisory-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
	.readiness-close { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 44px; width: 44px; height: 44px; border: 0; background: transparent; color: inherit; cursor: pointer; }
	.readiness-close:hover { background: #f4f4f5; }
	.readiness-close:focus-visible { outline: 2px solid #52525b; outline-offset: 2px; }
</style>