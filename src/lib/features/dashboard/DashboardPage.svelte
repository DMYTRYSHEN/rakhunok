<script module lang="ts">
	import type { DashboardSessionState } from './types';

	let cachedSessionState: Extract<DashboardSessionState, { status: 'ready' }> | null = null;
	let cachedTableOrderTtlSeconds = 1_800;
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import DashboardLogin from './auth/DashboardLogin.svelte';
	import MerchantOnboarding from './auth/MerchantOnboarding.svelte';
	import DashboardStateScreen from './auth/DashboardStateScreen.svelte';
	import DashboardShell from './components/DashboardShell.svelte';
	import { demoInvoiceEvents } from './data/invoice-events';
	import { demoInvoices } from './data/invoices';
	import { overviewSnapshot } from './data/overview';
	import { demoPosBoard } from './data/pos';
	import { selectExpiredPendingInvoices } from './notifications/invoice-attention';
	import { getDashboardGateway } from './api/supabase-browser';
	import {
		DEFAULT_TABLE_ORDER_TTL_SECONDS,
		type DashboardRealtimeResource,
		type DashboardRealtimeScope
	} from './api/dashboard-gateway';
	import type {
		BusinessEntityInput,
		BusinessStructureData,
		InvoiceEvent,
		InvoiceRecord,
		PosBoard as PosBoardData,
		TerminalInput
	} from './types';

	function lazyModule<T>(loader: () => Promise<T>) {
		let modulePromise: Promise<T> | undefined;
		return () => (modulePromise ??= loader());
	}

	const loadDashboardOverview = lazyModule(() => import('./overview/DashboardOverview.svelte'));
	const loadPosBoard = lazyModule(() => import('./pos/PosBoard.svelte'));
	const loadInvoiceList = lazyModule(() => import('./invoices/InvoiceList.svelte'));
	const loadInvoiceCreate = lazyModule(() => import('./invoices/InvoiceCreate.svelte'));
	const loadDashboardSettings = lazyModule(() => import('./settings/DashboardSettings.svelte'));
	const loadInvoiceRulesSettings = lazyModule(
		() => import('./invoice-rules/InvoiceRulesSettings.svelte')
	);
	const loadPaymentMethodsSettings = lazyModule(
		() => import('./payment-methods/PaymentMethodsSettings.svelte')
	);
	const loadPublicPageSettings = lazyModule(
		() => import('./public-page/PublicPageSettings.svelte')
	);
	const loadTeamSettings = lazyModule(() => import('./team/TeamSettings.svelte'));
	const loadDeveloperApi = lazyModule(() => import('./developer-api/DeveloperApi.svelte'));
	const loadPaymentSandbox = lazyModule(() => import('./sandbox/PaymentSandbox.svelte'));
	const loadBusinessStructure = lazyModule(() => import('./structure/BusinessStructure.svelte'));
	const loadInvoiceDetail = lazyModule(() => import('./invoices/InvoiceDetail.svelte'));

	let {
		view = 'overview',
		invoiceId
	}: {
		view?:
			| 'overview'
			| 'invoices'
			| 'invoice'
			| 'invoice-create'
			| 'invoice-rules'
			| 'payment-methods'
			| 'public-page'
			| 'pos'
			| 'sandbox'
			| 'settings'
			| 'structure'
			| 'team'
			| 'developer-api';
		invoiceId?: string;
	} = $props();

	function preloadActiveView() {
		const loaders = {
			overview: loadDashboardOverview,
			invoices: loadInvoiceList,
			invoice: loadInvoiceDetail,
			'invoice-create': loadInvoiceCreate,
			'invoice-rules': loadInvoiceRulesSettings,
			'payment-methods': loadPaymentMethodsSettings,
			'public-page': loadPublicPageSettings,
			pos: loadPosBoard,
			settings: loadDashboardSettings,
			structure: loadBusinessStructure,
			team: loadTeamSettings,
			'developer-api': loadDeveloperApi,
			sandbox: loadPaymentSandbox
		};
		return loaders[view]();
	}

	let sessionState = $state<DashboardSessionState>(cachedSessionState ?? { status: 'loading' });
	let gateway = $state<ReturnType<typeof getDashboardGateway>>(null);
	let invoices = $state<InvoiceRecord[]>([]);
	let attentionInvoices = $state<InvoiceRecord[]>([]);
	let attentionError = $state<string | null>(null);
	let contentError = $state<string | null>(null);
	let contentLoading = $state(false);
	let invoiceEvents = $state<InvoiceEvent[]>([]);
	let eventsLoading = $state(false);
	let eventsError = $state<string | null>(null);
	let posBoard = $state<PosBoardData>({ terminals: [], activeOrders: [] });
	let tableOrderTtlSeconds = $state(cachedTableOrderTtlSeconds);
	let structureData = $state<BusinessStructureData>({ entities: [], terminals: [] });
	let stopRealtimeSync = () => {};
	let stopAuthSync = () => {};
	let destroyed = false;
	let posRefreshPromise: Promise<void> | null = null;
	let posRefreshQueued = false;
	let realtimeRefreshPromise: Promise<void> | null = null;
	const pendingRealtimeResources = new SvelteSet<DashboardRealtimeResource>();
	let lastInvoiceId = $state<string | undefined>();
	let selectedInvoice = $derived(invoices.find((invoice) => invoice.id === invoiceId));

	async function restore(showLoading = sessionState.status !== 'ready') {
		if (showLoading) sessionState = { status: 'loading' };

		if (new URLSearchParams(window.location.search).get('demo') === '1') {
			invoices = demoInvoices;
			attentionInvoices = selectExpiredPendingInvoices(demoInvoices);
			invoiceEvents = demoInvoiceEvents;
			posBoard = demoPosBoard;
			structureData = {
				entities: [
					{
						id: 'demo-entity',
						businessType: 'fop',
						businessName: overviewSnapshot.merchantName,
						displayName: overviewSnapshot.merchantName,
						taxId: '1234567890',
						bankName: 'Demo Bank',
						iban: 'UA123456789012345678901234567',
						isActive: true
					}
				],
				terminals: demoPosBoard.terminals.map((terminal) => ({
					...terminal,
					entityId: 'demo-entity'
				}))
			};
			sessionState = {
				status: 'ready',
				user: { id: 'demo-user', email: 'demo@rahunok.app', fullName: 'Demo User' },
				merchant: {
					id: 'demo-merchant',
					userId: 'demo-user',
					businessName: overviewSnapshot.merchantName,
					displayName: overviewSnapshot.merchantName
				},
				snapshot: overviewSnapshot
			};
			cachedSessionState = sessionState;
			return;
		}

		gateway = getDashboardGateway();
		if (!gateway) {
			sessionState = { status: 'configuration-required' };
			return;
		}

		const restoredState = await gateway.restore();
		if (destroyed) return;
		if (restoredState.status === 'ready') {
			try {
				const settings = await gateway.getMerchantSettings(restoredState.merchant.id);
				if (destroyed) return;
				tableOrderTtlSeconds = settings.tableOrderTtlSeconds;
				cachedTableOrderTtlSeconds = settings.tableOrderTtlSeconds;
			} catch (error) {
				console.error('Не вдалося завантажити налаштування замовлень.', error);
				tableOrderTtlSeconds = DEFAULT_TABLE_ORDER_TTL_SECONDS;
				cachedTableOrderTtlSeconds = DEFAULT_TABLE_ORDER_TTL_SECONDS;
			}
		}
		sessionState = restoredState;
		cachedSessionState = restoredState.status === 'ready' ? restoredState : null;
		if (restoredState.status !== 'ready') {
			tableOrderTtlSeconds = DEFAULT_TABLE_ORDER_TTL_SECONDS;
			cachedTableOrderTtlSeconds = DEFAULT_TABLE_ORDER_TTL_SECONDS;
		}
		if (view === 'overview' && sessionState.status === 'ready') {
			contentLoading = true;
			contentError = null;
			try {
				const snapshot = await gateway.getOverview(sessionState.user.id, sessionState.merchant);
				if (destroyed) return;
				sessionState = { ...sessionState, snapshot };
			} catch (error) {
				contentError =
					error instanceof Error ? error.message : 'Не вдалося завантажити фінансовий огляд.';
			} finally {
				contentLoading = false;
			}
		}
		await Promise.all([loadInvoices(), loadAttentionInvoices()]);
		startRealtimeSync();
	}

	async function loadAttentionInvoices() {
		if (sessionState.status !== 'ready' || !gateway) return;
		try {
			const nextInvoices = await gateway.listInvoices(sessionState.merchant.id);
			if (!destroyed) {
				attentionInvoices = selectExpiredPendingInvoices(nextInvoices);
				attentionError = null;
			}
		} catch (error) {
			if (!destroyed) {
				attentionError =
					error instanceof Error ? error.message : 'Не вдалося завантажити сповіщення.';
			}
		}
	}

	async function loadInvoices() {
		if (
			view === 'overview' ||
			view === 'settings' ||
			view === 'invoice-rules' ||
			view === 'payment-methods' ||
			view === 'public-page' ||
			view === 'team' ||
			view === 'developer-api' ||
			view === 'sandbox' ||
			sessionState.status !== 'ready' ||
			!gateway
		)
			return;
		contentLoading = true;
		contentError = null;

		try {
			if (view === 'structure') {
				await refreshStructure();
			} else if (view === 'invoice-create') {
				await Promise.all([refreshPosBoard(), refreshStructure()]);
			} else if (view === 'pos') {
				await refreshPosBoard();
			} else if (view === 'invoice' && invoiceId) {
				const requestedInvoiceId = invoiceId;
				const invoice = await gateway.getInvoice(sessionState.merchant.id, requestedInvoiceId);
				if (requestedInvoiceId !== invoiceId || destroyed) return;
				invoices = invoice ? [invoice] : [];
				if (invoice) void loadInvoiceEvents(invoice.id);
			} else {
				invoices = await gateway.listInvoices(sessionState.merchant.id);
			}
		} catch (error) {
			contentError = error instanceof Error ? error.message : 'Не вдалося завантажити рахунки.';
		} finally {
			contentLoading = false;
		}
	}

	async function refreshPosBoard() {
		if (!gateway || sessionState.status !== 'ready' || destroyed) return;
		if (posRefreshPromise) {
			posRefreshQueued = true;
			await posRefreshPromise;
			return;
		}

		const activeGateway = gateway;
		const userId = sessionState.user.id;
		const merchantId = sessionState.merchant.id;
		posRefreshPromise = (async () => {
			do {
				posRefreshQueued = false;
				const nextBoard = await activeGateway.getPosBoard(userId, merchantId);
				if (!destroyed) posBoard = nextBoard;
			} while (posRefreshQueued && !destroyed);
		})();

		try {
			await posRefreshPromise;
		} finally {
			posRefreshPromise = null;
		}
	}

	async function refreshStructure() {
		if (!gateway || sessionState.status !== 'ready' || destroyed) return;
		const nextStructure = await gateway.getBusinessStructure(sessionState.user.id);
		if (!destroyed) structureData = nextStructure;
	}

	function getRealtimeScope(): DashboardRealtimeScope | null {
		if (sessionState.status !== 'ready' || sessionState.user.id === 'demo-user') return null;
		const userId = sessionState.user.id;
		const merchantId = sessionState.merchant.id;
		if (view === 'overview') return { view, userId, merchantId };
		if (view === 'invoices') return { view, merchantId };
		if (view === 'invoice' && invoiceId) return { view, merchantId, invoiceId };
		if (view === 'invoice-create') return { view, userId };
		if (view === 'pos' || view === 'structure') return { view, userId, merchantId };
		return null;
	}

	function startRealtimeSync() {
		stopRealtimeSync();
		if (!gateway || destroyed) return;
		const scope = getRealtimeScope();
		if (!scope) return;
		const unsubscribe = gateway.subscribeDashboardUpdates(scope, queueRealtimeRefresh);
		stopRealtimeSync = () => {
			unsubscribe();
			stopRealtimeSync = () => {};
		};
	}

	function startAuthSync() {
		stopAuthSync();
		if (!gateway || destroyed) return;
		const unsubscribe = gateway.subscribeAuthChanges((event) => {
			if (destroyed) return;
			if (event === 'signed-out') {
				cachedSessionState = null;
				cachedTableOrderTtlSeconds = DEFAULT_TABLE_ORDER_TTL_SECONDS;
				sessionState = { status: 'guest' };
				stopRealtimeSync();
				return;
			}
			setTimeout(() => {
				if (!destroyed) void restore(false);
			}, 0);
		});
		stopAuthSync = () => {
			unsubscribe();
			stopAuthSync = () => {};
		};
	}

	function queueRealtimeRefresh(resource: DashboardRealtimeResource) {
		pendingRealtimeResources.add(resource);
		if (!document.hidden) void flushRealtimeRefreshes();
	}

	async function flushRealtimeRefreshes() {
		if (realtimeRefreshPromise || destroyed || document.hidden) return realtimeRefreshPromise;
		realtimeRefreshPromise = (async () => {
			while (pendingRealtimeResources.size > 0 && !destroyed && !document.hidden) {
				const resources = [...pendingRealtimeResources];
				pendingRealtimeResources.clear();
				try {
					if (
						resources.includes('overview') ||
						resources.includes('invoices') ||
						resources.includes('invoice') ||
						resources.includes('pos')
					) {
						await loadAttentionInvoices();
					}
					if (resources.includes('overview')) await refreshOverview();
					if (resources.includes('invoices')) await refreshInvoiceList();
					if (resources.includes('invoice')) await refreshInvoiceDetail();
					if (resources.includes('events') && invoiceId) await loadInvoiceEvents(invoiceId, true);
					if (resources.includes('pos') || resources.includes('terminals')) await refreshPosBoard();
					if (resources.includes('structure')) await refreshStructure();
				} catch (error) {
					console.error('Не вдалося оновити дані з Realtime.', error);
				}
			}
		})();
		try {
			await realtimeRefreshPromise;
		} finally {
			realtimeRefreshPromise = null;
		}
	}

	async function refreshOverview() {
		if (!gateway || sessionState.status !== 'ready') return;
		const snapshot = await gateway.getOverview(sessionState.user.id, sessionState.merchant);
		if (!destroyed && view === 'overview') sessionState = { ...sessionState, snapshot };
	}

	async function refreshInvoiceList() {
		if (!gateway || sessionState.status !== 'ready') return;
		const nextInvoices = await gateway.listInvoices(sessionState.merchant.id);
		attentionInvoices = selectExpiredPendingInvoices(nextInvoices);
		attentionError = null;
		if (!destroyed && view === 'invoices') invoices = nextInvoices;
	}

	async function refreshInvoiceDetail() {
		if (!gateway || sessionState.status !== 'ready' || !invoiceId) return;
		const requestedInvoiceId = invoiceId;
		const invoice = await gateway.getInvoice(sessionState.merchant.id, requestedInvoiceId);
		if (!destroyed && view === 'invoice' && invoiceId === requestedInvoiceId) {
			invoices = invoice ? [invoice] : [];
		}
	}

	function handleVisibilityChange() {
		if (!document.hidden) void flushRealtimeRefreshes();
	}

	async function loadInvoiceEvents(invoiceId: string, background = false) {
		if (!gateway) return;
		if (!background) {
			eventsLoading = true;
			eventsError = null;
		}

		try {
			const nextEvents = await gateway.listInvoiceEvents(invoiceId);
			if (!destroyed && invoiceId === selectedInvoice?.id) invoiceEvents = nextEvents;
		} catch (error) {
			if (!background) {
				eventsError = error instanceof Error ? error.message : 'Не вдалося завантажити історію.';
			} else {
				throw error;
			}
		} finally {
			if (!background) eventsLoading = false;
		}
	}

	async function loginWithGoogle(credential: string, nonce: string) {
		if (!gateway) return;
		await gateway.signInWithGoogleIdToken(credential, nonce);
		await restore();
	}

	async function signOut() {
		stopRealtimeSync();
		cachedSessionState = null;
		cachedTableOrderTtlSeconds = DEFAULT_TABLE_ORDER_TTL_SECONDS;
		if (sessionState.status === 'ready' && sessionState.user.id === 'demo-user') {
			window.location.href = '/';
			return;
		}
		if (!gateway) throw new Error('Dashboard API недоступний.');
		await gateway.signOut();
		sessionState = { status: 'guest' };
	}

	async function completeOnboarding(input: import('./types').MerchantOnboardingInput) {
		if (!gateway) throw new Error('Dashboard API недоступний.');
		await gateway.onboardMerchant(input);
		await restore();
	}

	async function createInvoice(input: import('./types').InvoiceCreateInput) {
		if (!gateway) throw new Error('Dashboard API недоступний.');
		return gateway.createInvoice(input);
	}

	async function cancelInvoice(invoiceId: string) {
		if (!gateway) throw new Error('Dashboard API недоступний.');
		await gateway.cancelInvoice(invoiceId);
		attentionInvoices = attentionInvoices.filter((invoice) => invoice.id !== invoiceId);
		await Promise.all([loadInvoices(), loadAttentionInvoices()]);
	}

	async function createPosOrder(payload: import('./pos/pos-order-contract').LegacyPosOrderInsert) {
		if (!gateway) throw new Error('Dashboard API недоступний.');
		await gateway.createPosOrder(payload);
		await refreshPosBoard();
	}

	async function saveTableOrderTtlSeconds(nextTableOrderTtlSeconds: number) {
		if (sessionState.status !== 'ready') throw new Error('Dashboard API недоступний.');
		if (sessionState.user.id === 'demo-user') {
			tableOrderTtlSeconds = nextTableOrderTtlSeconds;
			return;
		}
		if (!gateway) throw new Error('Dashboard API недоступний.');
		await gateway.saveMerchantSettings(sessionState.merchant.id, {
			tableOrderTtlSeconds: nextTableOrderTtlSeconds
		});
		tableOrderTtlSeconds = nextTableOrderTtlSeconds;
		cachedTableOrderTtlSeconds = nextTableOrderTtlSeconds;
	}

	async function markPosOrderPaid(orderId: string) {
		if (!gateway) throw new Error('Dashboard API недоступний.');
		await gateway.markPosOrderPaid(orderId);
		await refreshPosBoard();
	}

	async function cancelPosOrder(orderId: string) {
		if (!gateway) throw new Error('Dashboard API недоступний.');
		await gateway.cancelPosOrder(orderId);
		await refreshPosBoard();
	}

	async function updateMerchantName(name: string) {
		if (!gateway || sessionState.status !== 'ready') throw new Error('Dashboard API недоступний.');
		await gateway.updateMerchantName(sessionState.merchant.id, name);
		await restore();
	}

	async function createBusinessEntity(input: BusinessEntityInput) {
		if (!gateway || sessionState.status !== 'ready') throw new Error('Dashboard API недоступний.');
		await gateway.createBusinessEntity(sessionState.user.id, input);
		await refreshStructure();
	}

	async function updateBusinessEntity(entityId: string, input: BusinessEntityInput) {
		if (!gateway || sessionState.status !== 'ready') throw new Error('Dashboard API недоступний.');
		await gateway.updateBusinessEntity(sessionState.user.id, entityId, input);
		await refreshStructure();
	}

	async function deleteBusinessEntity(entityId: string) {
		if (!gateway || sessionState.status !== 'ready') throw new Error('Dashboard API недоступний.');
		await gateway.deleteBusinessEntity(sessionState.user.id, entityId);
		await refreshStructure();
	}

	async function createTerminal(input: TerminalInput) {
		if (!gateway || sessionState.status !== 'ready') throw new Error('Dashboard API недоступний.');
		await gateway.createTerminal(sessionState.user.id, input);
		await refreshStructure();
	}

	async function updateTerminal(terminalId: string, input: TerminalInput) {
		if (!gateway || sessionState.status !== 'ready') throw new Error('Dashboard API недоступний.');
		await gateway.updateTerminal(sessionState.user.id, terminalId, input);
		await refreshStructure();
	}

	async function deleteTerminal(terminalId: string) {
		if (!gateway || sessionState.status !== 'ready') throw new Error('Dashboard API недоступний.');
		await gateway.deleteTerminal(sessionState.user.id, terminalId);
		await refreshStructure();
	}

	onMount(() => {
		destroyed = false;
		document.addEventListener('visibilitychange', handleVisibilityChange);
		void preloadActiveView();
		startAuthSync();
		void restore();
		return () => {
			destroyed = true;
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			stopRealtimeSync();
			stopAuthSync();
			pendingRealtimeResources.clear();
		};
	});

	$effect(() => {
		const currentInvoiceId = invoiceId;
		if (currentInvoiceId === lastInvoiceId) return;
		lastInvoiceId = currentInvoiceId;
		if (view === 'invoice' && sessionState.status === 'ready') {
			stopRealtimeSync();
			invoiceEvents = sessionState.user.id === 'demo-user' ? demoInvoiceEvents : [];
			void loadInvoices().then(startRealtimeSync);
		}
	});
</script>

{#if sessionState.status === 'loading'}
	<DashboardStateScreen loading />
{:else if sessionState.status === 'configuration-required'}
	<DashboardLogin configurationRequired />
{:else if sessionState.status === 'guest'}
	<DashboardLogin onGoogleLogin={loginWithGoogle} />
{:else if sessionState.status === 'onboarding'}
	<MerchantOnboarding user={sessionState.user} onComplete={completeOnboarding} />
{:else if sessionState.status === 'error'}
	<DashboardStateScreen message={sessionState.message} onRetry={restore} />
{:else}
	<DashboardShell
		merchantName={sessionState.snapshot.merchantName}
		activeSection={view === 'overview'
			? 'overview'
			: view === 'pos'
				? 'pos'
				: view === 'settings'
					? 'settings'
					: view === 'invoice-rules'
						? 'invoice-rules'
						: view === 'payment-methods'
							? 'payment-methods'
							: view === 'public-page'
								? 'public-page'
								: view === 'team'
									? 'team'
									: view === 'developer-api'
										? 'developer-api'
										: view === 'sandbox'
											? 'sandbox'
											: view === 'structure'
												? 'structure'
												: 'invoices'}
		demo={sessionState.user.id === 'demo-user'}
		attentionInvoices={attentionInvoices}
		attentionError={attentionError}
		onCancelAttentionInvoice={cancelInvoice}
		onSignOut={signOut}
	>
		{#if view === 'overview' && contentLoading}
			<DashboardStateScreen loading />
		{:else if view === 'overview' && contentError}
			<DashboardStateScreen message={contentError} onRetry={restore} />
		{:else if view === 'overview'}
			{#await loadDashboardOverview()}
				<DashboardStateScreen loading />
			{:then module}
				<module.default
					snapshot={sessionState.snapshot}
					demo={sessionState.user.id === 'demo-user'}
				/>
			{/await}
		{:else if contentLoading}
			<DashboardStateScreen loading />
		{:else if contentError}
			<DashboardStateScreen message={contentError} onRetry={loadInvoices} />
		{:else if view === 'pos'}
			{#await loadPosBoard()}
				<DashboardStateScreen loading />
			{:then module}
				<module.default
					board={posBoard}
					merchantId={sessionState.merchant.id}
					{tableOrderTtlSeconds}
					onCreate={createPosOrder}
					onMarkPaid={markPosOrderPaid}
					onCancel={cancelPosOrder}
					demo={sessionState.user.id === 'demo-user'}
				/>
			{/await}
		{:else if view === 'invoices'}
			{#await loadInvoiceList()}
				<DashboardStateScreen loading />
			{:then module}
				<module.default
					{invoices}
					onCancel={cancelInvoice}
					demo={sessionState.user.id === 'demo-user'}
				/>
			{/await}
		{:else if view === 'invoice-create'}
			{#await loadInvoiceCreate()}
				<DashboardStateScreen loading />
			{:then module}
				<module.default
					terminals={posBoard.terminals}
					entities={structureData.entities}
					onCreate={createInvoice}
					demo={sessionState.user.id === 'demo-user'}
				/>
			{/await}
		{:else if view === 'settings'}
			{#await loadDashboardSettings() then module}
				<module.default {tableOrderTtlSeconds} onSave={saveTableOrderTtlSeconds} />
			{/await}
		{:else if view === 'invoice-rules'}
			{#await loadInvoiceRulesSettings() then module}<module.default />{/await}
		{:else if view === 'payment-methods'}
			{#await loadPaymentMethodsSettings() then module}<module.default />{/await}
		{:else if view === 'public-page'}
			{#await loadPublicPageSettings() then module}<module.default />{/await}
		{:else if view === 'team'}
			{#await loadTeamSettings() then module}<module.default />{/await}
		{:else if view === 'developer-api'}
			{#await loadDeveloperApi() then module}
				<module.default gateway={gateway!} merchantId={sessionState.merchant.id} />
			{/await}
		{:else if view === 'sandbox'}
			{#await loadPaymentSandbox() then module}<module.default />{/await}
		{:else if view === 'structure'}
			{#await loadBusinessStructure()}
				<DashboardStateScreen loading />
			{:then module}
				<module.default
					merchant={sessionState.merchant}
					initialEntities={structureData.entities}
					initialTerminals={structureData.terminals}
					onUpdateMerchantName={updateMerchantName}
					onCreateEntity={createBusinessEntity}
					onUpdateEntity={updateBusinessEntity}
					onDeleteEntity={deleteBusinessEntity}
					onCreateTerminal={createTerminal}
					onUpdateTerminal={updateTerminal}
					onDeleteTerminal={deleteTerminal}
				/>
			{/await}
		{:else if selectedInvoice}
			{#await loadInvoiceDetail()}
				<DashboardStateScreen loading />
			{:then module}
				<module.default
					invoice={selectedInvoice}
					events={invoiceEvents}
					{eventsLoading}
					{eventsError}
					onEventsRetry={() => loadInvoiceEvents(selectedInvoice.id)}
					onCancel={cancelInvoice}
					demo={sessionState.user.id === 'demo-user'}
				/>
			{/await}
		{:else}
			<DashboardStateScreen message="Рахунок не знайдено або він недоступний." />
		{/if}
	</DashboardShell>
{/if}
