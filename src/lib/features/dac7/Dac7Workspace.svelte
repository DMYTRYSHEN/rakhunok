<script lang="ts">
	import {
		Building2,
		FingerprintPattern,
		KeyRound,
		ShieldCheck,
		UserCheck,
		UserCog,
		Wallet,
		Landmark,
		CodeXml,
		Search,
		Command,
		LogOut,
		ChevronDown,
		Globe,
		Inbox,
		LayoutDashboard,
		Layers,
		ChartBarBig,
		Percent,
		FileText,
		User,
		Receipt,
		TriangleAlert,
		MapPin,
		ShoppingBag,
		Plus,
		Users,
		Zap
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
	import BusinessWorkspace from './components/BusinessWorkspace.svelte';
	import CommandPalette from './components/CommandPalette.svelte';
	import { Store } from '@lucide/svelte';

	let {
		gateway,
		demo = true,
		initialRole = 'seller',
		onSignOut
	}: {
		gateway: Dac7Gateway;
		demo?: boolean;
		initialRole?: Dac7Role;
		onSignOut?: () => void;
	} = $props();

	let currentRole = $state<Dac7Role>('seller');
	let isDemoMode = $state<boolean>(true);
	let activeTab = $state<string>('home');
	let notifOpen = $state<boolean>(false);
	let commandPaletteOpen = $state<boolean>(false);

	$effect(() => {
		currentRole = initialRole;
	});

	$effect(() => {
		isDemoMode = demo;
	});

	// Roles config matching D:\SELF\src\layouts\rolesConfig.ts
	const rolesConfig: Record<
		Dac7Role,
		{
			label: string;
			who: string;
			avatar: string;
			user: string;
			sub: string;
			nav: Array<{ id: string; label: string; icon: any }>;
		}
	> = {
		seller: {
			label: 'САМОЗАЙНЯТИЙ',
			who: "Олексій · кур'єр",
			avatar: 'ОТ',
			user: 'Олексій Ткаченко',
			sub: 'RHK-9E71AB3',
			nav: [
				{ id: 'home', label: 'Головна', icon: LayoutDashboard },
				{ id: 'payouts', label: 'Батчі виплат', icon: Layers },
				{ id: 'income', label: 'Нарахування', icon: ChartBarBig },
				{ id: 'taxes', label: 'Податки', icon: Percent },
				{ id: 'docs', label: 'Документи', icon: FileText },
				{ id: 'platforms', label: 'Платформи', icon: Globe },
				{ id: 'profile', label: 'Мій профіль', icon: User }
			]
		},
		platform: {
			label: 'ПЛАТФОРМА',
			who: 'Bolt Food · фіндиректор',
			avatar: 'BF',
			user: 'Bolt Food Ukraine',
			sub: 'Оператор платформи',
			nav: [
				{ id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
				{ id: 'sellers', label: 'Виконавці', icon: Users },
				{ id: 'payouts', label: 'Виплати', icon: Receipt },
				{ id: 'taxes', label: 'Податки', icon: Percent },
				{ id: 'dac7', label: 'DAC7 звітність', icon: FileText },
				{ id: 'sim', label: 'Симулятор', icon: Zap }
			]
		},
		admin: {
			label: 'АДМІНІСТРАТОР',
			who: 'Управління ролями та правами',
			avatar: 'AD',
			user: 'Олександр Дмитришен',
			sub: 'Власник системи',
			nav: [
				{ id: 'admin_roles', label: 'Дашборд прав', icon: UserCog },
				{ id: 'admin_users', label: 'Користувачі', icon: Users },
				{ id: 'admin_audit', label: 'Аудит доступів', icon: ShieldCheck }
			]
		},
		gov: {
			label: 'ДЕРЖАВА',
			who: 'ДПС · Мінфін · НБУ',
			avatar: 'ДП',
			user: 'ДПС України',
			sub: 'RegTech · режим нагляду',
			nav: [
				{ id: 'overview', label: 'Огляд', icon: LayoutDashboard },
				{ id: 'gplatforms', label: 'Платформи', icon: Building2 },
				{ id: 'fraud', label: 'Fraud-моніторинг', icon: TriangleAlert },
				{ id: 'regions', label: 'Регіони', icon: MapPin }
			]
		},
		dev: {
			label: 'РОЗРОБНИК',
			who: 'інтеграція платформи',
			avatar: 'DV',
			user: 'dev@boltfood.ua',
			sub: 'Sandbox · full access',
			nav: [
				{ id: 'keys', label: 'Ключі API', icon: KeyRound },
				{ id: 'explorer', label: 'API Explorer', icon: CodeXml },
				{ id: 'webhooks', label: 'Webhooks & HMAC', icon: Zap },
				{ id: 'contracts', label: 'Контракти API', icon: FileText },
				{ id: 'erp', label: 'Інтеграція з ERP', icon: Building2 }
			]
		},
		sso: {
			label: 'RAHUNOK ID',
			who: 'Дія.Підпис SSO',
			avatar: 'ID',
			user: 'Rahunok ID SSO',
			sub: 'Дія.Підпис верифікація',
			nav: [
				{ id: 'sso_verify', label: 'Верифікація', icon: ShieldCheck },
				{ id: 'sso_hub', label: 'SSO Hub', icon: FingerprintPattern }
			]
		},
		passport: {
			label: 'RAHUNOK AUTH',
			who: 'Passkeys & pinPay',
			avatar: 'AP',
			user: 'Rahunok Auth Passport',
			sub: 'WebAuthn & pinPay Engine',
			nav: [
				{ id: 'passport_overview', label: 'Passkeys & pinPay', icon: KeyRound },
				{ id: 'passport_loyalty', label: 'Лояльність КСО', icon: ShoppingBag }
			]
		},
		business: {
			label: 'БІЗНЕС (МЕРЧАНТ)',
			who: 'Ресторан · VARUS',
			avatar: 'BS',
			user: 'VARUS Delivery',
			sub: 'Комерційний партнер',
			nav: [
				{ id: 'business_hub', label: 'Огляд', icon: Store },
				{ id: 'business_checkout', label: 'Оплата клієнта', icon: Wallet }
			]
		}
	};

	const currentRoleConfig = $derived(rolesConfig[currentRole] || rolesConfig.seller);

	function selectRole(role: Dac7Role) {
		currentRole = role;
		const cfg = rolesConfig[role];
		if (cfg && cfg.nav.length > 0) {
			activeTab = cfg.nav[0].id;
		}
	}
</script>

<div
	class="relative flex min-h-screen flex-col overflow-x-hidden bg-[#fafaf9] font-sans text-stone-900 antialiased md:flex-row"
>
	<!-- Background ambient gradient orbs from D:\SELF\src\layouts\AppShell.tsx -->
	<div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
		<div
			class="absolute -top-32 left-1/4 size-[450px] rounded-full bg-emerald-200/40 blur-3xl"
		></div>
		<div
			class="absolute top-1/3 -right-24 size-[400px] rounded-full bg-stone-300/40 blur-3xl"
		></div>
		<div
			class="absolute bottom-0 left-10 size-[350px] rounded-full bg-emerald-100/50 blur-3xl"
		></div>
	</div>

	<!-- Left Sidebar (D:\SELF\src\layouts\Sidebar.tsx) -->
	<aside
		class="relative z-20 w-full shrink-0 flex-col border-r border-stone-200/70 bg-white/60 backdrop-blur-xl md:flex md:min-h-screen md:w-64"
	>
		<!-- Top Branding -->
		<div class="flex items-center gap-3 px-5 py-5">
			<span
				class="flex size-9 items-center justify-center rounded-xl bg-stone-900 text-[14px] font-bold text-white shadow-sm"
			>
				R
			</span>
			<div class="leading-tight">
				<div class="text-[14.5px] font-bold tracking-tight text-stone-900">Rahunok</div>
				<div class="text-[10.5px] font-semibold tracking-[0.16em] text-stone-400 uppercase">
					{currentRoleConfig.label}
				</div>
			</div>
		</div>

		<!-- Search Pill Button -->
		<div class="mb-4 px-4">
			<button
				type="button"
				onclick={() => (commandPaletteOpen = true)}
				class="flex h-10 w-full cursor-pointer items-center justify-between rounded-full border border-stone-200/80 bg-white/70 px-3.5 text-[13px] text-stone-400 shadow-xs transition hover:bg-white hover:text-stone-700"
			>
				<div class="flex items-center gap-2">
					<Search size={14} />
					<span>Пошук...</span>
				</div>
				<span
					class="rounded border border-stone-200 bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-stone-500"
				>
					⌘ K
				</span>
			</button>
		</div>

		<!-- Section label -->
		<div class="mb-2 px-5 text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">
			Робочий простір
		</div>

		<!-- Nav Items List -->
		<nav class="flex-1 space-y-1 px-3">
			{#each currentRoleConfig.nav as item}
				{@const isActive = activeTab === item.id}
				{@const IconComponent = item.icon}
				<button
					type="button"
					onclick={() => (activeTab = item.id)}
					class="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-[13.5px] font-medium transition {isActive
						? 'bg-stone-900 text-white shadow-md'
						: 'text-stone-600 hover:bg-white/80 hover:text-stone-900'}"
				>
					<IconComponent size={16} class={isActive ? 'text-white' : 'text-stone-400'} />
					<span>{item.label}</span>
				</button>
			{/each}
		</nav>

		<!-- Bottom User Profile Pill -->
		<div class="mt-auto border-t border-stone-200/60 p-3">
			<div
				class="flex items-center justify-between rounded-2xl border border-stone-200/70 bg-white/80 p-2.5 shadow-xs"
			>
				<div class="flex min-w-0 items-center gap-2.5">
					<div
						class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-[12px] font-bold text-white"
					>
						{currentRoleConfig.avatar}
					</div>
					<div class="min-w-0 leading-tight">
						<div class="truncate text-[13px] font-bold text-stone-900">
							{currentRoleConfig.user}
						</div>
						<div class="truncate font-mono text-[11px] text-stone-400">
							{currentRoleConfig.sub}
						</div>
					</div>
				</div>

				{#if onSignOut}
					<button
						type="button"
						onclick={onSignOut}
						title="Вийти"
						class="cursor-pointer rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
					>
						<LogOut size={16} />
					</button>
				{/if}
			</div>
		</div>
	</aside>

	<!-- Main Layout Area -->
	<div class="flex min-w-0 flex-1 flex-col">
		<!-- Top Bar Header (Matches D:\SELF\src\layouts\Header.tsx) -->
		<header
			class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-stone-200/70 bg-white/60 px-6 backdrop-blur-xl"
		>
			<!-- Breadcrumbs -->
			<div class="flex items-center gap-2 text-[13.5px]">
				<span class="text-stone-400">Rahunok / {currentRoleConfig.label}</span>
				<span class="font-bold text-stone-900 capitalize">
					{currentRoleConfig.nav.find((n) => n.id === activeTab)?.label || 'Головна'}
				</span>
			</div>

			<!-- Right tools: Role switcher, mode toggle, lang, notifs -->
			<div class="flex items-center gap-3">
				<!-- Quick Role Selector Dropdown -->
				<div class="relative">
					<select
						value={currentRole}
						onchange={(e) => selectRole(e.currentTarget.value as Dac7Role)}
						class="h-9 cursor-pointer appearance-none rounded-full border border-stone-200 bg-white/80 pr-8 pl-3.5 text-[12.5px] font-semibold text-stone-800 shadow-xs transition outline-none hover:bg-white"
					>
						<option value="seller">Самозайнятий (Олексій)</option>
						<option value="platform">Платформа (Bolt Food)</option>
						<option value="admin">Адміністратор прав</option>
						<option value="gov">Держава (ДПС / Мінфін)</option>
						<option value="dev">Розробник платформи</option>
						<option value="sso">Rahunok ID (Дія.Підпис)</option>
						<option value="passport">Passkeys & pinPay</option>
						<option value="business">Бізнес (Мерчант)</option>
					</select>
					<ChevronDown
						size={14}
						class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-stone-400"
					/>
				</div>

				<!-- Mode badge toggle (Matches Screenshot 1 & 2) -->
				<button
					type="button"
					onclick={() => (isDemoMode = !isDemoMode)}
					class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold shadow-xs transition {isDemoMode
						? 'border-emerald-300 bg-emerald-50 text-emerald-800'
						: 'border-blue-300 bg-blue-50 text-blue-800'}"
				>
					<span
						class="size-1.5 rounded-full {isDemoMode
							? 'bg-emerald-500'
							: 'animate-pulse bg-blue-600'}"
					></span>
					<span>{isDemoMode ? 'Режим: Demo' : 'Live Sync'}</span>
				</button>

				<!-- Language button (Matches UK button with globe) -->
				<button
					type="button"
					class="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white/80 px-2.5 py-1 text-[12px] font-semibold text-stone-700 shadow-xs transition hover:bg-white"
				>
					<Globe size={13} class="text-stone-400" />
					<span>UK</span>
				</button>

				<!-- Inbox notification icon with green dot (Matches Screenshot 2) -->
				<div class="relative">
					<button
						type="button"
						onclick={() => (notifOpen = !notifOpen)}
						class="relative flex size-8 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white/80 text-stone-500 shadow-xs transition hover:bg-white hover:text-stone-900"
					>
						<Inbox size={15} />
						<span
							class="absolute -top-0.5 -right-0.5 size-2 rounded-full border-2 border-white bg-emerald-500"
						></span>
					</button>

					{#if notifOpen}
						<div
							class="animate-fadeIn absolute top-full right-0 z-50 mt-2 w-80 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl"
						>
							<div
								class="mb-2 px-2 text-[11px] font-semibold tracking-wider text-stone-400 uppercase"
							>
								Сповіщення
							</div>
							<div class="space-y-2 text-xs">
								<div class="rounded-xl bg-stone-50 p-2.5">
									<div class="font-semibold text-stone-900">Батч 02.07 заплановано о 21:00</div>
									<div class="mt-0.5 text-stone-500">501 ₴ на картку Монобанк</div>
								</div>
								<div class="rounded-xl bg-emerald-50 p-2.5 text-emerald-900">
									<div class="font-semibold">Верифікація Дія.Підпис успішна</div>
									<div class="mt-0.5 text-emerald-700">РНОКПП підтверджено без обмежень</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</header>

		<!-- Main Workspace Area -->
		<main class="mx-auto w-full max-w-7xl flex-1 p-6 md:p-8">
			{#if currentRole === 'seller'}
				<SellerCabinet
					{gateway}
					demo={isDemoMode}
					{activeTab}
					onNavigate={(tab: string) => (activeTab = tab)}
				/>
			{:else if currentRole === 'platform'}
				<PlatformConsole
					{gateway}
					demo={isDemoMode}
					{activeTab}
					onNavigate={(tab: string) => (activeTab = tab)}
				/>
			{:else if currentRole === 'admin'}
				<AdminRoleManager {gateway} bind:currentRole demo={isDemoMode} />
			{:else if currentRole === 'gov'}
				<GovAuditor {gateway} demo={isDemoMode} />
			{:else if currentRole === 'dev'}
				<DevExplorer {activeTab} />
			{:else if currentRole === 'sso'}
				<SsoDiiaHub {gateway} demo={isDemoMode} {activeTab} />
			{:else if currentRole === 'passport'}
				<PassportPinPay {gateway} demo={isDemoMode} {activeTab} />
			{:else if currentRole === 'business'}
				<BusinessWorkspace {gateway} demo={isDemoMode} {activeTab} />
			{/if}
		</main>

		<!-- Subtle Footer -->
		<footer class="border-t border-stone-200/50 px-8 py-4 text-[12px] text-stone-400">
			Rahunok Network © 2026: {currentRoleConfig.who} · доступ обмежено правами · ⌘K — пошук і навігація
			· {isDemoMode ? 'дані синтетичні' : 'підключено до Supabase'}
		</footer>
	</div>

	<!-- Interactive ⌘K Command Palette -->
	<CommandPalette
		bind:open={commandPaletteOpen}
		onClose={() => (commandPaletteOpen = false)}
		onSelectRole={selectRole}
		onNavigate={(tab) => (activeTab = tab)}
	/>
</div>
