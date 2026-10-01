<script lang="ts">
	import { onMount } from 'svelte';
	import { Building2, PanelsTopLeft, ContactRound, ArrowLeftRight, WalletCards, FileChartColumnIncreasing, Fingerprint, ShieldCheck, History, Network, FileText, RotateCcw, LogOut, Save, ArrowUpRight } from '@lucide/svelte';
	import LazyPanel from './LazyPanel.svelte';
	import type { ImportResult } from './ledger';
	import Dac7Pagination from '../dac7/components/Dac7Pagination.svelte';
	import './platform.css';
	import type { WorkflowCommand } from './workflow';
	import BentoBalanceCard from './BentoBalanceCard.svelte';
	import PayoutTimeline from './PayoutTimeline.svelte';
	import OperatorBIDashboard from './OperatorBIDashboard.svelte';
	import { allowedSections, createDemoGateway, DEMO_STORAGE_KEY, personas, readContext, sections, totals, type DemoGateway, type DemoStorage, type Result, type Section } from './gateway';

	let { role = null, onSignOut }: { role?: string | null; onSignOut?: () => void } = $props();
	let gateway = $state.raw<DemoGateway | null>(null);
	let personaId = $state('courier-1');
	let section = $state<Section>('overview');
	let revision = $state(0);
	let period = $state('all');
	let operatorFilter = $state('all');
	let contact = $state('');
	let feedback = $state('');
	let failed = $state(false);
	let confirmReset = $state(false);
	let currentPage = $state(1);
	let pageSize = $state(5);
	let search = $state('');
	let register = $state<'all' | 'customerMinor' | 'incomeMinor' | 'paidMinor'>('all');
	let payoutPeriod = $state('2026-09');
	const contexts = $derived.by(() => { void revision; return gateway?.contexts() ?? personas; });
	const persona = $derived(contexts.find(item => item.id === personaId) ?? personas[0]);
	const navigation = $derived(allowedSections(persona));
	const view = $derived.by(() => { void revision; return gateway?.view(personaId) ?? null; });
	const warning = $derived.by(() => { void revision; return gateway?.warning; });
	const workflow = $derived.by(() => { void revision; return gateway?.workflow(personaId); });
	const integration = $derived.by(() => { void revision; return gateway?.integration(personaId); });
	const payouts = $derived.by(() => { void revision; return gateway?.payouts(personaId, payoutPeriod); });
	const reports = $derived.by(() => { void revision; return gateway?.reports(personaId) ?? []; });
	const reporting = $derived.by(() => { void revision; return gateway?.reporting(personaId) ?? { sellerIds: [], assessments: [] }; });
	const accessRequests = $derived.by(() => { void revision; return gateway?.accessRequests(personaId) ?? []; });
	const operations = $derived.by(() => { void revision; return gateway?.operations(personaId) ?? []; });
	const membership = $derived.by(() => { void revision; return gateway?.membership(personaId); });
	const technicalAudit = $derived.by(() => { void revision; return gateway?.technicalAudit(personaId) ?? []; });
		const issues = $derived.by(() => { void revision; return gateway?.issues(personaId) ?? []; });
		const journal = $derived.by(() => { void revision; return gateway?.journal(personaId) ?? []; });
	let suspensionReason = $state('DEMO: операційна перевірка');
	let suspensionTarget = $state('');
	const periods = $derived([...new Set(view?.entries.map(entry => entry.period) ?? [])].sort());
		const pendingPayoutPeriods = $derived.by(() => {
			void revision;
			return periods.filter(value => {
				const records = gateway?.payouts(personaId, value);
				return records?.external.some(item => ['pending', 'unknown'].includes(item.status)) || records?.batches.some(batch => !batch.cancelled && batch.instructions.some(item => ['pending', 'unknown'].includes(item.status)));
			});
		});
	const entries = $derived(view?.entries.filter(entry => (period === 'all' || entry.period === period) && (operatorFilter === 'all' || entry.operatorId === operatorFilter)) ?? []);
	const summary = $derived(totals(entries, workflow?.sellers));
	const visibleRows = $derived(entries.filter(entry => (register === 'all' || entry[register] !== 0) && `${entry.id} ${entry.courierId}`.toLowerCase().includes(search.toLowerCase())));
	const pageRows = $derived(visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize));
	const icons = { overview: PanelsTopLeft, registration: Building2, couriers: ContactRound, operations: ArrowLeftRight, payouts: WalletCards, reports: FileChartColumnIncreasing, integrations: Fingerprint, team: ShieldCheck, audit: History, platforms: Network };
	const taskLabels: Partial<Record<Section, string>> = { registration: 'Підготувати реєстрацію', couriers: 'Перевірити самозайнятих', operations: 'Звірити операції', payouts: 'Підготувати виплати', reports: 'Підготувати звітність', integrations: 'Налаштувати інтеграцію', team: 'Керувати доступом команди' };
	const taskDetails: Partial<Record<Section, string>> = { registration: 'Реквізити, документи та статус подання', couriers: 'Анкети, підтвердження та уточнення', operations: 'Надходження, винагороди та коригування', payouts: 'Доступні суми, погодження та звірка', reports: 'Розрахунки, витяги та квитанції', integrations: 'Тестові ключі та імпорт подій', team: 'Запрошення, ролі та повноваження' };
	const guides: Record<Section, string[]> = {
		overview: ['Перевірте робочий контекст: роль визначає доступні розділи та дії.', 'Почніть із запитів на уточнення й непідтверджених даних. Оплати покупців, винагороди та виплати обліковуються окремо.', 'Власник готує реєстрацію й команду; самозайнятий перевіряє анкету та зв’язок із платформою; інтегратор імпортує операції; бухгалтер звіряє виплати та звіти.'],
		registration: ['Заповніть контакт, реквізити організації та представника. Збережіть чернетку на кожному етапі.', 'У блоці «Документи» внесіть синтетичні дані вручну або підготуйте їх із TXT/JSON. Перевірте поля перед поданням.', 'Документи перевіряє інший уповноважений користувач. Після зміни документів збережіть пакет з актуальними версіями, отримайте незалежне погодження й передайте його в деморозгляд.'],
		couriers: ['Оберіть анкету та перевірте вид діяльності, статус особи й реквізити. Використовуйте лише DEMO-дані.', 'Додайте документи вручну або з файла. Для виправлень створюйте нову версію; відхилений документ потребує уточнення.', 'Самозайнятий підтверджує зв’язок із платформою, а уповноважений перевіряє анкету й документи. Подання документа не означає його прийняття.'],
		operations: ['Оберіть період і перевірте джерела операцій. Не змішуйте оплати покупців із винагородами.', 'Для імпорту оберіть JSON або CSV, налаштуйте відповідність полів і натисніть «Перевірити імпорт». Суми вказуйте в копійках.', 'Перегляньте рядки й виправте помилки перед записом. Коригування посилається на первісну подію; повтор того самого ID не створює нову операцію.'],
		payouts: ['Оберіть період, перевірте доступні суми, документи та блокування. Уже зарезервовані суми не можна виплатити повторно.', 'Підготуйте пакет і передайте на незалежне погодження. У демо жодного банківського переказу немає.', 'Звірте кожну інструкцію. Невідомий результат спочатку уточнюють; його не слід трактувати як відмову чи повторювати без звірки.'],
		reports: ['Оберіть період і перевірте операції, документи та рішення щодо звітності. Відсутня оцінка не дорівнює нулю.', 'Усуньте блокування й підготуйте версію звіту. Ставки та юридичні правила демо не є підтвердженою податковою методикою.', 'Перевірте артефакт, погодьте його та перегляньте результат симуляції. Експорт і квитанції не є офіційним поданням.'],
		integrations: ['Створіть тестовий ключ тільки з потрібними правами й оберіть його в консолі.', 'Додайте JSON/CSV, за потреби зіставте назви колонок. Використовуйте унікальні DEMO-ID та суми в копійках.', 'Перевірте імпорт, перегляньте рядки й лише потім запишіть демоподії. Зміна вмісту вимагає повторної перевірки.'],
		team: ['Оберіть роль за обов’язками: власник, бухгалтер, інтегратор або перевіряльник.', 'Створіть демозапрошення. Запрошений учасник має прийняти його у своєму робочому контексті.', 'Перевіряйте статус доступу. Для тимчасової підтримки потрібні обмежений обсяг, строк та незалежне погодження; браузерне демо не замінює серверну авторизацію.'],
		audit: ['Знайдіть подію за часом, автором і оператором.', 'Зіставте подію з версією документа, пакета чи операції. Історія зберігає попередні рішення.', 'Виправлення виконуйте у відповідному робочому розділі, а не шляхом зміни журналу.'],
		platforms: ['Перевірте статус платформи й чергу проблем.', 'Для допомоги з даними запросіть тимчасовий доступ з потрібним обсягом і дочекайтеся незалежного погодження.', 'Призупинення обмежує нові дії, але не скасовує потреби звірити попередні результати.']
	};
	const money = (minor: number) => new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(minor / 100);
	const operatorName = (id: string) => view?.operators.find(item => item.id === id)?.name ?? id;
	const title = $derived(sections.find(item => item.id === section)?.label ?? 'Огляд');
	const legacyHref = $derived(`?demo=1&workspace=legacy&role=${role ?? 'seller'}`);

	function syncLocation() {
		const context = readContext(window.location.search, role, gateway?.contexts() ?? personas);
		personaId = context.persona.id;
		section = context.section;
		period = 'all'; operatorFilter = 'all'; search = ''; currentPage = 1;
		register = 'all';
		feedback = ''; confirmReset = false;
		contact = gateway?.view(personaId).operators[0]?.contact ?? '';
	}

	function navigate(nextPersona: string, nextSection: Section = 'overview') {
		const url = new URL(window.location.href);
		url.searchParams.set('demo', '1');
		url.searchParams.set('persona', nextPersona);
		url.searchParams.set('section', nextSection);
		window.history.pushState({}, '', url);
		syncLocation();
	}

	function resultFeedback(result: Result, success: string) {
		failed = !result.ok;
		const errors = {
			FORBIDDEN: 'Ця персона не має права на зміну.',
			INVALID_CONTACT: 'Вкажіть синтетичну адресу в домені .example.',
			STORAGE_UNAVAILABLE: 'Зміни не збережено: локальне сховище недоступне.',
			CONFLICT: 'Стан змінився в іншій вкладці або журнал заповнено. Оновіть сторінку.'
		};
		feedback = result.ok ? success : errors[result.error];
		revision += 1;
	}

	function saveContact(event: SubmitEvent) {
		event.preventDefault();
		if (gateway && persona.operatorId) resultFeedback(gateway.updateContact(personaId, persona.operatorId, contact.trim()), 'Демоконтакт збережено.');
	}
	function execute(command: WorkflowCommand, operatorId = persona.operatorId) {
		if (!gateway || !operatorId) return false;
		const result = gateway.command(personaId, operatorId, command);
		if (result.ok && !allowedSections(gateway.contexts().find(item => item.id === personaId) ?? personas[0]).some(item => item.id === section)) syncLocation();
		failed = !result.ok;
		feedback = result.ok ? 'Демозміну збережено.' : `Зміни не збережено: ${result.error}`;
		revision += 1;
		return result.ok;
	}

	function reset() {
		if (!gateway) return;
		const result = gateway.reset();
		if (result.ok) syncLocation();
		resultFeedback(result, 'Демодані відновлено.');
		contact = gateway.view(personaId).operators[0]?.contact ?? '';
		confirmReset = false;
	}
	function readAccess(operatorId: string, id: string): ReturnType<DemoGateway['readAccess']> {
		const result = gateway?.readAccess(personaId, operatorId, id) ?? { ok: false as const, error: 'FORBIDDEN' };
		revision += 1;
		return result;
	}
	function importRecords(command: Extract<WorkflowCommand, { type: 'ledger.import' }>): ImportResult {
		if (!gateway || !persona.operatorId) return { status: 'rejected', error: 'FORBIDDEN', rows: [] };
		const result = gateway.importRecords(personaId, persona.operatorId, command);
		failed = result.status === 'rejected'; feedback = failed ? `Імпорт відхилено: ${result.error}` : result.status === 'replayed' ? 'Повтор підтверджено. Нових записів немає.' : 'Демоподії записано.';
		revision += 1;
		return result;
	}

	onMount(() => {
		let storage: DemoStorage | null = null;
		try { storage = window.localStorage; } catch { storage = null; }
		gateway = createDemoGateway(storage);
		syncLocation();
		const onStorage = (event: StorageEvent) => {
			if (event.key === DEMO_STORAGE_KEY || event.key === null) {
				gateway = createDemoGateway(storage);
				syncLocation();
				revision += 1;
				failed = false; feedback = 'Демодані та права оновлено з іншої вкладки.';
			}
		};
		window.addEventListener('popstate', syncLocation);
		window.addEventListener('storage', onStorage);
		return () => { window.removeEventListener('popstate', syncLocation); window.removeEventListener('storage', onStorage); };
	});
</script>

<div class="demo-shell">
	<a class="skip-link" href="#platform-content">До вмісту</a>
	<aside>
		<a class="brand" href="?demo=1&role=platform"><Building2 size={27} /><span>Rahunok<strong>Platform</strong></span></a>
		<div class="environment"><span>DEMO</span> Україна · UAH</div>
		<label class="context-label" for="demo-persona">Робочий контекст</label>
		<select id="demo-persona" value={personaId} onchange={event => navigate(event.currentTarget.value)}>
			{#each contexts as item (item.id)}<option value={item.id}>{item.label}</option>{/each}
		</select>
		<nav aria-label="Розділи Platform">
			{#each navigation as item (item.id)}
				{@const Icon = icons[item.id]}
				<button type="button" class:active={section === item.id} aria-current={section === item.id ? 'page' : undefined} onclick={() => navigate(personaId, item.id)}><span class="nav-icon"><Icon size={20} strokeWidth={1.6} /></span>{item.label}</button>
			{/each}
		</nav>
		<div class="sidebar-bottom">
			<a href={legacyHref}><ArrowUpRight size={17} />Попередні демосценарії</a>
			<button type="button" onclick={onSignOut}><LogOut size={17} />Вийти з демо</button>
		</div>
	</aside>
	<main id="platform-content" tabindex="-1">
		<header>
			<div><p class="eyebrow">{persona.kind === 'admin' ? 'Rahunok · операційний контроль' : persona.kind === 'courier' ? `Особистий кабінет · ${persona.label}` : view?.operators[0]?.name ?? 'Оператор'}</p><h1>{title}</h1></div>
			<button class="icon-button" type="button" title="Відновити початкові демодані" aria-label="Відновити початкові демодані" onclick={() => confirmReset = !confirmReset}><RotateCcw size={19} /></button>
		</header>
		<div class="disclosure">Синтетичні дані. VARUS Delivery є демонстраційним прикладом, не підтвердженим партнерством. Платежі та подання не виконуються.</div>
		{#key `${personaId}:${section}`}<details class="workflow-guide"><summary>Що робити в цьому розділі · {title}</summary><ol>{#each guides[section] as instruction (instruction)}<li>{instruction}</li>{/each}</ol><p>Доступні лише дії вашої ролі. Незбережені поля можуть загубитися при переході до іншого розділу або робочого контексту.</p></details>{/key}
		{#if confirmReset}
			<div class="notice"><p>Відновити дані обох демооператорів? Усі локальні демозміни та журнал буде скинуто. Авторизація не зміниться.</p><div class="actions"><button type="button" onclick={reset}>Відновити демодані</button><button type="button" onclick={() => confirmReset = false}>Скасувати</button></div></div>
		{/if}
		{#if warning}<p role="alert" class="notice error">{warning === 'CORRUPT_STORAGE' ? 'Збережені демодані пошкоджені або несумісні. Показано початковий набір; натисніть відновлення для його збереження.' : 'Локальне сховище недоступне. Перегляд доступний, збереження змін неможливе.'}</p>{/if}
		{#if feedback}<p role={failed ? 'alert' : 'status'} class="notice" class:error={failed}>{feedback}</p>{/if}
		{#if !view}<p role="status">Завантаження демоданих...</p>
		{:else}
			{#if view.canReadFinance && ['overview', 'operations'].includes(section)}
				<div class="filters">
					<div><label for="demo-period">Період</label><select id="demo-period" bind:value={period} onchange={() => currentPage = 1}><option value="all">Усі періоди</option>{#each periods as value (value)}<option value={value}>{value}</option>{/each}</select></div>
					{#if view.operators.length > 1}<div><label for="demo-operator">Платформа</label><select id="demo-operator" bind:value={operatorFilter} onchange={() => currentPage = 1}><option value="all">Усі мої платформи</option>{#each view.operators as operator (operator.id)}<option value={operator.id}>{operator.name}</option>{/each}</select></div>{/if}
				</div>
			{/if}
			{#if section === 'overview'}
				{#if persona.kind === 'courier'}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-4 metrics relative">
						<BentoBalanceCard balance={summary.balanceMinor} trend={summary.incomeMinor > 0 ? '+ Активно' : 'Очікування'} />
						<PayoutTimeline period={pendingPayoutPeriods[0] ?? periods[0] ?? 'Останній період'} amount={summary.balanceMinor} status={pendingPayoutPeriods.length ? 'pending' : 'completed'} />
						<div class="sr-only" aria-hidden="true">
							Оплати покупців: {money(summary.customerMinor)}
							Винагороди: {money(summary.incomeMinor)}
							Виплачено: {money(summary.paidMinor)}
						</div>
					</div>
					<h2>Дії та Сповіщення</h2>
					<div class="flex flex-col gap-3 mb-6">
						{#each workflow?.sellers.filter(profile => profile.clarification || !profile.linked) ?? [] as profile (profile.operatorId)}<button aria-label="{profile.operatorId} · {profile.clarification ? 'Запит на уточнення' : 'Підтвердіть зв’язок'}" class="bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100 flex items-center justify-between p-4 rounded-xl w-full text-left transition-colors" onclick={() => navigate(personaId, 'couriers')}><span>{profile.operatorId}</span><span class="font-semibold">{profile.clarification ? 'Потрібно уточнення документів' : 'Підтвердіть зв’язок'}</span></button>{/each}
						{#each pendingPayoutPeriods as value (value)}<button aria-label="Виплати на звірці · {value}" class="bg-blue-50 text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100 flex items-center justify-between p-4 rounded-xl w-full text-left transition-colors" onclick={() => { payoutPeriod = value; navigate(personaId, 'payouts'); }}><span>Виплати на звірці</span><span class="font-semibold">{value}</span></button>{/each}
						{#if !pendingPayoutPeriods.length && !(workflow?.sellers.some(profile => profile.clarification || !profile.linked))}<div class="bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 p-4 rounded-xl font-medium">Нових запитів і виплат на звірці немає. Усе чудово!</div>{/if}
						{#if reports.length}<button aria-label="Доступні витяги · {reports.length}" class="bg-zinc-50 text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-100 flex items-center justify-between p-4 rounded-xl w-full text-left transition-colors" onclick={() => navigate(personaId, 'reports')}><span>Доступні податкові витяги DAC7</span><span class="font-semibold">{reports.length} шт</span></button>{/if}
					</div>
				{/if}
				{#if persona.kind === 'admin'}<h2>Операційний контроль</h2><div class="actions"><button onclick={() => navigate(personaId, 'platforms')}>Клієнти та черга проблем · {issues.length}<ArrowUpRight size={16} /></button><button onclick={() => navigate(personaId, 'audit')}>Технічний журнал<History size={16} /></button></div>{/if}
				{#if persona.kind === 'operator'}
					{#if operations[0]?.suspended}<p role="alert" class="notice error">Нові дії призупинено. Звірка попередніх результатів доступна.</p>{/if}
				{/if}
				{#if membership === 'invited'}<button onclick={() => execute({ type: 'member.status', id: persona.id, status: 'active' })}>Прийняти демозапрошення</button>{/if}
				{#if membership === 'revoked' || membership === 'inactive'}<p role="status" class="notice">Доступ до оператора {membership === 'revoked' ? 'відкликано' : 'деактивовано'}. Зверніться до власника оператора.</p>{/if}
				{#if view.canReadFinance}
					{#if persona.kind === 'operator'}
						<OperatorBIDashboard {summary} sellersCount={workflow?.sellers.length ?? 0} clarificationCount={workflow?.sellers.filter(profile => profile.clarification).length ?? 0} {navigate} {personaId} {navigation} {icons} {taskLabels} {taskDetails} />
						<h2 class="mt-8">Звірка за платформами</h2>
						<div class="table-scroll"><table><thead><tr><th>Платформа</th><th>Винагорода</th><th>Виплачено</th><th>Залишок</th></tr></thead><tbody>{#each view.operators.filter(operator => operatorFilter === 'all' || operator.id === operatorFilter) as operator (operator.id)}{@const sums = totals(entries.filter(entry => entry.operatorId === operator.id))}<tr><td>{operator.name}</td><td>{money(sums.incomeMinor)}</td><td>{money(sums.paidMinor)}</td><td>{money(sums.balanceMinor)}</td></tr>{/each}</tbody></table></div>
					{:else}
						{#if persona.kind !== 'courier'}
							<div class="metrics">
								<div><span>Оплати покупців</span><strong>{money(summary.customerMinor)}</strong></div>
								<div><span>Винагороди самозайнятих</span><strong>{money(summary.incomeMinor)}</strong></div>
								<div><span>Виплачено</span><strong>{money(summary.paidMinor)}</strong></div>
								<div><span>Залишок винагород</span><strong>{money(summary.balanceMinor)}</strong></div>
							</div>
						{/if}
						<h2 class="mt-8">Звірка за платформами</h2>
						<div class="table-scroll"><table><thead><tr><th>Платформа</th><th>Винагорода</th><th>Виплачено</th><th>Залишок</th></tr></thead><tbody>{#each view.operators.filter(operator => operatorFilter === 'all' || operator.id === operatorFilter) as operator (operator.id)}{@const sums = totals(entries.filter(entry => entry.operatorId === operator.id))}<tr><td>{operator.name}</td><td>{money(sums.incomeMinor)}</td><td>{money(sums.paidMinor)}</td><td>{money(sums.balanceMinor)}</td></tr>{/each}</tbody></table></div>
					{/if}
				{:else}
					<div class="metrics"><div><span>Доступні оператори</span><strong>{view.operators.length}</strong></div><div><span>Середовище</span><strong>DEMO</strong></div></div>
					<p class="empty">Фінансові записи для цього контексту недоступні.</p>
				{/if}
			{:else if section === 'registration'}
				{#if persona.permissions.includes('profile')}<h2>Демоконтакт оператора</h2>
				<form onsubmit={saveContact}><label for="operator-contact">Синтетична адреса (.example)</label><input id="operator-contact" type="email" required maxlength="120" bind:value={contact} /><button class="primary" type="submit"><Save size={17} />Зберегти</button></form>
				{/if}
				{#key personaId}<LazyPanel load={() => import('./RegistrationPanel.svelte')}>{#snippet children(Panel)}<Panel history={workflow?.registrations ?? []} {persona} {execute} />{/snippet}</LazyPanel>{/key}
				{#if persona.operatorId && workflow}{#key personaId}<LazyPanel load={() => import('./DocumentsPanel.svelte')}>{#snippet children(Panel)}<Panel ownerId="operator" operatorId={persona.operatorId!} documents={workflow?.documents.filter(document => document.ownerId === 'operator') ?? []} {persona} {execute} />{/snippet}</LazyPanel>{/key}{/if}
			{:else if section === 'payouts' && payouts}
				{#key personaId}<LazyPanel load={() => import('./PayoutPanel.svelte')}>{#snippet children(Panel)}{#if payouts}<Panel {persona} data={payouts} {execute} period={payoutPeriod} onPeriod={value => payoutPeriod = value} />{/if}{/snippet}</LazyPanel>{/key}
			{:else if section === 'reports'}
				{#key personaId}<LazyPanel load={() => import('./ReportPanel.svelte')}>{#snippet children(Panel)}<Panel {persona} data={reports} {reporting} {execute} />{/snippet}</LazyPanel>{/key}
			{:else if section === 'operations'}
				<label class="search" for="operation-register">Реєстр<select id="operation-register" bind:value={register} onchange={() => currentPage = 1}><option value="all">Усі операції</option><option value="customerMinor">Оплати покупців</option><option value="incomeMinor">Винагороди</option><option value="paidMinor">Підтверджені виплати</option></select></label>
				<label class="search">Пошук за ID події або самозайнятого<input type="search" bind:value={search} oninput={() => currentPage = 1} /></label>
				<div class="table-scroll"><table><thead><tr><th>Демоподія</th><th>Платформа / самозайнятий</th><th>Період</th><th>Оплата покупця</th><th>Винагорода</th><th>Виплачено</th></tr></thead><tbody>{#each pageRows as entry (`${entry.operatorId}:${entry.id}`)}<tr><td class="mono"><details><summary>{entry.id}</summary><p>{entry.operatorId} · {entry.courierId} · {entry.period}</p><p>Оплата: {money(entry.customerMinor)} · винагорода: {money(entry.incomeMinor)} · виплата: {money(entry.paidMinor)}</p></details></td><td>{operatorName(entry.operatorId)}<small>{entry.courierId}</small></td><td>{entry.period}</td><td>{money(entry.customerMinor)}</td><td>{money(entry.incomeMinor)}</td><td>{money(entry.paidMinor)}</td></tr>{:else}<tr><td colspan="6" class="empty">Записів за вибраними умовами немає.</td></tr>{/each}</tbody></table></div>
				<Dac7Pagination bind:currentPage bind:pageSize totalItems={visibleRows.length} />
				{#if section === 'operations' && persona.kind === 'operator' && integration}{#key personaId}<LazyPanel load={() => import('./IntegrationPanel.svelte')}>{#snippet children(Panel)}{#if integration}<Panel mode="operations" {persona} data={integration} {execute} {importRecords} />{/if}{/snippet}</LazyPanel>{/key}{/if}
			{:else if section === 'integrations' && integration}
				{#key personaId}<LazyPanel load={() => import('./IntegrationPanel.svelte')}>{#snippet children(Panel)}{#if integration}<Panel {persona} data={integration} {execute} {importRecords} />{/if}{/snippet}</LazyPanel>{/key}
			{:else if section === 'couriers'}
				{#if workflow}{#key personaId}<LazyPanel load={() => import('./PeoplePanel.svelte')}>{#snippet children(Panel)}{#if workflow}<Panel mode="couriers" {persona} data={workflow} {contexts} {execute} />{/if}{/snippet}</LazyPanel>{/key}{/if}
			{:else if section === 'platforms' && persona.kind === 'admin'}
								<h2>Черга проблем</h2>
								<div class="table-scroll"><table aria-label="Технічні проблеми"><thead><tr><th>Оператор</th><th>Ресурс</th><th>Посилання</th><th>Стан</th></tr></thead><tbody>{#each issues as issue, index (`${issue.operatorId}-${index}`)}<tr><td>{operatorName(issue.operatorId)}</td><td>{issue.resource}</td><td class="mono">{issue.reference}</td><td>{issue.status}</td></tr>{:else}<tr><td colspan="4">Невирішених технічних проблем немає.</td></tr>{/each}</tbody></table></div>
				<label for="suspension-reason">Причина операційного рішення<input id="suspension-reason" bind:value={suspensionReason} maxlength="500" /></label>
				{#each operations as operator (operator.id)}<section class="admin-operator"><h2>{operator.name}</h2><p>{operator.suspended ? 'Призупинено' : 'Активний'} · реєстрація: {operator.registration}</p><p>Активні тестові ключі: {operator.activeKeys} · події: {operator.eventCount}</p><p>Виплати на звірці: {operator.unresolvedPayouts} · проблеми звітів: {operator.reportIssues}</p><button onclick={() => suspensionTarget = operator.id}>{operator.suspended ? 'Відновити роботу' : 'Призупинити'} · {operator.id}</button>{#if suspensionTarget === operator.id}<div class="notice"><p>Підтвердити зміну операційного статусу {operator.name}?</p><button disabled={!suspensionReason.trim()} onclick={() => { if (execute({ type: 'operator.status', suspended: !operator.suspended, reason: suspensionReason }, operator.id)) suspensionTarget = ''; }}>Підтвердити рішення</button><button onclick={() => suspensionTarget = ''}>Скасувати</button></div>{/if}</section>{/each}
			{:else if section === 'platforms'}
				<div class="table-scroll"><table><thead><tr><th>Оператор</th><th>ID</th><th>Середовище</th></tr></thead><tbody>{#each view.operators as operator (operator.id)}<tr><td>{operator.name}</td><td class="mono">{operator.id}</td><td>DEMO</td></tr>{/each}</tbody></table></div>
			{:else if section === 'team'}
				{#if workflow}{#key personaId}<LazyPanel load={() => import('./PeoplePanel.svelte')}>{#snippet children(Panel)}{#if workflow}<Panel mode="team" {persona} data={workflow} {contexts} {execute} />{/if}{/snippet}</LazyPanel>{/key}{/if}
			{:else if section === 'audit'}
				{#if persona.kind === 'admin' || accessRequests.length}{#key personaId}<LazyPanel load={() => import('./AccessPanel.svelte')}>{#snippet children(Panel)}<Panel {persona} requests={accessRequests} operators={view?.operators ?? []} {execute} read={readAccess} />{/snippet}</LazyPanel>{/key}{/if}
				{#each [...technicalAudit].reverse() as event, index (`${event.at}-${index}`)}<p>{event.at} · {event.operatorId} · {event.actorId} · {event.suspended ? 'Призупинено' : 'Роботу відновлено'}: {event.reason}</p>{/each}
				<p>Локальний журнал змін і погоджених переглядів підтримки DEMO. Звичайні перегляди та відхилені спроби не записуються; це не захищений серверний аудит.</p>
				<div class="table-scroll"><table aria-label="Журнал змін"><thead><tr><th>Час</th><th>Оператор</th><th>Демоперсона</th><th>Дія</th><th>Результат</th></tr></thead><tbody>{#each journal as entry, index (`${entry.at}-${index}`)}<tr><td>{new Date(entry.at).toLocaleString('uk-UA')}</td><td>{entry.operatorId}</td><td>{entry.actorId}</td><td>{entry.action}</td><td>Застосовано · DEMO</td></tr>{:else}<tr><td colspan="5" class="empty">Доступних подій немає.</td></tr>{/each}</tbody></table></div>
			{:else}
				<div class="empty"><FileText size={30} /><h2>{title}</h2><p>Дані розділу недоступні.</p></div>
			{/if}
		{/if}
		<footer>DEMO · синтетичний набір v1 · права моделюються лише локально</footer>
	</main>
</div>

<style>
	.skip-link { position: fixed; top: 8px; left: 8px; z-index: 50; transform: translateY(-200%); background: #fff; color: #126450; padding: 12px 20px; border: 2px solid #126450; border-radius: 4px; }
	.skip-link:focus { transform: translateY(0); }
	.demo-shell { --line: #d7dadd; --muted: #60666f; --accent: #176c63; display: grid; grid-template-columns: 246px minmax(0, 1fr); min-height: 100vh; background: #f5f6f7; color: #23262b; font-family: 'Manrope', sans-serif; letter-spacing: 0; }
	aside { padding: 24px 16px; border-right: 1px solid var(--line); background: #fff; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
	.brand { display: flex; align-items: center; gap: 12px; color: #153e34; text-decoration: none; font-size: 16px; }
	.brand strong { display: block; font-size: 21px; }
	.environment { font-size: 12px; color: var(--muted); margin: 10px 0; }
	.environment span { background: #eaf4ef; color: #1c604e; padding: 4px 7px; border-radius: 4px; font-size: 11px; font-weight: 600; }
	.context-label { font-size: 12px; color: var(--muted); }
	select, input { width: 100%; min-width: 0; border: 1px solid #bbc7c5; border-radius: 6px; background: white; padding: 10px; font: inherit; font-size: 13px; color: inherit; }
	nav { display: grid; gap: 4px; margin-top: 12px; }
	button { cursor: pointer; font: inherit; font-size: 13px; border: 1px solid var(--line); border-radius: 6px; background: white; padding: 10px 12px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; color: inherit; }
	nav button { justify-content: flex-start; border-color: transparent; min-height: 42px; }
	nav button.active { color: #075e4c; background: #e5f1ec; font-weight: 600; }
	.nav-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex: 0 0 28px; color: #60666f; }
	nav button.active .nav-icon { color: #075e4c; }
	button:hover { background: #edf2f0; }
	button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid #ffac5f; outline-offset: 3px; }
	.sidebar-bottom { margin-top: auto; padding-top: 28px; display: grid; gap: 12px; }
	.sidebar-bottom a { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--muted); text-decoration: none; }
	main { min-width: 0; padding: 30px 36px; overflow-wrap: anywhere; }
	header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
	.eyebrow { color: var(--muted); font-size: 12px; margin: 0 0 6px; }
	h1 { font-size: 27px; font-weight: 650; margin: 0; }
	h2 { font-size: 17px; margin: 26px 0 14px; }
	.icon-button { width: 42px; height: 42px; flex-shrink: 0; }
	.disclosure { padding: 12px 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 1.6; }
	.filters { display: flex; flex-wrap: wrap; gap: 16px; margin: 22px 0; }
	.filters > div { width: 210px; font-size: 12px; display: grid; gap: 6px; }
	.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; padding: 24px 0; border-bottom: 1px solid var(--line); }
	.metrics span { display: block; font-size: 12px; color: var(--muted); }
	.metrics strong { display: block; font-size: 22px; margin-top: 9px; overflow-wrap: anywhere; }
	.metrics > div:nth-child(2) strong { color: #087b64; }
	.metrics > div:nth-child(3) strong { color: #95641a; }
	.table-scroll { width: 100%; overflow-x: auto; margin-top: 20px; }
	table { border-collapse: collapse; width: 100%; font-size: 13px; text-align: left; }
	th { color: var(--muted); font-size: 11px; background: #f0f4f2; font-weight: 600; }
	th, td { padding: 14px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
	td { background: #fff; }
	td small { display: block; color: var(--muted); margin-top: 5px; }
	.mono { font-family: monospace; }
	.notice { padding: 14px; background: #eaf4ef; font-size: 13px; border-left: 3px solid #19826b; margin: 16px 0; }
	.notice.error { background: #fff2ee; border-color: #bd4934; color: #8a3426; }
	.actions { display: flex; flex-wrap: wrap; gap: 8px; }
	form { display: grid; gap: 10px; max-width: 480px; font-size: 13px; }
	form button { justify-self: start; }
	.primary { background: #086b55; color: white; }
	.primary:hover { background: #064d3d; }
	.search { display: grid; gap: 7px; font-size: 12px; max-width: 370px; margin-top: 20px; }
	.empty { color: var(--muted); font-size: 13px; padding: 28px 12px; line-height: 1.7; }
	footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; }
	@media (max-width: 1000px) { main { padding: 24px; } .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
	@media (max-width: 700px) { .demo-shell { grid-template-columns: minmax(0, 1fr); } aside { padding: 16px; border-right: 0; border-bottom: 1px solid var(--line); } nav { display: flex; overflow-x: auto; padding-bottom: 5px; } nav button { white-space: nowrap; flex-shrink: 0; } .sidebar-bottom { margin: 0; padding-top: 6px; display: flex; justify-content: space-between; gap: 12px; } .sidebar-bottom a { max-width: 160px; } main { padding: 22px 16px; } .metrics { gap: 18px; } .metrics strong { font-size: 20px; } th, td { padding: 12px 10px; min-width: 105px; } .filters > div { width: 100%; } }
</style>