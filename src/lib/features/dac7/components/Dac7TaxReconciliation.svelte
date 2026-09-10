<script lang="ts">
	import {
		Building2,
		CircleCheck,
		Copy,
		Download,
		FileSpreadsheet,
		FileText,
		Landmark,
		Printer,
		Receipt,
		RefreshCw,
		Scale,
		ShieldAlert,
		ShieldCheck,
		AlertTriangle,
		Truck
	} from '@lucide/svelte';
	import type { Dac7TreasuryPaymentInstruction } from '../types';

	let { demo = true }: { demo?: boolean } = $props();

	let activeSubTab = $state<'treasury' | 'form4df' | 'selfbilling' | 'matrix' | 'incidents'>(
		'treasury'
	);
	let copied = $state(false);
	let xmlGenerated = $state(false);

	// 10% PIT Treasury payment order (No military tax!)
	const treasuryInstruction: Dac7TreasuryPaymentInstruction = {
		docNumber: 'TAX-2026/09-01',
		kbk: '11010100', // ПДФО, що сплачується податковими агентами
		recipientName: 'ГУК у м.Києві/Печерський р-н/11010100',
		recipientIban: 'UA348999980333111222333444555',
		recipientEdrpou: '37993783',
		amount: 896840, // 10% from 8,968,400 UAH
		purpose:
			'*;101;43829104;11010100;ПДФО 10% із платформних доходів самозайнятих курʼєрів за вересень 2026. Військовий збір не застосовується;;;',
		payerEdrpou: '43829104',
		date: '11.09.2026'
	};

	function copyPurpose() {
		navigator.clipboard.writeText(treasuryInstruction.purpose);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function download4dfXml() {
		const xmlContent = `<?xml version="1.0" encoding="windows-1251"?>
<DECLAR xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="J0500108.xsd">
  <DECLARHEAD>
    <TIN>43829104</TIN>
    <C_DOC>J05</C_DOC>
    <C_DOC_SUB>001</C_DOC_SUB>
    <C_DOC_VER>8</C_DOC_VER>
    <C_DOC_STAN>1</C_DOC_STAN>
    <PERIOD_MONTH>9</PERIOD_MONTH>
    <PERIOD_YEAR>2026</PERIOD_YEAR>
    <D_FILL>11092026</D_FILL>
    <SOFTWARE>Rahunok DAC7 Platform Engine v2.0</SOFTWARE>
  </DECLARHEAD>
  <DECLARBODY>
    <!-- Додаток 4ДФ: Доходи всіх категорій самозайнятих осіб та ФОП цифрової платформи -->
    <!-- Норма оподаткування: виключно 10% ПДФО для платформних осіб, 0% для ФОП, Військовий збір = 0.00 ₴ -->
    <!-- 1. Платформний виконавець (ст. 178-1 ПКУ): 10% ПДФО, 0% ВЗ -->
    <ROW ROWNUM="1">
      <RNOKPP>3091248192</RNOKPP>
      <NAME>Ткаченко Олексій Михайлович</NAME>
      <INCOME_ACCRUED>136800.00</INCOME_ACCRUED>
      <INCOME_PAID>136800.00</INCOME_PAID>
      <TAX_PIT_ACCRUED>13680.00</TAX_PIT_ACCRUED>
      <TAX_PIT_PAID>13680.00</TAX_PIT_PAID>
      <TAX_WAR_ACCRUED>0.00</TAX_WAR_ACCRUED>
      <TAX_WAR_PAID>0.00</TAX_WAR_PAID>
      <INCOME_CODE>106</INCOME_CODE>
    </ROW>
    <!-- 2. Зареєстрований ФОП (3 група): платформа не утримує податок (0%), код 157 -->
    <ROW ROWNUM="2">
      <RNOKPP>2847192041</RNOKPP>
      <NAME>Гнатюк Марія Василівна</NAME>
      <INCOME_ACCRUED>212400.00</INCOME_ACCRUED>
      <INCOME_PAID>212400.00</INCOME_PAID>
      <TAX_PIT_ACCRUED>0.00</TAX_PIT_ACCRUED>
      <TAX_PIT_PAID>0.00</TAX_PIT_PAID>
      <TAX_WAR_ACCRUED>0.00</TAX_WAR_ACCRUED>
      <TAX_WAR_PAID>0.00</TAX_WAR_PAID>
      <INCOME_CODE>157</INCOME_CODE>
    </ROW>
    <!-- 3. Продавець товарів понад ліміт De Minimis: оподаткування платформне, код 102 -->
    <ROW ROWNUM="3">
      <RNOKPP>3482910482</RNOKPP>
      <NAME>Савченко Ігор Вікторович</NAME>
      <INCOME_ACCRUED>103500.00</INCOME_ACCRUED>
      <INCOME_PAID>103500.00</INCOME_PAID>
      <TAX_PIT_ACCRUED>10350.00</TAX_PIT_ACCRUED>
      <TAX_PIT_PAID>10350.00</TAX_PIT_PAID>
      <TAX_WAR_ACCRUED>0.00</TAX_WAR_ACCRUED>
      <TAX_WAR_PAID>0.00</TAX_WAR_PAID>
      <INCOME_CODE>102</INCOME_CODE>
    </ROW>
    <!-- 4. Орендодавець нерухомості: надання майна в оренду, код 106 -->
    <ROW ROWNUM="4">
      <RNOKPP>2718294018</RNOKPP>
      <NAME>Шевченко Андрій Миколайович</NAME>
      <INCOME_ACCRUED>384000.00</INCOME_ACCRUED>
      <INCOME_PAID>384000.00</INCOME_PAID>
      <TAX_PIT_ACCRUED>38400.00</TAX_PIT_ACCRUED>
      <TAX_PIT_PAID>38400.00</TAX_PIT_PAID>
      <TAX_WAR_ACCRUED>0.00</TAX_WAR_ACCRUED>
      <TAX_WAR_PAID>0.00</TAX_WAR_PAID>
      <INCOME_CODE>106</INCOME_CODE>
    </ROW>
    <!-- 5. Незалежний професіонал (ст. 178 ПКУ): обліковується за кодом 157 -->
    <ROW ROWNUM="5">
      <RNOKPP>3182940182</RNOKPP>
      <NAME>Мельник Оксана Ігорівна</NAME>
      <INCOME_ACCRUED>89000.00</INCOME_ACCRUED>
      <INCOME_PAID>89000.00</INCOME_PAID>
      <TAX_PIT_ACCRUED>0.00</TAX_PIT_ACCRUED>
      <TAX_PIT_PAID>0.00</TAX_PIT_PAID>
      <TAX_WAR_ACCRUED>0.00</TAX_WAR_ACCRUED>
      <TAX_WAR_PAID>0.00</TAX_WAR_PAID>
      <INCOME_CODE>157</INCOME_CODE>
    </ROW>
  </DECLARBODY>
</DECLAR>`;

		const blob = new Blob([xmlContent], { type: 'application/xml;charset=windows-1251' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `4DF_43829104_09_2026.xml`;
		a.click();
		URL.revokeObjectURL(url);
		xmlGenerated = true;
	}

	const incidentCases = [
		{
			id: 'INC-2026-0901',
			title: 'Курʼєр не довіз вантаж (загублено / аварія)',
			type: 'UNDELIVERED_LOST',
			orderId: 'ORD-VARUS-9821',
			courier: 'Ткаченко О. (3091248192)',
			impactCustomer: 'Повне повернення клієнту: 930.00 ₴',
			impactMerchant: 'Компенсація вартості товарів VARUS: 850.00 ₴',
			impactCourier: 'Винагорода: 0.00 ₴ (дохід не нараховано)',
			taxImpact: 'ПДФО: 0.00 ₴ (база відсутня)',
			status: 'Сторновано в леджерах ✅'
		},
		{
			id: 'INC-2026-0902',
			title: 'Курʼєр пошкодив товар по своїй вині (биті пляшки)',
			type: 'DAMAGED_COURIER_FAULT',
			orderId: 'ORD-VARUS-9744',
			courier: 'Мельник С. (3182940182)',
			impactCustomer: 'Повернення коштів за пошкоджену позицію: 340.00 ₴',
			impactMerchant: 'Списання товару на підставі акта пошкодження',
			impactCourier: 'Винагороду анульовано. Регресна вимога згідно оферти',
			taxImpact: 'ПДФО 10% скасовано (сторнування проводки)',
			status: 'Сторновано в леджерах ✅'
		},
		{
			id: 'INC-2026-0903',
			title: 'Поломка мопеда під час рейсу (Перепризначення)',
			type: 'COURIER_REASSIGNED',
			orderId: 'ORD-VARUS-9912',
			courier: 'Курʼєр 1 (Олексій) → Курʼєр 2 (Дмитро)',
			impactCustomer: 'Замовлення доставлено із запізненням на 12 хв (промокод 50 ₴)',
			impactMerchant: 'Товар вручено в повному обсязі (850.00 ₴)',
			impactCourier: 'Курʼєр 1: 20 ₴ (подача), Курʼєр 2: 80 ₴ (вручення)',
			taxImpact: 'Курʼєр 1: ПДФО 2.00 ₴ · Курʼєр 2: ПДФО 8.00 ₴ (окремі записи в DAC7)',
			status: 'Розщеплено коректно ✅'
		},
		{
			id: 'INC-2026-0904',
			title: 'Клієнт відмовився від замовлення на порозі',
			type: 'CUSTOMER_REJECTED',
			orderId: 'ORD-VARUS-9610',
			courier: 'Коваль В. (3241590123)',
			impactCustomer: 'Повернення за товари, послуга доставки утримана',
			impactMerchant: 'Повернення товару назад у супермаркет VARUS',
			impactCourier: 'Повна винагорода: 100.00 ₴ (послугу курʼєра виконано!)',
			taxImpact: 'ПДФО 10%: 10.00 ₴ утримано та перераховано до бюджету',
			status: 'Виплачено курʼєру ✅'
		},
		{
			id: 'INC-2026-0905',
			title: 'Банк відхилив виплату на IBAN (арешт/блокування)',
			type: 'BANK_IBAN_REJECTED',
			orderId: 'BATCH-2026-0904',
			courier: 'Шевченко І. (3102938192)',
			impactCustomer: 'Не впливає на клієнта',
			impactMerchant: 'Не впливає на мерчанта',
			impactCourier: 'Кошти заморожено в Escrow до оновлення рахунку через Дія',
			taxImpact: 'ПДФО 10% вже зарезервовано в податковому звіті',
			status: 'Escrow Hold 🔒'
		}
	];
</script>

<div class="space-y-6">
	<!-- Sub-navigation tabs -->
	<div class="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-3">
		<button
			type="button"
			onclick={() => (activeSubTab = 'treasury')}
			class="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition {activeSubTab ===
			'treasury'
				? 'bg-stone-900 text-white shadow-sm'
				: 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}"
		>
			<Landmark class="size-4" />
			<span>Платіжка Казначейства (10% ПДФО)</span>
		</button>
		<button
			type="button"
			onclick={() => (activeSubTab = 'form4df')}
			class="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition {activeSubTab ===
			'form4df'
				? 'bg-stone-900 text-white shadow-sm'
				: 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}"
		>
			<FileSpreadsheet class="size-4" />
			<span>Експорт 4ДФ (XML для ДПС)</span>
		</button>
		<button
			type="button"
			onclick={() => (activeSubTab = 'selfbilling')}
			class="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition {activeSubTab ===
			'selfbilling'
				? 'bg-stone-900 text-white shadow-sm'
				: 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}"
		>
			<Receipt class="size-4" />
			<span>Довідка про доходи (Self-Billing)</span>
		</button>
		<button
			type="button"
			onclick={() => (activeSubTab = 'matrix')}
			class="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition {activeSubTab ===
			'matrix'
				? 'bg-stone-900 text-white shadow-sm'
				: 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}"
		>
			<Scale class="size-4" />
			<span>Звірка 3-х Леджерів (Reconciliation)</span>
		</button>
		<button
			type="button"
			onclick={() => (activeSubTab = 'incidents')}
			class="flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition {activeSubTab ===
			'incidents'
				? 'bg-stone-900 text-white shadow-sm'
				: 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}"
		>
			<AlertTriangle class="size-4 text-amber-500" />
			<span>Інциденти, збитки та сторно (Disputes)</span>
		</button>
	</div>

	<!-- TAB 1: Treasury Instruction -->
	{#if activeSubTab === 'treasury'}
		<div class="space-y-4">
			<div class="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
				<div class="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<div>
						<h3 class="flex items-center gap-2 text-base font-bold text-stone-900">
							<Landmark class="size-5 text-emerald-600" />
							Платіжна інструкція на сплату 10% ПДФО до Держказначейства
						</h3>
						<p class="mt-1 text-xs text-stone-500">
							Згідно зі спеціальним податковим режимом для операторів цифрових платформ, утримується
							виключно **10% ПДФО** (Військовий збір **не застосовується**).
						</p>
					</div>
					<span
						class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
					>
						Ставка: 10% ПДФО
					</span>
				</div>

				<div class="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
					<div class="space-y-2 rounded-xl border border-stone-200 bg-stone-50/70 p-4">
						<div class="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
							Отримувач платежу
						</div>
						<div class="font-bold text-stone-900">{treasuryInstruction.recipientName}</div>
						<div class="font-mono text-stone-600">
							Код ЄДРПОУ: {treasuryInstruction.recipientEdrpou}
						</div>
						<div class="font-mono text-stone-600">IBAN: {treasuryInstruction.recipientIban}</div>
						<div class="font-bold text-emerald-700">
							Код класифікації (КБК): {treasuryInstruction.kbk}
						</div>
					</div>

					<div class="space-y-2 rounded-xl border border-stone-200 bg-stone-50/70 p-4">
						<div class="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
							Фінансові параметри
						</div>
						<div class="text-stone-600">Сума утриманого податку за місяць:</div>
						<div class="text-2xl font-black text-stone-900">
							{treasuryInstruction.amount.toLocaleString('uk-UA')} ₴
						</div>
						<div class="font-medium text-emerald-600">10% від бази 8 968 400 ₴</div>
						<div class="text-[11px] text-stone-500">
							Військовий збір: 0.00 ₴ (звільнено законом)
						</div>
					</div>
				</div>

				<div class="mt-4 rounded-xl border border-stone-200 bg-stone-900 p-4 text-white">
					<div class="mb-2 flex items-center justify-between">
						<span class="font-mono text-xs text-stone-400"
							>Призначення платежу (стандарт НБУ № 101):</span
						>
						<button
							type="button"
							onclick={copyPurpose}
							class="flex cursor-pointer items-center gap-1 text-xs font-bold text-emerald-400 transition hover:text-emerald-300"
						>
							<Copy class="size-3.5" />
							{copied ? 'Скопійовано!' : 'Копіювати'}
						</button>
					</div>
					<div
						class="rounded-lg border border-stone-800 bg-stone-950 p-3 font-mono text-xs leading-relaxed break-all text-stone-200"
					>
						{treasuryInstruction.purpose}
					</div>
				</div>
			</div>
		</div>

		<!-- TAB 2: Form 4DF Export -->
	{:else if activeSubTab === 'form4df'}
		<div class="space-y-4">
			<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
				<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<div>
						<h3 class="flex items-center gap-2 text-base font-bold text-stone-900">
							<FileSpreadsheet class="size-5 text-sky-600" />
							Експорт форми 4ДФ (Податковий розрахунок доходів фізосіб)
						</h3>
						<p class="mt-1 text-xs text-stone-500">
							Формування електронного пакета у форматі ДПС для завантаження в M.E.Doc, СОТА або
							Кабінет платника
						</p>
					</div>
					<button
						type="button"
						onclick={download4dfXml}
						class="flex cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-stone-800"
					>
						<Download class="size-4" />
						<span>Завантажити 4DF XML</span>
					</button>
				</div>

				{#if xmlGenerated}
					<div
						class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"
					>
						<CircleCheck class="size-4 text-emerald-600" />
						<span
							>Файл `4DF_43829104_09_2026.xml` успішно згенеровано та підготовлено до відправки!</span
						>
					</div>
				{/if}

				<div class="overflow-x-auto rounded-xl border border-stone-200">
					<table class="w-full text-left text-xs">
						<thead class="border-b border-stone-200 bg-stone-50 font-semibold text-stone-500">
							<tr>
								<th class="p-3">РНОКПП</th>
								<th class="p-3">ПІБ Отримувача</th>
								<th class="p-3 text-right">Нараховано доходу</th>
								<th class="p-3 text-right">Виплачено доходу</th>
								<th class="p-3 text-right">ПДФО 10%</th>
								<th class="p-3 text-right">Військовий збір</th>
								<th class="p-3 text-center">Ознака доходу</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-stone-100 text-stone-700">
							<tr class="hover:bg-stone-50/50">
								<td class="p-3 font-mono font-bold text-stone-900">3091248192</td>
								<td class="p-3 font-medium">Ткаченко Олексій (Гіг-курʼєр)</td>
								<td class="p-3 text-right font-mono">136 800.00 ₴</td>
								<td class="p-3 text-right font-mono">136 800.00 ₴</td>
								<td class="p-3 text-right font-mono font-bold text-emerald-700">13 680.00 ₴</td>
								<td class="p-3 text-right font-mono text-stone-400">0.00 ₴ (0%)</td>
								<td class="p-3 text-center font-mono font-bold">106</td>
							</tr>
							<tr class="hover:bg-stone-50/50">
								<td class="p-3 font-mono font-bold text-stone-900">2847192041</td>
								<td class="p-3 font-medium">Гнатюк Марія (ФОП 3 група)</td>
								<td class="p-3 text-right font-mono">212 400.00 ₴</td>
								<td class="p-3 text-right font-mono">212 400.00 ₴</td>
								<td class="p-3 text-right font-mono text-stone-400">0.00 ₴ (0%)</td>
								<td class="p-3 text-right font-mono text-stone-400">0.00 ₴ (0%)</td>
								<td class="p-3 text-center font-mono font-bold text-indigo-700">157</td>
							</tr>
							<tr class="hover:bg-stone-50/50">
								<td class="p-3 font-mono font-bold text-stone-900">3482910482</td>
								<td class="p-3 font-medium">Савченко Ігор (Товари > поріг)</td>
								<td class="p-3 text-right font-mono">103 500.00 ₴</td>
								<td class="p-3 text-right font-mono">103 500.00 ₴</td>
								<td class="p-3 text-right font-mono font-bold text-emerald-700">10 350.00 ₴</td>
								<td class="p-3 text-right font-mono text-stone-400">0.00 ₴ (0%)</td>
								<td class="p-3 text-center font-mono font-bold">102</td>
							</tr>
							<tr class="hover:bg-stone-50/50">
								<td class="p-3 font-mono font-bold text-stone-900">2718294018</td>
								<td class="p-3 font-medium">Шевченко Андрій (Оренда житла)</td>
								<td class="p-3 text-right font-mono">384 000.00 ₴</td>
								<td class="p-3 text-right font-mono">384 000.00 ₴</td>
								<td class="p-3 text-right font-mono font-bold text-emerald-700">38 400.00 ₴</td>
								<td class="p-3 text-right font-mono text-stone-400">0.00 ₴ (0%)</td>
								<td class="p-3 text-center font-mono font-bold">106</td>
							</tr>
							<tr class="hover:bg-stone-50/50">
								<td class="p-3 font-mono font-bold text-stone-900">3182940182</td>
								<td class="p-3 font-medium">Мельник Оксана (Незалежний профі)</td>
								<td class="p-3 text-right font-mono">89 000.00 ₴</td>
								<td class="p-3 text-right font-mono">89 000.00 ₴</td>
								<td class="p-3 text-right font-mono text-stone-400">0.00 ₴ (0%)</td>
								<td class="p-3 text-right font-mono text-stone-400">0.00 ₴ (0%)</td>
								<td class="p-3 text-center font-mono font-bold text-indigo-700">157</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- TAB 3: Self-Billing Statement -->
	{:else if activeSubTab === 'selfbilling'}
		<div class="space-y-4">
			<div
				class="mx-auto max-w-3xl space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
			>
				<div class="flex items-center justify-between border-b border-stone-200 pb-4">
					<div>
						<div class="text-xs font-bold tracking-wider text-stone-400 uppercase">
							Офіційний документ
						</div>
						<h3 class="text-lg font-bold text-stone-900">
							Довідка про доходи та сплачені податки від цифрової платформи
						</h3>
					</div>
					<button
						type="button"
						onclick={() => window.print()}
						class="flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700 transition hover:bg-stone-50"
					>
						<Printer class="size-4" /> Друк / PDF
					</button>
				</div>

				<div class="grid grid-cols-2 gap-4 text-xs">
					<div>
						<span class="font-medium text-stone-400">Податковий агент (Оператор платформи):</span>
						<div class="mt-0.5 font-bold text-stone-900">ТОВ «БОЛТ ФУД ЮКРЕЙН»</div>
						<div class="font-mono text-stone-500">Код ЄДРПОУ: 43829104</div>
					</div>
					<div>
						<span class="font-medium text-stone-400">Отримувач доходу (Самозайнятий):</span>
						<div class="mt-0.5 font-bold text-stone-900">Ткаченко Олексій Михайлович</div>
						<div class="font-mono text-stone-500">РНОКПП: 3091248192</div>
						<div class="font-mono text-stone-500">IBAN: UA513220010000026200000002384</div>
					</div>
				</div>

				<div class="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-xs">
					<div class="flex justify-between">
						<span class="text-stone-600">Нарахований дохід за період (Gross):</span>
						<span class="font-bold text-stone-900">136 800.00 ₴</span>
					</div>
					<div class="flex justify-between">
						<span class="text-stone-600">Утриманий ПДФО за ставкою 10%:</span>
						<span class="font-bold text-emerald-700">-13 680.00 ₴</span>
					</div>
					<div class="flex justify-between">
						<span class="text-stone-600">Військовий збір (не застосовується):</span>
						<span class="font-bold text-stone-400">0.00 ₴</span>
					</div>
					<div class="flex justify-between border-t border-stone-200 pt-2 text-sm">
						<span class="font-bold text-stone-900"
							>Фактично виплачено на банківський рахунок (Net):</span
						>
						<span class="font-black text-stone-900">123 120.00 ₴</span>
					</div>
				</div>

				<div class="text-[11px] leading-relaxed text-stone-500">
					Підтверджуємо, що ТОВ «БОЛТ ФУД ЮКРЕЙН» як оператор цифрової платформи в повному обсязі
					виконало функції податкового агента щодо утримання та перерахування 10% ПДФО до державного
					бюджету. Дохід відповідає критеріям самозайнятості в межах річного ліміту 834 мінімальних
					зарплат.
				</div>

				<div
					class="flex items-center justify-between border-t border-stone-200 pt-4 font-mono text-xs text-stone-400"
				>
					<span>ЕЦП серійний номер: 72A94F10BC92...</span>
					<span>Мітка точного часу: 11.09.2026 01:40</span>
				</div>
			</div>
		</div>

		<!-- TAB 4: Reconciliation Matrix -->
	{:else if activeSubTab === 'matrix'}
		<div class="space-y-4">
			<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
				<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<div>
						<h3 class="flex items-center gap-2 text-base font-bold text-stone-900">
							<Scale class="size-5 text-indigo-600" />
							Матриця щоденної звірки 3-х Леджерів (End-of-Day Balancing)
						</h3>
						<p class="mt-1 text-xs text-stone-500">
							Контроль нульового балансу: Payment Ledger = Acquiring + Merchant + Courier Gross +
							Platform Margin
						</p>
					</div>
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
					>
						<CircleCheck class="size-4 text-emerald-600" />
						Баланс зведено: 0.00 ₴
					</span>
				</div>

				<div class="grid grid-cols-1 gap-4 text-xs md:grid-cols-4">
					<div class="space-y-1 rounded-xl border border-stone-200 bg-stone-50 p-4">
						<span class="font-semibold text-stone-400">1. Оплата клієнтів (VARUS)</span>
						<div class="text-lg font-black text-stone-900">930 000 ₴</div>
						<span class="text-[11px] text-stone-500">Payment Ledger Gross</span>
					</div>
					<div class="space-y-1 rounded-xl border border-stone-200 bg-stone-50 p-4">
						<span class="font-semibold text-stone-400">2. Комісія еквайрингу (1.2%)</span>
						<div class="text-lg font-black text-amber-700">11 160 ₴</div>
						<span class="text-[11px] text-stone-500">Витрати платіжного шлюзу</span>
					</div>
					<div class="space-y-1 rounded-xl border border-stone-200 bg-stone-50 p-4">
						<span class="font-semibold text-stone-400">3. Частка мерчанта (Товари)</span>
						<div class="text-lg font-black text-stone-900">850 000 ₴</div>
						<span class="text-[11px] text-stone-500">До перерахування VARUS</span>
					</div>
					<div class="space-y-1 rounded-xl border border-stone-200 bg-stone-50 p-4">
						<span class="font-semibold text-stone-400">4. Винагорода кур'єрів</span>
						<div class="text-lg font-black text-emerald-700">100 000 ₴</div>
						<span class="text-[11px] text-stone-500">90 000 ₴ IBAN + 10 000 ₴ ПДФО</span>
					</div>
				</div>

				<div class="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-xs">
					<div class="flex items-center gap-1.5 font-bold text-emerald-900">
						<ShieldCheck class="size-4 text-emerald-600" />
						Формула балансування підтверджена:
					</div>
					<div class="font-mono text-[11.5px] text-emerald-800">
						930 000 ₴ (Оплата клієнта) = 11 160 ₴ (Еквайринг) + 850 000 ₴ (VARUS) + 100 000 ₴
						(Кур'єр Gross) + (-31 160 ₴ Маржа платформи)
					</div>
					<p class="text-[11px] text-stone-500">
						Немає жодної нерозщепленої копійки. Усі записи синхронізовані між `dac7_payment_ledger`,
						`dac7_courier_income_ledger` та `dac7_payout_ledger`.
					</p>
				</div>
			</div>
		</div>

		<!-- TAB 5: Incidents & Disputes Storno Matrix -->
	{:else if activeSubTab === 'incidents'}
		<div class="space-y-4">
			<div class="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
				<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
					<div>
						<h3 class="flex items-center gap-2 text-base font-bold text-stone-900">
							<AlertTriangle class="size-5 text-amber-600" />
							Обробка позаштатних ситуацій: Збитки, поломки та сторнування
						</h3>
						<p class="mt-1 text-xs text-stone-500">
							Регламентні правила для ERP (1C/SAP/BAS): Як система автоматично коригує 3 Леджери та
							базу 10% ПДФО
						</p>
					</div>
					<span
						class="rounded-full border border-stone-200 bg-stone-100 px-3 py-1 font-mono text-xs font-bold text-stone-700"
					>
						5 типових сценаріїв
					</span>
				</div>

				<div class="space-y-3 text-xs">
					{#each incidentCases as c}
						<div
							class="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50/50 p-4 transition hover:bg-stone-50"
						>
							<div
								class="flex flex-col justify-between gap-2 border-b border-stone-200/70 pb-2 sm:flex-row sm:items-center"
							>
								<div class="flex items-center gap-2">
									<span class="font-mono font-bold text-stone-900">{c.id}</span>
									<span class="font-bold text-stone-800">{c.title}</span>
									<span
										class="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800"
									>
										{c.type}
									</span>
								</div>
								<span class="text-xs font-semibold text-emerald-700">{c.status}</span>
							</div>

							<div class="grid grid-cols-1 gap-3 text-[11.5px] md:grid-cols-4">
								<div class="space-y-1 rounded-lg border border-stone-200/60 bg-white p-2.5">
									<span class="block text-[10px] font-semibold text-stone-400 uppercase"
										>Клієнт (Покупець):</span
									>
									<span class="font-medium text-stone-800">{c.impactCustomer}</span>
								</div>
								<div class="space-y-1 rounded-lg border border-stone-200/60 bg-white p-2.5">
									<span class="block text-[10px] font-semibold text-stone-400 uppercase"
										>Мерчант (VARUS):</span
									>
									<span class="font-medium text-stone-800">{c.impactMerchant}</span>
								</div>
								<div class="space-y-1 rounded-lg border border-stone-200/60 bg-white p-2.5">
									<span class="block text-[10px] font-semibold text-stone-400 uppercase"
										>Курʼєр (Виконавець):</span
									>
									<span class="font-medium text-stone-800">{c.impactCourier}</span>
								</div>
								<div
									class="space-y-1 rounded-lg border border-emerald-200/60 bg-emerald-50/70 p-2.5"
								>
									<span class="block text-[10px] font-semibold text-emerald-700 uppercase"
										>Податки (10% ПДФО / DAC7):</span
									>
									<span class="font-bold text-emerald-900">{c.taxImpact}</span>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- ERP Accounting Rules Guide -->
				<div
					class="space-y-2 rounded-xl border border-stone-200 bg-stone-900 p-4 text-xs text-white"
				>
					<div class="flex items-center gap-2 font-bold text-stone-200">
						<FileText class="size-4 text-amber-400" />
						Бухгалтерські проводки для ERP (1C:Підприємство / BAS ERP) при сторнуванні:
					</div>
					<div
						class="space-y-1 rounded-lg border border-stone-800 bg-stone-950 p-3 font-mono text-[11px] text-stone-300"
					>
						<div>
							• Недовіз/пошкодження: <b>Дт 685 (Курʼєр) — Кт 702 (Дохід) СТОРНО</b> (дохід не виникає)
						</div>
						<div>
							• Сторнування податку: <b>Дт 685 (Курʼєр) — Кт 6411 (ПДФО 10%) СТОРНО</b> (податкове зобовʼязання
							анульовано)
						</div>
						<div>
							• Перепризначення курʼєрів: розбивка <b>Курʼєр 1 (Дт 685/1 — 20 ₴, ПДФО 2 ₴)</b> та
							<b>Курʼєр 2 (Дт 685/2 — 80 ₴, ПДФО 8 ₴)</b>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
