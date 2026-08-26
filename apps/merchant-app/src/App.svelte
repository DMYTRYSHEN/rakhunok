<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import Building2 from '@lucide/svelte/icons/building-2';
	import History from '@lucide/svelte/icons/history';
	import Landmark from '@lucide/svelte/icons/landmark';
	import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import Mic from '@lucide/svelte/icons/mic';
	import MonitorSmartphone from '@lucide/svelte/icons/monitor-smartphone';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Store from '@lucide/svelte/icons/store';
	import X from '@lucide/svelte/icons/x';
	import UserRound from '@lucide/svelte/icons/user-round';
	import type { AuthGateway, AuthState } from './auth/auth-gateway';
	import type { BusinessEntity, MerchantDataGateway, OrderSummary, Terminal } from './data/merchant-data-gateway';
	import { evaluateAmount, formatAmount } from './lib/calculator';
	import PaymentQr from './lib/PaymentQr.svelte';
	import { parseVoiceCommand, type VoiceCommand } from './lib/voice-command-parser';
	import { applyPwaUpdate, isStandalone, promptInstall } from './platform/pwa';
	import {
		createSpeechRecognition,
		getMicrophonePermission,
		isSpeechRecognitionSupported,
		requestMicrophonePermission,
		type MicrophonePermission,
		type SpeechLocale
	} from './platform/speech';
	import { bindTelegramBackButton, haptic } from './platform/telegram';

	type Scenario = 'fixed' | 'table' | 'open';
	type HistoryPeriod = 'today' | 'week' | 'month';

	const keys = ['C', '÷', '×', '⌫', '1', '2', '3', '−', '4', '5', '6', '+', '7', '8', '9', '=', '0', ','];
	let expression = $state('');
	let previousDisplay = $state('0');
	let wheelDirection = $state<1 | -1>(1);
	let wheelRevision = $state(0);
	let scenario = $state<Scenario>('fixed');
	let previewOpen = $state(false);
	let activeView = $state<'kasa' | 'history' | 'profile'>('kasa');
	let lightTheme = $state(false);
	let authState = $state<AuthState>({ status: 'loading' });
	let authGateway: AuthGateway | null = null;
	let merchantDataGateway: MerchantDataGateway | null = null;
	let authBusy = $state(false);
	let structureLoading = $state(false);
	let structureError = $state('');
	let entities = $state<BusinessEntity[]>([]);
	let terminals = $state<Terminal[]>([]);
	let selectedTerminalId = $state('');
	let orders = $state<OrderSummary[]>([]);
	let historyPeriod = $state<HistoryPeriod>('today');
	let selectedOrder = $state<OrderSummary | null>(null);
	let orderAction = $state<'copy' | 'cancel' | null>(null);
	let cancelConfirmation = $state(false);
	let historyLoading = $state(false);
	let historyError = $state('');
	let online = $state(true);
	let installAvailable = $state(false);
	let updateAvailable = $state(false);
	let standalone = $state(false);
	let microphonePermission = $state<MicrophonePermission>('prompt');
	let microphoneBusy = $state(false);
	let voiceOpen = $state(false);
	let voiceLocale = $state<SpeechLocale>('uk-UA');
	let voicePhase = $state<'idle' | 'listening' | 'processing' | 'result' | 'error'>('idle');
	let voiceTranscript = $state('');
	let voiceCommand = $state<VoiceCommand | null>(null);
	let voiceError = $state('');
	let speechRecognition: ReturnType<typeof createSpeechRecognition> = null;
	let evaluationTimer: ReturnType<typeof setTimeout> | undefined;

	const result = $derived(evaluateAmount(expression));
	const amount = $derived(result ?? 0);
	const display = $derived(expression || '0');
	const formattedDisplay = $derived(formatAmount(display).replace(/\s/g, ''));
	const amountCharacters = $derived(formattedDisplay.split(''));
	const previousCharacters = $derived(previousDisplay.padStart(formattedDisplay.length, ' ').slice(-formattedDisplay.length).split(''));
	const selectedTerminal = $derived(terminals.find((terminal) => terminal.id === selectedTerminalId));
	const scenarioIndex = $derived(scenario === 'fixed' ? 0 : scenario === 'table' ? 1 : 2);
	const canPreview = $derived(
		scenario === 'open' || (amount > 0 && (scenario !== 'table' || Boolean(selectedTerminal)))
	);
	const merchantName = $derived(authState.status === 'ready' ? authState.merchant.name : 'Моя каса');
	const filteredOrders = $derived(orders.filter((order) => isOrderInPeriod(order, historyPeriod)));
	const dateFormatter = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
	const fullDateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long', timeStyle: 'short' });

	$effect(() => {
		if (activeView !== 'history' || authState.status !== 'ready' || !merchantDataGateway) return;
		const merchantId = authState.merchant.id;
		const period = historyPeriod;
		void loadHistory(merchantId, period);
		return merchantDataGateway.subscribeOrders(merchantId, () => void loadHistory(merchantId, period));
	});

	$effect(() => {
		const hasBackTarget = previewOpen || Boolean(selectedOrder) || activeView !== 'kasa';
		return bindTelegramBackButton(hasBackTarget, () => {
			if (previewOpen) previewOpen = false;
			else if (selectedOrder) closeOrder();
			else activeView = 'kasa';
		});
	});

	onMount(() => {
		let mounted = true;
		let unsubscribe: (() => void) | undefined;
		online = navigator.onLine;
		standalone = isStandalone();
		void refreshMicrophonePermission();
		const handleOnline = () => (online = true);
		const handleOffline = () => (online = false);
		const handleInstall = () => (installAvailable = true);
		const handleInstalled = () => (installAvailable = false);
		const handleUpdate = () => (updateAvailable = true);
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		window.addEventListener('rahunok:install-available', handleInstall);
		window.addEventListener('rahunok:installed', handleInstalled);
		window.addEventListener('rahunok:update-available', handleUpdate);

		void restoreSession().then(() => {
			if (!mounted || !authGateway) return;
			unsubscribe = authGateway.subscribe(() => void restoreSession());
		});

		return () => {
			mounted = false;
			unsubscribe?.();
			if (evaluationTimer) clearTimeout(evaluationTimer);
			speechRecognition?.abort();
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
			window.removeEventListener('rahunok:install-available', handleInstall);
			window.removeEventListener('rahunok:installed', handleInstalled);
			window.removeEventListener('rahunok:update-available', handleUpdate);
		};
	});

	async function installApp() {
		if (await promptInstall()) installAvailable = false;
	}

	async function refreshMicrophonePermission() {
		microphonePermission = await getMicrophonePermission();
	}

	async function requestMicrophone() {
		microphoneBusy = true;
		microphonePermission = await requestMicrophonePermission();
		microphoneBusy = false;
	}

	async function openVoice() {
		voiceOpen = true;
		voiceTranscript = '';
		voiceCommand = null;
		voiceError = '';
		voicePhase = 'idle';
		await startListening();
	}

	async function startListening() {
		if (!isSpeechRecognitionSupported()) {
			voicePhase = 'error';
			voiceError = 'Цей браузер не підтримує голосове розпізнавання. Спробуйте Chrome або Safari.';
			return;
		}
		if (microphonePermission !== 'granted') await requestMicrophone();
		if (microphonePermission !== 'granted') {
			voicePhase = 'error';
			voiceError = microphonePermission === 'denied'
				? 'Дозвольте доступ до мікрофона в налаштуваннях браузера.'
				: 'Мікрофон недоступний на цьому пристрої.';
			return;
		}
		speechRecognition?.abort();
		voiceTranscript = '';
		voiceCommand = null;
		voiceError = '';
		voicePhase = 'listening';
		speechRecognition = createSpeechRecognition(voiceLocale, {
			onTranscript: (text, final) => {
				voiceTranscript = text;
				if (!final) return;
				voicePhase = 'processing';
				voiceCommand = parseVoiceCommand(text);
				voicePhase = voiceCommand.validation.valid ? 'result' : 'error';
				voiceError = voiceCommand.validation.errors.join(' ');
			},
			onError: (message) => {
				voicePhase = 'error';
				voiceError = message;
			},
			onEnd: () => {
				if (voicePhase === 'listening') {
					voicePhase = 'error';
					voiceError = 'Не вдалося почути команду. Спробуйте ще раз.';
				}
			}
		});
		speechRecognition?.start();
		haptic('medium');
	}

	function closeVoice() {
		speechRecognition?.abort();
		speechRecognition = null;
		voiceOpen = false;
		voicePhase = 'idle';
	}

	function confirmVoiceCommand() {
		const valueMinor = voiceCommand?.entities.amount?.value_minor;
		if (!voiceCommand?.validation.valid || valueMinor === undefined) return;
		const major = Math.floor(valueMinor / 100);
		const minor = valueMinor % 100;
		scenario = 'fixed';
		setExpression(minor ? `${major}.${String(minor).padStart(2, '0')}` : String(major), 1);
		closeVoice();
		previewOpen = true;
		haptic('medium');
	}

	async function restoreSession() {
		authState = { status: 'loading' };
		try {
			const { getAuthGateway, getMerchantDataGateway } = await import('./auth/supabase-browser');
			authGateway = await getAuthGateway();
			const restoredState: AuthState = authGateway
				? await authGateway.restore()
				: { status: 'error', message: 'Не налаштовано підключення Supabase.' };
			authState = restoredState;
			if (restoredState.status === 'ready') {
				merchantDataGateway = await getMerchantDataGateway();
				await loadStructure(restoredState.user.id);
			}
		} catch {
			authState = { status: 'error', message: 'Не вдалося запустити авторизацію.' };
		}
	}

	async function loadStructure(userId: string) {
		if (!merchantDataGateway) return;
		structureLoading = true;
		structureError = '';
		try {
			const structure = await merchantDataGateway.getStructure(userId);
			entities = structure.entities;
			terminals = structure.terminals;
			if (!terminals.some((terminal) => terminal.id === selectedTerminalId)) {
				selectedTerminalId = terminals[0]?.id ?? '';
			}
		} catch (error) {
			structureError = error instanceof Error ? error.message : 'Не вдалося завантажити каси та столи.';
		} finally {
			structureLoading = false;
		}
	}

	async function loadHistory(merchantId: string, period: HistoryPeriod = historyPeriod) {
		if (!merchantDataGateway) return;
		historyLoading = true;
		historyError = '';
		try {
			orders = await merchantDataGateway.listOrders(merchantId, historyThreshold(period).toISOString());
		} catch (error) {
			historyError = error instanceof Error ? error.message : 'Не вдалося завантажити історію оплат.';
		} finally {
			historyLoading = false;
		}
	}

	function historyThreshold(period: HistoryPeriod) {
		const threshold = new Date();
		if (period === 'today') threshold.setHours(0, 0, 0, 0);
		else threshold.setDate(threshold.getDate() - (period === 'week' ? 7 : 30));
		return threshold;
	}

	function orderStatus(status: string) {
		if (status === 'paid' || status === 'completed') return 'Сплачено';
		if (status === 'cancelled' || status === 'expired') return 'Скасовано';
		if (status === 'ready') return 'Готовий';
		if (status === 'preparing') return 'Готується';
		return 'Очікує';
	}

	function isOrderInPeriod(order: OrderSummary, period: HistoryPeriod) {
		return new Date(order.createdAt) >= historyThreshold(period);
	}

	function orderType(type: string) {
		if (type === 'table') return 'Стіл';
		if (type === 'delivery') return 'Доставка';
		if (type === 'open') return 'Вільна сума';
		return 'Фіксований рахунок';
	}

	function openOrder(order: OrderSummary) {
		selectedOrder = order;
		cancelConfirmation = false;
		haptic('selection');
	}

	function closeOrder() {
		selectedOrder = null;
		cancelConfirmation = false;
		orderAction = null;
	}

	async function copyOrderLink(order: OrderSummary) {
		orderAction = 'copy';
		try {
			await navigator.clipboard.writeText(order.shareUrl || `${window.location.origin}/pay/${order.id}`);
			haptic('light');
			setTimeout(() => {
				if (orderAction === 'copy') orderAction = null;
			}, 1400);
		} catch {
			orderAction = null;
		}
	}

	async function shareOrder(order: OrderSummary) {
		const url = order.shareUrl || `${window.location.origin}/pay/${order.id}`;
		if (!navigator.share) return copyOrderLink(order);
		try {
			await navigator.share({ title: `Рахунок ${order.orderNumber}`, text: `${formatAmount(String(order.amount))} ₴`, url });
			haptic('light');
		} catch {
			return;
		}
	}

	async function cancelOrder(order: OrderSummary) {
		if (!cancelConfirmation) {
			cancelConfirmation = true;
			haptic('medium');
			return;
		}
		if (!merchantDataGateway || authState.status !== 'ready') return;
		orderAction = 'cancel';
		try {
			await merchantDataGateway.cancelOrder(order.id);
			await loadHistory(authState.merchant.id);
			closeOrder();
			haptic('medium');
		} catch (error) {
			historyError = error instanceof Error ? error.message : 'Не вдалося скасувати рахунок.';
			orderAction = null;
		}
	}

	function orderIdentifier(id: string) {
		return `#${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`;
	}

	function retryStructure() {
		if (authState.status === 'ready') void loadStructure(authState.user.id);
	}

	async function signIn() {
		if (!authGateway || authBusy) return;
		authBusy = true;
		try {
			await authGateway.signInWithGoogle(`${window.location.origin}${import.meta.env.BASE_URL}`);
		} catch {
			authState = { status: 'error', message: 'Не вдалося увійти через Google.' };
			authBusy = false;
		}
	}

	async function signOut() {
		if (!authGateway || authBusy) return;
		authBusy = true;
		try {
			await authGateway.signOut();
			authState = { status: 'guest' };
			activeView = 'kasa';
			entities = [];
			terminals = [];
			selectedTerminalId = '';
			orders = [];
		} catch {
			authState = { status: 'error', message: 'Не вдалося вийти з акаунта.' };
		} finally {
			authBusy = false;
		}
	}

	function selectScenario(nextScenario: Scenario) {
		if (scenario === nextScenario) return;
		scenario = nextScenario;
		if (nextScenario === 'open') setExpression('', -1);
		haptic('selection');
	}

	function selectTerminal() {
		haptic('selection');
	}

	function calculate() {
		if (result === null) return;
		setExpression(result ? String(result) : '', result < amount ? -1 : 1);
	}

	function setExpression(nextExpression: string, direction: 1 | -1) {
		if (nextExpression === expression) return;
		previousDisplay = formattedDisplay;
		wheelDirection = direction;
		expression = nextExpression;
		wheelRevision += 1;
	}

	function pressKey(key: string) {
		if (scenario === 'open') return;
		if (evaluationTimer) clearTimeout(evaluationTimer);
		haptic('light');

		if (key === 'C') setExpression('', -1);
		else if (key === '⌫') setExpression(expression.slice(0, -1), -1);
		else if (key === '=') calculate();
		else if (key === '−') appendOperator('-');
		else if (key === '+') appendOperator('+');
		else if (key === '×') appendOperator('×');
		else if (key === '÷') appendOperator('÷');
		else if (key === ',') appendDecimal();
		else if (expression.length < 18) setExpression(`${expression}${key}`, 1);

		if (/[+\-×÷]/.test(expression) && /\d$/.test(expression)) {
			evaluationTimer = setTimeout(calculate, 900);
		}
	}

	function appendOperator(operator: '+' | '-' | '×' | '÷') {
		if (!expression) setExpression(`0${operator}`, 1);
		else if (/[+\-×÷]$/.test(expression)) setExpression(`${expression.slice(0, -1)}${operator}`, 1);
		else setExpression(`${expression}${operator}`, 1);
	}

	function appendDecimal() {
		const currentNumber = expression.split(/[+\-×÷]/).at(-1) ?? '';
		if (!currentNumber.includes('.')) setExpression(`${expression}${currentNumber ? '.' : '0.'}`, 1);
	}

	function openPreview() {
		if (!canPreview) return;
		previewOpen = true;
		haptic('medium');
	}
</script>

<main class:light-theme={lightTheme} class:auth-active={authState.status !== 'ready'} class="app-shell">
	{#if !online}<div class="pwa-banner offline-banner" role="status">Офлайн · доступна збережена оболонка</div>{/if}
	{#if updateAvailable}<button class="pwa-banner update-banner" type="button" onclick={applyPwaUpdate}>Доступне оновлення · застосувати</button>{/if}
	{#if authState.status !== 'ready'}
		<section class="auth-screen" aria-live="polite">
			<div class="auth-brand">
				<svg viewBox="0 0 208 221" aria-hidden="true"><path d="M108.9 29.2c31.7 0 52.6 20.2 52.6 47.8 0 21.2-12.1 38.8-33.1 46.3l40.9 68.1c-25.3 0-48.6-13.3-61-34.7l-13.7-23.7c-12.1 0-21.9 9.6-21.9 21.3v37.1c-19.4 0-35.2-15.3-35.2-34.3v-20c0-18.9 15.8-34.3 35.2-34.3h28.8c15.8 0 24.7-8.3 24.7-22.4 0-13.1-7.5-19.7-22.4-19.7H72.7c-19.4 0-35.2-14.1-35.2-31.5h71.4Z" /></svg>
				<h1>Rahunok</h1>
				<p>Мобільна каса для бізнесу</p>
			</div>

			{#if authState.status === 'loading'}
				<div class="auth-progress"><span></span><p>Перевіряємо сесію</p></div>
			{:else if authState.status === 'guest'}
				<button class="google-button" type="button" onclick={signIn} disabled={authBusy}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285f4" />
						<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853" />
						<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fbbc05" />
						<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ea4335" />
					</svg>
					{authBusy ? 'Авторизація...' : 'Увійти через Google'}
				</button>
			{:else if authState.status === 'onboarding'}
				<div class="auth-message">
					<strong>Бізнес ще не налаштовано</strong>
					<p>Створіть профіль бізнесу в особистому кабінеті, після чого поверніться до каси.</p>
					<a href="/dashboard/">Відкрити особистий кабінет</a>
					<button type="button" onclick={signOut}>Вийти</button>
				</div>
			{:else}
				<div class="auth-message error-message">
					<strong>Підключення недоступне</strong>
					<p>{authState.message}</p>
					<button type="button" onclick={restoreSession}>Спробувати ще раз</button>
				</div>
			{/if}
		</section>
	{:else}
	<header class="topbar">
		<button class="brand" type="button" onclick={() => (lightTheme = !lightTheme)} aria-label="Змінити тему">
			<svg viewBox="0 0 208 221" aria-hidden="true"><path d="M108.9 29.2c31.7 0 52.6 20.2 52.6 47.8 0 21.2-12.1 38.8-33.1 46.3l40.9 68.1c-25.3 0-48.6-13.3-61-34.7l-13.7-23.7c-12.1 0-21.9 9.6-21.9 21.3v37.1c-19.4 0-35.2-15.3-35.2-34.3v-20c0-18.9 15.8-34.3 35.2-34.3h28.8c15.8 0 24.7-8.3 24.7-22.4 0-13.1-7.5-19.7-22.4-19.7H72.7c-19.4 0-35.2-14.1-35.2-31.5h71.4Z" /></svg>
			Rahunok
		</button>
		<button class="entity-button" type="button" aria-label="Обрати бізнес">
			<strong>{merchantName} <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" /></strong>
			<small><span class="status-dot"></span> Онлайн</small>
		</button>
	</header>

	{#if activeView === 'kasa'}
		<section class="kasa" aria-labelledby="kasa-title">
			<div class="amount-block">
				<h1 id="kasa-title" aria-live="polite">
					<span class="amount-window" aria-label={formattedDisplay}>
						{#key wheelRevision}
							<span class:reverse={wheelDirection < 0} class="amount-reel" aria-hidden="true">
								{#each amountCharacters as character, index}
									<span class="amount-character" class:changed={previousCharacters[index] !== character}>
										<span class="previous-character">{previousCharacters[index]}</span>
										<span class="current-character">{character}</span>
									</span>
								{/each}
							</span>
						{/key}
					</span><small>₴</small>
				</h1>
			</div>

			{#if scenario === 'table'}
				<label class="table-select" class:ready={Boolean(selectedTerminal)}>
					<span class="terminal-icon"><MapPin size={17} strokeWidth={2.1} /></span>
					<span class="terminal-label">Стіл або каса</span>
					<strong class="terminal-value">{selectedTerminal ? `${selectedTerminal.name} (${selectedTerminal.code})` : structureLoading ? 'Завантаження...' : 'Немає активних точок'}</strong>
					<select bind:value={selectedTerminalId} onchange={selectTerminal} disabled={structureLoading || terminals.length === 0}>
						{#if terminals.length === 0}<option value="">{structureLoading ? 'Завантаження...' : 'Немає активних точок'}</option>{/if}
						{#each entities as entity}
							<optgroup label={entity.name}>
								{#each terminals.filter((terminal) => terminal.entityId === entity.id) as terminal}
									<option value={terminal.id}>{terminal.name} ({terminal.code})</option>
								{/each}
							</optgroup>
						{/each}
					</select>
					<span class="terminal-status" aria-hidden="true"></span>
					<ChevronDown class="select-chevron" size={17} strokeWidth={2.2} aria-hidden="true" />
				</label>
				{#if structureError}<button class="structure-error" type="button" onclick={retryStructure}>{structureError} Повторити</button>{/if}
			{:else if scenario === 'open'}
				<div class="open-note"><span>∞</span><div><strong>Вільна сума</strong><p>Суму введе покупець</p></div></div>
			{/if}

			<div class="scenario-control" style:--scenario-index={scenarioIndex} role="radiogroup" aria-label="Тип рахунку">
				<span class="scenario-indicator" aria-hidden="true"></span>
				<button class:active={scenario === 'fixed'} type="button" role="radio" aria-checked={scenario === 'fixed'} onclick={() => selectScenario('fixed')}>Фіксована</button>
				<button class:active={scenario === 'table'} type="button" role="radio" aria-checked={scenario === 'table'} onclick={() => selectScenario('table')}>Стіл</button>
				<button class:active={scenario === 'open'} type="button" role="radio" aria-checked={scenario === 'open'} onclick={() => selectScenario('open')}>Вільна сума</button>
			</div>

			<div class="keypad" class:muted={scenario === 'open'} aria-label="Клавіатура суми">
				{#each keys as key}
					<button
						class:danger={key === 'C'}
						class:operator={['÷', '×', '−', '+'].includes(key)}
						class:equals={key === '='}
						class:zero={key === '0'}
						type="button"
						aria-label={key === '⌫' ? 'Видалити цифру' : key}
						onclick={() => pressKey(key)}>{key}</button
					>
				{/each}
			</div>
		</section>
	{:else if activeView === 'history'}
		<section class="placeholder-view">
			<div class="history-heading">
				<div><p class="eyebrow">Операції</p><h1>Історія оплат</h1></div>
				<div class="history-pro-control">
					<div><strong>Миттєві статуси оплат</strong><span id="pro-realtime-note"><LockKeyhole size={10} /> Доступно в Pro</span></div>
					<label class="native-toggle" aria-label="Миттєві статуси оплат, доступно в Pro">
						<input type="checkbox" disabled aria-describedby="pro-realtime-note" />
						<span><i></i></span>
					</label>
				</div>
			</div>
			<div class="history-periods" role="radiogroup" aria-label="Період історії">
				<button class:active={historyPeriod === 'today'} type="button" role="radio" aria-checked={historyPeriod === 'today'} onclick={() => (historyPeriod = 'today')}>Сьогодні</button>
				<button class:active={historyPeriod === 'week'} type="button" role="radio" aria-checked={historyPeriod === 'week'} onclick={() => (historyPeriod = 'week')}>Тиждень</button>
				<button class:active={historyPeriod === 'month'} type="button" role="radio" aria-checked={historyPeriod === 'month'} onclick={() => (historyPeriod = 'month')}>Місяць</button>
			</div>
			{#if historyLoading && orders.length === 0}
				<div class="empty-state"><span class="history-spinner"></span><strong>Завантаження</strong></div>
			{:else if historyError}
				<button class="empty-state history-error" type="button" onclick={() => authState.status === 'ready' && loadHistory(authState.merchant.id)}><span>!</span><strong>{historyError}</strong><p>Торкніться, щоб повторити.</p></button>
			{:else if filteredOrders.length === 0}
				<div class="empty-state"><span>↗</span><strong>Ще немає оплат</strong><p>Нові операції з’являться тут.</p></div>
			{:else}
				<div class="history-list">
					{#each filteredOrders as order (order.id)}
						<button class="history-row" type="button" onclick={() => openOrder(order)}>
							<div class="history-id"><strong>{orderIdentifier(order.id)}</strong><p>{dateFormatter.format(new Date(order.createdAt))}</p></div>
							<div class="history-total"><strong>{formatAmount(String(order.amount))} ₴</strong><span class:paid={order.status === 'paid' || order.status === 'completed'} class:cancelled={order.status === 'cancelled' || order.status === 'expired'}>{orderStatus(order.status)}</span></div>
							<ChevronRight class="history-chevron" size={17} aria-hidden="true" />
						</button>
					{/each}
				</div>
			{/if}
		</section>
	{:else}
		<section class="placeholder-view">
			<p class="eyebrow">Обліковий запис</p>
			<h1>Профіль касира</h1>
			<div class="profile-row"><span>R</span><div><strong>{merchantName}</strong><p>{authState.user.email ?? 'Обліковий запис Google'}</p></div></div>
			<div class="pwa-settings">
				<div><strong>Застосунок</strong><p>{standalone ? 'Встановлено на пристрій' : 'Відкрито у браузері'}</p></div>
				{#if installAvailable && !standalone}<button type="button" onclick={installApp}>Встановити</button>{/if}
			</div>
			<div class="pwa-settings permission-settings">
				<div><strong>Мікрофон</strong><p>{microphonePermission === 'granted' ? 'Доступ дозволено' : microphonePermission === 'denied' ? 'Заблоковано в браузері' : microphonePermission === 'unsupported' ? 'Не підтримується пристроєм' : 'Потрібен для голосових команд'}</p></div>
				{#if microphonePermission === 'prompt'}<button type="button" onclick={requestMicrophone} disabled={microphoneBusy}>{microphoneBusy ? 'Запит...' : 'Надати доступ'}</button>{/if}
			</div>
			<div class="business-setup">
				<div class="business-setup-heading">
					<span><Landmark size={20} /></span>
					<div><strong>Почніть приймати кошти</strong><p>Додайте реквізити компанії та створіть першу точку приймання оплат.</p></div>
				</div>
				<a href="/dashboard/structure">
					<span><Building2 size={20} /></span>
					<div><strong>{entities.length ? 'Керувати компаніями' : 'Додати компанію'}</strong><p>Назва, ЄДРПОУ або ІПН, банк та IBAN</p></div>
					<ChevronRight size={18} />
				</a>
				<a href="/dashboard/structure">
					<span><MonitorSmartphone size={20} /></span>
					<div><strong>{terminals.length ? 'Керувати терміналами' : 'Створити термінал'}</strong><p>Каса, стіл, динамічний QR або NFC</p></div>
					<ChevronRight size={18} />
				</a>
			</div>
			<button class="logout-button" type="button" onclick={signOut} disabled={authBusy}>Вийти з акаунта</button>
		</section>
	{/if}

	<div class="dock-container">
		<nav class="dock" aria-label="Навігація застосунку">
			<button class:active={activeView !== 'profile'} type="button" onclick={() => (activeView = activeView === 'kasa' ? 'history' : 'kasa')} aria-label={activeView === 'kasa' ? 'Історія' : 'Каса'}>{#if activeView === 'kasa'}<History size={22} />{:else}<Store size={22} />{/if}</button>
			<button class="pay-button" class:disabled={!canPreview} type="button" onclick={openPreview} aria-label="Створити рахунок"><span>{scenario === 'open' ? 'Вільна сума' : amount > 0 ? `${formatAmount(String(amount))} ₴` : 'Рахунок'}</span><ChevronRight size={21} strokeWidth={2.3} aria-hidden="true" /></button>
			<button class:active={activeView === 'profile'} type="button" onclick={() => (activeView = 'profile')} aria-label="Профіль"><UserRound size={22} /></button>
		</nav>
		<button class="voice-button" class:listening={voiceOpen && voicePhase === 'listening'} type="button" aria-label="Створити рахунок голосом" onclick={openVoice}><Mic size={23} strokeWidth={2.1} /></button>
	</div>
	{/if}
</main>

{#if voiceOpen}
	<div class="modal-backdrop voice-backdrop" role="presentation">
		<div class="voice-sheet" role="dialog" aria-modal="true" aria-labelledby="voice-title">
			<div class="sheet-handle" aria-hidden="true"></div>
			<button class="sheet-close" type="button" onclick={closeVoice} aria-label="Закрити"><X size={18} /></button>
			<div class="voice-orb" class:listening={voicePhase === 'listening'} class:processing={voicePhase === 'processing'} aria-hidden="true"><Mic size={30} /></div>
			<h2 id="voice-title">{voicePhase === 'listening' ? 'Слухаю' : voicePhase === 'processing' ? 'Розпізнаю' : voicePhase === 'result' ? 'Перевірте рахунок' : voicePhase === 'error' ? 'Не вдалося' : 'Голосовий рахунок'}</h2>
			{#if voicePhase === 'listening'}
				<div class="voice-wave" aria-hidden="true">{#each [1, 2, 3, 4, 5, 6, 7] as bar}<span style:--bar={bar}></span>{/each}</div>
			{/if}
			<p class="voice-transcript" aria-live="polite">{voiceTranscript || 'Скажіть: «До сплати 350 гривень»'}</p>
			{#if voicePhase === 'result' && voiceCommand?.entities.amount}
				<div class="voice-result">
					<span>Сума</span><strong>{formatAmount(String(voiceCommand.entities.amount.value_minor / 100))} ₴</strong>
					{#if voiceCommand.entities.customer}<small>Для: {voiceCommand.entities.customer.name}</small>{/if}
					{#if voiceCommand.validation.requires_confirmation}<p>Сума розпізнана приблизно. Уважно перевірте її.</p>{/if}
				</div>
				<button class="primary-button" type="button" onclick={confirmVoiceCommand}>Створити рахунок</button>
			{:else if voicePhase === 'error'}
				<p class="voice-error" role="alert">{voiceError}</p>
				<button class="primary-button" type="button" onclick={startListening}>Спробувати ще раз</button>
			{:else if voicePhase === 'listening'}
				<button class="voice-stop" type="button" onclick={() => speechRecognition?.stop()}>Завершити</button>
			{/if}
		</div>
	</div>
{/if}

{#if previewOpen}
	<div class="modal-backdrop intelligence-backdrop" role="presentation">
		<div class="order-sheet creation-sheet" role="dialog" aria-modal="true" aria-labelledby="preview-title">
			<div class="sheet-handle" aria-hidden="true"></div>
			<button class="sheet-close" type="button" onclick={() => (previewOpen = false)} aria-label="Закрити"><X size={18} /></button>
			<div class="creation-status"><span></span> Новий рахунок</div>
			<p class="eyebrow">Перевірка перед створенням</p>
			<h2 id="preview-title">{scenario === 'open' ? 'Вільна сума' : formatAmount(String(amount))} {#if scenario !== 'open'}<small>₴</small>{/if}</h2>
			{#if scenario === 'table' && selectedTerminal}<p class="terminal-summary">{selectedTerminal.name} · {selectedTerminal.code}</p>{/if}
			{#if scenario === 'table' && selectedTerminal}
				<PaymentQr value={`${window.location.origin}/pos/${encodeURIComponent(selectedTerminal.code)}`} label="QR столу (багаторазовий)" />
			{:else}
				<div class="creation-mark" aria-hidden="true"><svg viewBox="0 0 208 221"><path d="M108.9 29.2c31.7 0 52.6 20.2 52.6 47.8 0 21.2-12.1 38.8-33.1 46.3l40.9 68.1c-25.3 0-48.6-13.3-61-34.7l-13.7-23.7c-12.1 0-21.9 9.6-21.9 21.3v37.1c-19.4 0-35.2-15.3-35.2-34.3v-20c0-18.9 15.8-34.3 35.2-34.3h28.8c15.8 0 24.7-8.3 24.7-22.4 0-13.1-7.5-19.7-22.4-19.7H72.7c-19.4 0-35.2-14.1-35.2-31.5h71.4Z" /></svg></div>
			{/if}
			<div class="order-meta creation-meta">
				<div><span>Тип</span><strong>{scenario === 'table' ? 'Термінал' : scenario === 'open' ? 'Вільна сума' : 'Фіксований'}</strong></div>
				<div><span>Статус</span><strong>Не створено</strong></div>
			</div>
			<p class="sheet-copy">Після підключення каси тут з’явиться одноразове посилання та QR для покупця.</p>
			<a class="primary-button creation-action" href="/dashboard/structure"><Landmark size={18} /> Підключити реквізити</a>
		</div>
	</div>
{/if}

{#if selectedOrder}
	<div class="modal-backdrop intelligence-backdrop" role="presentation">
		<div class="order-sheet" role="dialog" aria-modal="true" aria-labelledby="order-title">
			<div class="sheet-handle" aria-hidden="true"></div>
			<button class="sheet-close" type="button" onclick={closeOrder} aria-label="Закрити"><X size={18} /></button>
			<p class="eyebrow">{orderType(selectedOrder.type)}</p>
			<h2 id="order-title">{formatAmount(String(selectedOrder.amount))} <small>₴</small></h2>
			<p class="order-reference">{selectedOrder.orderNumber || orderIdentifier(selectedOrder.id)}</p>
			<PaymentQr value={selectedOrder.shareUrl || `${window.location.origin}/pay/${selectedOrder.id}`} label="Рахунок на оплату" />
			<div class="order-meta">
				<div><span>Статус</span><strong>{orderStatus(selectedOrder.status)}</strong></div>
				<div><span>Створено</span><strong>{fullDateFormatter.format(new Date(selectedOrder.createdAt))}</strong></div>
			</div>
			<div class="order-actions">
				<button type="button" onclick={() => shareOrder(selectedOrder!)}><span><Share2 size={20} /></span>Поділитися</button>
				<button type="button" onclick={() => copyOrderLink(selectedOrder!)}><span>{#if orderAction === 'copy'}<Check size={20} />{:else}<Copy size={20} />{/if}</span>{orderAction === 'copy' ? 'Скопійовано' : 'Копіювати'}</button>
			</div>
			{#if !['paid', 'completed', 'cancelled', 'expired'].includes(selectedOrder.status)}
				<button class:confirming={cancelConfirmation} class="cancel-order" type="button" disabled={orderAction === 'cancel'} onclick={() => cancelOrder(selectedOrder!)}>
					{orderAction === 'cancel' ? 'Скасування...' : cancelConfirmation ? 'Підтвердити скасування' : 'Скасувати рахунок'}
				</button>
			{/if}
		</div>
	</div>
{/if}