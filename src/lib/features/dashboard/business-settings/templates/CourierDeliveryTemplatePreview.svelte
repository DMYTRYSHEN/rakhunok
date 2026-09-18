<script lang="ts">
	import {
		Box,
		Clock,
		MapPin,
		Package,
		ShieldCheck,
		Truck,
		Zap
	} from '@lucide/svelte';

	let {
		onPay,
		scenario = 'vertical_delivery'
	}: {
		onPay: (amount: number) => void;
		scenario?: string;
	} = $props();

	type PackageType = {
		id: string;
		title: string;
		subtitle: string;
		price: number;
		icon: string;
	};

	const packageTypes: PackageType[] = [
		{ id: 'docs', title: 'Документи / Лист', subtitle: 'До 0.5 кг у фірмовому конверті', price: 90, icon: '📄' },
		{ id: 'small', title: 'Посилка до 5 кг', subtitle: 'Взуття, техніка, пакунки', price: 140, icon: '📦' },
		{ id: 'cargo', title: 'Вантаж до 25 кг', subtitle: 'Коробки, габаритні товари', price: 280, icon: '🛋️' }
	];

	let selectedTypeId = $state('small');
	let pickupAddress = $state('вул. Антоновича, 45 (під’їзд 2)');
	let dropAddress = $state('вул. Мечникова, 8 (офіс 301)');
	let isExpress = $state(true);
	let phone = $state('+380 50 111 22 33');

	const selectedType = $derived(packageTypes.find((p) => p.id === selectedTypeId) ?? packageTypes[1]);
	const expressFee = $derived(isExpress ? 60 : 0);
	const total = $derived(selectedType.price + expressFee);

	function handlePay() {
		onPay(total);
	}
</script>

<div class="courier-checkout">
	<!-- Route input -->
	<div class="route-box">
		<div class="route-point">
			<span class="pt-dot from"></span>
			<div class="pt-field">
				<span class="pt-lbl">Звідки забрати:</span>
				<input type="text" bind:value={pickupAddress} placeholder="Адреса відправника" />
			</div>
		</div>

		<div class="route-line"></div>

		<div class="route-point">
			<span class="pt-dot to"></span>
			<div class="pt-field">
				<span class="pt-lbl">Куди доставити:</span>
				<input type="text" bind:value={dropAddress} placeholder="Адреса отримувача" />
			</div>
		</div>
	</div>

	<!-- Parcel Types -->
	<div class="section-title">
		<Package size={14} class="text-blue-600" />
		<strong>Тип та габарити вантажу:</strong>
	</div>

	<div class="types-list">
		{#each packageTypes as pt (pt.id)}
			<button
				type="button"
				class="type-card"
				class:selected={pt.id === selectedTypeId}
				onclick={() => (selectedTypeId = pt.id)}
			>
				<span class="type-icon">{pt.icon}</span>
				<div class="type-info">
					<strong>{pt.title}</strong>
					<small>{pt.subtitle}</small>
				</div>
				<span class="type-price">{pt.price} ₴</span>
			</button>
		{/each}
	</div>

	<!-- Speed / Urgency -->
	<div class="urgency-section">
		<label class="urgency-card" class:active={isExpress}>
			<input type="checkbox" bind:checked={isExpress} />
			<div>
				<div class="flex items-center gap-1">
					<Zap size={13} class="text-amber-500" />
					<strong>Експрес доставка (до 60 хв)</strong>
				</div>
				<small>Пряма подача найближчого кур’єра</small>
			</div>
			<span class="urgency-price">+60 ₴</span>
		</label>
	</div>

	<!-- Contact phone -->
	<label class="phone-input">
		<span class="phone-lbl">Номер телефону для зв’язку з кур’єром:</span>
		<input type="text" bind:value={phone} placeholder="+380..." />
	</label>

	<!-- Price Summary & CTA -->
	<div class="summary-box">
		<div class="sum-row">
			<span>Тариф перевезення:</span>
			<strong>{selectedType.price} ₴</strong>
		</div>
		{#if isExpress}
			<div class="sum-row text-amber-700">
				<span>Експрес-подача:</span>
				<strong>+60 ₴</strong>
			</div>
		{/if}
		<div class="sum-row total">
			<span>До сплати:</span>
			<strong>{total} ₴</strong>
		</div>
	</div>

	<button type="button" class="btn-pay" onclick={handlePay}>
		Викликати кур’єра • {total} ₴
	</button>
</div>

<style>
	.courier-checkout {
		padding: 12px 14px 20px;
		display: flex;
		flex-direction: column;
		gap: 11px;
	}
	.route-box {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 10px 12px;
		position: relative;
	}
	.route-point {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.pt-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-top: 14px;
		flex-shrink: 0;
	}
	.pt-dot.from {
		background: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
	}
	.pt-dot.to {
		background: #10b981;
		box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
	}
	.route-line {
		width: 2px;
		height: 16px;
		background: #cbd5e1;
		margin-left: 4px;
		margin-top: -4px;
		margin-bottom: -4px;
	}
	.pt-field {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.pt-lbl {
		font-size: 9px;
		font-weight: 700;
		color: #64748b;
	}
	.pt-field input {
		background: #ffffff;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		padding: 5px 8px;
		font-size: 11px;
		color: #0f172a;
		outline: none;
	}
	.section-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		color: #1e293b;
	}
	.types-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.type-card {
		display: flex;
		align-items: center;
		gap: 10px;
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 8px 12px;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s ease;
	}
	.type-card.selected {
		border-color: #3b82f6;
		background: #eff6ff;
	}
	.type-icon {
		font-size: 22px;
	}
	.type-info {
		flex: 1;
		min-width: 0;
	}
	.type-info strong {
		display: block;
		font-size: 11px;
		color: #0f172a;
	}
	.type-info small {
		font-size: 9px;
		color: #64748b;
	}
	.type-price {
		font-size: 12px;
		font-weight: 800;
		color: #2563eb;
	}
	.urgency-card {
		display: flex;
		align-items: center;
		gap: 10px;
		background: #fffbeb;
		border: 1px solid #fde68a;
		border-radius: 10px;
		padding: 8px 10px;
		cursor: pointer;
	}
	.urgency-card strong {
		display: block;
		font-size: 11px;
		color: #92400e;
	}
	.urgency-card small {
		font-size: 9px;
		color: #b45309;
	}
	.urgency-price {
		margin-left: auto;
		font-size: 11px;
		font-weight: 800;
		color: #b45309;
	}
	.phone-input {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.phone-lbl {
		font-size: 9px;
		font-weight: 700;
		color: #64748b;
	}
	.phone-input input {
		background: #ffffff;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		padding: 6px 8px;
		font-size: 11px;
		outline: none;
	}
	.summary-box {
		background: #f8fafc;
		border-radius: 8px;
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.sum-row {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: #64748b;
	}
	.sum-row.total {
		border-top: 1px solid #e2e8f0;
		padding-top: 4px;
		margin-top: 2px;
		font-size: 13px;
		font-weight: 800;
		color: #0f172a;
	}
	.btn-pay {
		width: 100%;
		background: #2563eb;
		color: #ffffff;
		border: none;
		border-radius: 10px;
		padding: 11px;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
	}
	.btn-pay:hover {
		background: #1d4ed8;
	}
</style>
