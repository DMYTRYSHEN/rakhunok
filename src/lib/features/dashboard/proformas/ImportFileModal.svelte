<script lang="ts">
	import { X, UploadCloud, FileSpreadsheet, Check, AlertCircle } from '@lucide/svelte';
	import * as XLSX from 'xlsx';
	import type { ProformaItem } from './types';

	let {
		open = $bindable(false),
		onImport
	}: {
		open: boolean;
		onImport: (items: ProformaItem[]) => void;
	} = $props();

	let fileInput = $state<HTMLInputElement | null>(null);
	let file = $state<File | null>(null);
	let parsedData = $state<Record<string, any>[]>([]);
	let headers = $state<string[]>([]);
	let errorMsg = $state<string | null>(null);
	let isLoading = $state(false);

	let mapping = $state({
		name: '',
		quantity: '',
		price: '',
		discount: '',
		total: ''
	});

	$effect(() => {
		if (open && fileInput && !file) {
			file = null;
			parsedData = [];
			headers = [];
			errorMsg = null;
			mapping = { name: '', quantity: '', price: '', discount: '', total: '' };
		}
	});

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const selected = target.files?.[0];
		if (!selected) return;
		
		file = selected;
		errorMsg = null;
		isLoading = true;
		
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const data = new Uint8Array(e.target?.result as ArrayBuffer);
				const workbook = XLSX.read(data, { type: 'array' });
				
				const firstSheetName = workbook.SheetNames[0];
				const worksheet = workbook.Sheets[firstSheetName];
				
				const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
				
				if (json.length === 0) {
					throw new Error('Файл порожній або має непідтримуваний формат.');
				}

				parsedData = json;
				headers = Object.keys(json[0]);
				
				autoMapColumns(headers);
			} catch (error) {
				errorMsg = error instanceof Error ? error.message : 'Помилка при читанні файлу';
				file = null;
			} finally {
				isLoading = false;
				if (fileInput) fileInput.value = '';
			}
		};
		reader.onerror = () => {
			errorMsg = 'Помилка при читанні файлу';
			isLoading = false;
			file = null;
			if (fileInput) fileInput.value = '';
		};
		
		reader.readAsArrayBuffer(file);
	}

	function autoMapColumns(h: string[]) {
		const findMatch = (keywords: string[]) => h.find(col => 
			keywords.some(kw => col.toLowerCase().includes(kw))
		) || '';

		mapping.name = findMatch(['назва', 'номенклатура', 'name', 'товар', 'послуг']);
		mapping.quantity = findMatch(['кількість', 'количество', 'qty', 'quantity', 'шт', 'кол']);
		mapping.price = findMatch(['ціна', 'цена', 'price', 'вартість']);
		mapping.discount = findMatch(['знижк', 'скидк', 'discount', '%']);
		mapping.total = findMatch(['сума', 'сумма', 'total', 'всього']);
	}

	function handleImport() {
		if (!mapping.name) {
			errorMsg = 'Будь ласка, вкажіть хоча б колонку з назвою номенклатури.';
			return;
		}

		const itemsToImport: ProformaItem[] = [];

		for (const row of parsedData) {
			const nameVal = row[mapping.name]?.toString().trim();
			if (!nameVal) continue; // Skip empty rows

			const parseNum = (val: any) => {
				if (!val && val !== 0) return 0;
				const str = val.toString().replace(/\s/g, '').replace(',', '.');
				const parsed = parseFloat(str);
				return isNaN(parsed) ? 0 : parsed;
			};

			const qtyVal = mapping.quantity ? parseNum(row[mapping.quantity]) || 1 : 1;
			const priceVal = mapping.price ? parseNum(row[mapping.price]) : 0;
			const discVal = mapping.discount ? parseNum(row[mapping.discount]) : 0;
			
			let explicitTotal = mapping.total ? parseNum(row[mapping.total]) : 0;
			
			let finalPrice = priceVal;
			if (priceVal === 0 && explicitTotal > 0 && qtyVal > 0) {
				finalPrice = explicitTotal / qtyVal;
			}

			let finalDiscount = discVal;
			// Reverse engineer discount if not mapped but total is provided and smaller than price * qty
			if (finalDiscount === 0 && explicitTotal > 0 && finalPrice > 0) {
				const expectedTotal = finalPrice * qtyVal;
				if (explicitTotal < expectedTotal) {
					finalDiscount = ((expectedTotal - explicitTotal) / expectedTotal) * 100;
					// Round to 2 decimals
					finalDiscount = Math.round(finalDiscount * 100) / 100;
				}
			}

			let total = finalPrice * qtyVal * (1 - finalDiscount / 100);
			if (explicitTotal > 0 && finalPrice > 0 && finalDiscount === 0) {
				// If we didn't calculate discount (e.g. total > expected), just trust total for display
				total = explicitTotal;
			}

			itemsToImport.push({
				id: `item-${crypto.randomUUID()}`,
				type: 'item',
				name: nameVal,
				description: '',
				price: finalPrice,
				quantity: qtyVal,
				unit: 'шт.',
				discountPercent: finalDiscount,
				total: total
			});
		}

		onImport(itemsToImport);
		open = false;
	}

	function removeFile() {
		file = null;
		parsedData = [];
		headers = [];
		errorMsg = null;
		mapping = { name: '', quantity: '', price: '', discount: '', total: '' };
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
		<div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
			<div class="flex items-center justify-between shrink-0">
				<div>
					<h3 class="text-lg font-extrabold text-zinc-950">Імпорт з файлу</h3>
					<p class="text-xs text-zinc-500">Завантажте XLSX або CSV файл для імпорту товарів і послуг</p>
				</div>
				<button type="button" onclick={() => (open = false)} class="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
					<X size={18} />
				</button>
			</div>

			<div class="flex-1 overflow-y-auto space-y-5 pr-1">
				{#if !file}
					<button
						type="button"
						onclick={() => fileInput?.click()}
						class="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 py-12 transition hover:border-blue-500 hover:bg-blue-50/50"
					>
						<UploadCloud size={40} class="text-blue-500" />
						<div class="text-center">
							<strong class="block text-sm font-bold text-zinc-900">Натисніть для вибору файлу</strong>
							<span class="text-xs text-zinc-500">або перетягніть файл сюди (CSV, XLSX)</span>
						</div>
					</button>
					<input
						type="file"
						accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
						bind:this={fileInput}
						onchange={handleFileChange}
						class="hidden"
					/>
					{#if isLoading}
						<p class="text-center text-xs font-bold text-zinc-500">Завантаження та обробка...</p>
					{/if}
				{:else}
					<div class="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4">
						<div class="flex items-center gap-3">
							<div class="grid size-10 place-items-center rounded-lg bg-emerald-100 text-emerald-600">
								<FileSpreadsheet size={20} />
							</div>
							<div>
								<strong class="block text-sm font-bold text-zinc-900">{file.name}</strong>
								<span class="text-xs text-zinc-500">{parsedData.length} рядків знайдено</span>
							</div>
						</div>
						<button type="button" onclick={removeFile} class="text-xs font-bold text-red-600 hover:text-red-800">
							Видалити
						</button>
					</div>

					<div class="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
						<h4 class="mb-3 text-sm font-extrabold text-zinc-900">Конструктор: Налаштування колонок</h4>
						<p class="mb-4 text-xs text-zinc-600">Оберіть відповідність між колонками вашого файлу та полями проформи.</p>
						
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<label class="block space-y-1.5">
								<span class="text-xs font-bold text-zinc-700">Номенклатура / Назва <span class="text-red-500">*</span></span>
								<select bind:value={mapping.name} class="w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm outline-none focus:border-blue-500">
									<option value="">Не вибрано</option>
									{#each headers as h}<option value={h}>{h}</option>{/each}
								</select>
							</label>

							<label class="block space-y-1.5">
								<span class="text-xs font-bold text-zinc-700">Кількість</span>
								<select bind:value={mapping.quantity} class="w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm outline-none focus:border-blue-500">
									<option value="">Не вибрано (дефолт 1)</option>
									{#each headers as h}<option value={h}>{h}</option>{/each}
								</select>
							</label>

							<label class="block space-y-1.5">
								<span class="text-xs font-bold text-zinc-700">Ціна</span>
								<select bind:value={mapping.price} class="w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm outline-none focus:border-blue-500">
									<option value="">Не вибрано (дефолт 0)</option>
									{#each headers as h}<option value={h}>{h}</option>{/each}
								</select>
							</label>

							<label class="block space-y-1.5">
								<span class="text-xs font-bold text-zinc-700">% Знижки</span>
								<select bind:value={mapping.discount} class="w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm outline-none focus:border-blue-500">
									<option value="">Не вибрано</option>
									{#each headers as h}<option value={h}>{h}</option>{/each}
								</select>
							</label>

							<label class="block space-y-1.5 sm:col-span-2">
								<span class="text-xs font-bold text-zinc-700">Загальна сума</span>
								<select bind:value={mapping.total} class="w-full rounded-lg border border-zinc-200 bg-white p-2 text-sm outline-none focus:border-blue-500">
									<option value="">Не вибрано (розрахується автоматично)</option>
									{#each headers as h}<option value={h}>{h}</option>{/each}
								</select>
							</label>
						</div>
					</div>

					{#if parsedData.length > 0 && mapping.name}
						<div class="rounded-xl border border-zinc-200 overflow-hidden">
							<div class="bg-zinc-50 px-3 py-2 border-b border-zinc-200">
								<span class="text-xs font-bold text-zinc-700">Попередній перегляд (перші 3 рядки)</span>
							</div>
							<div class="overflow-x-auto">
								<table class="w-full text-left text-xs text-zinc-700">
									<thead>
										<tr class="bg-white border-b border-zinc-100">
											<th class="p-2 font-bold whitespace-nowrap">Назва</th>
											<th class="p-2 font-bold text-right whitespace-nowrap">Кіл.</th>
											<th class="p-2 font-bold text-right whitespace-nowrap">Ціна</th>
											<th class="p-2 font-bold text-right whitespace-nowrap">Знижка</th>
											<th class="p-2 font-bold text-right whitespace-nowrap">Сума</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-zinc-100">
										{#each parsedData.slice(0, 3) as row}
											<tr class="hover:bg-zinc-50">
												<td class="p-2 font-medium truncate max-w-[200px]">{row[mapping.name] || '—'}</td>
												<td class="p-2 text-right">{mapping.quantity ? row[mapping.quantity] : '1'}</td>
												<td class="p-2 text-right">{mapping.price ? row[mapping.price] : '0'}</td>
												<td class="p-2 text-right">{mapping.discount ? row[mapping.discount] : '0'}%</td>
												<td class="p-2 text-right font-bold">{mapping.total ? row[mapping.total] : '—'}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				{/if}

				{#if errorMsg}
					<div class="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">
						<AlertCircle size={16} />
						{errorMsg}
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-end gap-3 shrink-0 pt-2 border-t border-zinc-100">
				<button
					type="button"
					onclick={() => (open = false)}
					class="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100"
				>
					Скасувати
				</button>
				<button
					type="button"
					disabled={!file || !mapping.name}
					onclick={handleImport}
					class="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Check size={16} />
					Імпортувати товари
				</button>
			</div>
		</div>
	</div>
{/if}
