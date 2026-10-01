<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Building2,
		CodeXml,
		Command,
		CornerDownLeft,
		Fingerprint,
		KeyRound,
		Receipt,
		Search,
		ShieldCheck,
		Users,
		Wallet,
		X
	} from '@lucide/svelte';
	import type { Dac7Role } from '../types';

	let {
		open = $bindable(false),
		onClose,
		onSelectRole,
		onNavigate
	}: {
		open?: boolean;
		onClose: () => void;
		onSelectRole?: (role: Dac7Role) => void;
		onNavigate?: (tab: string) => void;
	} = $props();

	let searchQuery = $state('');

	const quickActions = [
		{
			id: 'seller',
			title: 'Самозайнятий курʼєр (Олексій)',
			sub: 'Кабінет, виплати, документи',
			type: 'Роль',
			role: 'seller' as Dac7Role
		},
		{
			id: 'platform',
			title: 'Оператор платформи (Bolt Food)',
			sub: 'Консоль, комплаєнс, 10% ПДФО',
			type: 'Роль',
			role: 'platform' as Dac7Role
		},
		{
			id: 'business',
			title: 'Бізнес-мерчант (VARUS Delivery)',
			sub: 'Платежі клієнтів, Checkout',
			type: 'Роль',
			role: 'business' as Dac7Role
		},
		{
			id: 'gov',
			title: 'Держава (ДПС / Мінфін)',
			sub: 'DAC7 звітність, аналітика ризиків',
			type: 'Роль',
			role: 'gov' as Dac7Role
		},
		{
			id: 'dev',
			title: 'Портал розробника (API Explorer)',
			sub: 'Sandbox ключі, webhooks',
			type: 'Роль',
			role: 'dev' as Dac7Role
		},
		{
			id: 'sso',
			title: 'Rahunok ID (Дія.Підпис)',
			sub: 'Верифікація РНОКПП та P7S',
			type: 'Роль',
			role: 'sso' as Dac7Role
		},
		{
			id: 'passport',
			title: 'Rahunok Auth (Passkeys & pinPay)',
			sub: 'FIDO2, каси самообслуговування',
			type: 'Роль',
			role: 'passport' as Dac7Role
		},
		{
			id: 'nav_payouts',
			title: 'Батчі виплат та реєстр СЕП',
			sub: 'Перехід до виплат',
			type: 'Розділ',
			tab: 'payouts'
		},
		{
			id: 'nav_taxes',
			title: 'Податкове адміністрування (10% ПДФО)',
			sub: 'Казначейство та 4ДФ',
			type: 'Розділ',
			tab: 'taxes'
		},
		{
			id: 'nav_dac7',
			title: 'Генератор DPI XML (OECD DAC7)',
			sub: 'Експорт реєстру продавців',
			type: 'Розділ',
			tab: 'dac7'
		}
	];

	const filteredActions = $derived(
		searchQuery.trim() === ''
			? quickActions
			: quickActions.filter(
					(a) =>
						a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
						a.sub.toLowerCase().includes(searchQuery.toLowerCase())
				)
	);

	function handleAction(item: (typeof quickActions)[0]) {
		if (item.role && onSelectRole) {
			onSelectRole(item.role);
		} else if (item.tab && onNavigate) {
			onNavigate(item.tab);
		}
		onClose();
	}

	onMount(() => {
		function onKey(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				if (open) onClose();
				else open = true;
			}
			if (e.key === 'Escape' && open) {
				e.preventDefault();
				onClose();
			}
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

{#if open}
	<div
		class="animate-fadeIn fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24 backdrop-blur-xs"
	>
		<button
			type="button"
			class="fixed inset-0 h-full w-full cursor-default bg-transparent"
			onclick={onClose}
			aria-label="Закрити"
		></button>

		<div
			class="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
		>
			<!-- Search Bar -->
			<div class="flex items-center gap-3 border-b border-stone-200 px-4 py-3.5">
				<Search class="size-5 shrink-0 text-stone-400" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Введіть команду, розділ або роль..."
					class="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
				/>
				<button
					type="button"
					onclick={onClose}
					class="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
				>
					<X class="size-4" />
				</button>
			</div>

			<!-- Results List -->
			<div class="max-h-80 divide-y divide-stone-100 overflow-y-auto p-2 text-xs">
				{#each filteredActions as item}
					<button
						type="button"
						onclick={() => handleAction(item)}
						class="group flex w-full cursor-pointer items-center justify-between rounded-xl p-3 text-left transition hover:bg-stone-50"
					>
						<div>
							<div
								class="flex items-center gap-2 font-bold text-stone-900 group-hover:text-stone-950"
							>
								<span>{item.title}</span>
								<span
									class="rounded border border-stone-200 bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] text-stone-500"
								>
									{item.type}
								</span>
							</div>
							<div class="mt-0.5 text-[11.5px] text-stone-500">{item.sub}</div>
						</div>
						<CornerDownLeft class="size-4 text-stone-300 transition group-hover:text-stone-600" />
					</button>
				{/each}
				{#if filteredActions.length === 0}
					<div class="p-6 text-center text-stone-400">
						Нічого не знайдено за запитом "{searchQuery}"
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div
				class="flex items-center justify-between border-t border-stone-100 bg-stone-50 px-4 py-2 text-[11px] text-stone-400"
			>
				<span>Навігація: <b>↑</b> <b>↓</b> <b>Enter</b></span>
				<span>Esc для виходу</span>
			</div>
		</div>
	</div>
{/if}
