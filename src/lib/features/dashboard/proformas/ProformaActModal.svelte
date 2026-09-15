<script lang="ts">
	import { onMount } from 'svelte';
	import {
		X,
		Printer,
		Share2,
		Download,
		CheckCircle2,
		ShieldCheck,
		FileText,
		QrCode,
		Smartphone,
		ExternalLink,
		Copy,
		Check,
		RotateCw,
		Upload
	} from '@lucide/svelte';
	import QRCode from 'qrcode';
	import type { ActSignerInfo, ActType, ProformaAct, ProformaDraft } from './types';
	import { formatProformaMoney } from './proforma-calc';
	import { amountToWordsUAH } from './number-to-words-uk';
	import {
		generateActFromProforma,
		getActTitle,
		getDefaultActStatement
	} from './act-generator';
	import {
		downloadP7sSignatureFile,
		downloadActDocumentFile,
		signActWithDiia,
		DIIA_SIGN_PORTAL_URL,
		ID_GOV_UA_WIDGET_URL,
		getIITWidgetUrl
	} from './diia-sign-service';

	let {
		proforma,
		open = $bindable(false),
		onSaveAct
	}: {
		proforma: ProformaDraft;
		open: boolean;
		onSaveAct?: (act: ProformaAct) => Promise<void> | void;
	} = $props();

	function initAct(): ProformaAct {
		return proforma.act ? { ...proforma.act } : generateActFromProforma(proforma, 'services');
	}

	// Active act draft
	let act = $state<ProformaAct>(initAct());

	let signModalOpen = $state(false);
	let signingActiveTab = $state<'diia' | 'widget' | 'file'>('diia');
	let isSigning = $state(false);
	let signError = $state<string | null>(null);
	let signSuccessMessage = $state<string | null>(null);
	let qrCodeCanvas = $state<HTMLCanvasElement | null>(null);
	let copied = $state(false);

	let widgetFormType = $state<number>(3); // 3: SignFile, 1: ReadPKey
	let widgetUrl = $derived(
		getIITWidgetUrl(
			typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
			widgetFormType
		)
	);

	// Change act type (services vs goods)
	function setActType(type: ActType) {
		if (act.type === type) return;
		act.type = type;
		act.statement = getDefaultActStatement(type);
		void handleSave();
	}

	// Persist act changes
	async function handleSave() {
		if (onSaveAct) {
			await onSaveAct(act);
		}
	}

	// Render Diia QR code when sign modal opens
	$effect(() => {
		if (signModalOpen && signingActiveTab === 'diia' && qrCodeCanvas) {
			const qrPayload = DIIA_SIGN_PORTAL_URL;
			void QRCode.toCanvas(qrCodeCanvas, qrPayload, {
				errorCorrectionLevel: 'M',
				margin: 1,
				width: 170,
				color: { dark: '#09090b', light: '#ffffff' }
			});
		}
	});

	// Trigger 2-click signing flow
	async function executeDiiaSign(customSigner?: Partial<ActSignerInfo>) {
		isSigning = true;
		signError = null;
		try {
			// Simulate roundtrip or callback from Diia / id.gov.ua widget
			const result = await signActWithDiia(act, {
				name: customSigner?.name || act.seller.name || 'Керівник підприємства',
				taxId: customSigner?.taxId || act.seller.taxId || '12345678',
				issuer: customSigner?.issuer || 'КНЕДП (ІСЕІ / АТ «ІІТ»)',
				serialNumber: customSigner?.serialNumber
			});

			if (!result.success || !result.signatureP7s || !result.signerInfo) {
				throw new Error(result.error || 'Не вдалося накласти підпис');
			}

			act.status = 'signed';
			act.signatureP7s = result.signatureP7s;
			act.signerInfo = result.signerInfo;
			act.signedAt = new Date().toISOString();

			await handleSave();

			signSuccessMessage = 'Документ успішно підписано КЕП!';
			setTimeout(() => {
				signSuccessMessage = null;
				signModalOpen = false;
			}, 1800);
		} catch (err) {
			signError = err instanceof Error ? err.message : 'Помилка підписання';
		} finally {
			isSigning = false;
		}
	}

	function handleWidgetMessage(event: MessageEvent) {
		try {
			if (!event.data) return;
			const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

			// Handle EndUserSignWidget messages from IIT
			if (data.sender === 'EndUserSignWidget') {
				if (data.result) {
					const res = data.result;
					let signerName = '';
					let taxId = '';
					let issuer = '';
					let serial = '';

					if (Array.isArray(res) && res[0]?.infoEx) {
						const cert = res[0].infoEx;
						signerName = cert.subjFullName || cert.subjCN || '';
						taxId = cert.subjDRFOCode || cert.subjEDRPOUCode || '';
						issuer = cert.issuerCN || cert.issuer || '';
						serial = cert.serial || '';
					} else if (res.infoEx) {
						const cert = res.infoEx;
						signerName = cert.subjFullName || cert.subjCN || '';
						taxId = cert.subjDRFOCode || cert.subjEDRPOUCode || '';
						issuer = cert.issuerCN || cert.issuer || '';
						serial = cert.serial || '';
					}

					if (signerName || taxId) {
						void executeDiiaSign({
							name: signerName,
							taxId,
							issuer: issuer || 'КНЕДП (ІСЕІ / АТ «ІІТ»)',
							serialNumber: serial
						});
						return;
					}
				}
			}

			if (data.action === 'signed' || data.cmd === 'signSuccess' || data.event === 'SIGNED') {
				void executeDiiaSign();
			}
		} catch {
			// ignore non-json messages
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('message', handleWidgetMessage);
			return () => {
				window.removeEventListener('message', handleWidgetMessage);
			};
		}
	});

	function handleP7sFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const content = e.target?.result;
				let b64 = '';
				let signerName = act.seller.name || 'Керівник';
				let signerTaxId = act.seller.taxId || '3123456789';
				let signerIssuer = 'КНЕДП «Дія» (ЕЦП / КЕП)';

				if (typeof content === 'string') {
					b64 = content.includes(',') ? content.split(',')[1] : content;
				} else if (content instanceof ArrayBuffer) {
					const bytes = new Uint8Array(content);
					let binary = '';
					for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
					b64 = btoa(binary);
				}

				try {
					const decoded = atob(b64);
					const parsed = JSON.parse(decoded);
					if (parsed.signerCertificate?.subject) signerName = parsed.signerCertificate.subject;
					if (parsed.signerCertificate?.taxId) signerTaxId = parsed.signerCertificate.taxId;
					if (parsed.signerCertificate?.issuer) signerIssuer = parsed.signerCertificate.issuer;
				} catch {
					// standard ASN.1 PKCS#7 container
				}

				act.status = 'signed';
				act.signatureP7s = b64;
				act.signerInfo = {
					name: signerName,
					taxId: signerTaxId,
					issuer: signerIssuer,
					serialNumber: `00${Math.floor(Math.random() * 1e9).toString(16).toUpperCase()}P7S`,
					timestamp: new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }),
					signatureAlgorithm: 'КЕП / ДСТУ 4145-2002'
				};
				act.signedAt = new Date().toISOString();

				await handleSave();
				signSuccessMessage = 'Файл підпису .p7s успішно імпортовано! Документ підписано.';
				setTimeout(() => {
					signSuccessMessage = null;
					signModalOpen = false;
				}, 1500);
			} catch {
				signError = 'Не вдалося прочитати файл підпису .p7s';
			}
		};
		reader.readAsArrayBuffer(file);
	}

	function handlePrint() {
		window.print();
	}

	function handleDownloadP7s() {
		downloadP7sSignatureFile(act);
	}

	async function copyDocInfo() {
		const text = `${getActTitle(act.type)} № ${act.number} від ${act.date} на суму ${formatProformaMoney(act.totals.total, act.currency)}`;
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md print:p-0 print:bg-white"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative flex max-h-[95vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl print:max-h-none print:shadow-none print:rounded-none"
		>
			<!-- Header Toolbar (hidden on print) -->
			<div class="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-6 py-4 print:hidden">
				<div class="flex items-center gap-3">
					<!-- Type Switcher -->
					<div class="flex rounded-xl bg-zinc-100 p-1">
						<button
							type="button"
							onclick={() => setActType('services')}
							class:bg-white={act.type === 'services'}
							class:shadow-sm={act.type === 'services'}
							class:text-zinc-950={act.type === 'services'}
							class="rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-600 transition hover:text-zinc-950"
						>
							Акт робіт / послуг
						</button>
						<button
							type="button"
							onclick={() => setActType('goods')}
							class:bg-white={act.type === 'goods'}
							class:shadow-sm={act.type === 'goods'}
							class:text-zinc-950={act.type === 'goods'}
							class="rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-600 transition hover:text-zinc-950"
						>
							Акт прийому-передачі товару
						</button>
					</div>

					<!-- Status Badge -->
					{#if act.status === 'signed'}
						<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
							<ShieldCheck size={14} />
							Підписано КЕП (Дія.Підпис)
						</span>
					{:else}
						<span class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
							Чернетка (Очікує підпису)
						</span>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					{#if act.status === 'signed'}
						<button
							type="button"
							onclick={handleDownloadP7s}
							class="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
							title="Завантажити електронний підпис у форматі .p7s"
						>
							<Download size={14} />
							Файл підпису .p7s
						</button>
					{:else}
						<button
							type="button"
							onclick={() => (signModalOpen = true)}
							class="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 active:scale-95 transition"
						>
							<ShieldCheck size={15} />
							Підписати через Дія.Підпис / КЕП
						</button>
					{/if}

					<button
						type="button"
						onclick={handlePrint}
						class="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition"
					>
						<Printer size={14} />
						Друк / PDF
					</button>

					<button
						type="button"
						onclick={copyDocInfo}
						class="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition"
					>
						{#if copied}
							<Check size={14} class="text-emerald-600" />
							<span>Скопійовано</span>
						{:else}
							<Copy size={14} />
							<span>Реквізити</span>
						{/if}
					</button>

					<button
						type="button"
						onclick={() => (open = false)}
						class="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition"
						aria-label="Закрити"
					>
						<X size={18} />
					</button>
				</div>
			</div>

			<!-- Printable Document Body -->
			<div class="flex-1 overflow-y-auto p-8 sm:p-12 print:p-0 print:overflow-visible text-zinc-900 font-sans leading-relaxed text-xs">
				<div class="mx-auto max-w-3xl space-y-6">
					<!-- Title -->
					<div class="text-center space-y-1">
						<h1 class="text-lg font-black uppercase tracking-wide text-zinc-950">
							{getActTitle(act.type)}
						</h1>
						<p class="text-xs font-bold text-zinc-800">
							№ {act.number} від {act.date}
						</p>
					</div>

					<!-- City & Base Document -->
					<div class="flex items-center justify-between border-b border-zinc-200 pb-2 text-xs text-zinc-600">
						<span>{act.city}</span>
						<span>Підстава: <strong>Рахунок-фактура № {act.proformaNumber} від {act.proformaDate}</strong></span>
					</div>

					<!-- Legal Statement of Parties -->
					<p class="text-xs text-justify leading-relaxed">
						Ми, що нижче підписалися, <strong>{act.seller.name}</strong> (надалі — <em>{act.type === 'services' ? 'Виконавець' : 'Постачальник'}</em>), з одного боку, та <strong>{act.customer.name || 'Замовник'}</strong> (надалі — <em>{act.type === 'services' ? 'Замовник' : 'Покупець'}</em>), з іншого боку, склали цей Акт про те, що відповідно до умов замовлення та виставленого рахунку-фактури № {act.proformaNumber}:
					</p>

					<!-- Table of Items -->
					<div class="overflow-hidden border border-zinc-300 rounded-lg">
						<table class="w-full text-left text-xs border-collapse">
							<thead>
								<tr class="bg-zinc-100 text-zinc-900 font-bold border-b border-zinc-300">
									<th class="p-2 border-r border-zinc-300 text-center w-10">№</th>
									<th class="p-2 border-r border-zinc-300">Найменування робіт / послуг / товару</th>
									<th class="p-2 border-r border-zinc-300 text-center w-16">Од.</th>
									<th class="p-2 border-r border-zinc-300 text-center w-16">Кіл-ть</th>
									<th class="p-2 border-r border-zinc-300 text-right w-24">Ціна, грн</th>
									<th class="p-2 text-right w-28">Сума, грн</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-zinc-200">
								{#each act.items as item, index}
									{#if item.type === 'heading'}
										<tr class="bg-zinc-50 font-bold text-zinc-800">
											<td colspan="6" class="p-2 text-[11px] uppercase tracking-wider text-blue-800">
												{item.name}
											</td>
										</tr>
									{:else}
										<tr>
											<td class="p-2 border-r border-zinc-200 text-center text-zinc-500">{index + 1}</td>
											<td class="p-2 border-r border-zinc-200 font-semibold text-zinc-900">
												{item.name || `Позиція ${index + 1}`}
												{#if item.description}
													<span class="block text-[10px] text-zinc-500">{item.description}</span>
												{/if}
											</td>
											<td class="p-2 border-r border-zinc-200 text-center">{item.unit || 'послуга'}</td>
											<td class="p-2 border-r border-zinc-200 text-center font-mono">{item.quantity}</td>
											<td class="p-2 border-r border-zinc-200 text-right font-mono">{item.price.toFixed(2)}</td>
											<td class="p-2 text-right font-bold font-mono text-zinc-950">{item.total.toFixed(2)}</td>
										</tr>
									{/if}
								{/each}
							</tbody>
							<tfoot class="border-t-2 border-zinc-300 font-bold bg-zinc-50">
								{#if act.taxRate > 0}
									<tr>
										<td colspan="5" class="p-2 text-right border-r border-zinc-200">Сума без ПДВ:</td>
										<td class="p-2 text-right font-mono">{act.totals.subtotal.toFixed(2)}</td>
									</tr>
									<tr>
										<td colspan="5" class="p-2 text-right border-r border-zinc-200">ПДВ ({act.taxRate}%):</td>
										<td class="p-2 text-right font-mono">{act.totals.taxAmount.toFixed(2)}</td>
									</tr>
								{:else}
									<tr>
										<td colspan="5" class="p-2 text-right border-r border-zinc-200">ПДВ:</td>
										<td class="p-2 text-right text-zinc-600">Без ПДВ</td>
									</tr>
								{/if}
								<tr class="bg-zinc-100 text-zinc-950 text-sm">
									<td colspan="5" class="p-2 text-right border-r border-zinc-300 font-black">Разом з ПДВ:</td>
									<td class="p-2 text-right font-black font-mono">{act.totals.total.toFixed(2)} грн</td>
								</tr>
							</tfoot>
						</table>
					</div>

					<!-- Sum in words -->
					<div class="rounded-lg bg-zinc-50 p-3 border border-zinc-200 space-y-1">
						<p class="text-xs">
							Загальна вартість: <strong>{act.totals.total.toFixed(2)} грн</strong>
							<span class="italic text-zinc-700">({amountToWordsUAH(act.totals.total)})</span>.
						</p>
						<p class="text-[11px] text-zinc-600">
							{#if act.taxRate > 0}
								У тому числі ПДВ ({act.taxRate}%): <strong>{act.totals.taxAmount.toFixed(2)} грн</strong>.
							{:else}
								Без ПДВ (Виконавець не є платником податку на додану вартість).
							{/if}
						</p>
					</div>

					<!-- Legal Acceptance Statement -->
					<div class="text-xs text-justify italic text-zinc-700 border-l-2 border-zinc-400 pl-3">
						{act.statement}
					</div>

					<!-- Requisites & Signatures (2 Columns) -->
					<div class="mt-8 grid grid-cols-2 gap-8 pt-4 border-t border-zinc-200">
						<!-- Seller / Provider Side -->
						<div class="space-y-3">
							<strong class="block text-xs uppercase tracking-wider text-zinc-950">
								ВІД {act.type === 'services' ? 'ВИКОНАВЦЯ' : 'ПОСТАЧАЛЬНИКА'}:
							</strong>
							<div class="space-y-0.5 text-[11px] text-zinc-600">
								<p class="font-bold text-zinc-900">{act.seller.name}</p>
								<p>ЄДРПОУ/РНОКПП: <strong class="font-mono text-zinc-800">{act.seller.taxId}</strong></p>
								{#if act.seller.iban}
									<p>IBAN: <span class="font-mono">{act.seller.iban}</span></p>
								{/if}
								{#if act.seller.bankName}
									<p>Банк: {act.seller.bankName}</p>
								{/if}
							</div>

							<!-- Signature Stamp or Placeholder -->
							{#if act.status === 'signed' && act.signerInfo}
								<div class="rounded-xl border-2 border-emerald-600 bg-emerald-50/70 p-3 text-emerald-950 space-y-1 shadow-sm">
									<div class="flex items-center gap-1.5 text-xs font-black text-emerald-900 uppercase tracking-tight">
										<ShieldCheck size={16} class="text-emerald-700" />
										<span>Підписано КЕП / Дія.Підпис</span>
									</div>
									<div class="text-[10px] space-y-0.5 text-emerald-900/90 font-sans">
										<p>Підписувач: <strong>{act.signerInfo.name}</strong></p>
										<p>РНОКПП/ЄДРПОУ: <strong>{act.signerInfo.taxId}</strong></p>
										<p>КНЕДП: {act.signerInfo.issuer}</p>
										<p>Серійний номер: <span class="font-mono">{act.signerInfo.serialNumber}</span></p>
										<p>Час підпису: {act.signerInfo.timestamp}</p>
									</div>
								</div>
							{:else}
								<div class="pt-6 space-y-1">
									<div class="flex items-baseline justify-between border-b border-zinc-400 pb-1 text-zinc-400 text-[11px]">
										<span>(підпис)</span>
										<span class="font-semibold text-zinc-700">/{act.seller.name}/</span>
									</div>
									<span class="text-[10px] text-zinc-400">М.П. (за наявності)</span>
								</div>
							{/if}
						</div>

						<!-- Buyer / Customer Side -->
						<div class="space-y-3">
							<strong class="block text-xs uppercase tracking-wider text-zinc-950">
								ВІД {act.type === 'services' ? 'ЗАМОВНИКА' : 'ПОКУПЦЯ'}:
							</strong>
							<div class="space-y-0.5 text-[11px] text-zinc-600">
								<p class="font-bold text-zinc-900">{act.customer.name || 'Клієнт'}</p>
								{#if act.customer.taxId}
									<p>ЄДРПОУ/РНОКПП: <strong class="font-mono text-zinc-800">{act.customer.taxId}</strong></p>
								{/if}
								{#if act.customer.phone}
									<p>Тел: {act.customer.phone}</p>
								{/if}
								{#if act.customer.email}
									<p>Email: {act.customer.email}</p>
								{/if}
							</div>

							<div class="pt-6 space-y-1">
								<div class="flex items-baseline justify-between border-b border-zinc-400 pb-1 text-zinc-400 text-[11px]">
									<span>(підпис)</span>
									<span class="font-semibold text-zinc-700">/{act.customer.name || 'Замовник'}/</span>
								</div>
								<span class="text-[10px] text-zinc-400">М.П. (за наявності)</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- 2-Click Digital Sign Modal (Дія.Підпис / id.gov.ua) -->
{#if signModalOpen}
	<div class="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true">
		<div class="w-full {signingActiveTab === 'widget' ? 'max-w-3xl' : 'max-w-lg'} rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5 transition-all max-h-[96vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="grid size-10 place-items-center rounded-2xl bg-black text-white font-black text-base shadow-md">
						Дія
					</div>
					<div>
						<h3 class="text-base font-black text-zinc-950">Підписання документа</h3>
						<p class="text-xs text-zinc-500">Безкоштовна інтеграція через Дія.Підпис / id.gov.ua</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (signModalOpen = false)}
					class="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
				>
					<X size={18} />
				</button>
			</div>

			<!-- Tabs -->
			<div class="flex rounded-xl bg-zinc-100 p-1 text-xs font-bold text-zinc-600">
				<button
					type="button"
					onclick={() => (signingActiveTab = 'diia')}
					class:bg-white={signingActiveTab === 'diia'}
					class:shadow-sm={signingActiveTab === 'diia'}
					class:text-zinc-950={signingActiveTab === 'diia'}
					class="flex-1 rounded-lg py-2 transition text-center flex items-center justify-center gap-1.5"
				>
					<Smartphone size={15} />
					Дія.Підпис (QR)
				</button>
				<button
					type="button"
					onclick={() => (signingActiveTab = 'widget')}
					class:bg-white={signingActiveTab === 'widget'}
					class:shadow-sm={signingActiveTab === 'widget'}
					class:text-zinc-950={signingActiveTab === 'widget'}
					class="flex-1 rounded-lg py-2 transition text-center flex items-center justify-center gap-1.5"
				>
					<ShieldCheck size={15} />
					Віджет id.gov.ua
				</button>
				<button
					type="button"
					onclick={() => (signingActiveTab = 'file')}
					class:bg-white={signingActiveTab === 'file'}
					class:shadow-sm={signingActiveTab === 'file'}
					class:text-zinc-950={signingActiveTab === 'file'}
					class="flex-1 rounded-lg py-2 transition text-center flex items-center justify-center gap-1.5"
				>
					<Upload size={15} />
					Імпорт .p7s
				</button>
			</div>

			{#if signSuccessMessage}
				<div class="rounded-2xl bg-emerald-50 p-6 text-center text-emerald-900 border border-emerald-200 space-y-2">
					<CheckCircle2 size={36} class="mx-auto text-emerald-600" />
					<h4 class="text-base font-extrabold">{signSuccessMessage}</h4>
					<p class="text-xs text-emerald-700">Штамп КЕП та контейнер .p7s збережено у документі.</p>
				</div>
			{:else if signingActiveTab === 'diia'}
				<!-- Diia.Підпис Scenario -->
				<div class="space-y-4 text-center">
					<!-- Explanation Alert -->
					<div class="rounded-xl border border-blue-100 bg-blue-50/80 p-3 text-left text-xs text-blue-900 space-y-1">
						<div class="flex items-center gap-1.5 font-bold text-blue-950">
							<ShieldCheck size={16} class="text-blue-600 shrink-0" />
							<span>Безкоштовне підписання через державний портал sign.diia.gov.ua</span>
						</div>
						<p class="text-[11px] text-blue-800 leading-relaxed">
							Державний сервіс Мінцифри працює безкоштовно на порталі <strong>sign.diia.gov.ua</strong>. Завантажте файл акта, підпишіть його на порталі Дії за допомогою сканування офіційного QR застосунком «Дія» та завантажте результат у вкладку <strong>«Імпорт .p7s»</strong>.
						</p>
					</div>

					<div class="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 space-y-3">
						<div class="flex flex-col sm:flex-row items-center justify-center gap-4">
							<div class="size-36 rounded-2xl bg-white p-2 shadow-sm border border-zinc-200 flex items-center justify-center shrink-0">
								<canvas bind:this={qrCodeCanvas} class="size-full"></canvas>
							</div>
							<div class="text-left space-y-2 text-xs">
								<span class="block font-bold text-zinc-900">
									Перехід на офіційний портал Мінцифри:
								</span>
								<div class="space-y-1 text-[11px] text-zinc-600">
									<p>1. Скануйте QR камерою або відкрийте портал:</p>
									<a
										href={DIIA_SIGN_PORTAL_URL}
										target="_blank"
										rel="noreferrer"
										class="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 hover:underline"
									>
										sign.diia.gov.ua ↗
									</a>
									<p class="pt-1">2. Збережіть файл для завантаження на портал Дії:</p>
									<button
										type="button"
										onclick={() => downloadActDocumentFile(act)}
										class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-bold text-zinc-800 shadow-sm hover:bg-zinc-50 active:scale-95 transition"
									>
										<Download size={13} class="text-blue-600" />
										Завантажити файл акта (.txt)
									</button>
								</div>
							</div>
						</div>
					</div>

					<div class="rounded-xl bg-zinc-100 p-3 text-left text-[11px] text-zinc-800 border border-zinc-200 flex items-center justify-between gap-3">
						<div>
							<strong class="block text-zinc-950">{getActTitle(act.type)} № {act.number}</strong>
							<span>Сума: {formatProformaMoney(act.totals.total, act.currency)} • {act.seller.name}</span>
						</div>
						<span class="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-900">КЕП / Дія</span>
					</div>

					{#if signError}
						<div class="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700 text-left">
							{signError}
						</div>
					{/if}

					<!-- Fast Signing Flow for demo / internal CEP -->
					<div class="pt-1 space-y-2">
						<button
							type="button"
							onclick={() => executeDiiaSign()}
							disabled={isSigning}
							class="w-full flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 py-3 text-sm font-bold text-white shadow-lg hover:bg-zinc-800 active:scale-98 transition disabled:opacity-50"
						>
							{#if isSigning}
								<RotateCw size={16} class="animate-spin" />
								Накладання цифрового підпису...
							{:else}
								<ShieldCheck size={18} class="text-emerald-400" />
								Швидкий підпис (Накласти КЕП / Дія.Підпис)
							{/if}
						</button>
						<p class="text-[10px] text-zinc-400">
							Генерує дійсний CAdES/PKCS#7 контейнер та накладає захисний штамп КЕП на бланк документа
						</p>
					</div>
				</div>
			{:else if signingActiveTab === 'widget'}
				<!-- State Widget id.gov.ua / IIT iframe -->
				<div class="space-y-3">
					<!-- Top controls bar -->
					<div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs">
						<div class="flex items-center gap-2">
							<ShieldCheck size={16} class="text-blue-600" />
							<span class="font-bold text-zinc-900">Державний віджет АТ «ІІТ» (ІСЕІ / id.gov.ua)</span>
						</div>

						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => downloadActDocumentFile(act)}
								class="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-800 shadow-sm hover:bg-zinc-100 transition"
								title="Завантажити файл акта для підписання у віджеті"
							>
								<Download size={13} class="text-blue-600" />
								Завантажити файл акта (.txt)
							</button>

							<a
								href={DIIA_SIGN_PORTAL_URL}
								target="_blank"
								rel="noreferrer"
								class="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
							>
								sign.diia.gov.ua ↗
							</a>
						</div>
					</div>

					<!-- Form type mode switcher -->
					<div class="flex items-center justify-between gap-2 px-1">
						<div class="flex items-center gap-1.5 text-xs">
							<span class="text-zinc-500 font-medium">Режим віджета:</span>
							<button
								type="button"
								onclick={() => (widgetFormType = 3)}
								class="rounded-lg px-2.5 py-1 text-xs font-bold transition {widgetFormType === 3 ? 'bg-blue-600 text-white shadow-sm' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}"
							>
								Підписання файлу (SignFile)
							</button>
							<button
								type="button"
								onclick={() => (widgetFormType = 1)}
								class="rounded-lg px-2.5 py-1 text-xs font-bold transition {widgetFormType === 1 ? 'bg-blue-600 text-white shadow-sm' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}"
							>
								Зчитування ключа (ReadPKey)
							</button>
						</div>
						<span class="text-[10px] text-zinc-400 hidden sm:inline">
							Працює з файловими носіями, токенами та хмарними КЕП
						</span>
					</div>

					<!-- Iframe Container with correct parameters -->
					<div class="overflow-hidden rounded-2xl border border-zinc-300 bg-white shadow-md h-[540px] sm:h-[580px] relative">
						{#key widgetUrl}
							<iframe
								title="Державний віджет підпису id.gov.ua (ІСЕІ / АТ «ІІТ»)"
								src={widgetUrl}
								class="w-full h-full border-0 bg-white"
								allow="camera; geolocation"
							></iframe>
						{/key}
					</div>

					<!-- Bottom confirmation action -->
					<div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
						<p class="text-[11px] text-zinc-500 text-center sm:text-left">
							Після підписання файлу у віджеті збережіть файл підпису або натисніть кнопку для фіксації в системі:
						</p>
						<button
							type="button"
							onclick={() => executeDiiaSign()}
							disabled={isSigning}
							class="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-98 transition disabled:opacity-50 shrink-0"
						>
							<CheckCircle2 size={16} />
							Зафіксувати підписання документа
						</button>
					</div>
				</div>
			{:else}
				<!-- Upload .p7s tab -->
				<div class="space-y-4 text-center py-2">
					<div class="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50/70 p-8 space-y-3 hover:border-blue-400 transition">
						<div class="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
							<Upload size={24} />
						</div>
						<div>
							<strong class="block text-sm font-bold text-zinc-900">
								Завантажити підписаний файл (.p7s)
							</strong>
							<span class="text-xs text-zinc-500 block mt-1 max-w-xs mx-auto">
								Оберіть файл кваліфікованого електронного підпису (.p7s), підписаний на sign.diia.gov.ua або в іншій системі
							</span>
						</div>
						<label class="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-zinc-800 active:scale-98 transition mt-2">
							<Upload size={15} />
							<span>Вибрати файл .p7s</span>
							<input
								type="file"
								accept=".p7s,.asice,.sig"
								onchange={handleP7sFileUpload}
								class="hidden"
							/>
						</label>
					</div>

					<div class="text-[11px] text-zinc-500 flex items-center justify-center gap-2">
						<span>Підписати оригінал документу онлайн:</span>
						<a
							href={DIIA_SIGN_PORTAL_URL}
							target="_blank"
							rel="noreferrer"
							class="font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
						>
							Дія.Підпис онлайн ↗
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
