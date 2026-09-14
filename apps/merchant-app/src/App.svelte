<script lang="ts">
	import { onMount } from 'svelte';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
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
	import { createSessionFence } from './auth/session-fence';
	import { createGoogleNonce, loadGoogleIdentityServices } from './auth/google-identity';
	import LoginOptions from './auth/LoginOptions.svelte';
	import AccountIdentityGuidance from './auth/AccountIdentityGuidance.svelte';
	import TelegramExternalBrowser from './auth/TelegramExternalBrowser.svelte';
	import { googleEnvironmentMessage } from './auth/login-availability';
	import { hasTelegramIdentity, telegramCallbackError, telegramSessionAvailable } from './auth/telegram-session';
	import type { TelegramStatus } from './auth/telegram-login';
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
	let orderCreating = $state(false);
	let orderCreateError = $state('');
	let activeView = $state<'kasa' | 'history' | 'profile'>('kasa');
	let lightTheme = $state(false);
	let authState = $state<AuthState>({ status: 'loading' });
	let authGateway: AuthGateway | null = null;
	let merchantDataGateway: MerchantDataGateway | null = null;
	let authBusy = $state(false);
	let googleLoginMessage = $state('');
	let telegramLoginMessage = $state(telegramCallbackError(window.location.href));
	const telegramEnabled = telegramSessionAvailable(window.location.origin, import.meta.env.PUBLIC_TELEGRAM_AUTH_ENABLED);
	let telegramLogin: ReturnType<AuthGateway['createTelegramLogin']> | undefined;
	let unsubscribeTelegram: (() => void) | undefined;
	let telegramStatus = $state<TelegramStatus>('loading');
	let structureLoading = $state(false);
	let structureError = $state('');
	let entities = $state<BusinessEntity[]>([]);
	let terminals = $state<Terminal[]>([]);
	let selectedTerminalId = $state('');
	let qrSwipeStartX = $state<number | null>(null);
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
	const sessionFence = createSessionFence();
	const restoreFence = createSessionFence();
	const structureFence = createSessionFence();
	const historyFence = createSessionFence();
	const voiceFence = createSessionFence();
	let accountIdentity = '';
	let disposed = false;
	let signingOut = false;
	let unsubscribeAuth: (() => void) | undefined;

	const result = $derived(evaluateAmount(expression));
	const amount = $derived(result ?? 0);
	const display = $derived(expression || '0');
	const formattedDisplay = $derived(formatAmount(display).replace(/\s/g, ''));
	const amountCharacters = $derived(formattedDisplay.split(''));
	const previousCharacters = $derived(previousDisplay.padStart(formattedDisplay.length, ' ').slice(-formattedDisplay.length).split(''));
	const selectedTerminal = $derived(terminals.find((terminal) => terminal.id === selectedTerminalId));
	const selectedTerminalIndex = $derived(terminals.findIndex((terminal) => terminal.id === selectedTerminalId));
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
		const generation = sessionFence.capture();
		void loadHistory(merchantId, period);
		return merchantDataGateway.subscribeOrders(merchantId, () => {
			if (sessionFence.isCurrent(generation)) void loadHistory(merchantId, period);
		});
	});

	$effect(() => {
		const hasBackTarget = authState.status === 'ready' && (previewOpen || Boolean(selectedOrder) || activeView !== 'kasa');
		return bindTelegramBackButton(hasBackTarget, () => {
			if (authState.status !== 'ready') return;
			if (previewOpen) previewOpen = false;
			else if (selectedOrder) closeOrder();
			else activeView = 'kasa';
		});
	});

	function initializeGoogleButton(buttonElement: HTMLDivElement) {
		const environmentMessage = googleEnvironmentMessage(window.isSecureContext, Boolean(window.crypto?.subtle));
		googleLoginMessage = environmentMessage;
		if (environmentMessage) return;
		const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID?.trim();
		if (!clientId) {
			googleLoginMessage = 'Сервіс входу тимчасово недоступний.';
			return;
		}

		let active = true;
		void Promise.all([loadGoogleIdentityServices(), createGoogleNonce()])
			.then(([google, nonce]) => {
				if (!active) return;
				google.accounts.id.initialize({
					client_id: clientId,
					nonce: nonce.hashed,
					callback: (response) => {
						if (active && response.credential) void signIn(response.credential, nonce.raw);
					}
				});
				google.accounts.id.renderButton(buttonElement, {
					type: 'standard',
					theme: 'outline',
					size: 'large',
					text: 'signin_with',
					shape: 'rectangular',
					width: 320
				});
			})
			.catch(() => {
				if (active) googleLoginMessage = 'Не вдалося завантажити Google. Перевірте інтернет і блокувальник вмісту, потім оновіть сторінку.';
			});
		return () => { active = false; };
	}

	onMount(() => {
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

		void restoreSession();

		return () => {
			disposed = true;
			restoreFence.advance();
			sessionFence.advance();
			unsubscribeAuth?.();
			unsubscribeTelegram?.();
			telegramLogin?.dispose();
			clearAccountState();
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
		const permission = await getMicrophonePermission();
		if (!disposed) microphonePermission = permission;
	}

	async function requestMicrophone() {
		const generation = sessionFence.capture();
		microphoneBusy = true;
		const permission = await requestMicrophonePermission();
		if (!sessionFence.isCurrent(generation)) return;
		microphonePermission = permission;
		microphoneBusy = false;
	}

	async function openVoice() {
		if (authState.status !== 'ready') return;
		voiceOpen = true;
		voiceTranscript = '';
		voiceCommand = null;
		voiceError = '';
		voicePhase = 'idle';
		await startListening();
	}

	async function startListening() {
		if (authState.status !== 'ready' || !voiceOpen) return;
		const generation = sessionFence.capture();
		const attempt = voiceFence.advance();
		const current = () => sessionFence.isCurrent(generation) && voiceFence.isCurrent(attempt) && voiceOpen;
		if (!isSpeechRecognitionSupported()) {
			voicePhase = 'error';
			voiceError = 'Цей браузер не підтримує голосове розпізнавання. Спробуйте Chrome або Safari.';
			return;
		}
		if (microphonePermission !== 'granted') await requestMicrophone();
		if (!current()) return;
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
				if (!current()) return;
				voiceTranscript = text;
				if (!final) return;
				voicePhase = 'processing';
				voiceCommand = parseVoiceCommand(text);
				voicePhase = voiceCommand.validation.valid ? 'result' : 'error';
				voiceError = voiceCommand.validation.errors.join(' ');
			},
			onError: (message) => {
				if (!current()) return;
				voicePhase = 'error';
				voiceError = message;
			},
			onEnd: () => {
				if (!current()) return;
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
		voiceFence.advance();
		speechRecognition?.abort();
		speechRecognition = null;
		voiceOpen = false;
		voicePhase = 'idle';
	}

	async function confirmVoiceCommand() {
		if (authState.status !== 'ready') return;
		const generation = sessionFence.capture();
		const attempt = voiceFence.capture();
		const valueMinor = voiceCommand?.entities.amount?.value_minor;
		if (!voiceCommand?.validation.valid || valueMinor === undefined || orderCreating) return;
		const major = Math.floor(valueMinor / 100);
		const minor = valueMinor % 100;
		const voiceAmount = valueMinor / 100;
		const customerName = voiceCommand.entities.customer?.name;
		scenario = 'fixed';
		setExpression(minor ? `${major}.${String(minor).padStart(2, '0')}` : String(major), 1);
		voiceError = '';
		const created = await submitOrder(voiceAmount, customerName ? `Рахунок для ${customerName}` : undefined);
		if (!sessionFence.isCurrent(generation) || !voiceFence.isCurrent(attempt)) return;
		if (created) {
			closeVoice();
		} else {
			voiceError = orderCreateError;
		}
	}

	function clearAccountState() {
		structureFence.advance();
		historyFence.advance();
		if (evaluationTimer) clearTimeout(evaluationTimer);
		evaluationTimer = undefined;
		closeVoice();
		voiceTranscript = '';
		voiceCommand = null;
		voiceError = '';
		voiceLocale = 'uk-UA';
		microphoneBusy = false;
		closeOrder();
		previewOpen = false;
		orderCreating = false;
		orderCreateError = '';
		activeView = 'kasa';
		expression = '';
		previousDisplay = '0';
		wheelDirection = 1;
		wheelRevision = 0;
		scenario = 'fixed';
		qrSwipeStartX = null;
		entities = [];
		terminals = [];
		selectedTerminalId = '';
		orders = [];
		historyPeriod = 'today';
		structureLoading = false;
		structureError = '';
		historyLoading = false;
		historyError = '';
		merchantDataGateway = null;
		googleLoginMessage = '';
		if (accountIdentity) telegramLoginMessage = '';
	}

	async function restoreSession() {
		if (disposed || signingOut) return;
		const request = restoreFence.advance();
		// Auth events carry no identity here: invalidate old continuations immediately.
		sessionFence.advance();
		authBusy = false;
		closeVoice();
		authState = { status: 'loading' };
		const current = () => !disposed && restoreFence.isCurrent(request);
		try {
			const { getAuthGateway, getMerchantDataGateway } = await import('./auth/supabase-browser');
			if (!current()) return;
			const gateway = await getAuthGateway();
			if (!current()) return;
			authGateway = gateway;
			if (gateway && telegramEnabled && !telegramLogin) {
				telegramLogin = gateway.createTelegramLogin({
					origin: window.location.origin,
					enabled: import.meta.env.PUBLIC_TELEGRAM_AUTH_ENABLED,
					mode: import.meta.env.PUBLIC_TELEGRAM_AUTH_MODE,
					clientId: import.meta.env.PUBLIC_TELEGRAM_CLIENT_ID
				});
				unsubscribeTelegram = telegramLogin.subscribe((status) => { telegramStatus = status; });
				void telegramLogin.prepare();
			}
			// Subscribe before restore/data awaits so an account switch cannot be missed.
			if (gateway && !unsubscribeAuth) {
				unsubscribeAuth = gateway.subscribe(() => void restoreSession());
			}
			const restoredState: AuthState = gateway
				? await gateway.restore()
				: { status: 'error', message: 'Не налаштовано підключення Supabase.' };
			if (!current()) return;
			const identity = restoredState.status === 'ready'
				? JSON.stringify([restoredState.user.id, restoredState.merchant.id]) : '';
			if (!identity || identity !== accountIdentity) clearAccountState();
			accountIdentity = identity;
			if (restoredState.status === 'ready') {
				const dataGateway = await getMerchantDataGateway();
				if (!current()) return;
				merchantDataGateway = dataGateway;
			}
			authState = restoredState;
			// A same-account refresh also invalidated in-flight UI busy indicators.
			orderCreating = false;
			orderAction = null;
			microphoneBusy = false;
			historyLoading = false;
			if (restoredState.status === 'ready') await loadStructure(restoredState.user.id);
		} catch {
			if (!current()) return;
			clearAccountState();
			accountIdentity = '';
			authState = { status: 'error', message: 'Не вдалося запустити авторизацію.' };
		}
	}

	async function loadStructure(userId: string) {
		if (!merchantDataGateway || authState.status !== 'ready' || authState.user.id !== userId) return;
		const gateway = merchantDataGateway;
		const generation = sessionFence.capture();
		const request = structureFence.advance();
		const current = () => sessionFence.isCurrent(generation) && structureFence.isCurrent(request);
		structureLoading = true;
		structureError = '';
		try {
			const structure = await gateway.getStructure(userId);
			if (!current()) return;
			entities = structure.entities;
			terminals = structure.terminals;
			if (!terminals.some((terminal) => terminal.id === selectedTerminalId)) {
				selectedTerminalId = terminals[0]?.id ?? '';
			}
		} catch (error) {
			if (!current()) return;
			structureError = error instanceof Error ? error.message : 'Не вдалося завантажити каси та столи.';
		} finally {
			if (current()) structureLoading = false;
		}
	}

	async function loadHistory(merchantId: string, period: HistoryPeriod = historyPeriod) {
		if (!merchantDataGateway || authState.status !== 'ready' || authState.merchant.id !== merchantId || historyPeriod !== period) return;
		const gateway = merchantDataGateway;
		const generation = sessionFence.capture();
		const request = historyFence.advance();
		const current = () => sessionFence.isCurrent(generation) && historyFence.isCurrent(request) && historyPeriod === period;
		historyLoading = true;
		historyError = '';
		try {
			const loadedOrders = await gateway.listOrders(merchantId, historyThreshold(period).toISOString());
			if (current()) orders = loadedOrders;
		} catch (error) {
			if (!current()) return;
			historyError = error instanceof Error ? error.message : 'Не вдалося завантажити історію оплат.';
		} finally {
			if (current()) historyLoading = false;
		}
	}

	function selectQrTerminal(index: number) {
		const terminal = terminals[index];
		if (!terminal || terminal.id === selectedTerminalId) return;
		selectedTerminalId = terminal.id;
		haptic('selection');
	}

	function finishQrSwipe(event: PointerEvent) {
		if (qrSwipeStartX === null) return;
		const distance = event.clientX - qrSwipeStartX;
		qrSwipeStartX = null;
		if (Math.abs(distance) < 40) return;
		selectQrTerminal(selectedTerminalIndex + (distance < 0 ? 1 : -1));
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
		if (type === 'open' || type === 'open_amount') return 'Вільна сума';
		return 'Фіксований рахунок';
	}

	function openOrder(order: OrderSummary) {
		if (authState.status !== 'ready') return;
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
		if (authState.status !== 'ready') return;
		const generation = sessionFence.capture();
		const current = () => sessionFence.isCurrent(generation) && selectedOrder?.id === order.id;
		orderAction = 'copy';
		try {
			await navigator.clipboard.writeText(order.shareUrl || `${window.location.origin}/pay/${order.id}`);
			if (!current()) return;
			haptic('light');
			setTimeout(() => {
				if (current() && orderAction === 'copy') orderAction = null;
			}, 1400);
		} catch {
			if (current()) orderAction = null;
		}
	}

	async function shareOrder(order: OrderSummary) {
		if (authState.status !== 'ready') return;
		const generation = sessionFence.capture();
		const url = order.shareUrl || `${window.location.origin}/pay/${order.id}`;
		if (!navigator.share) return copyOrderLink(order);
		try {
			await navigator.share({ title: `Рахунок ${order.orderNumber}`, text: `${formatAmount(String(order.amount))} ₴`, url });
			if (!sessionFence.isCurrent(generation)) return;
			haptic('light');
		} catch {
			return;
		}
	}

	async function cancelOrder(order: OrderSummary) {
		if (!merchantDataGateway || authState.status !== 'ready') return;
		if (!cancelConfirmation) {
			cancelConfirmation = true;
			haptic('medium');
			return;
		}
		const gateway = merchantDataGateway;
		const merchantId = authState.merchant.id;
		const expectedUserId = authState.user.id;
		const generation = sessionFence.capture();
		const isCurrentSession = () => sessionFence.isCurrent(generation);
		const current = () => sessionFence.isCurrent(generation) && selectedOrder?.id === order.id;
		orderAction = 'cancel';
		try {
			await gateway.cancelOrder(order.id, expectedUserId, isCurrentSession);
			if (!sessionFence.isCurrent(generation)) return;
			await loadHistory(merchantId);
			if (!current()) return;
			closeOrder();
			haptic('medium');
		} catch (error) {
			if (!current()) return;
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

	async function signIn(credential: string, nonce: string) {
		if (!authGateway || authBusy || telegramStatus === 'busy' || telegramStatus === 'exchanging') return;
		const generation = sessionFence.capture();
		authBusy = true;
		googleLoginMessage = '';
		try {
			await authGateway.signInWithGoogleIdToken(credential, nonce);
		} catch {
			if (sessionFence.isCurrent(generation)) googleLoginMessage = 'Не вдалося увійти через Google.';
		} finally {
			if (sessionFence.isCurrent(generation)) authBusy = false;
		}
	}

	async function startTelegram(mode: 'signin' | 'link') {
		if (!telegramLogin || authBusy || !telegramEnabled || telegramStatus !== 'ready') return;
		const expectedUserId = authState.status === 'ready' || authState.status === 'onboarding' ? authState.user.id : null;
		if (mode === 'signin' && authState.status !== 'guest') return;
		const generation = sessionFence.capture();
		authBusy = true;
		telegramLoginMessage = '';
		try {
			await telegramLogin.start(mode, expectedUserId);
		} catch {
			if (sessionFence.isCurrent(generation)) telegramLoginMessage = 'Вхід через Telegram не завершено або скасовано. Дозвольте спливні вікна та спробуйте знову. Перенаправлення автоматично не запускається.';
		} finally {
			if (sessionFence.isCurrent(generation)) authBusy = false;
		}
	}

	async function signOut() {
		if (!authGateway || authBusy || telegramStatus === 'busy' || telegramStatus === 'exchanging') return;
		const gateway = authGateway;
		signingOut = true;
		restoreFence.advance();
		const generation = sessionFence.advance();
		clearAccountState();
		accountIdentity = '';
		authState = { status: 'loading' };
		authBusy = true;
		try {
			await gateway.signOut();
			if (!sessionFence.isCurrent(generation)) return;
			authState = { status: 'guest' };
		} catch {
			if (sessionFence.isCurrent(generation)) authState = { status: 'error', message: 'Не вдалося вийти з акаунта.' };
		} finally {
			signingOut = false;
			if (sessionFence.isCurrent(generation)) authBusy = false;
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
		if (authState.status !== 'ready' || !canPreview) return;
		orderCreateError = '';
		previewOpen = true;
		haptic('medium');
	}

	async function submitOrder(orderAmount: number, title?: string) {
		if (!merchantDataGateway || authState.status !== 'ready' || orderCreating) return;
		const gateway = merchantDataGateway;
		const expectedUserId = authState.user.id;
		const generation = sessionFence.capture();
		const isCurrentSession = () => sessionFence.isCurrent(generation);
		orderCreating = true;
		orderCreateError = '';
		const orderNumber = `APP-${Date.now().toString().slice(-8)}`;
		try {
			const order = await gateway.createOrder({
				type: scenario === 'open' ? 'open_amount' : scenario,
				amount: orderAmount,
				orderNumber,
				title: title || (scenario === 'table' && selectedTerminal ? selectedTerminal.name : `Рахунок ${orderNumber}`),
				description: scenario === 'table' && selectedTerminal ? `Оплата через ${selectedTerminal.name}` : undefined,
				tableNumber: scenario === 'table' && selectedTerminal && /^\d+$/.test(selectedTerminal.code)
					? Number(selectedTerminal.code)
					: undefined
			}, expectedUserId, isCurrentSession);
			// Keep the dispatched outcome; only suppress writes into a newer session.
			if (!sessionFence.isCurrent(generation)) return true;
			orders = [order, ...orders.filter((existing) => existing.id !== order.id)];
			previewOpen = false;
			selectedOrder = order;
			setExpression('', -1);
			haptic('medium');
			return true;
		} catch (error) {
			if (sessionFence.isCurrent(generation)) orderCreateError = error instanceof Error ? error.message : 'Не вдалося створити рахунок.';
			return false;
		} finally {
			if (sessionFence.isCurrent(generation)) orderCreating = false;
		}
	}

	async function createOrder() {
		await submitOrder(amount);
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
				<LoginOptions enabled={telegramEnabled} busy={authBusy || (telegramEnabled && telegramStatus !== 'ready')} onTelegram={() => void startTelegram('signin')}>
				{#if telegramEnabled && telegramStatus === 'loading'}<p role="status">Готуємо вхід через Telegram…</p>{/if}
				{#if telegramEnabled && telegramStatus === 'external-required'}<TelegramExternalBrowser />{/if}
				{#if telegramEnabled && telegramStatus === 'error'}<p role="alert">Telegram недоступний. Перевірте підключення й налаштування, потім оновіть сторінку. Google залишається доступним.</p>{/if}
				{#if telegramStatus === 'busy'}<button type="button" onclick={() => telegramLogin?.cancel()}>Скасувати Telegram</button>{/if}
				{#if telegramStatus === 'exchanging'}<p role="status">Завершуємо авторизацію Telegram… Не запускайте інший вхід.</p>{/if}
				{#if telegramLoginMessage}<p role="alert">{telegramLoginMessage}</p>{/if}
				<div class="google-login">
					<div {@attach initializeGoogleButton} class:invisible={authBusy}></div>
					{#if authBusy}<p>Авторизація...</p>{/if}
					{#if googleLoginMessage}<p class="google-login-error" role="alert">{googleLoginMessage}</p>{/if}
				</div>
				</LoginOptions>
			{:else if authState.status === 'onboarding'}
				<div class="auth-message">
					<strong>У цьому акаунті бізнес не знайдено</strong>
					<AccountIdentityGuidance context="onboarding" user={authState.user} />
					<p>Лише якщо ви ще не створювали бізнес, створіть його в особистому кабінеті, після чого поверніться до каси.</p>
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
			<div class="profile-row"><span>R</span><div><strong>{merchantName}</strong><p>{authState.user.email ?? 'Обліковий запис'}</p></div></div>
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
			<AccountIdentityGuidance context="profile" user={authState.user} />
			{#if telegramEnabled}
				{#if !hasTelegramIdentity(authState.user) && authState.user.email && !authState.user.is_anonymous}
					<button class="logout-button" type="button" onclick={() => void startTelegram('link')} disabled={authBusy || telegramStatus !== 'ready'}>Прив’язати Telegram до цього акаунта</button>
				{/if}
				{#if telegramStatus === 'busy'}<button type="button" onclick={() => telegramLogin?.cancel()}>Скасувати Telegram</button>{/if}
				{#if telegramStatus === 'exchanging'}<p role="status">Завершуємо прив’язування Telegram… Не запускайте інший вхід.</p>{/if}
				{#if telegramStatus === 'error'}<p role="alert">Telegram недоступний. Оновіть сторінку після перевірки налаштувань.</p>{/if}
				{#if telegramStatus === 'external-required'}<TelegramExternalBrowser />{/if}
				{#if telegramLoginMessage}<p role="alert">{telegramLoginMessage}</p>{/if}
			{/if}
			<button class="logout-button" type="button" onclick={signOut} disabled={authBusy || telegramStatus === 'busy' || telegramStatus === 'exchanging'}>Вийти з акаунта</button>
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

{#if authState.status === 'ready' && voiceOpen}
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
				{#if voiceError}<p class="voice-error" role="alert">{voiceError}</p>{/if}
				<button class="primary-button" type="button" onclick={confirmVoiceCommand} disabled={orderCreating}>
					{orderCreating ? 'Створення...' : 'Створити рахунок'}
				</button>
			{:else if voicePhase === 'error'}
				<p class="voice-error" role="alert">{voiceError}</p>
				<button class="primary-button" type="button" onclick={startListening}>Спробувати ще раз</button>
			{:else if voicePhase === 'listening'}
				<button class="voice-stop" type="button" onclick={() => speechRecognition?.stop()}>Завершити</button>
			{/if}
		</div>
	</div>
{/if}

{#if authState.status === 'ready' && previewOpen}
	<div class="modal-backdrop intelligence-backdrop" role="presentation">
		<div class="order-sheet creation-sheet" role="dialog" aria-modal="true" aria-labelledby="preview-title">
			<div class="sheet-handle" aria-hidden="true"></div>
			<button class="sheet-close" type="button" onclick={() => (previewOpen = false)} aria-label="Закрити"><X size={18} /></button>
			<div class="creation-status"><span></span> Новий рахунок</div>
			<p class="eyebrow">Перевірка перед створенням</p>
			<h2 id="preview-title">{scenario === 'open' ? 'Вільна сума' : formatAmount(String(amount))} {#if scenario !== 'open'}<small>₴</small>{/if}</h2>
			{#if scenario === 'table' && selectedTerminal}
				<div
					class="qr-carousel"
					class:multiple={terminals.length > 1}
					role="group"
					aria-label="QR-коди терміналів"
					onpointerdown={(event) => (qrSwipeStartX = event.clientX)}
					onpointerup={finishQrSwipe}
					onpointercancel={() => (qrSwipeStartX = null)}
				>
					<div class="qr-carousel-heading">
						<button type="button" aria-label="Попередній QR-код" disabled={selectedTerminalIndex <= 0} onclick={() => selectQrTerminal(selectedTerminalIndex - 1)}><ChevronLeft size={18} /></button>
						<p class="terminal-summary"><strong>{selectedTerminal.name}</strong><span>{selectedTerminal.code}</span></p>
						<button type="button" aria-label="Наступний QR-код" disabled={selectedTerminalIndex >= terminals.length - 1} onclick={() => selectQrTerminal(selectedTerminalIndex + 1)}><ChevronRight size={18} /></button>
					</div>
					<PaymentQr value={`${window.location.origin}/pos/${encodeURIComponent(selectedTerminal.code)}`} label="QR столу (багаторазовий)" />
					{#if terminals.length > 1}
						<div class="qr-pagination" aria-label={`QR-код ${selectedTerminalIndex + 1} з ${terminals.length}`}>
							{#each terminals as terminal, index}
								<button class:active={terminal.id === selectedTerminalId} type="button" aria-label={`Показати QR ${terminal.name}`} onclick={() => selectQrTerminal(index)}></button>
							{/each}
							<span>{selectedTerminalIndex + 1} / {terminals.length}</span>
						</div>
					{/if}
				</div>
			{:else}
				<div class="creation-mark" aria-hidden="true"><svg viewBox="0 0 208 221"><path d="M108.9 29.2c31.7 0 52.6 20.2 52.6 47.8 0 21.2-12.1 38.8-33.1 46.3l40.9 68.1c-25.3 0-48.6-13.3-61-34.7l-13.7-23.7c-12.1 0-21.9 9.6-21.9 21.3v37.1c-19.4 0-35.2-15.3-35.2-34.3v-20c0-18.9 15.8-34.3 35.2-34.3h28.8c15.8 0 24.7-8.3 24.7-22.4 0-13.1-7.5-19.7-22.4-19.7H72.7c-19.4 0-35.2-14.1-35.2-31.5h71.4Z" /></svg></div>
			{/if}
			<div class="order-meta creation-meta">
				<div><span>Тип</span><strong>{scenario === 'table' ? 'Термінал' : scenario === 'open' ? 'Вільна сума' : 'Фіксований'}</strong></div>
				<div><span>Статус</span><strong>Не створено</strong></div>
			</div>
			{#if orderCreateError}<p class="sheet-copy" role="alert">{orderCreateError}</p>{/if}
			<button class="primary-button creation-action" type="button" onclick={createOrder} disabled={orderCreating}>
				{orderCreating ? 'Створення...' : 'Створити рахунок і QR'}
			</button>
		</div>
	</div>
{/if}

{#if authState.status === 'ready' && selectedOrder}
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