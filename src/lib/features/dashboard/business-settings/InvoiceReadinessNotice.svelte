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
	const blockers = $derived(issues.filter((issue) => issue.severity === 'blocker'));
	const advisories = $derived(scope && !acknowledged ? issues.filter((issue) => issue.severity === 'advisory') : []);
	const hasAdvice = $derived(issues.some((issue) => issue.severity === 'advisory'));
	const record = $derived(scope ? readinessNoticeSession().forScope(scope) : null);

	function adviceTransition(element: Element) {
		return fly(element, { y: 12, duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180, easing: (progress) => 1 - Math.pow(1 - progress, 3) });
	}

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

{#if blockers.length || error || pending}
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
		<button type="button" class="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold underline disabled:opacity-50" disabled={pending} onclick={onCheck}>
			<RefreshCw size={16} aria-hidden="true" />
			{pending ? 'Перевіряємо…' : 'Перевірити після збереження'}
		</button>
	</section>
{/if}

{#if advisories.length}
	<section class="readiness-advisories" aria-labelledby="invoice-advice-title" transition:adviceTransition|global>
		<div class="readiness-advisory-header">
			<h2 id="invoice-advice-title">Рекомендовано доповнити</h2>
			<button class="readiness-close" type="button" aria-label="Закрити рекомендації" title="Закрити рекомендації" onclick={() => record?.acknowledge()}><X size={18} aria-hidden="true" /></button>
		</div>
		<ul class="readiness-advisory-links">
			{#each advisories as issue (`${issue.section}:${issue.entityId ?? ''}`)}
				<li><a href={resolve(issue.entityId ? `/dashboard/${issue.section}?entityId=${encodeURIComponent(issue.entityId)}` : `/dashboard/${issue.section}`)}>{issue.label}</a></li>
			{/each}
		</ul>
		{#if !blockers.length && !error && !pending}
			<button class="readiness-recheck" type="button" onclick={onCheck}><RefreshCw size={16} aria-hidden="true" />Перевірити після збереження</button>
		{/if}
	</section>
{/if}

<style>
	.readiness-blockers { margin-top: 0.75rem; border-left: 4px solid #b91c1c; background: #fef2f2; padding: 0.75rem 1rem; color: #991b1b; overflow-wrap: anywhere; }
	.readiness-advisories { position: fixed; z-index: 60; right: 24px; bottom: 24px; box-sizing: border-box; width: 384px; max-width: calc(100vw - 32px); max-height: min(360px, calc(100dvh - 128px)); overflow-y: auto; padding: 12px 16px 16px; border: 1px solid #d4d4d8; border-radius: 8px; background: #fff; box-shadow: 0 8px 32px rgb(0 0 0 / 14%); color: #3f3f46; font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }
	.readiness-advisory-header { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
	.readiness-advisory-header h2 { margin: 0; color: #18181b; font-size: 16px; font-weight: 600; line-height: 1.4; }
	.readiness-advisory-links { margin: 8px 0 0; padding: 0; list-style: none; }
	.readiness-advisory-links li + li { margin-top: 8px; }
	.readiness-advisory-links a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
	.readiness-recheck { display: inline-flex; min-height: 44px; align-items: center; gap: 8px; margin-top: 8px; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; font-weight: 600; text-align: left; text-decoration: underline; cursor: pointer; }
	.readiness-close { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 44px; width: 44px; height: 44px; border: 0; background: transparent; color: inherit; cursor: pointer; }
	.readiness-close:hover { background: #f4f4f5; }
	.readiness-close:focus-visible { outline: 2px solid #52525b; outline-offset: 2px; }
	@media (max-width: 640px) {
		.readiness-advisories { right: 16px; bottom: max(16px, env(safe-area-inset-bottom)); width: calc(100vw - 32px); max-height: min(280px, calc(100dvh - 128px)); }
	}
</style>