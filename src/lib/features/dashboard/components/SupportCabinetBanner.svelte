<script lang="ts">
	import { LogOut, ShieldCheck } from '@lucide/svelte';
	import type { SupportContext } from '../api/support-cabinet';
	let { context, name, remaining, busy, error, onExit }: {
		context: SupportContext | null;
		name: string;
		remaining: number;
		busy: boolean;
		error: string;
		onExit: () => void;
	} = $props();
</script>

<section aria-label="Кабінет клієнта" class="support-banner">
	<ShieldCheck size={20} aria-hidden="true" />
	<div class="identity">
		<strong>Техпідтримка · {name || 'Кабінет клієнта'}</strong>
		<span>{context?.workspace === 'live' ? 'Реальний бізнес' : context ? 'Тестова копія' : 'Доступ не підтверджено'}{context ? ` · ${context.targetId}` : ''}</span>
	</div>
	{#if context}<time>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</time>{/if}
	<button onclick={onExit} disabled={busy}><LogOut size={18} aria-hidden="true" />Вийти з кабінету клієнта</button>
	{#if error}<p role="alert">{error}</p>{/if}
</section>

<style>
	.support-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 2px solid #327452; background: #eaf5ee; color: #173d29; font-family: 'Manrope', sans-serif; letter-spacing: 0; }
	.identity { display: grid; gap: 4px; flex: 1; min-width: min(220px, 100%); overflow-wrap: anywhere; }
	strong { font-size: 14px; }
	span { font-size: 12px; }
	time { font-variant-numeric: tabular-nums; min-width: 48px; }
	button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 8px 12px; border: 1px solid #327452; border-radius: 4px; background: white; color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
	button:disabled { opacity: .6; cursor: wait; }
	p { width: 100%; margin: 0; font-size: 13px; overflow-wrap: anywhere; }
</style>