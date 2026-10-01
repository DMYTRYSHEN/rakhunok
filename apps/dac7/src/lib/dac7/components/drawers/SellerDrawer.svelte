<script lang="ts">
	import {
		CheckCircle2,
		CircleCheck,
		Fingerprint,
		KeyRound,
		Lock,
		ShieldAlert,
		ShieldCheck,
		User,
		X,
		AlertTriangle,
		Building,
		Car,
		FileBadge,
		GraduationCap,
		Store,
		TrendingUp,
		Info,
		Layers
	} from '@lucide/svelte';
	import type { Dac7Seller } from '../../types';
	import { fmt, KYC_META, CATEGORY_META } from '../../mockData';

	let {
		seller = null,
		onClose
	}: {
		seller: Dac7Seller | null;
		onClose: () => void;
	} = $props();

	let isBlocked = $state(false);

	$effect(() => {
		if (seller) {
			isBlocked = seller.kyc === 'blocked';
		}
	});

	function toggleBlock() {
		isBlocked = !isBlocked;
		if (seller) {
			seller.kyc = isBlocked ? 'blocked' : 'tier2';
		}
	}
</script>

{#if seller}
	<div
		class="animate-fadeIn fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity"
	>
		<!-- Backdrop click -->
		<button
			type="button"
			class="fixed inset-0 h-full w-full cursor-default bg-transparent"
			onclick={onClose}
			aria-label="Закрити"
		></button>

		<div
			class="relative z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-stone-200 px-6 py-4">
				<div class="flex items-center gap-3">
					<div
						class="flex size-11 items-center justify-center rounded-xl bg-stone-900 text-sm font-bold text-white"
					>
						{seller.name
							.split(' ')
							.map((w) => w[0])
							.join('')
							.slice(0, 2)}
					</div>
					<div>
						<div class="flex items-center gap-2">
							<h2 class="text-base font-bold text-stone-900">{seller.name}</h2>
							<span
								class="rounded-full border px-2 py-0.5 text-[10px] font-bold {CATEGORY_META[
									seller.category
								]?.badgeClass || 'bg-stone-100 text-stone-700'}"
							>
								{CATEGORY_META[seller.category]?.shortLabel || seller.category}
							</span>
						</div>
						<div class="font-mono text-xs text-stone-400">
							{seller.id} · {seller.role} · {seller.city}
						</div>
					</div>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="cursor-pointer rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
				>
					<X class="size-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="flex-1 space-y-6 p-6 text-xs">
				<!-- Score & Status Badges -->
				<div class="grid grid-cols-3 gap-3">
					<div class="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 text-center">
						<span class="text-[10.5px] font-semibold tracking-wider text-stone-400 uppercase"
							>KYC Статус</span
						>
						<div class="mt-1 font-bold text-stone-900">
							{KYC_META[seller.kyc]?.l || seller.kyc}
						</div>
					</div>
					<div class="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 text-center">
						<span class="text-[10.5px] font-semibold tracking-wider text-stone-400 uppercase">
							{seller.corporateDetails ? 'ЄДРПОУ' : 'РНОКПП'}
						</span>
						<div class="mt-1 font-mono font-bold text-stone-900">
							{seller.corporateDetails?.edrpou || seller.rnokpp || '3091248192'}
						</div>
					</div>
					<div class="rounded-xl border border-stone-200 bg-stone-50/70 p-3.5 text-center">
						<span class="text-[10.5px] font-semibold tracking-wider text-stone-400 uppercase"
							>Compliance Score</span
						>
						<div class="mt-1 text-lg font-black text-emerald-700">{seller.score}/100</div>
					</div>
				</div>

				<!-- Legal Regime Badge Banner -->
				<div class="space-y-1.5 rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 font-bold text-stone-900">
							<FileBadge class="size-4 text-stone-700" />
							Правовий статус за Законом № 4903-IX
						</span>
						<span class="text-[11px] font-bold text-stone-900">
							{CATEGORY_META[seller.category]?.taxRateDisplay}
						</span>
					</div>
					<p class="text-[11.5px] leading-relaxed text-stone-600">
						{CATEGORY_META[seller.category]?.taxDescription}
					</p>
				</div>

				<!-- Specific Card 1: Platform Gig Seller (10% PIT limit 834 MW) -->
				{#if seller.category === 'platform_gig'}
					<div
						class="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs"
					>
						<div class="flex items-center justify-between">
							<span class="flex items-center gap-1.5 font-bold text-emerald-950">
								<TrendingUp class="size-4 text-emerald-700" />
								Річний ліміт 10% ПДФО (834 розміри МЗП)
							</span>
							<span class="text-xs font-bold text-emerald-800">
								{Math.round((seller.earned / 7211598) * 100)}% ліміту
							</span>
						</div>

						<div class="h-2.5 w-full overflow-hidden rounded-full bg-emerald-200/60">
							<div
								class="h-2.5 rounded-full bg-emerald-600 transition-all"
								style="width: {Math.min(100, Math.round((seller.earned / 7211598) * 100))}%"
							></div>
						</div>

						<div class="flex justify-between text-[11px] text-stone-600">
							<span
								>Зароблено YTD: <strong class="text-stone-900">{fmt(seller.earned)} ₴</strong></span
							>
							<span>Поріг: <strong class="text-stone-900">7 211 598 ₴</strong></span>
						</div>

						<div
							class="rounded-xl border border-emerald-100 bg-white/80 p-2.5 text-[11px] text-emerald-900"
						>
							✓ Ставка 10% діє до вичерпання 7.21 млн ₴. Понад ліміт застосовується ставка 18% ПДФО
							на суму перевищення. <strong>Військовий збір = 0.00 ₴</strong>.
						</div>
					</div>
				{/if}

				<!-- Specific Card 2: FOP Sole Proprietor -->
				{#if seller.category === 'fop'}
					<div class="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-xs">
						<div class="flex items-center justify-between">
							<span class="flex items-center gap-1.5 font-bold text-indigo-950">
								<Store class="size-4 text-indigo-700" />
								Статус: Зареєстрований ФОП ({seller.fopGroup || 3} група)
							</span>
							<span
								class="rounded border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800"
							>
								ЄП {seller.fopTaxRate || 5}%
							</span>
						</div>

						<div class="space-y-1.5 text-[11.5px] text-stone-600">
							<div class="flex justify-between">
								<span class="text-stone-500">Утримання податку платформою:</span>
								<span class="font-bold text-emerald-700">0.00 ₴ (0%)</span>
							</div>
							<div class="flex justify-between">
								<span class="text-stone-500">Код ознаки доходу у 4ДФ:</span>
								<span class="font-mono font-bold text-stone-900">157 (Самозайнята особа)</span>
							</div>
							<div class="flex justify-between">
								<span class="text-stone-500">Сплата податків:</span>
								<span class="font-medium text-stone-800">Самостійно до ДПС щокварталу</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Specific Card 3: Casual Goods Seller (De Minimis meter) -->
				{#if seller.category === 'goods_casual'}
					<div class="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
						<div class="flex items-center justify-between">
							<span class="flex items-center gap-1.5 font-bold text-amber-950">
								<TrendingUp class="size-4 text-amber-700" />
								Контроль порогу De Minimis (DAC7 Exemption)
							</span>
							<span
								class="rounded border px-2 py-0.5 text-[10px] font-bold {seller.deMinimis?.isExempt
									? 'border-emerald-200 bg-emerald-50 text-emerald-800'
									: 'border-red-200 bg-red-50 text-red-800'}"
							>
								{seller.deMinimis?.isExempt
									? 'Звільнено (Exempt)'
									: 'Поріг перевищено (Reportable)'}
							</span>
						</div>

						<div class="grid grid-cols-2 gap-3 text-[11.5px]">
							<div class="rounded-xl border border-amber-100 bg-white p-2.5">
								<div class="text-[10.5px] text-stone-500">Кількість продажів:</div>
								<div class="mt-0.5 text-sm font-bold text-stone-900">
									{seller.deMinimis?.salesCount || seller.goodsSalesCount || 0} / 30 угод
								</div>
								<div class="mt-2 h-1.5 w-full rounded-full bg-stone-100">
									<div
										class="h-1.5 rounded-full bg-amber-500"
										style="width: {Math.min(
											100,
											Math.round(
												((seller.deMinimis?.salesCount || seller.goodsSalesCount || 0) / 30) * 100
											)
										)}%"
									></div>
								</div>
							</div>

							<div class="rounded-xl border border-amber-100 bg-white p-2.5">
								<div class="text-[10.5px] text-stone-500">Сума продажів:</div>
								<div class="mt-0.5 text-sm font-bold text-stone-900">
									{seller.deMinimis?.salesTotalEur || seller.goodsSalesYtd || 0} / 2 000 €
								</div>
								<div class="mt-2 h-1.5 w-full rounded-full bg-stone-100">
									<div
										class="h-1.5 rounded-full bg-amber-500"
										style="width: {Math.min(
											100,
											Math.round(
												((seller.deMinimis?.salesTotalEur || seller.goodsSalesYtd || 0) / 2000) *
													100
											)
										)}%"
									></div>
								</div>
							</div>
						</div>

						<div class="text-[11px] text-stone-600">
							{#if seller.deMinimis?.isExempt}
								✓ До 30 продажів та до 2 000 € платформа не передає щорічний звіт DPI до ДПС.
							{:else}
								⚠️ Ліміт перевищено! Дані про доходи продавця обов'язково включаються до щорічного
								звіту DPI для ДПС.
							{/if}
						</div>
					</div>
				{/if}

				<!-- Specific Card 4: Immovable Property Rental -->
				{#if seller.category === 'property_rental'}
					<div class="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-4 shadow-xs">
						<div class="flex items-center justify-between">
							<span class="flex items-center gap-1.5 font-bold text-violet-950">
								<Building class="size-4 text-violet-700" />
								Об'єкт нерухомості (OECD DPI Listing)
							</span>
							<span
								class="rounded border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800"
							>
								{seller.propertyDetails?.rentalDays || 142} діб оренди
							</span>
						</div>

						<div class="space-y-1.5 text-[11.5px] text-stone-600">
							<div class="flex justify-between">
								<span class="text-stone-500">Адреса об'єкта:</span>
								<span class="text-right font-medium text-stone-900">
									{seller.propertyDetails?.address || seller.address}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-stone-500">Кадастровий номер:</span>
								<span class="font-mono font-bold text-violet-950">
									{seller.propertyDetails?.cadastralNumber || '8000000000:72:001:0014'}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-stone-500">Тип приміщення:</span>
								<span class="text-stone-800">Житлова нерухомість (квартира)</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Specific Card 5: Transport Rental -->
				{#if seller.category === 'transport_rental'}
					<div class="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 shadow-xs">
						<div class="flex items-center justify-between">
							<span class="flex items-center gap-1.5 font-bold text-cyan-950">
								<Car class="size-4 text-cyan-700" />
								Транспортний засіб (Оренда рухомого майна)
							</span>
							<span
								class="rounded border border-cyan-200 bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-800"
							>
								{seller.transportDetails?.rentalDays || 95} діб
							</span>
						</div>

						<div class="space-y-1.5 text-[11.5px] text-stone-600">
							<div class="flex justify-between">
								<span class="text-stone-500">Модель:</span>
								<span class="font-bold text-stone-900"
									>{seller.transportDetails?.model || 'Skoda Octavia 2.0 TDI'}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="text-stone-500">Номерний знак:</span>
								<span class="font-mono font-bold text-cyan-950"
									>{seller.transportDetails?.plateNumber || 'KA 1234 CB'}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="text-stone-500">VIN-код:</span>
								<span class="font-mono text-stone-800"
									>{seller.transportDetails?.vin || 'VF1234567890ABCDE'}</span
								>
							</div>
						</div>
					</div>
				{/if}

				<!-- Specific Card 6: Independent Professional -->
				{#if seller.category === 'independent_pro'}
					<div class="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/50 p-4 shadow-xs">
						<div class="flex items-center justify-between">
							<span class="flex items-center gap-1.5 font-bold text-teal-950">
								<GraduationCap class="size-4 text-teal-700" />
								Незалежна професійна діяльність (ст. 178 ПКУ)
							</span>
							<span
								class="rounded border border-teal-200 bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800"
							>
								{seller.professionalDetails?.certNumber || '№ 4821-НП'}
							</span>
						</div>

						<div class="space-y-1.5 text-[11.5px] text-stone-600">
							<div class="flex justify-between">
								<span class="text-stone-500">Спеціальність / Профіль:</span>
								<span class="font-semibold text-stone-900">
									{seller.professionalDetails?.activityType || 'Психологічне консультування'}
								</span>
							</div>
							<div class="flex justify-between">
								<span class="text-stone-500">Податковий орган обліку:</span>
								<span class="text-stone-800">
									{seller.professionalDetails?.registeredTaxOffice || 'ГУ ДПС у Львівській області'}
								</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Specific Card 7: Corporate Entity -->
				{#if seller.category === 'corporate_entity'}
					<div class="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
						<div class="flex items-center justify-between">
							<span class="flex items-center gap-1.5 font-bold text-blue-950">
								<Store class="size-4 text-blue-700" />
								Корпоративний мерчант (Юридична особа)
							</span>
							<span
								class="rounded border border-blue-200 bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800"
							>
								{seller.corporateDetails?.isVatPayer ? 'Платник ПДВ 20%' : 'Без ПДВ'}
							</span>
						</div>

						<div class="space-y-1.5 text-[11.5px] text-stone-600">
							<div class="flex justify-between">
								<span class="text-stone-500">Повне найменування:</span>
								<span class="font-bold text-stone-900"
									>{seller.corporateDetails?.companyName || seller.name}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="text-stone-500">Код ЄДРПОУ:</span>
								<span class="font-mono font-bold text-blue-950"
									>{seller.corporateDetails?.edrpou || '32615482'}</span
								>
							</div>
							<div class="flex justify-between">
								<span class="text-stone-500">Тип звітності DAC7:</span>
								<span class="text-stone-800">Entity Reporting (Супермаркети/Мережі)</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Specific Card 8: Excluded Seller -->
				{#if seller.category === 'excluded_seller'}
					<div class="space-y-2 rounded-2xl border border-stone-300 bg-stone-100/70 p-4 shadow-xs">
						<div class="flex items-center justify-between">
							<span class="flex items-center gap-1.5 font-bold text-stone-900">
								<ShieldCheck class="size-4 text-stone-600" />
								Виключений продавець (Excluded Seller per DAC7)
							</span>
							<span
								class="rounded border border-stone-300 bg-stone-200 px-2 py-0.5 text-[10px] font-bold text-stone-800"
							>
								Звільнено
							</span>
						</div>
						<p class="text-[11px] leading-relaxed text-stone-600">
							Суб'єкт здійснює понад 2 000 операцій оренди на рік або є публічною компанією.
							Відповідно до Директиви DAC7 та Закону № 4903-IX, платформа звільняється від передачі
							щорічного звіту DPI щодо цього учасника.
						</p>
					</div>
				{/if}

				<!-- Identity & Diia.Signature Details -->
				<div class="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 font-bold text-stone-900">
							<Fingerprint class="size-4 text-sky-600" />
							Електронна ідентифікація через Дія.Підпис
						</span>
						<span
							class="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
						>
							P7S Валідовано
						</span>
					</div>
					<div class="space-y-1.5 text-stone-600">
						<div class="flex justify-between">
							<span class="text-stone-400">Сертифікат КЕП:</span>
							<span class="font-mono text-stone-800">UA-DI-2026-9F8A...</span>
						</div>
						<div class="flex justify-between">
							<span class="text-stone-400">Дата верифікації:</span>
							<span>{seller.since}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-stone-400">Оферта платформи:</span>
							<span class="font-semibold text-emerald-700">Підписано КЕП (v2.4)</span>
						</div>
					</div>
				</div>

				<!-- Banking & Multi-IBAN -->
				<div class="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
					<div class="flex items-center justify-between">
						<span class="flex items-center gap-1.5 font-bold text-stone-900">
							<KeyRound class="size-4 text-stone-700" />
							Банківський рахунок для виплат
						</span>
						<span
							class="rounded border border-stone-200 bg-stone-100 px-2 py-0.5 font-mono text-[10px] text-stone-600"
						>
							{seller.bankName || 'Монобанк'}
						</span>
					</div>
					<div
						class="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-3 font-mono text-stone-800"
					>
						<span>{seller.ibanFormatted || 'UA51 3220 0100 0002 6200 0000 0023 84'}</span>
						<CircleCheck class="size-4 text-emerald-600" />
					</div>
					<div class="text-[11px] text-stone-500">
						Рахунок перевірено за алгоритмом ISO 13616 (Modulo 97). Авторизаційний платіж penny drop
						(5.00 ₴) підтверджено.
					</div>
				</div>

				<!-- Financial & DAC7 Summary -->
				<div class="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs">
					<span class="font-bold text-stone-900">Податковий зріз DAC7 (YTD)</span>
					<div class="grid grid-cols-2 gap-3 text-stone-700">
						<div class="rounded-xl border border-stone-100 bg-stone-50 p-3">
							<span class="text-[11px] text-stone-400">Нараховано доходу:</span>
							<div class="mt-0.5 text-base font-black text-stone-900">{fmt(seller.earned)} ₴</div>
						</div>
						<div class="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
							<span class="text-[11px] text-emerald-700">
								{seller.category === 'platform_gig'
									? 'Утримано 10% ПДФО:'
									: seller.category === 'fop'
										? 'ПДФО платформи (0%):'
										: 'Податок платформи:'}
							</span>
							<div class="mt-0.5 text-base font-black text-emerald-800">
								{seller.category === 'platform_gig' ? fmt(Math.round(seller.earned * 0.1)) : '0'} ₴
							</div>
							<div class="mt-0.5 text-[10px] text-stone-400">Військовий збір: 0.00 ₴</div>
						</div>
					</div>
				</div>

				<!-- AML / Sanctions Screening -->
				<div
					class="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-3.5"
				>
					<div class="flex items-center gap-2">
						<ShieldCheck class="size-5 text-emerald-600" />
						<div>
							<div class="font-bold text-stone-900">AML / PEP / Санкційні списки</div>
							<div class="text-[11px] text-stone-500">
								Перевірено за базами РНБО та Держфінмоніторингу
							</div>
						</div>
					</div>
					<span class="text-xs font-bold text-emerald-700">Clean</span>
				</div>
			</div>

			<!-- Footer Actions -->
			<div
				class="flex items-center justify-between border-t border-stone-200 bg-stone-50/70 p-4 px-6"
			>
				<button
					type="button"
					onclick={toggleBlock}
					class="cursor-pointer rounded-xl px-4 py-2 text-xs font-bold transition {isBlocked
						? 'bg-emerald-600 text-white hover:bg-emerald-700'
						: 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'}"
				>
					{isBlocked ? 'Розблокувати учасника' : 'Заблокувати виплати (AML Hold)'}
				</button>
				<button
					type="button"
					onclick={onClose}
					class="cursor-pointer rounded-xl bg-stone-900 px-5 py-2 text-xs font-bold text-white transition hover:bg-stone-800"
				>
					Закрити
				</button>
			</div>
		</div>
	</div>
{/if}
