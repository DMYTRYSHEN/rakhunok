<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, Check, LogOut, RefreshCw, Search, ShieldCheck, X } from '@lucide/svelte';
	import QRCode from 'qrcode';
	import { getSupabaseBrowserClient } from '$lib/features/dashboard/api/supabase-browser';
	import { SUPPORT_CABINET_MARKER } from '$lib/features/dashboard/api/support-cabinet';

	type Context = { id: string; targetId: string; merchantId: string; workspace: 'sandbox' | 'live'; expiresAt: string };
	type Client = { targetId: string; merchantId: string; email: string; name: string; active: boolean };
	type PreparedTtl = { operationId: string; digest: string; expiresAt: string; payload: { contextId: string; workspace: 'sandbox' | 'live'; previousSeconds: number | null; nextSeconds: number } };
	type TtlResult = { committed: boolean; operationId: string; tableOrderTtlSeconds: number };
	type TtlOperation = PreparedTtl & { state: 'prepared' | 'committed' | 'cancelled' | 'expired'; result: TtlResult | null };
	class SupportRequestError extends Error {
		readonly status: number;
		constructor(message: string, status: number) { super(message); this.status = status; }
	}
	type Snapshot = {
		merchant: { id: string; name: string; active: boolean; onboardingComplete: boolean };
		settings: { revision: number; document: Record<string, unknown> } | null;
		tableTtl: { storedSeconds: number | null; effectiveSeconds: number };
		entities: { id: string; name: string; iban: string; taxId: string; active: boolean }[];
		terminals: { id: string; name: string; entityId: string; active: boolean }[];
		invoices: { id: string; number: string; type: string; title: string; status: string; amount: number; currency: string; createdAt: string; expiresAt: string | null }[];
	};
	let signedIn = $state(false);
	let ready = $state(false);
	let busy = $state(true);
	let message = $state('');
	let freshMfa = $state(false);
	let canWrite = $state(false);
	let nextSeconds = $state(1800);
	let prepared = $state<PreparedTtl | null>(null);
	let acknowledged = $state(false);
	let commitAttempted = $state(false);
	let receipt = $state('');
	let factorId = $state('');
	let factors = $state<{ id: string; friendly_name?: string; status: string }[]>([]);
	let mfaVerified = $state(false);
	let qr = $state('');
	let code = $state('');
	let query = $state('');
	let searched = $state(false);
	let clients = $state<Client[]>([]);
	let selected = $state('');
	let workspace = $state<'sandbox' | 'live'>('sandbox');
	let reason = $state('');
	let context = $state<Context | null>(null);
	let snapshot = $state<Snapshot | null>(null);
	let now = $state(Date.now());
	const remaining = $derived(context ? Math.max(0, Math.ceil((Date.parse(context.expiresAt) - now) / 1000)) : 0);
	let generation = 0;
	let controller = new AbortController();
	let alive = false;

	function reset() {
		generation += 1;
		controller.abort();
		controller = new AbortController();
		ready = false;
		freshMfa = false;
		canWrite = false;
		prepared = null;
		acknowledged = false;
		commitAttempted = false;
		receipt = '';
		context = null;
		snapshot = null;
		clients = [];
		query = '';
		reason = '';
		selected = '';
		searched = false;
		factorId = '';
		factors = [];
		mfaVerified = false;
		qr = '';
		code = '';
	}

	async function rpc<Result>(action: string, input: Record<string, unknown> = {}): Promise<Result> {
		const version = generation;
		const signal = controller.signal;
		const client = getSupabaseBrowserClient();
		const session = await client?.auth.getSession();
		if (!session?.data.session || session.error) throw new Error('Потрібен вхід адміністратора.');
		if (version !== generation || signal.aborted) throw new DOMException('Stale request', 'AbortError');
		const response = await fetch(`/dashboard/api/support/${action}`, {
			method: 'POST', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.data.session.access_token}` },
			body: JSON.stringify(input)
		});
		if (!response.ok) {
			if (version !== generation || signal.aborted) throw new DOMException('Stale request', 'AbortError');
			if (response.status === 403) freshMfa = false;
			const messages: Record<number, string> = {
				401: 'Сесія завершена. Увійдіть повторно.',
				403: 'Доступ не підтверджено. Перевірте роль, MFA та строк контексту.',
				409: 'Конфлікт стану або завершений строк операції. Оновіть дані перед новою зміною.',
				429: 'Забагато запитів. Спробуйте пізніше.',
				503: 'Сервер підтримки недоступний або ще не налаштований.'
			};
			throw new SupportRequestError(messages[response.status] ?? 'Запит не виконано. Перевірте дані.', response.status);
		}
		const result: Result = await response.json();
		if (version !== generation || signal.aborted) throw new DOMException('Stale request', 'AbortError');
		return result;
	}

	async function run(operation: () => Promise<void>) {
		const version = generation;
		busy = true;
		message = '';
		try { await operation(); }
		catch (error) {
			if (alive && version === generation && !(error instanceof DOMException && error.name === 'AbortError')) {
				snapshot = null;
				message = error instanceof Error ? error.message : 'Запит не виконано.';
			}
		} finally { if (alive && version === generation) busy = false; }
	}

	async function refresh() {
		snapshot = null;
		if (!context) return;
		const result = await rpc<{ context: Context; data: Snapshot }>('snapshot', { sessionId: context.id });
		context = result.context;
		snapshot = Date.parse(result.context.expiresAt) > Date.now() ? result.data : null;
		if (snapshot) nextSeconds = snapshot.tableTtl.effectiveSeconds;
		await reconcileTtl();
	}

	async function bootstrap() {
		const result = await rpc<{ freshMfa: boolean; canWrite: boolean; context: Context | null }>('bootstrap');
		ready = true;
		freshMfa = result.freshMfa;
		mfaVerified = result.freshMfa;
		canWrite = result.canWrite === true;
		context = result.context;
		if (context) await refresh();
	}

	async function initialize() {
		const version = generation;
		const client = getSupabaseBrowserClient();
		if (!client) throw new Error('Не налаштовано Supabase цього середовища.');
		const { data, error } = await client.auth.getSession();
		if (error) throw error;
		if (version !== generation) return;
		signedIn = Boolean(data.session);
		if (!data.session) return;
		const factorResult = await client.auth.mfa.listFactors();
		if (factorResult.error) throw factorResult.error;
		if (version !== generation) return;
		factors = factorResult.data.all.filter((factor) => factor.factor_type === 'totp');
		factorId = factors.find((factor) => factor.status === 'verified')?.id
			?? factors.find((factor) => factor.friendly_name === 'Dashboard Support')?.id
			?? factors[0]?.id ?? '';
		const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
		if (assurance.error) throw assurance.error;
		if (version !== generation) return;
		mfaVerified = assurance.data.currentLevel === 'aal2';
		if (mfaVerified) await bootstrap();
	}

	async function enroll() {
		const version = generation;
		const client = getSupabaseBrowserClient();
		if (!client) return;
		const available = await client.auth.mfa.listFactors();
		if (available.error) throw available.error;
		if (version !== generation) return;
		factors = available.data.all.filter((factor) => factor.factor_type === 'totp');
		if (factors.length > 0) {
			factorId = factors.find((factor) => factor.status === 'verified')?.id ?? factors[0].id;
			return;
		}
		const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Dashboard Support' });
		if (error) throw error;
		const image = await QRCode.toDataURL(data.totp.uri, { width: 224, margin: 2 });
		if (version !== generation) return;
		factorId = data.id;
		factors = [{ id: data.id, friendly_name: 'Dashboard Support', status: 'unverified' }];
		qr = image;
	}

	async function verify() {
		const version = generation;
		const client = getSupabaseBrowserClient();
		if (!client || !factorId || !/^[0-9]{6}$/.test(code)) return;
		const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
		if (version !== generation) return;
		code = '';
		if (error) {
			const messages: Record<string, string> = {
				mfa_verification_failed: 'Код не підтверджено. Перевірте вибраний автентифікатор і автоматичний час на телефоні, потім введіть новий код.',
				mfa_challenge_expired: 'Строк перевірки завершився. Введіть новий код.',
				over_request_rate_limit: 'Забагато спроб. Зачекайте перед повторною перевіркою.'
			};
			throw new Error(messages[error.code ?? ''] ?? 'Не вдалося підтвердити автентифікатор. Спробуйте ще раз.');
		}
		qr = '';
		mfaVerified = true;
		await bootstrap();
	}

	async function search() {
		clients = [];
		selected = '';
		searched = false;
		const result = await rpc<{ clients: Client[] }>('search', { query: query.trim() });
		clients = result.clients;
		searched = true;
	}

	async function open() {
		const target = clients.find((item) => item.merchantId === selected);
		if (!target) return;
		context = await rpc<Context>('open', { targetId: target.targetId, merchantId: target.merchantId, workspace, reason: reason.trim() });
		clients = [];
		query = '';
		selected = '';
		await refresh();
	}

	async function end() {
		const active = context;
		snapshot = null;
		prepared = null;
		receipt = '';
		if (!active) return;
		await rpc('end', { sessionId: active.id });
		context = null;
		reason = '';
		searched = false;
	}

	function exit() {
		generation += 1;
		controller.abort();
		controller = new AbortController();
		void run(end);
	}

	function enterCabinet() {
		if (!context || !snapshot || busy || remaining === 0 || prepared) return;
		sessionStorage.setItem(SUPPORT_CABINET_MARKER, '1');
		window.location.assign('/dashboard');
	}

	async function prepareTtl() {
		if (!context || prepared) return;
		receipt = '';
		await rpc('elevate', { sessionId: context.id });
		prepared = await rpc<PreparedTtl>('prepare', { sessionId: context.id, action: 'settings.table_ttl', nextSeconds });
		acknowledged = false;
		commitAttempted = false;
	}

	function showReceipt(result: TtlResult, operation: PreparedTtl) {
		if (result?.committed !== true || result.operationId !== operation.operationId || result.tableOrderTtlSeconds !== operation.payload.nextSeconds) throw new Error('Результат операції не підтверджено.');
		receipt = `Збережено: ${result.tableOrderTtlSeconds / 60} хв. Операція ${result.operationId}`;
		prepared = null;
		commitAttempted = false;
	}

	async function reconcileTtl() {
		if (!context) return;
		const expectedId = prepared?.operationId;
		const { operation } = await rpc<{ operation: TtlOperation | null }>('operation', {
			sessionId: context.id, ...(expectedId ? { operationId: expectedId } : {})
		});
		if (!operation) {
			if (expectedId) throw new Error('Результат операції не підтверджено.');
			return;
		}
		if (operation.payload?.contextId !== context.id || operation.payload.workspace !== context.workspace ||
			(expectedId && operation.operationId !== expectedId) || !/^[a-f0-9]{64}$/.test(operation.digest) ||
			!Number.isFinite(Date.parse(operation.expiresAt)) || ![1800, 3600, 7200, 18000].includes(operation.payload.nextSeconds)) {
			throw new Error('Результат операції не підтверджено.');
		}
		if (operation.state === 'committed' && operation.result) showReceipt(operation.result, operation);
		else if (operation.state === 'prepared') {
			prepared = operation;
			commitAttempted = false;
			acknowledged = false;
		} else if (operation.state === 'expired' || operation.state === 'cancelled') {
			prepared = null;
			commitAttempted = false;
			receipt = operation.state === 'expired' ? 'Строк підтвердження завершився. Зміну не виконано.' : 'Операцію скасовано.';
		} else throw new Error('Результат операції не підтверджено.');
	}

	async function commitTtl() {
		if (!context || !prepared || !acknowledged) return;
		await rpc('elevate', { sessionId: context.id });
		if (!context || !prepared) return;
		commitAttempted = true;
		try {
			const result = await rpc<TtlResult>('commit', {
				sessionId: context.id, operationId: prepared.operationId, digest: prepared.digest,
				acknowledgement: context.workspace === 'live' ? 'CHANGE_LIVE_BUSINESS' : 'CHANGE_SANDBOX'
			});
			showReceipt(result, prepared);
		} catch (error) {
			if (error instanceof SupportRequestError && [400, 401, 403, 409, 429].includes(error.status)) {
				commitAttempted = false;
				acknowledged = false;
			}
			throw error;
		}
		await refresh();
	}

	async function cancelTtl() {
		if (!context || !prepared) return;
		await rpc('cancel', { sessionId: context.id, operationId: prepared.operationId });
		prepared = null;
		commitAttempted = false;
		await refresh();
	}

	onMount(() => {
		alive = true;
		const client = getSupabaseBrowserClient();
		let identity = '';
		const subscription = client?.auth.onAuthStateChange((event, session) => {
			let sessionId = '';
			if (session) {
				try {
					const payload = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
					sessionId = JSON.parse(atob(payload)).session_id ?? session.access_token;
				} catch { sessionId = session.access_token; }
			}
			const nextIdentity = session ? `${session.user.id}:${sessionId}` : '';
			if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT' || nextIdentity !== identity) {
				identity = nextIdentity;
				reset();
				signedIn = Boolean(session);
				queueMicrotask(() => { if (alive) void run(initialize); });
			}
		});
		if (!client) void run(initialize);
		const timer = setInterval(() => {
			now = Date.now();
			if (context && (snapshot || prepared) && Date.parse(context.expiresAt) <= now) {
				controller.abort();
				controller = new AbortController();
				snapshot = null;
				prepared = null;
				receipt = '';
			}
		}, 1000);
		return () => { alive = false; reset(); clearInterval(timer); subscription?.data.subscription.unsubscribe(); };
	});
</script>

<svelte:head>
	<title>Підтримка клієнтів | Рахунок</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main>
	<header><a href="/dashboard" aria-label="До Dashboard"><ArrowLeft size={20} /></a><h1>Підтримка клієнтів</h1><ShieldCheck size={24} /></header>
	{#if message}<p class="error" role="alert">{message}</p>{/if}
	{#if !signedIn}
		<section><h2>Обліковий запис адміністратора</h2><a href="/dashboard">Увійти в Dashboard</a></section>
	{:else}
		{#if mfaVerified && !ready}
			<section><h2>Особу адміністратора підтверджено</h2><button disabled={busy} onclick={() => void run(bootstrap)}><RefreshCw size={18} />Повторити перевірку доступу</button></section>
		{:else if !freshMfa}
			<section class="verification"><h2>Підтвердження адміністратора</h2>
				{#if qr}<img src={qr} alt="QR-код підключення автентифікатора" width="224" height="224" />{/if}
				{#if factorId}
					{#if factors.length > 1}<label>Автентифікатор<select bind:value={factorId} disabled={busy} onchange={() => { qr = ''; code = ''; }}>{#each factors as factor (factor.id)}<option value={factor.id}>{factor.friendly_name || 'Автентифікатор'} · {factor.status === 'verified' ? 'Підключений' : 'Очікує підтвердження'}</option>{/each}</select></label>{/if}
					{#if factors.find((factor) => factor.id === factorId)?.status === 'unverified' && !qr}<p role="status">Підключення автентифікатора очікує підтвердження.</p>{/if}
					<form onsubmit={(event) => { event.preventDefault(); void run(verify); }}>
						<label>Код автентифікатора<input bind:value={code} inputmode="numeric" autocomplete="one-time-code" pattern={'[0-9]{6}'} maxlength="6" required /></label>
						<button disabled={busy || code.length !== 6}><ShieldCheck size={18} />Підтвердити</button>
					</form>
				{:else}<button disabled={busy} onclick={() => void run(enroll)}>Підключити автентифікатор</button>{/if}
			</section>
		{/if}
		{#if context}
			<section class:live={context.workspace === 'live'} class="context">
				<div><strong>{context.workspace === 'live' ? 'Реальний бізнес' : 'Тестова копія'}</strong><span>{canWrite ? 'Перегляд і строк нових рахунків за столиком' : 'Лише перегляд'}</span></div>
				<p>{context.targetId}<br />{context.merchantId}</p>
				<time>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</time>
				<button onclick={exit}><LogOut size={18} />Завершити підтримку</button>
			</section>
			<div class="section-heading"><h2>{snapshot?.merchant.name ?? 'Дані клієнта'}</h2><button title="Оновити дані" aria-label="Оновити дані" disabled={busy || remaining === 0} onclick={() => void run(refresh)}><RefreshCw size={18} /></button></div>
			<button disabled={busy || !snapshot || remaining === 0 || Boolean(prepared)} onclick={enterCabinet}><ShieldCheck size={18} />Відкрити кабінет клієнта</button>
			{#if remaining === 0}<p role="status">Строк доступу завершився.</p>{/if}
			{#if receipt}<p class="receipt" role="status">{receipt}</p>{/if}
			{#if prepared}
				<section class="ttl-review" aria-label="Підтвердження строку рахунків">
					<h3>Строк нових рахунків за столиком</h3>
					<p>{(prepared.payload.previousSeconds ?? 1800) / 60} хв → {prepared.payload.nextSeconds / 60} хв</p>
					<p>{context.workspace === 'live' ? 'Зміна в реальному бізнесі. Наявні рахунки не зміняться.' : 'Зміна лише в тестовій копії.'}</p>
					<p>Підтвердження до {new Date(prepared.expiresAt).toLocaleTimeString('uk-UA')}</p>
					{#if commitAttempted}<p role="status">Результат ще не підтверджено. Повторна перевірка використовує ту саму операцію.</p>{/if}
					<label class="acknowledgement"><input type="checkbox" bind:checked={acknowledged} disabled={busy || commitAttempted} />Підтверджую зміну {context.workspace === 'live' ? 'в реальному бізнесі' : 'в тестовій копії'}</label>
					<div class="ttl-actions">
						{#if commitAttempted}
							<button disabled={busy || remaining === 0} onclick={() => void run(refresh)}><RefreshCw size={18} />Перевірити результат</button>
						{:else}
							<button disabled={busy || !canWrite || !freshMfa || !acknowledged || remaining === 0 || Date.parse(prepared.expiresAt) <= now} onclick={() => void run(commitTtl)}><Check size={18} />Підтвердити зміну</button>
						{/if}
						<button disabled={busy || commitAttempted} onclick={() => void run(cancelTtl)}><X size={18} />Скасувати</button>
					</div>
				</section>
			{/if}
			{#if snapshot}
				<section><h3>Бізнес</h3><p>{snapshot.merchant.active ? 'Активний' : 'Неактивний'} · Онбординг: {snapshot.merchant.onboardingComplete ? 'завершений' : 'незавершений'}</p></section>
				<section><h3>Платіжні налаштування</h3>
					{#if snapshot.settings}<p>Ревізія {snapshot.settings.revision}</p><pre>{JSON.stringify(snapshot.settings.document, null, 2)}</pre>{:else}<p>Налаштування відсутні</p>{/if}
				</section>
				<section><h3>Строк рахунків за столиком</h3><p>{snapshot.tableTtl.effectiveSeconds / 60} хв</p>
					{#if canWrite && !prepared}
						<form onsubmit={(event) => { event.preventDefault(); void run(prepareTtl); }}>
							<label>Новий строк<select bind:value={nextSeconds}><option value={1800}>30 хвилин</option><option value={3600}>1 година</option><option value={7200}>2 години</option><option value={18000}>5 годин</option></select></label>
							<button disabled={busy || !freshMfa || remaining === 0 || nextSeconds === snapshot.tableTtl.effectiveSeconds}><ShieldCheck size={18} />Переглянути зміну</button>
						</form>
					{/if}
				</section>
				<section><h3>Юридичні особи</h3><div class="table-scroll"><table><thead><tr><th>Назва</th><th>IBAN</th><th>Податковий номер</th><th>Статус</th></tr></thead><tbody>{#each snapshot.entities as entity (entity.id)}<tr><td>{entity.name}</td><td>{entity.iban}</td><td>{entity.taxId}</td><td>{entity.active ? 'Активна' : 'Неактивна'}</td></tr>{:else}<tr><td colspan="4">Немає юридичних осіб</td></tr>{/each}</tbody></table></div></section>
				<section><h3>Термінали</h3><ul>{#each snapshot.terminals as terminal (terminal.id)}<li>{terminal.name} · {terminal.active ? 'Активний' : 'Неактивний'}</li>{:else}<li>Немає терміналів</li>{/each}</ul></section>
				<section><h3>Останні рахунки</h3><div class="table-scroll"><table><thead><tr><th>Номер</th><th>Назва</th><th>Сценарій</th><th>Сума</th><th>Статус</th></tr></thead><tbody>{#each snapshot.invoices as invoice (invoice.id)}<tr><td>{invoice.number}</td><td>{invoice.title}</td><td>{invoice.type}</td><td>{invoice.amount} {invoice.currency}</td><td>{invoice.status}</td></tr>{:else}<tr><td colspan="5">Немає рахунків</td></tr>{/each}</tbody></table></div></section>
			{/if}
		{:else if ready && freshMfa}
			<section><h2>Клієнт</h2><form onsubmit={(event) => { event.preventDefault(); void run(search); }}><label>Email або UID<input bind:value={query} minlength="3" maxlength="254" required /></label><button disabled={busy}><Search size={18} />Знайти</button></form></section>
			{#if searched && clients.length === 0}<p role="status">Клієнта з таким email або UID не знайдено.</p>{/if}
			{#if clients.length > 0}
				<form class="open-form" onsubmit={(event) => { event.preventDefault(); void run(open); }}>
					<label>Бізнес<select bind:value={selected} required><option value="">Оберіть бізнес</option>{#each clients as client (client.merchantId)}<option value={client.merchantId}>{client.name} · {client.email}</option>{/each}</select></label>
					<fieldset><legend>Робоче середовище</legend><label><input type="radio" bind:group={workspace} value="sandbox" />Тестова копія</label><label><input type="radio" bind:group={workspace} value="live" />Реальний бізнес</label></fieldset>
					<label>Причина доступу<textarea bind:value={reason} minlength="10" maxlength="500" required></textarea></label>
					<button disabled={busy || !selected || reason.trim().length < 10}>Відкрити контекст</button>
				</form>
			{/if}
		{/if}
	{/if}
	{#if busy}<p role="status">Завантаження…</p>{/if}
</main>

<style>
	main { max-width: 1120px; margin: 0 auto; padding: 24px; color: var(--text-primary, #202923); font-family: 'Manrope', sans-serif; letter-spacing: 0; }
	header, .section-heading { display: flex; align-items: center; gap: 16px; }
	header { border-bottom: 1px solid #ccd4cf; padding-bottom: 20px; }
	h1 { font-size: 24px; flex: 1; margin: 0; }
	h2 { font-size: 20px; margin: 0 0 16px; }
	h3 { font-size: 17px; margin: 0 0 12px; }
	section { padding: 24px 0; border-bottom: 1px solid #ccd4cf; }
	a { color: #23714b; }
	form { display: flex; align-items: end; flex-wrap: wrap; gap: 16px; }
	label { display: flex; flex-direction: column; gap: 8px; font-size: 14px; flex: 1; min-width: min(240px, 100%); }
	input, select, textarea { min-width: 0; max-width: 100%; width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #8c9a90; border-radius: 4px; background: var(--bg-surface, #fff); color: inherit; font: inherit; }
	button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 10px 14px; border: 1px solid #8c9a90; border-radius: 4px; background: var(--bg-surface, #fff); color: inherit; font: inherit; cursor: pointer; }
	button:disabled { opacity: .5; cursor: default; }
	.context { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; border-bottom: 3px solid #23714b; }
	.context.live { border-color: #aa4839; }
	.context div { display: grid; gap: 4px; }
	.context span { font-size: 13px; }
	.context p { font-size: 12px; overflow-wrap: anywhere; flex: 1; }
	time { font-variant-numeric: tabular-nums; min-width: 48px; }
	.section-heading { margin-top: 24px; justify-content: space-between; }
	.section-heading h2 { margin: 0; }
	.error { background: #fae8e4; color: #813025; padding: 16px; overflow-wrap: anywhere; }
	.receipt { overflow-wrap: anywhere; }
	.ttl-review { border-bottom: 2px solid #aa4839; }
	.acknowledgement { flex-direction: row; align-items: center; margin-bottom: 16px; }
	.acknowledgement input { width: auto; }
	.ttl-actions { display: flex; flex-wrap: wrap; gap: 12px; }
	pre { font-size: 13px; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 400px; overflow: auto; }
	.table-scroll { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 14px; }
	th, td { padding: 12px 8px; border-bottom: 1px solid #dbe1dd; text-align: left; overflow-wrap: anywhere; }
	th { font-weight: 600; }
	.open-form { margin-top: 24px; flex-direction: column; align-items: stretch; }
	fieldset { display: flex; flex-wrap: wrap; gap: 20px; border: 0; padding: 12px 0; }
	fieldset label { flex-direction: row; align-items: center; flex: none; min-width: auto; }
	fieldset input { width: auto; }
	.verification { max-width: 560px; }
	.verification img { display: block; margin-bottom: 20px; }
	@media (max-width: 600px) { main { padding: 16px; } h1 { font-size: 20px; } form > button { width: 100%; } .context button { width: 100%; } }
</style>