<script lang="ts">
	import { tick } from 'svelte';
	import {
		Calculator,
		ChevronUp,
		Coffee,
		Delete,
		Minus,
		Plus,
		ReceiptText,
		Search,
		ShoppingBasket,
		Trash2,
		Truck,
		Utensils,
		UserRound,
		X
	} from '@lucide/svelte';
	import type { PosBoard, PosTerminal } from '../types';
	import { formatMoney } from '../utils/format';
	import { getPosDraftTotal, type PosDraft, type PosDraftAction } from './pos-drafts';
	import { buildLegacyPosOrderInsert } from './pos-order-contract';

	let {
		merchantId,
		board,
		terminal,
		draft,
		onaction,
		onselectterminal,
		onsubmit,
		onclose
	}: {
		merchantId: string;
		board: PosBoard;
		terminal: PosTerminal;
		draft: PosDraft;
		onaction: (action: PosDraftAction) => void;
		onselectterminal: (terminalId: string) => void;
		onsubmit: () => Promise<void>;
		onclose: () => void;
	} = $props();

	let mode = $state<'amount' | 'products'>('amount');
	let category = $state('Усі');
	let search = $state('');
	let mobileReceiptOpen = $state(false);
	let openReceiptButton: HTMLButtonElement;
	let mobileReceipt = $state<HTMLElement>();
	let closeReceiptButton: HTMLButtonElement;
	let submitting = $state(false);
	let submitError = $state<string | null>(null);
	const total = $derived(getPosDraftTotal(draft));
	const orderContract = $derived(buildLegacyPosOrderInsert(merchantId, terminal, draft));
	const itemCount = $derived(draft.items.reduce((count, item) => count + item.quantity, 0));
	const servicePoints = $derived(
		board.terminals.filter((item) => item.type === 'table' || item.type === 'kasa')
	);
	const keys = ['7', '8', '9', '⌫', '4', '5', '6', '+', '1', '2', '3', '−', '00', '0', '.', '='];
	const categories = ['Усі', 'Кава', 'Їжа', 'Напої'];
	const products = [
		{
			id: 'coffee-cappuccino',
			name: 'Капучино',
			price: 150,
			category: 'Кава',
			tone: 'bg-amber-100'
		},
		{
			id: 'coffee-americano',
			name: 'Американо',
			price: 80,
			category: 'Кава',
			tone: 'bg-orange-100'
		},
		{ id: 'coffee-latte', name: 'Лате', price: 140, category: 'Кава', tone: 'bg-yellow-100' },
		{ id: 'bakery-croissant', name: 'Круасан', price: 95, category: 'Їжа', tone: 'bg-rose-100' },
		{ id: 'drink-tea', name: 'Чайник чаю', price: 120, category: 'Напої', tone: 'bg-emerald-100' },
		{ id: 'food-sandwich', name: 'Сендвіч', price: 180, category: 'Їжа', tone: 'bg-sky-100' }
	];
	const filteredProducts = $derived(
		products.filter(
			(product) =>
				(category === 'Усі' || product.category === category) &&
				product.name.toLocaleLowerCase('uk-UA').includes(search.trim().toLocaleLowerCase('uk-UA'))
		)
	);

	async function submitOrder() {
		if (!orderContract.ok || submitting) return;
		submitting = true;
		submitError = null;
		try {
			await onsubmit();
		} catch (error) {
			submitError = error instanceof Error ? error.message : 'Не вдалося створити замовлення.';
			submitting = false;
		}
	}

	$effect(() => {
		if (!mobileReceiptOpen) return;

		const previousOverflow = document.body.style.overflow;
		const handleKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				mobileReceiptOpen = false;
				return;
			}
			if (event.key !== 'Tab') return;
			if (!mobileReceipt) return;

			const focusable = Array.from(
				mobileReceipt.querySelectorAll<HTMLElement>(
					'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
		};

		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', handleKeydown);
		void tick().then(() => closeReceiptButton.focus());

		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener('keydown', handleKeydown);
			openReceiptButton?.focus();
		};
	});
</script>

{#snippet receipt()}
	<div class="flex h-full min-h-0 flex-col">
		<div class="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
			<div>
				<h3 class="text-sm font-extrabold">Поточне замовлення</h3>
				<p class="mt-0.5 text-xs text-zinc-500">
					{itemCount ? `${itemCount} поз.` : 'Без товарів'}
				</p>
			</div>
			<div class="flex items-center gap-1">
				<button
					type="button"
					onclick={() => onaction({ type: 'clear' })}
					class="grid size-10 place-items-center rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
					disabled={!draft.items.length && total === 0}
					aria-label="Очистити замовлення"
				>
					<Trash2 size={18} aria-hidden="true" />
				</button>
				<button
					bind:this={closeReceiptButton}
					type="button"
					onclick={() => (mobileReceiptOpen = false)}
					class="grid size-10 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 md:hidden"
					aria-label="Закрити поточне замовлення"
				>
					<X size={18} aria-hidden="true" />
				</button>
			</div>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
			{#if draft.items.length}
				<ul class="space-y-4">
					{#each draft.items as item (item.id)}
						<li class="flex items-center gap-3">
							<span
								class="grid size-11 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-600"
							>
								<Utensils size={17} aria-hidden="true" />
							</span>
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-bold">{item.name}</p>
								<p class="mt-0.5 text-xs text-zinc-500">{formatMoney(item.price)}</p>
							</div>
							<div class="flex h-10 items-center rounded-md border border-zinc-200 bg-white">
								<button
									type="button"
									onclick={() => onaction({ type: 'change-quantity', itemId: item.id, delta: -1 })}
									class="grid size-10 place-items-center"
									aria-label="Зменшити кількість {item.name}"
									><Minus size={15} aria-hidden="true" /></button
								>
								<span class="w-7 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
								<button
									type="button"
									onclick={() => onaction({ type: 'change-quantity', itemId: item.id, delta: 1 })}
									class="grid size-10 place-items-center"
									aria-label="Збільшити кількість {item.name}"
									><Plus size={15} aria-hidden="true" /></button
								>
							</div>
						</li>
					{/each}
				</ul>
			{:else}
				<div class="grid min-h-52 place-items-center text-center">
					<div>
						<span
							class="mx-auto grid size-12 place-items-center rounded-full bg-zinc-100 text-zinc-500"
							><ReceiptText size={20} aria-hidden="true" /></span
						>
						<p class="mt-3 text-sm font-bold">Замовлення порожнє</p>
						<p class="mt-1 max-w-48 text-xs leading-5 text-zinc-500">
							Оберіть товар або введіть довільну суму.
						</p>
					</div>
				</div>
			{/if}
		</div>

		<div class="border-t border-zinc-200 bg-white p-5">
			<label class="sr-only" for="pos-checkout-memo">Примітка до замовлення</label>
			<input
				id="pos-checkout-memo"
				value={draft.memo}
				oninput={(event) => onaction({ type: 'set-memo', memo: event.currentTarget.value })}
				class="h-11 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
				placeholder="Додати примітку"
			/>
			<div class="mt-5 flex items-center justify-between gap-4">
				<span class="text-sm font-bold">Разом</span>
				<strong data-testid="pos-draft-total" class="text-2xl font-extrabold tabular-nums"
					>{formatMoney(total)}</strong
				>
			</div>
			<button
				type="button"
				disabled={!orderContract.ok || submitting}
				onclick={submitOrder}
				class="mt-4 h-14 w-full rounded-md bg-[#1769e0] px-4 text-sm font-extrabold text-white disabled:bg-zinc-200 disabled:text-zinc-500"
			>
				{submitting
					? 'Створюємо…'
					: orderContract.ok
						? 'Створити замовлення'
						: 'Додайте суму або товар'}
			</button>
			{#if submitError}<p class="mt-3 text-xs text-red-700" role="alert">{submitError}</p>{/if}
		</div>
	</div>
{/snippet}

{#snippet servicePanel()}
	<aside
		class="hidden min-h-0 flex-col border-r border-zinc-200 bg-white xl:flex"
		aria-label="Столи та обслуговування"
	>
		<div class="min-h-0 flex-1 overflow-y-auto p-4">
			<div class="flex items-center justify-between gap-3">
				<h3 class="text-sm font-extrabold">Столи та каси</h3>
				<span class="text-xs font-semibold text-zinc-500">{servicePoints.length}</span>
			</div>
			<div class="mt-3 space-y-2">
				{#each servicePoints as servicePoint (servicePoint.id)}
					{@const activeOrder = board.activeOrders.find(
						(order) => order.terminalId === servicePoint.id
					)}
					<button
						type="button"
						onclick={() => onselectterminal(servicePoint.id)}
						aria-pressed={servicePoint.id === terminal.id}
						class="flex min-h-16 w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left {servicePoint.id ===
						terminal.id
							? 'border-blue-500 bg-blue-50'
							: 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50'}"
					>
						<span class="min-w-0">
							<strong class="block truncate text-sm">{servicePoint.name}</strong>
							<span class="mt-1 block text-xs text-zinc-500">
								{activeOrder
									? 'Активне замовлення'
									: servicePoint.type === 'kasa'
										? 'Каса'
										: 'Вільний стіл'}
							</span>
						</span>
						<strong
							class="shrink-0 text-sm tabular-nums {activeOrder
								? 'text-zinc-950'
								: 'text-zinc-400'}"
						>
							{activeOrder ? formatMoney(activeOrder.amount) : '0,00 ₴'}
						</strong>
					</button>
				{/each}
			</div>
		</div>

		<div class="space-y-3 border-t border-zinc-200 p-4" aria-label="Виконавці замовлення">
			<div>
				<label
					for="pos-waiter"
					class="mb-1.5 flex items-center gap-2 text-xs font-bold text-zinc-700"
				>
					<UserRound size={15} aria-hidden="true" /> Офіціант
				</label>
				<select
					id="pos-waiter"
					disabled
					class="h-11 w-full rounded-md border border-zinc-200 bg-zinc-100 px-3 text-sm text-zinc-500 disabled:cursor-not-allowed"
				>
					<option>Вибір готується</option>
				</select>
				<p class="mt-1.5 text-[0.6875rem] leading-4 text-zinc-500">
					Буде використано для обліку чайових.
				</p>
			</div>
			<div>
				<label
					for="pos-courier"
					class="mb-1.5 flex items-center gap-2 text-xs font-bold text-zinc-700"
				>
					<Truck size={15} aria-hidden="true" /> Кур’єр
				</label>
				<select
					id="pos-courier"
					disabled
					class="h-11 w-full rounded-md border border-zinc-200 bg-zinc-100 px-3 text-sm text-zinc-500 disabled:cursor-not-allowed"
				>
					<option>Вибір готується</option>
				</select>
				<p class="mt-1.5 text-[0.6875rem] leading-4 text-zinc-500">
					Буде використано для доставки замовлення.
				</p>
			</div>
		</div>
	</aside>
{/snippet}

<section
	aria-label="Чернетка замовлення"
	class="fixed inset-x-0 top-18 bottom-0 z-20 flex min-h-0 flex-col overflow-hidden bg-[#f5f6f7]"
>
	<header
		class="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 sm:px-5"
	>
		<div class="flex min-w-0 items-center gap-3">
			<span
				class="grid size-10 shrink-0 place-items-center rounded-md bg-[#e9f2ff] font-black text-[#1769e0]"
				>{terminal.name.slice(0, 1)}</span
			>
			<div class="min-w-0">
				<h2 class="truncate text-sm font-extrabold">{terminal.name}</h2>
				<p class="mt-0.5 text-xs text-zinc-500">Нове замовлення · {terminal.code}</p>
			</div>
		</div>
		<button
			type="button"
			onclick={onclose}
			class="grid size-11 shrink-0 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
			aria-label="Закрити чернетку"><X size={19} aria-hidden="true" /></button
		>
	</header>

	<div
		class="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[17.5rem_minmax(0,1fr)_25rem]"
	>
		{@render servicePanel()}
		<div class="min-h-0 overflow-y-auto px-4 pt-4 pb-28 sm:px-5 md:pb-6">
			<div class="mx-auto max-w-4xl">
				<div class="grid grid-cols-2 rounded-md bg-zinc-200/70 p-1" aria-label="Режим чернетки">
					<button
						type="button"
						onclick={() => (mode = 'amount')}
						class="flex h-11 items-center justify-center gap-2 rounded-sm text-sm font-bold {mode ===
						'amount'
							? 'bg-white text-zinc-950 shadow-sm'
							: 'text-zinc-600'}"><Calculator size={17} aria-hidden="true" /> Сума</button
					>
					<button
						type="button"
						onclick={() => (mode = 'products')}
						class="flex h-11 items-center justify-center gap-2 rounded-sm text-sm font-bold {mode ===
						'products'
							? 'bg-white text-zinc-950 shadow-sm'
							: 'text-zinc-600'}"><ShoppingBasket size={17} aria-hidden="true" /> Товари</button
					>
				</div>

				{#if mode === 'amount'}
					<div class="mx-auto mt-5 max-w-lg">
						<div class="min-h-28 border-b border-zinc-300 px-2 py-3 text-right">
							<p class="h-5 truncate text-xs font-medium text-zinc-500">
								{draft.formula || 'Довільна сума'}
							</p>
							<p class="mt-2 text-4xl font-extrabold tabular-nums sm:text-5xl">
								{draft.inputAmount}
							</p>
						</div>
						<div class="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
							{#each keys as key (key)}
								<button
									type="button"
									onclick={() => onaction({ type: 'press-key', key })}
									class="grid h-14 place-items-center rounded-md border border-zinc-200 bg-white text-lg font-extrabold shadow-sm active:scale-[0.98] active:bg-zinc-100 sm:h-16"
									class:text-[#1769e0]={['+', '−', '='].includes(key)}
									aria-label={key === '⌫' ? 'Видалити цифру' : key}
								>
									{#if key === '⌫'}<Delete size={21} aria-hidden="true" />{:else}{key}{/if}
								</button>
							{/each}
						</div>
						<div class="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
							{#each [50, 100, 500] as amount (amount)}
								<button
									type="button"
									onclick={() => onaction({ type: 'add-amount', amount })}
									class="h-12 rounded-md bg-[#e9f2ff] text-sm font-extrabold text-[#1769e0] active:scale-[0.98]"
									>+{amount}</button
								>
							{/each}
						</div>
					</div>
				{:else}
					<div class="mt-5">
						<label class="relative block">
							<span class="sr-only">Пошук товарів</span>
							<Search
								size={18}
								class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-zinc-400"
								aria-hidden="true"
							/>
							<input
								type="search"
								bind:value={search}
								placeholder="Пошук товарів"
								class="h-12 w-full rounded-md border border-zinc-200 bg-white pr-4 pl-11 text-sm outline-none focus:border-[#1769e0]"
							/>
						</label>
						<div
							class="mt-3 flex scrollbar-none gap-2 overflow-x-auto pb-1"
							aria-label="Категорії товарів"
						>
							{#each categories as productCategory (productCategory)}
								<button
									type="button"
									onclick={() => (category = productCategory)}
									class="h-10 shrink-0 rounded-full px-4 text-sm font-bold {category ===
									productCategory
										? 'bg-zinc-950 text-white'
										: 'border border-zinc-200 bg-white text-zinc-600'}">{productCategory}</button
								>
							{/each}
						</div>
						<div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
							{#each filteredProducts as product (product.id)}
								<button
									type="button"
									onclick={() => onaction({ type: 'add-item', item: product })}
									class="flex min-h-32 flex-col justify-between rounded-md border border-zinc-200 bg-white p-3 text-left shadow-sm active:scale-[0.98] sm:min-h-36 sm:p-4"
								>
									<span
										class="grid size-10 place-items-center rounded-md {product.tone} text-zinc-700"
										><Coffee size={18} aria-hidden="true" /></span
									>
									<span
										><span class="block text-sm font-extrabold">{product.name}</span><span
											class="mt-1 block text-xs font-semibold text-zinc-500"
											>{formatMoney(product.price)}</span
										></span
									>
								</button>
							{:else}
								<p class="col-span-full py-14 text-center text-sm text-zinc-500">
									Товарів не знайдено
								</p>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		<aside class="hidden min-h-0 border-l border-zinc-200 bg-white md:block">
			{@render receipt()}
		</aside>
	</div>

	<button
		bind:this={openReceiptButton}
		type="button"
		onclick={() => (mobileReceiptOpen = true)}
		class="absolute inset-x-3 bottom-3 flex h-16 items-center justify-between rounded-lg bg-zinc-950 px-5 text-white shadow-xl md:hidden"
		aria-label="Відкрити поточне замовлення"
	>
		<span class="flex items-center gap-3"
			><span class="grid size-9 place-items-center rounded-md bg-white/10"
				><ShoppingBasket size={18} aria-hidden="true" /></span
			><span class="text-left"
				><span class="block text-xs text-zinc-400"
					>{itemCount ? `${itemCount} поз.` : 'Поточне замовлення'}</span
				><strong class="mt-0.5 block text-base tabular-nums">{formatMoney(total)}</strong></span
			></span
		>
		<ChevronUp size={19} aria-hidden="true" />
	</button>

	{#if mobileReceiptOpen}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-zinc-950/45 md:hidden"
			aria-label="Закрити поточне замовлення"
			onclick={() => (mobileReceiptOpen = false)}
		></button>
		<div
			bind:this={mobileReceipt}
			class="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] overflow-hidden rounded-t-lg bg-white md:hidden"
			aria-label="Поточне замовлення"
			aria-modal="true"
			role="dialog"
		>
			<div class="flex justify-center py-2">
				<span class="h-1 w-10 rounded-full bg-zinc-300"></span>
			</div>
			<div class="max-h-[calc(82vh-1rem)] overflow-y-auto">{@render receipt()}</div>
		</div>
	{/if}
</section>

<style>
	.scrollbar-none {
		scrollbar-width: none;
	}
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
</style>
