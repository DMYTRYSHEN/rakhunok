<script lang="ts">
	import {
		Building2,
		Fingerprint,
		KeyRound,
		Lock,
		ShieldCheck,
		UserCheck,
		UserCog
	} from '@lucide/svelte';
	import type { Dac7Role } from './types';
	import type { Dac7Gateway } from './dac7-gateway';
	import AdminRoleManager from './components/AdminRoleManager.svelte';
	import PlatformConsole from './components/PlatformConsole.svelte';
	import SellerCabinet from './components/SellerCabinet.svelte';
	import GovAuditor from './components/GovAuditor.svelte';
	import SsoDiiaHub from './components/SsoDiiaHub.svelte';
	import PassportPinPay from './components/PassportPinPay.svelte';
	import DevExplorer from './components/DevExplorer.svelte';

	let {
		gateway,
		demo = false,
		initialRole = 'admin'
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
		initialRole?: Dac7Role;
	} = $props();

	let currentRole = $state<Dac7Role>('admin');
	let isDemoMode = $state<boolean>(false);

	$effect(() => {
		currentRole = initialRole;
	});

	$effect(() => {
		isDemoMode = demo;
	});

	const roleNav = [
		{ id: 'admin' as Dac7Role, label: '????? ????', icon: UserCog },
		{ id: 'platform' as Dac7Role, label: '????????? (CFO)', icon: Building2 },
		{ id: 'seller' as Dac7Role, label: "???'?? (???????)", icon: UserCheck },
		{ id: 'gov' as Dac7Role, label: '??????? (???)', icon: ShieldCheck },
		{ id: 'dev' as Dac7Role, label: '?????????', icon: KeyRound },
		{ id: 'sso' as Dac7Role, label: '???.?????? (SSO)', icon: Fingerprint },
		{ id: 'passport' as Dac7Role, label: 'Passkeys / pinPay', icon: Lock }
	];
</script>

<div class="min-h-screen bg-[#fafaf9] text-stone-900 pb-16 antialiased">
	<!-- Top App Header -->
	<header class="sticky top-0 z-40 border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
		<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
			<div class="flex items-center gap-3">
				<a href="/dac7" class="flex items-center gap-2">
					<span class="grid size-8 place-items-center rounded-xl bg-stone-900 font-black text-white text-xs">
						R
					</span>
					<span class="font-extrabold text-stone-900 tracking-tight text-sm sm:text-base">
						Rahunok Network ? DAC7 & ????? ? 4903-IX
					</span>
				</a>
			</div>

			<div class="flex items-center gap-2.5">
				<!-- Mode toggle -->
				<button
					type="button"
					onclick={() => (isDemoMode = !isDemoMode)}
					class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition shadow-sm {isDemoMode
						? 'border-emerald-300 bg-emerald-50 text-emerald-800'
						: 'border-blue-300 bg-blue-50 text-blue-800'}"
				>
					<span class="size-2 rounded-full {isDemoMode ? 'bg-emerald-500' : 'bg-blue-600 animate-pulse'}"></span>
					<span>?????: {isDemoMode ? '???? (????????)' : 'Live (Supabase)'}</span>
				</button>
			</div>
		</div>

		<!-- Horizontal Role Switcher Bar -->
		<div class="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-4 py-2 sm:px-6 border-t border-stone-100">
			{#each roleNav as item}
				{@const isSelected = currentRole === item.id}
				<button
					type="button"
					onclick={() => (currentRole = item.id)}
					class="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition {isSelected
						? 'bg-stone-900 text-white shadow-sm'
						: 'bg-stone-100 text-stone-600 hover:bg-stone-200'}"
				>
					<item.icon size={14} />
					<span>{item.label}</span>
				</button>
			{/each}
		</div>
	</header>

	<!-- Main Role View Workspace -->
	<main class="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
		{#if currentRole === 'admin'}
			<AdminRoleManager {gateway} bind:currentRole demo={isDemoMode} />
		{:else if currentRole === 'platform'}
			<PlatformConsole {gateway} demo={isDemoMode} />
		{:else if currentRole === 'seller'}
			<SellerCabinet {gateway} demo={isDemoMode} />
		{:else if currentRole === 'gov'}
			<GovAuditor {gateway} demo={isDemoMode} />
		{:else if currentRole === 'sso'}
			<SsoDiiaHub {gateway} demo={isDemoMode} />
		{:else if currentRole === 'passport'}
			<PassportPinPay {gateway} demo={isDemoMode} />
		{:else if currentRole === 'dev'}
			<DevExplorer />
		{/if}
	</main>
</div>
