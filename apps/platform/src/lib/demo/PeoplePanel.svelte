<script lang="ts">
	import { Save, UserPlus, Check, X } from '@lucide/svelte';
	import DocumentsPanel from './DocumentsPanel.svelte';
	import type { DemoGateway, Persona, Permission } from './gateway';
	import { sellerBlockers, type Participant, type SellerProfile, type WorkflowCommand } from './workflow';

	let { mode, persona, data, contexts, execute }: { mode: 'couriers' | 'team' | 'business'; persona: Persona; data: ReturnType<DemoGateway['workflow']>; contexts: Persona[]; execute: (command: WorkflowCommand, operatorId?: string) => boolean } = $props();

	let search = $state('');
	let readiness = $state('all');
	let selected = $state('');
	let page = $state(1);
	let kind = $state<'person' | 'fop'>('person');
	let residency = $state('UA');
	let tin = $state('DEMO-TIN');
	let account = $state('DEMO-IBAN');
	let documents = $state('DEMO document');
	let provider = $state<'diia' | 'bankid' | 'iban'>('diia');
	let outcome = $state<'verified' | 'rejected' | 'expired'>('verified');
	let reason = $state('DEMO: Уточніть дані');
	let responseDocuments = $state('DEMO updated document');
	let responseMessage = $state('Дані уточнено');
	let memberId = $state('demo-member-new');
	let email = $state('new@demo.example');
	let permission = $state<Permission>('finance');
	let participantId = $state('DEMO-seller-' + Math.random().toString(36).slice(2, 6));
	let participantName = $state('DEMO Самозайнятий');
	let activity = $state<Participant['activity']>('delivery');

	const activityLabels: Record<string, string> = { delivery: 'Доставка', taxi: 'Таксі', services: 'Послуги', other: 'Інше' };

	const rows = $derived(data.participants.filter(person => `${person.id} ${person.name}`.toLowerCase().includes(search.toLowerCase()) && (readiness === 'all' || (sellerBlockers(data.sellers.find(profile => profile.courierId === person.id), new Date().toISOString(), data.documents).length === 0) === (readiness === 'ready'))));
	const current = $derived(data.sellers.find(profile => profile.courierId === selected));

	function select(id: string) {
		selected = id;
		const profile = data.sellers.find(item => item.courierId === id);
		kind = profile?.kind ?? 'person'; 
		residency = profile?.residency ?? 'UA'; 
		tin = profile?.tin ?? 'DEMO-TIN'; 
		account = profile?.account ?? 'DEMO-IBAN'; 
		documents = profile?.documents ?? 'DEMO document';
	}

	function save() { execute({ type: 'seller.save', profile: { courierId: selected, kind, residency, tin, account, documents } }); }
	function blockers(profile?: SellerProfile) { return sellerBlockers(profile, new Date().toISOString(), data.documents).join(' · '); }
</script>

<section class="module space-y-6 min-h-[600px]">
	{#if mode === 'team'}
		<!-- Team Mode content (just keeping it as a stub to match original logic if it existed) -->
		<div>
			<h2 class="text-xl font-bold mb-4">Команда</h2>
			<!-- Original team panel logic was here -->
		</div>
	{:else}
		<div class="flex flex-col lg:flex-row gap-6 w-full h-full">
			
			<!-- Left Panel: List & Search -->
			<div class="w-full lg:w-1/3 flex flex-col gap-6 lg:sticky lg:top-6">
				<details class="bg-white/50 border border-slate-200 rounded-2xl p-2 group">
					<summary class="p-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-50/50 rounded-xl transition-colors flex items-center justify-between">
						Додати самозайнятого
					</summary>
					<form class="p-4 pt-2 border-t border-slate-200/50 mt-2 space-y-4" onsubmit={e => { e.preventDefault(); execute({ type: 'seller.onboard', id: participantId, name: participantName, activity }); page = 1; search = participantId; participantId = 'DEMO-seller-' + Math.random().toString(36).slice(2, 6); }}>
						<div>
							<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="participant-id">ID самозайнятого</label>
							<input class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="participant-id" bind:value={participantId} maxlength="120" />
						</div>
						<div>
							<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="participant-name">Ім'я · DEMO</label>
							<input class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="participant-name" bind:value={participantName} maxlength="120" />
						</div>
						<div>
							<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="participant-activity">Діяльність</label>
							<select class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="participant-activity" bind:value={activity}>
								{#each Object.entries(activityLabels) as [value, label] (value)}<option {value}>{label}</option>{/each}
							</select>
						</div>
						<button class="mt-4 px-6 py-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold rounded-xl flex items-center gap-2 transition-all w-full justify-center" type="submit">Додати самозайнятого</button>
					</form>
				</details>

				<div>
					<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="courier-search">Пошук самозайнятого</label>
					<input class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="courier-search" type="search" bind:value={search} oninput={() => page = 1} />
				</div>

				<div>
					<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="courier-readiness">Стан перевірки</label>
					<select class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="courier-readiness" bind:value={readiness} onchange={() => page = 1}>
						<option value="all">Усі</option><option value="ready">Готово · DEMO</option><option value="blocked">Потребує перевірки</option>
					</select>
				</div>

				<div class="flex flex-col gap-3">
					{#each rows.slice((page - 1) * 2, page * 2) as person (person.id)}
						<button class="w-full flex flex-col items-start gap-2 p-5 bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-md hover:ring-2 hover:ring-indigo-100 rounded-2xl transition-all text-left group {selected === person.id ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-md' : ''}" onclick={() => select(person.id)}>
							<div class="font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">{person.name}</div>
							<div class="text-xs font-bold uppercase tracking-widest text-slate-400">{person.id} · {activityLabels[person.activity]}</div>
							<div class="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md font-medium border border-amber-100 mt-2">{blockers(data.sellers.find(profile => profile.courierId === person.id)) || 'Готово до виплат'}</div>
						</button>
					{/each}
					{#if rows.length === 0}
						<div class="p-8 text-center bg-slate-50/80 border border-dashed border-slate-300 rounded-2xl text-slate-500 font-medium">
							Самозайнятих не знайдено.
						</div>
					{/if}
				</div>

				<div class="flex items-center justify-between bg-slate-100/50 p-2 rounded-xl border border-slate-200/60">
					<button class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-sm font-bold text-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" disabled={page === 1} onclick={() => page--}>Назад</button>
					<span class="text-xs font-bold uppercase tracking-widest text-slate-400">Стор. {page} з {Math.max(1, Math.ceil(rows.length / 2))}</span>
					<button class="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:text-indigo-600 rounded-lg text-sm font-bold text-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" disabled={page * 2 >= rows.length} onclick={() => page++}>Далі</button>
				</div>
			</div>

			<!-- Right Panel: Details -->
			<div class="w-full lg:w-2/3">
				{#if selected}
					<div class="p-8 bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] shadow-xl shadow-slate-900/5 space-y-6">
						<div>
							<h2 class="text-2xl font-black text-slate-800 mb-1">{selected}</h2>
							<p class="text-sm text-slate-500">Особу, правовий статус продавця та зв'язок з оператором обліковано окремо.</p>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="seller-kind">Правовий статус</label>
								<select class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="seller-kind" bind:value={kind}><option value="person">Фізична особа</option><option value="fop">ФОП</option></select>
							</div>
							<div>
								<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="seller-residency">Резидентність</label>
								<input class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="seller-residency" bind:value={residency} maxlength="500" />
							</div>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="seller-tin">Демоідентифікатор (DEMO-)</label>
								<input class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="seller-tin" bind:value={tin} maxlength="500" />
							</div>
							<div>
								<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="seller-account">Деморахунок (DEMO-)</label>
								<input class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="seller-account" bind:value={account} maxlength="500" />
							</div>
						</div>

						<div>
							<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="seller-documents">Синтетичні документи</label>
							<input class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="seller-documents" bind:value={documents} maxlength="500" />
						</div>

						<button class="mt-2 px-6 py-4 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all w-full shadow-lg shadow-indigo-600/20" onclick={save}>Зберегти профіль</button>

						<div class="mt-8">
							<DocumentsPanel ownerId={selected} operatorId={persona.operatorId!} documents={data.documents.filter(document => document.ownerId === selected)} {persona} {execute} />
						</div>

						{#if current}
							<div class="mt-8 pt-8 border-t border-slate-200/60">
								<h3 class="text-lg font-bold text-slate-800 mb-4">Незалежні перевірки · DEMO</h3>
								<p class="text-slate-500 text-sm mb-6">{blockers(current)}</p>
								
								{#if current.response && current.clarification}
									<div class="bg-indigo-50 p-4 rounded-xl mb-6">
										<p class="text-sm font-medium text-indigo-800 mb-3">{current.response.documents} · {current.response.message}</p>
										<button class="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg w-full transition-all hover:bg-indigo-700" onclick={() => { const updated = current.response?.documents; if (execute({ type: 'seller.review', courierId: selected }) && updated) documents = updated; }}>Прийняти уточнення</button>
									</div>
								{/if}

								<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
									<div>
										<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="seller-provider">Провайдер</label>
										<select class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="seller-provider" bind:value={provider}><option value="diia">Дія</option><option value="bankid">BankID</option><option value="iban">IBAN</option></select>
									</div>
									<div>
										<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="seller-outcome">Результат</label>
										<select class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="seller-outcome" bind:value={outcome}><option value="verified">Підтверджено · DEMO</option><option value="rejected">Відмова</option><option value="expired">Строк минув</option></select>
									</div>
								</div>
								
								<button class="mb-6 px-6 py-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-xl w-full transition-all" onclick={() => execute({ type: 'seller.verify', courierId: selected, provider, outcome })}>Застосувати перевірку</button>
								
								<div class="space-y-2 mb-6">
									{#each Object.entries(current.evidence) as [name, evidence] (name)}
										<div class="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
											<span class="font-bold text-slate-700">{name}</span>: 
											<span class="text-slate-600">{evidence.outcome} · перевірено {evidence.at} · до {evidence.expires} · {evidence.source}</span>
										</div>
									{/each}
								</div>
								
								<div>
									<label class="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2" for="seller-clarification">Уточнення</label>
									<div class="flex flex-col sm:flex-row gap-3">
										<input class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all" id="seller-clarification" bind:value={reason} maxlength="500" />
										<button class="px-6 py-3 bg-slate-800 text-white hover:bg-slate-900 font-bold rounded-xl transition-all whitespace-nowrap" onclick={() => execute({ type: 'seller.clarify', courierId: selected, reason })}>Запросити</button>
									</div>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<div class="h-full min-h-[400px] flex items-center justify-center bg-slate-50/50 border border-dashed border-slate-300 rounded-[2rem]">
						<div class="text-slate-400 text-center">
							<svg class="mx-auto mb-4 opacity-50" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
							<p class="font-medium">Оберіть самозайнятого зі списку ліворуч<br>або додайте нового</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</section>
