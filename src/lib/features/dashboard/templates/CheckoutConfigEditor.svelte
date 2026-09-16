<script lang="ts">
	import type { CheckoutScenarioConfig } from '$lib/features/shared/checkout-scenario-config';

	let {
		config = $bindable({}),
		scenario = 'fixed'
	}: {
		config: Partial<CheckoutScenarioConfig>;
		scenario?: string;
	} = $props();
</script>

<div class="pt-2 border-t border-zinc-100">
	<span class="mb-3 block text-xs font-bold uppercase tracking-wider text-zinc-500">Опції екрана платника (UX)</span>

	<!-- Loyalty & Discounts -->
	<p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Лояльність та знижки</p>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
		<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Картка лояльності</strong>
				<span class="text-[11px] text-zinc-500">Сканер Apple Pass & бонуси</span>
			</div>
			<input type="checkbox" bind:checked={config.allow_loyalty} class="size-4.5 accent-blue-600 rounded" />
		</label>
		<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Промокод / знижка</strong>
				<span class="text-[11px] text-zinc-500">Поле введення купона</span>
			</div>
			<input type="checkbox" bind:checked={config.allow_promo} class="size-4.5 accent-blue-600 rounded" />
		</label>
		{#if config.allow_promo}
			<label class="sm:col-span-2">
				<span class="mb-1 block text-xs font-bold text-zinc-600">Сума знижки (₴)</span>
				<input
					type="number"
					bind:value={config.promo_discount}
					min="0"
					step="0.5"
					class="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
				/>
			</label>
		{/if}
	</div>

	<!-- HoReCa -->
	{#if scenario === 'table'}
		<p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">HoReCa / Ресторан</p>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
			<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
				<div>
					<strong class="block text-xs font-semibold text-zinc-900">Чайові гостя</strong>
					<span class="text-[11px] text-zinc-500">Пресети % або фіксовані суми</span>
				</div>
				<input type="checkbox" bind:checked={config.allow_tips} class="size-4.5 accent-blue-600 rounded" />
			</label>
			<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
				<div>
					<strong class="block text-xs font-semibold text-zinc-900">Поділ рахунку</strong>
					<span class="text-[11px] text-zinc-500">Split Bill між гостями</span>
				</div>
				<input type="checkbox" bind:checked={config.allow_split} class="size-4.5 accent-blue-600 rounded" />
			</label>
			<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
				<div>
					<strong class="block text-xs font-semibold text-zinc-900">DAC7 Compliance</strong>
					<span class="text-[11px] text-zinc-500">Фіскалізація та розщеплення</span>
				</div>
				<input type="checkbox" bind:checked={config.allow_compliance_card} class="size-4.5 accent-blue-600 rounded" />
			</label>
		</div>
	{/if}

	<!-- Charity -->
	<p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Благодійність</p>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
		<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Округлення на ЗСУ</strong>
				<span class="text-[11px] text-zinc-500">Благодійний внесок решти</span>
			</div>
			<input type="checkbox" bind:checked={config.allow_roundup} class="size-4.5 accent-blue-600 rounded" />
		</label>
	</div>

	<!-- Order Enhancements -->
	<p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Замовлення</p>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
		<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Order Bump / Upsell</strong>
				<span class="text-[11px] text-zinc-500">Допродаж перед оплатою</span>
			</div>
			<input type="checkbox" bind:checked={config.allow_upsell} class="size-4.5 accent-blue-600 rounded" />
		</label>
		{#if scenario === 'delivery'}
			<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
				<div>
					<strong class="block text-xs font-semibold text-zinc-900">Блок доставки</strong>
					<span class="text-[11px] text-zinc-500">Нова Пошта / кур'єр</span>
				</div>
				<input type="checkbox" bind:checked={config.allow_delivery} class="size-4.5 accent-blue-600 rounded" />
			</label>
		{/if}
	</div>

	<!-- Payment & Post-payment -->
	<p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Оплата та після оплати</p>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
		<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Оплата частинами (BNPL)</strong>
				<span class="text-[11px] text-zinc-500">Розбити суму на 4 платежі</span>
			</div>
			<input type="checkbox" bind:checked={config.allow_bnpl} class="size-4.5 accent-blue-600 rounded" />
		</label>
		<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">Інші способи оплати</strong>
				<span class="text-[11px] text-zinc-500">Показати додаткові банки</span>
			</div>
			<input type="checkbox" bind:checked={config.show_other_banks} class="size-4.5 accent-blue-600 rounded" />
		</label>
		<label class="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer">
			<div>
				<strong class="block text-xs font-semibold text-zinc-900">NPS відгук</strong>
				<span class="text-[11px] text-zinc-500">Оцінка після оплати</span>
			</div>
			<input type="checkbox" bind:checked={config.allow_nps_review} class="size-4.5 accent-blue-600 rounded" />
		</label>
	</div>

	<!-- UI Customization -->
	<p class="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Інтерфейс</p>
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
		<label>
			<span class="mb-1 block text-xs font-bold text-zinc-600">Текст кнопки оплати</span>
			<input
				bind:value={config.cta_text}
				placeholder="Перейти до оплати"
				class="h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-blue-600"
			/>
		</label>
		<label>
			<span class="mb-1 block text-xs font-bold text-zinc-600">Тема чекауту</span>
			<select
				bind:value={config.theme}
				class="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold"
			>
				<option value="dark">Темна</option>
				<option value="light">Світла</option>
			</select>
		</label>
	</div>
</div>
