<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Copy from '@lucide/svelte/icons/copy';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import Send from '@lucide/svelte/icons/send';
	import Share2 from '@lucide/svelte/icons/share-2';
	import X from '@lucide/svelte/icons/x';
	import { haptic } from '../platform/telegram';
	import PaymentQr from './PaymentQr.svelte';
	import { formatAmount } from './calculator';
	import type { OrderSummary, Terminal } from '../data/merchant-data-gateway';
	import {
		computeLiquidGeometry,
		stepSpring,
		ACTIVATION_THRESHOLD,
		MAX_DRAG_DISTANCE,
		type LiquidGeometry,
		type SpringState
	} from './liquid-payment-physics';

	interface Props {
		amount: number;
		formattedAmount: string;
		scenario: 'fixed' | 'table' | 'open';
		disabled?: boolean;
		selectedTerminal?: Terminal;
		terminals?: Terminal[];
		selectedTerminalIndex?: number;
		onSelectTerminal?: (index: number) => void;
		orderCreating?: boolean;
		orderCreateError?: string;
		open?: boolean;
		selectedOrder?: OrderSummary | null;
		orderAction?: 'copy' | 'cancel' | null;
		telegramAction?: 'sending' | 'sent' | 'error' | 'unknown' | null;
		telegramActionMessage?: string;
		cancelConfirmation?: boolean;
		origin?: string;
		onSubmitOrder: () => void;
		onShareOrder?: (order: OrderSummary) => void;
		onSendTelegramInvoice?: (order: OrderSummary) => void;
		onCopyOrderLink?: (order: OrderSummary) => void;
		onCancelOrder?: (order: OrderSummary) => void;
		onClose?: () => void;
	}

	let {
		amount,
		formattedAmount,
		scenario,
		disabled = false,
		selectedTerminal,
		terminals = [],
		selectedTerminalIndex = 0,
		onSelectTerminal,
		orderCreating = false,
		orderCreateError = '',
		open = $bindable(false),
		selectedOrder = null,
		orderAction = null,
		telegramAction = null,
		telegramActionMessage = '',
		cancelConfirmation = false,
		origin = '',
		onSubmitOrder,
		onShareOrder,
		onSendTelegramInvoice,
		onCopyOrderLink,
		onCancelOrder,
		onClose
	}: Props = $props();

	let containerEl: HTMLElement | null = $state(null);
	let cardEl: HTMLElement | null = $state(null);
	let buttonWidth = $state(180);
	let windowWidth = $state(380);
	let windowHeight = $state(520);
	let viewportWidth = $state(360);
	let viewportHeight = $state(640);
	let startCenterY = $state(0);

	function initialOrder() {
		return selectedOrder;
	}

	let cachedOrder = $state<OrderSummary | null>(initialOrder());
	let qrEntryIndex = $state(0);
	let spring = $state<SpringState>({ value: 0, velocity: 0, target: 0 });
	let isDragging = $state(false);
	let isHolding = $state(false);
	let isPressed = $state(false);
	let pointerStartY = 0;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let animFrame: number | undefined;
	let lastTime = 0;
	let reducedMotion = false;
	let returnFocus: HTMLElement | null = null;
	let qrSwipeStartX: number | null = null;

	const fullDateFormatter = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'long', timeStyle: 'short' });

	function orderStatus(status: string) {
		if (status === 'paid' || status === 'completed') return 'Сплачено';
		if (status === 'cancelled' || status === 'expired') return 'Скасовано';
		if (status === 'ready') return 'Готовий';
		if (status === 'preparing') return 'Готується';
		return 'Очікує';
	}

	function orderType(type: string) {
		if (type === 'table') return 'Стіл';
		if (type === 'delivery') return 'Доставка';
		if (type === 'open' || type === 'open_amount') return 'Вільна сума';
		return 'Фіксований рахунок';
	}

	function orderIdentifier(id: string) {
		return `#${id.replaceAll('-', '').slice(0, 8).toUpperCase()}`;
	}

	// Keep spring target open if selectedOrder exists or open is true
	$effect(() => {
		if (selectedOrder) {
			cachedOrder = selectedOrder;
			updateDimensions();
		}
		if (selectedOrder || open) {
			updateAnchorCoords();
			if (spring.target !== 1) spring = { value: spring.value, velocity: spring.velocity, target: 1 };
		} else {
			if (spring.target !== 0 && !isDragging) spring = { value: spring.value, velocity: spring.velocity, target: 0 };
		}
	});

	// Auto-collapse when disabled (only if no active order is being viewed)
	$effect(() => {
		if (disabled && !selectedOrder && (open || spring.target > 0)) {
			open = false;
			if (spring.target !== 0) spring = { value: spring.value, velocity: spring.velocity, target: 0 };
		}
	});

	// Compute base geometry
	let geo = $derived<LiquidGeometry>(
		computeLiquidGeometry(spring.value, buttonWidth, windowWidth, windowHeight)
	);

	let sheetCenterY = $derived(viewportWidth >= 768 ? viewportHeight / 2 : viewportHeight - windowHeight / 2 - 8);

	let isOverlayActive = $derived(Boolean(cachedOrder) || open || spring.value > 0.005 || spring.target > 0 || isPressed);
	let isExpanded = $derived(spring.value >= 0.82);

	let displayText = $derived(
		scenario === 'open' ? 'Вільна сума' : amount > 0 ? `${formattedAmount} ₴` : 'Рахунок'
	);

	let scenarioLabel = $derived(
		scenario === 'table' ? 'Термінал' : scenario === 'open' ? 'Вільна сума' : 'Фіксований'
	);

	let shareOrigin = $derived(origin || (typeof window !== 'undefined' ? window.location.origin : ''));
	let paymentComplete = $derived(cachedOrder?.status === 'paid' || cachedOrder?.status === 'completed');
	let paymentClosed = $derived(cachedOrder?.status === 'cancelled' || cachedOrder?.status === 'expired');
	let paymentUrl = $derived(cachedOrder ? `${shareOrigin}/pay/${encodeURIComponent(cachedOrder.id)}` : '');
	let orderTerminal = $derived(terminals.find((terminal) => terminal.id === cachedOrder?.terminalId));
	let qrEntries = $derived(
		cachedOrder
			? [
					...(cachedOrder.type === 'table' && orderTerminal
						? [{ label: `Точка ${orderTerminal.name}`, detail: 'Багаторазовий вхід', url: `${shareOrigin}/tag/${encodeURIComponent(orderTerminal.code)}` }]
						: []),
					{
						label: cachedOrder.type === 'table' ? 'Одноразовий чек' : cachedOrder.type === 'open_amount' ? 'Вільна сума' : 'Коротке посилання',
						detail: 'Швидка оплата',
						url: `${shareOrigin}/${cachedOrder.type === 'table' ? 'pos' : cachedOrder.type === 'open_amount' ? 't' : 'o'}/${cachedOrder.id}`
					},
					{ label: 'Рахунок', detail: 'Повне посилання', url: paymentUrl }
				]
			: []
	);
	let activeQrIndex = $derived(Math.min(qrEntryIndex, Math.max(0, qrEntries.length - 1)));
	let activeQrEntry = $derived(qrEntries[activeQrIndex]);

	$effect(() => {
		if (isExpanded && cardEl && !cardEl.contains(document.activeElement)) {
			returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			cardEl.focus();
		}
	});

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) {
					node.parentNode.removeChild(node);
				}
			}
		};
	}

	onMount(() => {
		reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		updateDimensions();
		window.addEventListener('resize', updateDimensions);
		window.addEventListener('keydown', handleKeydown);
		lastTime = performance.now();
		animFrame = requestAnimationFrame(loop);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', updateDimensions);
			window.removeEventListener('keydown', handleKeydown);
		}
		if (animFrame) cancelAnimationFrame(animFrame);
		if (holdTimer) clearTimeout(holdTimer);
	});

	function updateAnchorCoords() {
		if (containerEl) {
			const rect = containerEl.getBoundingClientRect();
			if (rect.width > 30) buttonWidth = rect.width;
			startCenterY = rect.top + rect.height / 2;
		}
	}

	function updateDimensions() {
		updateAnchorCoords();
		if (typeof window !== 'undefined') {
			viewportWidth = window.innerWidth;
			viewportHeight = window.innerHeight;
			windowWidth = Math.min(viewportWidth - 16, 460);
			windowHeight = Math.min(viewportHeight - 32, cachedOrder ? 740 : 440);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!isOverlayActive) return;
		if (event.key === 'Escape') closeWindow();
		if (event.key !== 'Tab' || !cardEl) return;
		const controls = Array.from(cardEl.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(control => control.getClientRects().length > 0);
		const first = controls[0];
		const last = controls.at(-1);
		if (!first || !last) { event.preventDefault(); cardEl.focus(); return; }
		if (event.shiftKey && (document.activeElement === first || document.activeElement === cardEl)) {
			event.preventDefault(); last.focus();
		} else if (!event.shiftKey && (document.activeElement === last || document.activeElement === cardEl)) {
			event.preventDefault(); first.focus();
		}
	}

	function loop(time: number) {
		const dt = (time - lastTime) / 1000;
		lastTime = time;

		if (!isDragging && (Math.abs(spring.value - spring.target) > 0.0001 || Math.abs(spring.velocity) > 0.0001)) {
			if (reducedMotion) {
				spring = { value: spring.target, velocity: 0, target: spring.target };
			} else {
				spring = stepSpring(spring, dt);
			}
		}

		if (spring.value <= 0.01 && spring.target === 0) {
			if (open && !selectedOrder) {
				open = false;
			}
			if (cachedOrder && !selectedOrder) {
				cachedOrder = null;
			}
		}

		animFrame = requestAnimationFrame(loop);
	}

	function handleDockPointerDown(e: PointerEvent) {
		if (disabled) return;
		if (e.button !== 0) return;

		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);

		updateAnchorCoords();
		pointerStartY = e.clientY;
		isPressed = true;
		isDragging = false;
		isHolding = false;

		spring.target = 0.06;

		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = setTimeout(() => {
			if (!isPressed) return;
			isHolding = true;
			isDragging = true;
			haptic('selection');
		}, 120);
	}

	function handleDockPointerMove(e: PointerEvent) {
		if (!isPressed) return;
		const dy = pointerStartY - e.clientY;

		if (!isDragging && Math.abs(dy) > 6) {
			if (holdTimer) clearTimeout(holdTimer);
			isDragging = true;
			isHolding = true;
			haptic('selection');
		}

		if (isDragging) {
			const dragRatio = Math.max(0, dy) / MAX_DRAG_DISTANCE;
			const targetProgress = Math.min(1, dragRatio);
			spring.value = targetProgress;
			spring.target = targetProgress;
			spring.velocity = 0;
		}
	}

	function handleDockPointerUp(e: PointerEvent) {
		if (!isPressed) return;
		isPressed = false;
		if (holdTimer) clearTimeout(holdTimer);

		const dy = pointerStartY - e.clientY;

		if (!isDragging && Math.abs(dy) < 8) {
			haptic('medium');
			open = true;
			spring = { value: spring.value > 0.02 ? spring.value : 0, velocity: 0, target: 1.0 };
			return;
		}

		isDragging = false;
		isHolding = false;

		if (spring.value >= ACTIVATION_THRESHOLD) {
			open = true;
			spring = { value: spring.value, velocity: 0, target: 1.0 };
			haptic('medium');
		} else {
			open = false;
			spring = { value: spring.value, velocity: 0, target: 0.0 };
			haptic('light');
		}
	}

	function handleDockPointerCancel() {
		isPressed = false;
		isDragging = false;
		isHolding = false;
		if (holdTimer) clearTimeout(holdTimer);
		if (!open && !selectedOrder) spring.target = 0;
	}

	function handleDockKeydown(event: KeyboardEvent) {
		if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return;
		event.preventDefault();
		updateAnchorCoords();
		open = true;
		spring = { value: spring.value, velocity: 0, target: 1 };
		haptic('medium');
	}

	function selectQrEntry(index: number) {
		qrEntryIndex = Math.max(0, Math.min(index, qrEntries.length - 1));
		haptic('selection');
	}

	function finishQrSwipe(event: PointerEvent) {
		if (qrSwipeStartX === null) return;
		const distance = event.clientX - qrSwipeStartX;
		qrSwipeStartX = null;
		if (Math.abs(distance) < 40) return;
		selectQrEntry(activeQrIndex + (distance < 0 ? 1 : -1));
	}

	function handleCardPointerDown(e: PointerEvent) {
		if (e.clientY > startCenterY - 80) return;
		pointerStartY = e.clientY;
		isDragging = true;
	}

	function handleCardPointerMove(e: PointerEvent) {
		if (!isDragging) return;
		const dismissDy = e.clientY - pointerStartY;
		if (dismissDy > 0) {
			const ratio = dismissDy / MAX_DRAG_DISTANCE;
			const targetProgress = Math.max(0, 1 - ratio);
			spring.value = targetProgress;
			spring.target = targetProgress;
			spring.velocity = 0;
		}
	}

	function handleCardPointerUp(e: PointerEvent) {
		if (!isDragging) return;
		isDragging = false;
		if (spring.value < 0.72) {
			closeWindow();
		} else {
			spring.target = 1.0;
		}
	}

	function closeWindow() {
		open = false;
		onClose?.();
		spring = { value: spring.value, velocity: 0, target: 0 };
		haptic('light');
		if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus();
		else containerEl?.querySelector('button')?.focus();
	}
</script>

<!-- Resting Dock Button Anchor -->
<div class="liquid-dock-anchor" bind:this={containerEl}>
	<button
		type="button"
		class="dock-pay-btn"
		class:disabled={disabled && !selectedOrder}
		class:is-active={isOverlayActive}
		aria-label="Створити рахунок"
		aria-disabled={disabled}
		onpointerdown={handleDockPointerDown}
		onpointermove={handleDockPointerMove}
		onpointerup={handleDockPointerUp}
		onpointercancel={handleDockPointerCancel}
		onkeydown={handleDockKeydown}
	>
		<span class="dock-btn-action">Створити рахунок</span>
		<span class="dock-btn-label">{displayText}</span>
		<ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
	</button>
</div>

<!-- Portaled Morphing Liquid Glass Overlay -->
{#if isOverlayActive}
	<div use:portal class="liquid-portal-root">
		<!-- Backdrop -->
		<div
			class="liquid-backdrop"
			style:opacity={Math.min(0.75, Math.max(0, ((spring.value - 0.08) / 0.92) * 0.75))}
			role="presentation"
			onclick={closeWindow}
		></div>

		<!-- Morphing Glass Surface -->
		<div
			bind:this={cardEl}
			class="liquid-card"
			class:expanded={isExpanded}
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="invoice-dialog-title"
			style:left="{viewportWidth / 2}px"
			style:top="{sheetCenterY + (1 - Math.min(1, Math.max(0, spring.value))) * 20}px"
			style:opacity={Math.min(1, Math.max(0, spring.value))}
			style:width="{windowWidth}px"
			style:height="{windowHeight}px"
			style:border-radius="8px"
			style:--blur="{geo.blur}px"
			style:--shadow-blur="{geo.shadowBlur}px"
			style:--shadow-y="{geo.shadowOffsetY}px"
			style:--shadow-opacity="{geo.shadowOpacity}"
			style:--rim-opacity="{geo.rimOpacity}"
		>
			<!-- Top Drag Handle -->
			<div
				class="card-drag-zone"
				role="presentation"
				onpointerdown={handleCardPointerDown}
				onpointermove={handleCardPointerMove}
				onpointerup={handleCardPointerUp}
			>
				<div class="card-handle" aria-hidden="true"></div>
			</div>

			<header class="invoice-dialog-header">
				<h2 id="invoice-dialog-title">{cachedOrder ? 'Рахунок' : 'Новий рахунок'}</h2>
			<button
				type="button"
				class="card-close-btn"
				onclick={(e) => { e.stopPropagation(); closeWindow(); }}
				aria-label="Закрити"
			>
				<X size={17} />
			</button>
			</header>

			<!-- Compact preview during initial drag -->
			{#if !cachedOrder && geo.buttonContentOpacity > 0.01}
				<div class="layer-compact-preview" style:opacity={geo.buttonContentOpacity}>
					<span>{displayText}</span>
					<ChevronRight size={20} strokeWidth={2.2} />
				</div>
			{/if}

			<!-- Expanded Card Content -->
			{#if geo.windowContentOpacity > 0.01 || cachedOrder}
				<div
					class="layer-creation-content"
					class:has-order={Boolean(cachedOrder)}
					style:opacity={cachedOrder ? 1 : geo.windowContentOpacity}
					style:transform="translateY({cachedOrder ? 0 : (1 - geo.windowContentOpacity) * 14}px)"
				>
					{#if cachedOrder}
						<div class="created-order-view" class:complete={paymentComplete} class:closed={paymentClosed}>
							<div class="invoice-details">
							<div class="payment-state" aria-live="polite">
								<span class="payment-state-mark">
									{#if paymentComplete}<Check size={18} strokeWidth={2.6} />{:else if paymentClosed}<X size={18} />{:else}<span></span>{/if}
								</span>
								<strong>{paymentComplete ? 'Оплату отримано' : paymentClosed ? orderStatus(cachedOrder.status) : 'Очікуємо оплату'}</strong>
							</div>
							<p class="creation-eyebrow">{orderTerminal?.name || orderType(cachedOrder.type)}</p>
							<h2 id="liquid-title" class="creation-amount">
								{formatAmount(String(cachedOrder.amount))} <small>₴</small>
							</h2>

							{#if !paymentClosed}
								<div
									class="qr-carousel"
									role="group"
									aria-label="Варіанти QR для оплати"
									data-qr-routes={qrEntries.map((entry) => entry.url).join(' ')}
									onpointerdown={(event) => (qrSwipeStartX = event.clientX)}
									onpointerup={finishQrSwipe}
									onpointercancel={() => (qrSwipeStartX = null)}
								>
									<div class="qr-entry-heading">
										<button type="button" aria-label="Попередній QR" disabled={activeQrIndex === 0} onclick={() => selectQrEntry(activeQrIndex - 1)}><ChevronLeft size={19} /></button>
										<div><strong>{activeQrEntry?.label}</strong><span>{activeQrEntry?.detail}</span></div>
										<button type="button" aria-label="Наступний QR" disabled={activeQrIndex >= qrEntries.length - 1} onclick={() => selectQrEntry(activeQrIndex + 1)}><ChevronRight size={19} /></button>
									</div>
									<div class="qr-wrapper" class:complete={paymentComplete} data-payment-url={activeQrEntry?.url}>
										<PaymentQr value={activeQrEntry?.url || paymentUrl} label={`QR-код: ${activeQrEntry?.label || 'Оплата'}`} />
									</div>
									<div class="qr-pagination" aria-label={`QR ${activeQrIndex + 1} з ${qrEntries.length}`}>
										{#each qrEntries as entry, index (entry.url)}
											<button type="button" class:active={index === activeQrIndex} aria-label={`Показати ${entry.label}`} onclick={() => selectQrEntry(index)}></button>
										{/each}
										<span>{activeQrIndex + 1} / {qrEntries.length}</span>
									</div>
								</div>
								{#if paymentComplete}<p class="payment-instruction">Платіж підтверджено</p>{/if}
							{:else}
								<div class="closed-payment-mark"><X size={34} /></div>
							{/if}

							<div class="order-reference">
								<span>{cachedOrder.orderNumber || orderIdentifier(cachedOrder.id)}</span>
								<span>{fullDateFormatter.format(new Date(cachedOrder.createdAt))}</span>
							</div>
							</div>

							<footer class="invoice-actions">
							{#if !paymentClosed}<div class="order-actions-grid">
								<button
									type="button"
									class="action-btn share-btn"
									onclick={() => onShareOrder?.(cachedOrder!)}
								>
									<span><Share2 size={18} /></span>
									Поділитися
								</button>
								<button
									type="button"
									class="action-btn telegram-btn"
									disabled={telegramAction === 'sending'}
									onclick={() => onSendTelegramInvoice?.(cachedOrder!)}
								>
									<span>{#if telegramAction === 'sent'}<Check size={18} />{:else}<Send size={18} />{/if}</span>
									{telegramAction === 'sending' ? 'Надсилаємо...' : telegramAction === 'sent' ? 'Надіслано' : 'Надіслати в Telegram'}
								</button>
								<button
									type="button"
									class="action-btn copy-btn"
									onclick={() => onCopyOrderLink?.(cachedOrder!)}
								>
									<span>
										{#if orderAction === 'copy'}
											<Check size={18} />
										{:else}
											<Copy size={18} />
										{/if}
									</span>
									{orderAction === 'copy' ? 'Скопійовано' : 'Копіювати'}
								</button>
							</div>
								{#if telegramActionMessage}
									<p class:telegram-unknown={telegramAction === 'unknown'} class="telegram-delivery-message" role={telegramAction === 'sent' ? 'status' : 'alert'}>{telegramActionMessage}</p>
								{/if}
							{/if}

							<!-- Cancel option -->
							{#if !['paid', 'completed', 'cancelled', 'expired'].includes(cachedOrder.status)}
								<button
									class="cancel-btn"
									class:confirming={cancelConfirmation}
									type="button"
									disabled={orderAction === 'cancel'}
									onclick={() => onCancelOrder?.(cachedOrder!)}
								>
									<X size={16} />
									<span>{orderAction === 'cancel' ? 'Скасування...' : cancelConfirmation ? 'Підтвердити скасування' : 'Скасувати рахунок'}</span>
								</button>
							{/if}
							</footer>
						</div>
					{:else}
						<!-- CREATION PREVIEW VIEW -->
						<div class="creation-preview-view">
							<p class="creation-eyebrow">До сплати</p>

							<h2 id="liquid-title" class="creation-amount">
								{scenario === 'open' ? 'Вільна сума' : formattedAmount}
								{#if scenario !== 'open'}<small>₴</small>{/if}
							</h2>

							{#if scenario === 'table' && selectedTerminal}
								<div class="terminal-summary">
									<span><QrCode size={20} /></span>
									<div><small>Точка приймання</small><strong>{selectedTerminal.name}</strong><em>{selectedTerminal.code}</em></div>
								</div>
							{/if}

							<!-- Meta -->
							<div class="creation-meta">
								<div><span>Тип</span><strong>{scenarioLabel}</strong></div>
								<div><span>Статус</span><strong>Не створено</strong></div>
							</div>

							{#if orderCreateError}
								<p class="creation-error" role="alert">{orderCreateError}</p>
							{/if}

							<!-- Submit action -->
							<div class="creation-actions">
								<button
									type="button"
									class="creation-submit-btn"
									disabled={orderCreating}
									onclick={(e) => { e.stopPropagation(); onSubmitOrder(); }}
								>
									<span>{orderCreating ? 'Створюємо рахунок...' : 'Створити QR для оплати'}</span>
									{#if !orderCreating}
										<ChevronRight size={18} strokeWidth={2.4} />
									{/if}
								</button>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* Resting dock anchor */
	.liquid-dock-anchor {
		position: relative;
		display: flex;
		flex: 1;
		height: 52px;
		margin: 0;
		min-width: 0;
		align-items: center;
		justify-content: center;
		user-select: none;
		-webkit-user-select: none;
		touch-action: none;
	}

	.dock-pay-btn {
		display: flex;
		width: 100%;
		height: 52px;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 0 16px;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-top-color: rgba(255, 255, 255, 0.32);
		border-radius: 8px;
		color: #ffffff;
		font-size: 14px;
		font-weight: 700;
		background: var(--action);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
		cursor: pointer;
		touch-action: none;
		transition: transform 120ms ease, opacity 180ms ease;
	}

	.dock-pay-btn:active {
		transform: scale(0.96);
	}

	.dock-pay-btn.disabled {
		pointer-events: none;
		opacity: 0.5;
	}

	.dock-pay-btn.is-active {
		opacity: 0;
	}

	.dock-btn-action {
		min-width: 0;
		text-align: left;
		font-size: 14px;
		line-height: 1.2;
	}

	.dock-btn-label {
		margin-left: auto;
		overflow: hidden;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dock-pay-btn > :global(svg) {
		flex-shrink: 0;
	}

	/* Portal root */
	.liquid-portal-root {
		position: fixed;
		inset: 0;
		z-index: 1000;
		pointer-events: none;
	}

	.liquid-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(8, 9, 13, 0.72);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		pointer-events: auto;
		transition: opacity 200ms ease;
	}

	/* Morphing Liquid Glass Surface */
	.liquid-card {
		position: fixed;
		transform: translate(-50%, -50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		overflow-x: hidden;
		overflow-y: auto;
		max-height: calc(100svh - 24px);
		-webkit-overflow-scrolling: touch;
		pointer-events: auto;
		outline: none;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-top-color: rgba(255, 255, 255, 0.26);
		background: rgba(18, 19, 23, 0.97);
		backdrop-filter: blur(var(--blur)) saturate(125%);
		-webkit-backdrop-filter: blur(var(--blur)) saturate(125%);
		box-shadow:
			0 var(--shadow-y) var(--shadow-blur) rgba(0, 0, 0, var(--shadow-opacity)),
			0 12px 36px rgba(0, 0, 0, 0.34),
			inset 0 1px 1px rgba(255, 255, 255, calc(0.18 + var(--rim-opacity) * 0.16)),
			inset 0 -1px 2px rgba(0, 0, 0, 0.2);
		color: #ffffff;
		will-change: left, top, width, height, border-radius;
	}

	.liquid-card.expanded {
		border-color: rgba(255, 255, 255, 0.25);
		border-bottom-right-radius: 22px !important;
		border-bottom-left-radius: 22px !important;
	}

	/* Top Drag Handle */
	.card-drag-zone {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: grab;
		z-index: 10;
		touch-action: none;
	}

	.card-handle {
		width: 36px;
		height: 4px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.4);
	}

	.card-close-btn {
		position: absolute;
		top: 14px;
		right: 14px;
		z-index: 12;
		display: grid;
		width: 32px;
		height: 32px;
		padding: 0;
		place-items: center;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.75);
		cursor: pointer;
		transition: background 160ms ease, color 160ms ease;
	}

	.card-close-btn:hover {
		background: rgba(255, 255, 255, 0.18);
		color: #ffffff;
	}

	.layer-compact-preview {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: #ffffff;
		font-weight: 700;
		font-size: 14px;
		pointer-events: none;
		white-space: nowrap;
	}

	.layer-creation-content {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 34px 20px 20px;
		text-align: center;
		box-sizing: border-box;
		will-change: opacity, transform;
	}

	.created-order-view {
		display: flex;
		flex-direction: column;
		width: 100%;
		align-items: center;
		min-height: 100%;
	}

	.qr-carousel {
		display: flex;
		width: 100%;
		flex-direction: column;
		align-items: center;
		touch-action: pan-y;
	}

	.qr-entry-heading {
		display: grid;
		width: 100%;
		grid-template-columns: 36px 1fr 36px;
		align-items: center;
		gap: 8px;
	}

	.qr-entry-heading > div {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.qr-entry-heading strong,
	.qr-entry-heading span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.qr-entry-heading strong {
		font-size: 14px;
	}

	.qr-entry-heading span {
		color: rgba(255, 255, 255, 0.5);
		font-size: 11px;
	}

	.qr-entry-heading button {
		display: grid;
		width: 36px;
		height: 36px;
		place-items: center;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.07);
		color: #ffffff;
		cursor: pointer;
	}

	.qr-entry-heading button:disabled {
		opacity: 0.28;
		cursor: default;
	}

	.creation-preview-view {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
	}

	.payment-state {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 14px;
		padding: 6px 11px 6px 7px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid rgba(255, 255, 255, 0.1);
		font-size: 12px;
		color: rgba(255, 255, 255, 0.86);
	}

	.payment-state-mark {
		display: grid;
		width: 26px;
		height: 26px;
		place-items: center;
		border-radius: 50%;
		background: rgba(255, 204, 0, 0.14);
		color: #ffd54a;
	}

	.payment-state-mark > span {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ffd54a;
		box-shadow: 0 0 0 4px rgba(255, 213, 74, 0.14);
	}

	.created-order-view.complete .payment-state-mark {
		background: rgba(48, 209, 88, 0.15);
		color: #55dc77;
	}

	.created-order-view.closed .payment-state-mark {
		background: rgba(255, 105, 97, 0.14);
		color: #ff6961;
	}

	.order-reference {
		display: flex;
		width: 100%;
		justify-content: space-between;
		gap: 12px;
		margin: 2px 0 8px;
		color: rgba(255, 255, 255, 0.43);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	.order-reference span:last-child {
		text-align: right;
	}

	.qr-wrapper {
		display: flex;
		justify-content: center;
		margin: 8px auto 12px;
		padding: 8px;
		border-radius: 20px;
		background: #ffffff;
		box-shadow: 0 16px 34px rgba(0, 0, 0, 0.32);
	}

	.qr-wrapper :global(.payment-qr) {
		margin: 0 auto;
	}

	.qr-wrapper :global(figcaption) {
		display: none;
	}

	.qr-wrapper :global(.payment-qr-frame) {
		width: min(256px, 66vw, 34svh);
		aspect-ratio: 1;
		border-radius: 12px;
		box-shadow: none;
	}

	.qr-wrapper.complete {
		outline: 3px solid rgba(48, 209, 88, 0.5);
	}

	.qr-pagination {
		display: flex;
		height: 22px;
		align-items: center;
		justify-content: center;
		gap: 7px;
	}

	.qr-pagination button {
		width: 7px;
		height: 7px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.25);
		cursor: pointer;
		transition: width 160ms ease, border-radius 160ms ease, background 160ms ease;
	}

	.qr-pagination button.active {
		width: 20px;
		border-radius: 999px;
		background: #ffffff;
	}

	.qr-pagination span {
		margin-left: 3px;
		color: rgba(255, 255, 255, 0.48);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
	}

	.payment-instruction {
		margin: 0 0 12px;
		color: rgba(255, 255, 255, 0.67);
		font-size: 13px;
	}

	.closed-payment-mark {
		display: grid;
		width: 88px;
		height: 88px;
		place-items: center;
		margin: 42px auto;
		border-radius: 50%;
		background: rgba(255, 105, 97, 0.1);
		color: #ff6961;
	}

	.creation-eyebrow {
		margin: 0 0 4px;
		color: rgba(255, 255, 255, 0.48);
		font-size: 11px;
	}

	.creation-amount {
		margin: 0 0 8px;
		font-size: clamp(34px, 8vw, 44px);
		font-weight: 750;
		line-height: 1.05;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0;
		text-shadow: 0 2px 14px rgba(0, 0, 0, 0.35);
	}

	.creation-amount small {
		font-size: 22px;
		font-weight: 550;
		color: rgba(255, 255, 255, 0.55);
	}

	.terminal-summary {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		margin: 8px 0 18px;
		padding: 13px 14px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.06);
		text-align: left;
	}

	.terminal-summary > span {
		display: grid;
		width: 38px;
		height: 38px;
		flex: 0 0 38px;
		place-items: center;
		border-radius: 10px;
		background: rgba(72, 215, 232, 0.12);
		color: #48d7e8;
	}

	.terminal-summary div {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.terminal-summary small,
	.terminal-summary em {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.5);
		font-style: normal;
	}

	.terminal-summary strong {
		overflow: hidden;
		font-size: 14px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.creation-meta {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		margin-bottom: 12px;
		border-radius: 14px;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.08);
	}

	.creation-meta > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 12px;
		background: rgba(18, 20, 28, 0.65);
	}

	.creation-meta span {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.45);
	}

	.creation-meta strong {
		font-size: 13px;
		font-weight: 600;
	}


	.creation-error {
		margin: 0 0 10px;
		padding: 8px 12px;
		border-radius: 10px;
		background: rgba(255, 69, 58, 0.15);
		color: #ff453a;
		font-size: 12px;
		text-align: left;
	}

	/* Share & Copy Actions Grid */
	.order-actions-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-top: 6px;
		margin-bottom: 6px;
		width: 100%;
	}

	.action-btn {
		display: flex;
		height: 48px;
		min-height: 48px;
		align-items: center;
		justify-content: center;
		gap: 8px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
		font-size: 14px;
		font-weight: 650;
		cursor: pointer;
		transition: background 140ms ease, transform 120ms ease;
	}

	.action-btn:active {
		background: rgba(255, 255, 255, 0.18);
		transform: scale(0.97);
	}

	.action-btn:disabled {
		cursor: wait;
		opacity: 0.62;
	}

	.telegram-delivery-message {
		width: 100%;
		margin: 2px 0 6px;
		color: #ff9f0a;
		font-size: 12px;
		line-height: 1.4;
		text-align: left;
	}

	.telegram-delivery-message:not(.telegram-unknown)[role='status'] {
		color: #55dc77;
	}

	.cancel-btn {
		display: flex;
		width: 100%;
		height: 44px;
		min-height: 44px;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-top: 4px;
		border: 1px solid rgba(255, 69, 58, 0.4);
		border-radius: 14px;
		color: #ff6961;
		font-size: 13px;
		font-weight: 650;
		background: rgba(255, 69, 58, 0.08);
		cursor: pointer;
		transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
	}

	.cancel-btn:hover {
		background: rgba(255, 69, 58, 0.16);
	}

	.cancel-btn.confirming {
		background: #ff453a;
		color: #ffffff;
		border-color: #ff453a;
		box-shadow: 0 4px 16px rgba(255, 69, 58, 0.45);
		font-weight: 700;
	}

	.creation-actions {
		margin-top: auto;
		padding-bottom: max(0px, env(safe-area-inset-bottom));
		width: 100%;
	}

	.creation-submit-btn {
		display: flex;
		width: 100%;
		height: 50px;
		align-items: center;
		justify-content: center;
		gap: 7px;
		border: 1px solid rgba(255, 255, 255, 0.22);
		border-top-color: rgba(255, 255, 255, 0.38);
		border-radius: 14px;
		background: linear-gradient(135deg, #0a84ff 0%, #0066cc 100%);
		box-shadow: 0 6px 20px rgba(10, 132, 255, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.28);
		color: #ffffff;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
		transition: transform 120ms ease, box-shadow 160ms ease, opacity 160ms ease;
	}

	.creation-submit-btn:active:not(:disabled) {
		transform: scale(0.97);
		box-shadow: 0 3px 12px rgba(10, 132, 255, 0.25);
	}

	.creation-submit-btn:disabled {
		opacity: 0.65;
		cursor: default;
	}

	@media (max-height: 700px) {
		.layer-creation-content {
			padding-top: 30px;
			padding-bottom: 14px;
		}

		.payment-state {
			margin-bottom: 8px;
		}

		.order-reference {
			margin-bottom: 4px;
		}

		.qr-wrapper {
			margin: 5px auto 7px;
		}

		.qr-wrapper :global(.payment-qr-frame) {
			width: min(220px, 58vw, 29svh);
		}

		.payment-instruction {
			margin-bottom: 7px;
		}
	}

	.liquid-card { color: var(--ink); background: var(--panel); border-color: var(--line); overflow: hidden; backdrop-filter: none; -webkit-backdrop-filter: none; box-shadow: 0 16px 48px rgb(0 0 0 / 16%); }
	.liquid-card.expanded { border-color: var(--line); border-radius: 8px !important; }
	.liquid-backdrop { background: rgb(0 0 0 / 48%); backdrop-filter: none; -webkit-backdrop-filter: none; }
	.invoice-dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 68px; flex-shrink: 0; padding: 16px 16px 8px 24px; border-bottom: 1px solid var(--line); }
	.invoice-dialog-header h2 { margin: 0; font-size: 16px; font-weight: 650; line-height: 1.4; }
	.invoice-dialog-header .card-close-btn { position: static; flex-shrink: 0; border-radius: 8px; background: transparent; }
	.card-drag-zone { height: 14px; }
	.card-close-btn { width: 44px; height: 44px; top: 8px; right: 8px; color: var(--ink); background: var(--key); border-color: var(--line); }
	.card-close-btn:hover { color: var(--ink); background: var(--surface); }
	.card-handle { background: var(--muted); }
	.layer-creation-content { position: relative; inset: auto; flex: 1; min-height: 0; overflow-y: auto; padding: 20px 24px max(16px, env(safe-area-inset-bottom)); width: 100%; }
	.creation-preview-view { min-height: 100%; gap: 16px; }
	.layer-creation-content.has-order { padding: 0; overflow: hidden; }
	.created-order-view { gap: 0; height: 100%; min-height: 0; }
	.invoice-details { display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1; min-height: 0; width: 100%; overflow-y: auto; padding: 16px 24px; }
	.invoice-details > * { flex-shrink: 0; }
	.invoice-actions { flex-shrink: 0; width: 100%; padding: 8px 16px max(8px, env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--panel); }
	.invoice-actions:empty { display: none; }
	.qr-entry-heading { grid-template-columns: 44px minmax(0, 1fr) 44px; }
	.qr-entry-heading button { width: 44px; height: 44px; color: var(--ink); background: var(--key); border-color: var(--line); }
	.qr-entry-heading strong, .qr-entry-heading span, .terminal-summary strong { white-space: normal; overflow-wrap: anywhere; }
	.qr-entry-heading span, .creation-eyebrow, .terminal-summary small, .terminal-summary em, .creation-meta span, .order-reference, .payment-instruction, .creation-amount small { color: var(--muted); font-size: 13px; }
	.payment-state { color: var(--ink); border-color: var(--line); background: var(--surface); }
	.payment-state-mark { color: var(--warning); }
	.payment-state-mark > span { background: var(--warning); }
	.created-order-view.complete .payment-state-mark { color: var(--success); }
	.created-order-view.closed .payment-state-mark, .creation-error, .cancel-btn { color: var(--danger); }
	.order-reference { flex-wrap: wrap; }
	.creation-amount { font-size: 36px; text-shadow: none; overflow-wrap: anywhere; line-height: 1.2; }
	.creation-amount small { font-size: 22px; }
	.creation-meta { border-radius: 0; border-block: 1px solid var(--line); background: var(--line); }
	.creation-meta > div { background: var(--panel); padding: 12px; }
	.terminal-summary { border-radius: 0; background: transparent; border: 0; border-top: 1px solid var(--line); padding: 12px 0; }
	.terminal-summary > span { color: var(--brand); }
	.action-btn { height: auto; padding: 10px 6px; border-radius: 8px; color: var(--ink); background: var(--surface); border-color: var(--line); font-size: 13px; }
	.cancel-btn { border-radius: 8px; height: auto; padding: 10px; }
	.cancel-btn.confirming { background: #b93631; color: white; border-color: #b93631; box-shadow: none; }
	.creation-submit-btn { background: var(--action); border-radius: 8px; box-shadow: none; }
	.qr-pagination { height: auto; flex-wrap: wrap; gap: 0; }
	.qr-pagination button, .qr-pagination button.active { width: 44px; height: 44px; border-radius: 0; background: transparent; position: relative; }
	.qr-pagination button::after { position: absolute; content: ''; width: 7px; height: 7px; inset: 0; margin: auto; border-radius: 50%; background: var(--muted); }
	.qr-pagination button.active::after { width: 18px; border-radius: 4px; background: var(--brand); }
	.qr-pagination span { color: var(--muted); font-size: 12px; }
	.qr-wrapper { border-radius: 8px; box-shadow: none; margin: 8px auto; }
	.creation-actions { position: sticky; bottom: -16px; padding: 12px 0; background: var(--panel); }
	.creation-submit-btn { height: auto; min-height: 48px; padding: 12px; }
	.order-actions-grid { gap: 8px; }
	.order-actions-grid .share-btn { grid-column: 1 / -1; background: var(--action); color: white; border-color: transparent; }
	.action-btn { min-width: 0; overflow-wrap: anywhere; }
	.action-btn > span { display: flex; flex-shrink: 0; }
	.cancel-btn { background: transparent; border-color: transparent; }
	@media (min-width: 768px) { .card-drag-zone { display: none; } .invoice-dialog-header { padding-top: 8px; } }
	@media (max-width: 374px) { .layer-creation-content { padding-inline: 16px; } .invoice-dialog-header { padding-left: 16px; } .creation-amount { font-size: 30px; } }
	button:focus-visible { outline: 3px solid var(--brand); outline-offset: 3px; }
	@media (prefers-reduced-motion: reduce) {
		.liquid-card { transition: none !important; }
	}
</style>
