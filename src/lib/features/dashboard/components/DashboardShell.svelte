<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import logoUrl from '../../../../../logo.svg?url';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import {
		ArrowDown01Icon,
		Building03Icon,
		Cancel01Icon,
		CircleDollarSignIcon,
		CodeIcon,
		DashboardSquare01Icon,
		Invoice01Icon,
		Logout01Icon,
		MailSend01Icon,
		Menu01Icon,
		Notification02Icon,
		Package01Icon,
		PanelLeftCloseIcon,
		RepeatIcon,
		RestaurantTableIcon,
		Scroll01Icon,
		Settings01Icon,
		Store01Icon,
		UserGroupIcon,
		WalletCardsIcon,
		WebDesign01Icon
	} from '@hugeicons/core-free-icons';

	let {
		children,
		merchantName,
		activeSection = 'overview',
		demo = false,
		onSignOut
	}: {
		children: Snippet;
		merchantName: string;
		activeSection?: 'overview' | 'invoices' | 'invoice-rules' | 'payment-methods' | 'public-page' | 'pos' | 'settings' | 'structure' | 'team' | 'developer-api';
		demo?: boolean;
		onSignOut: () => Promise<void>;
	} = $props();
	let menuOpen = $state(false);
	let isDesktop = $state(false);
	let openMenuButton: HTMLButtonElement;
	let closeMenuButton: HTMLButtonElement;
	let mobileNavigation: HTMLElement;
	let signingOut = $state(false);
	let signOutError = $state(false);
	let invoicesExpanded = $state(true);

	const invoiceScenarios = [
		{ type: 'fixed', name: 'Фіксований рахунок', description: 'Інтернет-магазин, послуги, рахунок на суму', icon: Invoice01Icon, available: true },
		{ type: 'open_amount', name: 'Вільна сума', description: 'Клієнт сам вказує суму: каса або донат', icon: CircleDollarSignIcon, available: true },
		{ type: 'table', name: 'Рахунок за столиком', description: 'Ресторан, номер столика та чайові', icon: RestaurantTableIcon, available: true },
		{ type: 'delivery', name: 'Нова пошта / Доставка', description: 'Відділення, поштамат і розрахунок', icon: Package01Icon, available: true },
		{ type: 'recurring', name: 'Рекурентний платіж', description: 'Задана сума з повторенням за розкладом', icon: RepeatIcon, available: false },
		{ type: 'rtp', name: 'RTP-запит', description: 'Запит постійному клієнту за його ідентифікатором', icon: MailSend01Icon, available: false }
	] as const;

	function containFocus(event: KeyboardEvent, container: HTMLElement) {
		if (event.key !== 'Tab') return;
		const focusable = Array.from(
			container.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		).filter((element) => !element.hidden);
		const first = focusable[0];
		const last = focusable.at(-1);
		if (!first || !last) return;

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	onMount(() => {
		const mediaQuery = window.matchMedia('(min-width: 1024px)');
		const updateViewport = () => (isDesktop = mediaQuery.matches);

		updateViewport();
		mediaQuery.addEventListener('change', updateViewport);
		const handleShortcut = (event: KeyboardEvent) => {
			if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
			if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select, [contenteditable="true"]')) return;
			const destinations: Record<string, string> = {
				'1': '/dashboard', '2': '/dashboard/pos', '3': '/dashboard/invoices', n: '/dashboard/invoices/new'
			};
			const destination = destinations[event.key.toLowerCase()];
			if (!destination) return;
			event.preventDefault();
			void goto(resolve(`${destination}${demo ? '?demo=1' : ''}` as '/'));
		};
		document.addEventListener('keydown', handleShortcut);

		return () => {
			mediaQuery.removeEventListener('change', updateViewport);
			document.removeEventListener('keydown', handleShortcut);
		};
	});

	async function signOut() {
		if (signingOut) return;
		signingOut = true;
		signOutError = false;
		try { await onSignOut(); }
		catch { signOutError = true; signingOut = false; }
	}

	$effect(() => {
		if (!menuOpen) return;

		const previousOverflow = document.body.style.overflow;
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				menuOpen = false;
				return;
			}
			containFocus(event, mobileNavigation);
		};

		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', handleKeydown);
		void tick().then(() => closeMenuButton.focus());

		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener('keydown', handleKeydown);
			openMenuButton?.focus();
		};
	});

	$effect(() => {
		if (activeSection === 'invoices') invoicesExpanded = true;
	});
</script>

<div class="dashboard-root min-h-screen bg-[#f6f7f8] text-zinc-950">
	{#if menuOpen}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-zinc-950/45 lg:hidden"
			aria-label="Закрити навігацію"
			onclick={() => (menuOpen = false)}
		></button>
	{/if}

	<aside
		bind:this={mobileNavigation}
		class:translate-x-0={menuOpen}
		class="fixed inset-y-0 left-0 z-50 flex w-[17.5rem] -translate-x-full flex-col border-r border-zinc-800 bg-[#111313] text-white transition-transform duration-200 lg:translate-x-0"
		aria-hidden={!isDesktop && !menuOpen}
		inert={!isDesktop && !menuOpen}
	>
		<div class="flex h-18 items-center justify-between border-b border-white/10 px-5">
			<a href={resolve('/')} class="flex items-center gap-2.5" aria-label="Rahunok, на головну">
				<span class="grid size-8 place-items-center overflow-hidden rounded-md bg-[#c9ff4a]">
					<img src={logoUrl} alt="" class="size-8" aria-hidden="true" />
				</span>
				<span class="text-base font-extrabold">Rahunok</span>
			</a>
			<button
				bind:this={closeMenuButton}
				type="button"
				class="grid size-9 place-items-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white lg:hidden"
				aria-label="Закрити навігацію"
				onclick={() => (menuOpen = false)}
			>
				<HugeiconsIcon icon={Cancel01Icon} size={19} aria-hidden="true" />
			</button>
		</div>

		<nav class="flex-1 overflow-y-auto px-3 py-5" aria-label="Основна навігація">
			<p class="px-3 pb-2 text-[0.625rem] font-bold tracking-[0.14em] text-zinc-500 uppercase">
				Робочий простір
			</p>
			<a
				href={resolve(demo ? '/dashboard?demo=1' : '/dashboard')}
				onclick={() => (menuOpen = false)}
				aria-current={activeSection === 'overview' ? 'page' : undefined}
				class:nav-active={activeSection === 'overview'}
				class="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-bold text-zinc-400 hover:text-white"
			>
				<HugeiconsIcon icon={DashboardSquare01Icon} size={17} aria-hidden="true" />
				Огляд
			</a>
			<a
				href={resolve(demo ? '/dashboard/pos?demo=1' : '/dashboard/pos')}
				onclick={() => (menuOpen = false)}
				aria-current={activeSection === 'pos' ? 'page' : undefined}
				class:nav-active={activeSection === 'pos'}
				class="mt-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-zinc-400 hover:text-white"
			>
				<HugeiconsIcon icon={Store01Icon} size={17} aria-hidden="true" />
				Каса
			</a>
			<div class="mt-1">
				<div
					class:nav-active={activeSection === 'invoices'}
					class="flex h-10 items-center rounded-md text-zinc-400"
				>
					<a
						href={resolve(demo ? '/dashboard/invoices?demo=1' : '/dashboard/invoices')}
						onclick={() => (menuOpen = false)}
						aria-current={activeSection === 'invoices' ? 'page' : undefined}
						class="flex min-w-0 flex-1 items-center gap-3 self-stretch px-3 text-sm font-semibold hover:text-white"
					>
						<HugeiconsIcon icon={Invoice01Icon} size={17} aria-hidden="true" />
						Рахунки
					</a>
					<button
						type="button"
						class="grid size-10 shrink-0 place-items-center rounded-md hover:bg-white/10 hover:text-white"
						aria-label={invoicesExpanded ? 'Згорнути типи рахунків' : 'Розгорнути типи рахунків'}
						aria-expanded={invoicesExpanded}
						aria-controls="invoice-scenarios"
						onclick={() => (invoicesExpanded = !invoicesExpanded)}
					>
						<HugeiconsIcon
							icon={ArrowDown01Icon}
							size={16}
							className={`transition-transform ${invoicesExpanded ? 'rotate-180' : ''}`}
							aria-hidden="true"
						/>
					</button>
				</div>

				{#if invoicesExpanded}
					<div id="invoice-scenarios" class="mt-1 space-y-0.5 border-l border-white/10 py-1 pl-3">
						{#each invoiceScenarios as item (item.type)}
							<a
								href={resolve(`/dashboard/invoices/new?type=${item.type}${demo ? '&demo=1' : ''}` as '/')}
								onclick={() => (menuOpen = false)}
								class="group flex min-h-14 items-start gap-2.5 rounded-md px-2.5 py-2 text-zinc-400 hover:bg-white/7 hover:text-white"
							>
								<HugeiconsIcon icon={item.icon} size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
								<span class="min-w-0 flex-1">
									<span class="flex items-center gap-2 text-xs font-bold">
										{item.name}
										{#if !item.available}<span class="rounded bg-zinc-800 px-1 py-0.5 text-[0.5rem] text-zinc-500">СКОРО</span>{/if}
									</span>
									<span class="mt-0.5 block text-[0.625rem] leading-4 text-zinc-600 group-hover:text-zinc-400">{item.description}</span>
								</span>
							</a>
						{/each}
					</div>
				{/if}
			</div>

			<p class="mt-7 px-3 pb-2 text-[0.625rem] font-bold tracking-[0.14em] text-zinc-500 uppercase">
				Керування
			</p>
			<a
				href={resolve(demo ? '/dashboard/structure?demo=1' : '/dashboard/structure')}
				onclick={() => (menuOpen = false)}
				aria-current={activeSection === 'structure' ? 'page' : undefined}
				class:nav-active={activeSection === 'structure'}
				class="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-zinc-400 hover:text-white"
			>
				<HugeiconsIcon icon={Building03Icon} size={17} aria-hidden="true" />
				Структура бізнесу
			</a>
			<a
				href={resolve(demo ? '/dashboard/invoice-rules?demo=1' : '/dashboard/invoice-rules')}
				onclick={() => (menuOpen = false)}
				aria-current={activeSection === 'invoice-rules' ? 'page' : undefined}
				class:nav-active={activeSection === 'invoice-rules'}
				class="mt-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-zinc-400 hover:text-white"
			>
				<HugeiconsIcon icon={Scroll01Icon} size={17} aria-hidden="true" />
				Правила рахунків
			</a>
			<a
				href={resolve(demo ? '/dashboard/payment-methods?demo=1' : '/dashboard/payment-methods')}
				onclick={() => (menuOpen = false)}
				aria-current={activeSection === 'payment-methods' ? 'page' : undefined}
				class:nav-active={activeSection === 'payment-methods'}
				class="mt-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-zinc-400 hover:text-white"
			>
				<HugeiconsIcon icon={WalletCardsIcon} size={17} aria-hidden="true" />
				Способи оплати
			</a>
			<a
				href={resolve(demo ? '/dashboard/public-page?demo=1' : '/dashboard/public-page')}
				onclick={() => (menuOpen = false)}
				aria-current={activeSection === 'public-page' ? 'page' : undefined}
				class:nav-active={activeSection === 'public-page'}
				class="mt-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-zinc-400 hover:text-white"
			>
				<HugeiconsIcon icon={WebDesign01Icon} size={17} aria-hidden="true" />
				Публічний профіль
			</a>
			<a
				href={resolve(demo ? '/dashboard/team?demo=1' : '/dashboard/team')}
				onclick={() => (menuOpen = false)}
				aria-current={activeSection === 'team' ? 'page' : undefined}
				class:nav-active={activeSection === 'team'}
				class="mt-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-zinc-400 hover:text-white"
			>
				<HugeiconsIcon icon={UserGroupIcon} size={17} aria-hidden="true" />
				Команда й касири
				<span class="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-[0.5625rem] text-zinc-400">СКОРО</span>
			</a>
			<a
				href={resolve(demo ? '/dashboard/developer-api?demo=1' : '/dashboard/developer-api')}
				onclick={() => (menuOpen = false)}
				aria-current={activeSection === 'developer-api' ? 'page' : undefined}
				class:nav-active={activeSection === 'developer-api'}
				class="mt-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-zinc-400"
			>
				<HugeiconsIcon icon={CodeIcon} size={17} aria-hidden="true" />
				Розробникам
			</a>
			<a
				href={resolve(demo ? '/dashboard/settings?demo=1' : '/dashboard/settings')}
				onclick={() => (menuOpen = false)}
				aria-current={activeSection === 'settings' ? 'page' : undefined}
				class:nav-active={activeSection === 'settings'}
				class="mt-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-zinc-400"
			>
				<HugeiconsIcon icon={Settings01Icon} size={17} aria-hidden="true" />
				Налаштування
			</a>
		</nav>

		<div class="border-t border-white/10 p-3">
			<button
				type="button"
				disabled={signingOut}
				onclick={signOut}
				class="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-white/10 disabled:opacity-60"
			>
				<span class="grid size-9 place-items-center rounded-md bg-zinc-800 text-xs font-extrabold"
					>RC</span
				>
				<span class="min-w-0 flex-1">
					<span class="block truncate text-xs font-bold">{merchantName}</span>
					<span class="mt-0.5 block text-[0.6875rem] text-zinc-500">Власник</span>
				</span>
				<HugeiconsIcon icon={Logout01Icon} size={16} className="text-zinc-500" aria-hidden="true" />
			</button>
			{#if signOutError}<p class="px-2 pb-1 text-xs text-red-300" role="alert">Не вдалося вийти. Спробуйте ще раз.</p>{/if}
		</div>
	</aside>

	<div class="min-h-screen lg:pl-[17.5rem]">
		<header
			class="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-zinc-200 bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:px-8"
		>
			<div class="flex min-w-0 items-center gap-3">
				<button
					bind:this={openMenuButton}
					type="button"
					class="grid size-10 shrink-0 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-700 lg:hidden"
					aria-label="Відкрити навігацію"
					aria-expanded={menuOpen}
					onclick={() => (menuOpen = true)}
				>
					<HugeiconsIcon icon={Menu01Icon} size={19} aria-hidden="true" />
				</button>
				<HugeiconsIcon icon={PanelLeftCloseIcon} size={17} className="hidden text-zinc-400 lg:block" aria-hidden="true" />
				<p class="truncate text-xs font-semibold text-zinc-500">{merchantName}</p>
			</div>
			<div class="flex items-center gap-2">
				<span class="hidden items-center gap-2 text-xs font-semibold text-zinc-500 sm:flex">
					<span class="size-1.5 rounded-full bg-zinc-400"></span>
					{demo ? 'Ознайомчий режим' : 'Supabase'}
				</span>
				<button
					type="button"
					disabled
					title="Сповіщення ще не підключені"
					class="relative grid size-10 place-items-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-400"
					aria-label="Сповіщення ще не підключені"
				>
					<HugeiconsIcon icon={Notification02Icon} size={18} aria-hidden="true" />
				</button>
			</div>
		</header>

		<main class="mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
			{@render children()}
		</main>
	</div>
</div>

<style>
	:global(html:has(.dashboard-root)) {
		background: #f6f7f8;
	}

	:global(body:has(.dashboard-root)) {
		background: #f6f7f8;
		font-family: 'Manrope', sans-serif;
	}

	.dashboard-root :global(button:focus-visible),
	.dashboard-root :global(a:focus-visible) {
		outline: 3px solid rgb(37 99 235 / 35%);
		outline-offset: 2px;
	}

	.nav-active {
		background-color: rgb(255 255 255 / 10%);
		color: white;
	}
</style>
