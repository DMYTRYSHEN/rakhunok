<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Copy from '@lucide/svelte/icons/copy';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import Share2 from '@lucide/svelte/icons/share-2';
	import X from '@lucide/svelte/icons/x';
	import { haptic } from '../platform/telegram';
	import PaymentQr from './PaymentQr.svelte';
	import { formatAmount } from './calculator';
	import type { OrderSummary, Terminal } from '../data/merchant-data-gateway';
	import {
		computeLiquidGeometry,
		stepSpring,
		lerp,
		smoothstep,
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
		cancelConfirmation?: boolean;
		origin?: string;
		onSubmitOrder: () => void;
		onShareOrder?: (order: OrderSummary) => void;
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
		cancelConfirmation = false,
		origin = '',
		onSubmitOrder,
		onShareOrder,
		onCopyOrderLink,
		onCancelOrder,
		onClose
	}: Props = $props();

	let containerEl: HTMLElement | null = $state(null);
	let buttonWidth = $state(180);
	let windowWidth = $state(380);
	let windowHeight = $state(520);
	let startCenterX = $state(0);
	let startCenterY = $state(0);

	let cachedOrder = $state<OrderSummary | null>(null);
	let createdQrIndex = $state(0);

	let spring = $state<SpringState>({ value: 0, velocity: 0, target: 0 });
	let isDragging = $state(false);
	let isHolding = $state(false);
	let isPressed = $state(false);
	let pointerStartY = 0;
	let holdTimer: ReturnType<typeof setTimeout> | undefined;
	let animFrame: number | undefined;
	let lastTime = 0;
	let reducedMotion = false;
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

	let screenCenterX = $derived(typeof window !== 'undefined' ? window.innerWidth / 2 : 180);
	let screenCenterY = $derived(typeof window !== 'undefined' ? window.innerHeight / 2 : 320);

	let t = $derived(smoothstep(spring.value));
	let currentCenterX = $derived(lerp(startCenterX || screenCenterX, screenCenterX, t));
	let currentCenterY = $derived(lerp(startCenterY || screenCenterY + 200, screenCenterY, t));

	let isOverlayActive = $derived(Boolean(cachedOrder) || open || spring.value > 0.005 || spring.target > 0 || isPressed);
	let isExpanded = $derived(spring.value >= 0.82);

	let displayText = $derived(
		scenario === 'open' ? 'Вільна сума' : amount > 0 ? `${formattedAmount} ₴` : 'Рахунок'
	);

	let scenarioLabel = $derived(
		scenario === 'table' ? 'Термінал' : scenario === 'open' ? 'Вільна сума' : 'Фіксований'
	);

	let shareOrigin = $derived(origin || (typeof window !== 'undefined' ? window.location.origin : ''));

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
		lastTime = performance.now();
		animFrame = requestAnimationFrame(loop);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', updateDimensions);
		}
		if (animFrame) cancelAnimationFrame(animFrame);
		if (holdTimer) clearTimeout(holdTimer);
	});

	function updateAnchorCoords() {
		if (containerEl) {
			const rect = containerEl.getBoundingClientRect();
			if (rect.width > 30) buttonWidth = rect.width;
			startCenterX = rect.left + rect.width / 2;
			startCenterY = rect.top + rect.height / 2;
		}
	}

	function updateDimensions() {
		updateAnchorCoords();
		if (typeof window !== 'undefined') {
			windowWidth = Math.min(window.innerWidth - 24, 430);
			windowHeight = Math.min(window.innerHeight - 32, cachedOrder ? 540 : 500);
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
	}

	function finishQrSwipe(e: PointerEvent) {
		if (qrSwipeStartX === null) return;
		const diff = e.clientX - qrSwipeStartX;
		qrSwipeStartX = null;
		if (Math.abs(diff) < 40) return;
		if (diff < 0 && selectedTerminalIndex < terminals.length - 1) {
			onSelectTerminal?.(selectedTerminalIndex + 1);
		} else if (diff > 0 && selectedTerminalIndex > 0) {
			onSelectTerminal?.(selectedTerminalIndex - 1);
		}
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
		onpointerdown={handleDockPointerDown}
		onpointermove={handleDockPointerMove}
		onpointerup={handleDockPointerUp}
		onpointercancel={handleDockPointerCancel}
	>
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
			class="liquid-card"
			class:expanded={isExpanded}
			role="dialog"
			aria-modal="true"
			aria-labelledby="liquid-title"
			style:left="{currentCenterX}px"
			style:top="{currentCenterY}px"
			style:width="{geo.width}px"
			style:height="{geo.height}px"
			style:border-radius="{geo.borderRadius}px"
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

			<!-- Close Button -->
			<button
				type="button"
				class="card-close-btn"
				onclick={(e) => { e.stopPropagation(); closeWindow(); }}
				aria-label="Закрити"
			>
				<X size={17} />
			</button>

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
					style:opacity={cachedOrder ? 1 : geo.windowContentOpacity}
					style:transform="translateY({cachedOrder ? 0 : (1 - geo.windowContentOpacity) * 14}px)"
				>
					{#if cachedOrder}
						{@const orderShortRef = cachedOrder.shareUrl ? cachedOrder.shareUrl.split('/').pop() : cachedOrder.id.split('-')[0]}
						{@const createdLinks = [
							...((scenario === 'table' || cachedOrder.type === 'table') && selectedTerminal ? [{
								label: 'Багаторазовий QR терміналу або столу',
								path: `/tag/${encodeURIComponent(selectedTerminal.code)}`
							}] : []),
							...(scenario === 'table' || cachedOrder.type === 'table' ? [{
								label: 'Одноразовий чек для клієнта',
								path: `/pos/${orderShortRef}`
							}] : [{
								label: 'Вільна сума або переказ',
								path: `/t/${orderShortRef}`
							}]),
							{
								label: 'Повне посилання',
								path: `/pay/${cachedOrder.id}`
							}
						]}
						<!-- CREATED ORDER VIEW (with PaymentQr, Share, Copy) -->
						<div class="created-order-view">
							<p class="creation-eyebrow">{orderType(cachedOrder.type)}</p>
							<h2 id="liquid-title" class="creation-amount">
								{formatAmount(String(cachedOrder.amount))} <small>₴</small>
							</h2>
							
							<div class="order-status-pill">
								<span class="status-indicator-dot" class:paid={cachedOrder.status === 'paid' || cachedOrder.status === 'completed'}></span>
								<span class="status-text">{orderStatus(cachedOrder.status)}</span>
								<span class="status-bullet">•</span>
								<span class="order-ref-code">{cachedOrder.orderNumber || orderIdentifier(cachedOrder.id)}</span>
							</div>

							<!-- The Payment QR code Carousel -->

							<div
								class="qr-wrapper created-qr-carousel"
								role="group"
								aria-label="QR-коди рахунку"
								onpointerdown={(e) => (qrSwipeStartX = e.clientX)}
								onpointerup={(e) => {
									if (qrSwipeStartX !== null) {
										const diff = e.clientX - qrSwipeStartX;
										if (diff > 40 && createdQrIndex > 0) createdQrIndex--;
										if (diff < -40 && createdQrIndex < createdLinks.length - 1) createdQrIndex++;
									}
									qrSwipeStartX = null;
								}}
								onpointercancel={() => (qrSwipeStartX = null)}
							>
								<PaymentQr
									value={`${shareOrigin}${createdLinks[createdQrIndex]?.path || `/pay/${cachedOrder.id}`}`}
									label=""
								/>

								{#if createdLinks.length > 1}
									<div class="carousel-nav" style="margin-top: 12px; margin-bottom: 8px;">
										<button
											type="button"
											aria-label="Попередній QR-код"
											disabled={createdQrIndex <= 0}
											onclick={(e) => { e.stopPropagation(); createdQrIndex--; }}
										>
											<ChevronLeft size={18} />
										</button>
										<div class="terminal-info" style="font-size: 11px; max-width: 160px; white-space: normal; line-height: 1.3; text-align: center;">
											<strong style="display:block; color: var(--text);">{createdLinks[createdQrIndex]?.label}</strong>
											<span style="display:block; margin-top: 4px; color: var(--color-zinc-500, #71717a); word-break: break-all;">{createdLinks[createdQrIndex]?.path}</span>
										</div>
										<button
											type="button"
											aria-label="Наступний QR-код"
											disabled={createdQrIndex >= createdLinks.length - 1}
											onclick={(e) => { e.stopPropagation(); createdQrIndex++; }}
										>
											<ChevronRight size={18} />
										</button>
									</div>

									<div class="carousel-dots" style="margin-top: 8px;" aria-label={`QR-код ${createdQrIndex + 1} з ${createdLinks.length}`}>
										{#each createdLinks as link, idx}
											<button
												class:active={idx === createdQrIndex}
												type="button"
												aria-label={`Показати ${link.label}`}
												onclick={(e) => { e.stopPropagation(); createdQrIndex = idx; }}
											></button>
										{/each}
										<span>{createdQrIndex + 1} / {createdLinks.length}</span>
									</div>
								{:else}
									<div class="terminal-info" style="font-size: 11px; max-width: 200px; margin: 12px auto 8px; white-space: normal; line-height: 1.3; text-align: center;">
										<strong style="display:block; color: var(--text);">{createdLinks[0]?.label}</strong>
										<span style="display:block; margin-top: 4px; color: var(--color-zinc-500, #71717a); word-break: break-all;">{createdLinks[0]?.path}</span>
									</div>
								{/if}
							</div>

							<p class="order-created-time">
								{fullDateFormatter.format(new Date(cachedOrder.createdAt))}
							</p>

							<!-- Share & Copy actions -->
							<div class="order-actions-grid">
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

							<!-- Cancel option -->
							{#if !['paid', 'completed', 'cancelled', 'expired'].includes(cachedOrder.status)}
								<button
									class="cancel-btn"
									class:confirming={cancelConfirmation}
									type="button"
									disabled={orderAction === 'cancel'}
									onclick={() => onCancelOrder?.(cachedOrder!)}
								>
									<span>✕</span>
									<span>{orderAction === 'cancel' ? 'Скасування...' : cancelConfirmation ? 'Підтвердити скасування' : 'Скасувати рахунок'}</span>
								</button>
							{/if}
						</div>
					{:else}
						<!-- CREATION PREVIEW VIEW -->
						<div class="creation-preview-view">
							<div class="creation-status"><span></span> Новий рахунок</div>
							<p class="creation-eyebrow">Перевірка перед створенням</p>

							<h2 id="liquid-title" class="creation-amount">
								{scenario === 'open' ? 'Вільна сума' : formattedAmount}
								{#if scenario !== 'open'}<small>₴</small>{/if}
							</h2>

							<!-- Table QR or Carousel -->
							{#if scenario === 'table' && terminals.length > 0}
								{@const displayTerminals = selectedTerminal ? [selectedTerminal] : terminals}
								<div
									class="table-qr-carousel"
									class:multiple={displayTerminals.length > 1}
									role="group"
									aria-label="QR-коди терміналів"
									onpointerdown={(e) => (qrSwipeStartX = e.clientX)}
									onpointerup={finishQrSwipe}
									onpointercancel={() => (qrSwipeStartX = null)}
								>
									{#if displayTerminals.length > 1}
										<div class="carousel-nav">
											<button
												type="button"
												aria-label="Попередній QR-код"
												disabled={selectedTerminalIndex <= 0}
												onclick={() => onSelectTerminal?.(selectedTerminalIndex - 1)}
											>
												<ChevronLeft size={18} />
											</button>
											<div class="terminal-info">
												<strong>{terminals[selectedTerminalIndex]?.name}</strong>
												<span>{terminals[selectedTerminalIndex]?.code}</span>
											</div>
											<button
												type="button"
												aria-label="Наступний QR-код"
												disabled={selectedTerminalIndex >= terminals.length - 1}
												onclick={() => onSelectTerminal?.(selectedTerminalIndex + 1)}
											>
												<ChevronRight size={18} />
											</button>
										</div>
									{:else}
										<div class="terminal-info-static" style="margin-bottom: 12px;">
											<strong>{displayTerminals[0].name}</strong>
											<span>{displayTerminals[0].code}</span>
										</div>
									{/if}

									<div class="draft-qr-placeholder">
										<QrCode size={112} strokeWidth={1.2} aria-hidden="true" class="text-zinc-300" />
										<p class="mt-3 text-xs font-bold text-zinc-500">Чернетка</p>
									</div>

									{#if displayTerminals.length > 1}
										<div class="carousel-dots" aria-label={`Термінал ${selectedTerminalIndex + 1} з ${displayTerminals.length}`}>
											{#each displayTerminals as terminal, idx}
												<button
													class:active={terminal.id === (terminals[selectedTerminalIndex]?.id)}
													type="button"
													aria-label={`Вибрати ${terminal.name}`}
													onclick={() => onSelectTerminal?.(idx)}
												></button>
											{/each}
											<span>{selectedTerminalIndex + 1} / {displayTerminals.length}</span>
										</div>
									{/if}
								</div>
							{:else}
								<div class="creation-brand-mark" aria-hidden="true">
									<svg viewBox="0 0 208 221">
										<path d="M108.9 29.2c31.7 0 52.6 20.2 52.6 47.8 0 21.2-12.1 38.8-33.1 46.3l40.9 68.1c-25.3 0-48.6-13.3-61-34.7l-13.7-23.7c-12.1 0-21.9 9.6-21.9 21.3v37.1c-19.4 0-35.2-15.3-35.2-34.3v-20c0-18.9 15.8-34.3 35.2-34.3h28.8c15.8 0 24.7-8.3 24.7-22.4 0-13.1-7.5-19.7-22.4-19.7H72.7c-19.4 0-35.2-14.1-35.2-31.5h71.4Z" />
									</svg>
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
									<span>{orderCreating ? 'Створення...' : 'Створити рахунок і QR'}</span>
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
		margin: 0 7px;
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
		justify-content: center;
		gap: 7px;
		padding: 0 16px;
		border: 1px solid rgba(255, 255, 255, 0.16);
		border-top-color: rgba(255, 255, 255, 0.32);
		border-radius: 999px;
		color: #ffffff;
		font-size: 14px;
		font-weight: 700;
		background: linear-gradient(110deg, #087cf0 0%, #478cef 48%, #876ee7 100%);
		box-shadow: 0 4px 22px rgba(10, 132, 255, 0.32), inset 0 1px 1px rgba(255, 255, 255, 0.28);
		cursor: pointer;
		outline: none;
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

	.dock-btn-label {
		overflow: hidden;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		background: rgba(8, 9, 13, 0.65);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
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
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-top-color: rgba(255, 255, 255, 0.38);
		background: linear-gradient(
			155deg,
			rgba(255, 255, 255, 0.14) 0%,
			rgba(255, 255, 255, 0.04) 38%,
			rgba(10, 132, 255, 0.16) 75%,
			rgba(159, 122, 234, 0.12) 100%
		), rgba(18, 20, 28, 0.92);
		backdrop-filter: blur(var(--blur)) saturate(180%);
		-webkit-backdrop-filter: blur(var(--blur)) saturate(180%);
		box-shadow:
			0 var(--shadow-y) var(--shadow-blur) rgba(0, 0, 0, var(--shadow-opacity)),
			0 12px 36px rgba(10, 132, 255, 0.24),
			inset 0 1px 1px rgba(255, 255, 255, calc(0.28 + var(--rim-opacity) * 0.22)),
			inset 0 -1px 2px rgba(0, 0, 0, 0.2);
		color: #ffffff;
		will-change: left, top, width, height, border-radius;
	}

	.liquid-card.expanded {
		border-color: rgba(255, 255, 255, 0.25);
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
		padding: 28px 18px 18px;
		text-align: center;
		box-sizing: border-box;
		will-change: opacity, transform;
	}

	.created-order-view {
		display: flex;
		flex-direction: column;
		width: 100%;
		align-items: center;
	}

	.creation-preview-view {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
	}

	.order-status-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: -2px 0 10px;
		padding: 4px 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-size: 11px;
		color: rgba(255, 255, 255, 0.75);
	}

	.status-indicator-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #ffcc00;
		box-shadow: 0 0 6px rgba(255, 204, 0, 0.6);
	}

	.status-indicator-dot.paid {
		background: #30d158;
		box-shadow: 0 0 6px rgba(48, 209, 88, 0.7);
	}

	.status-text {
		font-weight: 650;
		color: #ffffff;
	}

	.status-bullet {
		color: rgba(255, 255, 255, 0.35);
	}

	.order-ref-code {
		font-variant-numeric: tabular-nums;
		color: rgba(255, 255, 255, 0.55);
		font-size: 10.5px;
	}

	.order-created-time {
		margin: -2px 0 8px;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.42);
	}

	.qr-wrapper {
		display: flex;
		justify-content: center;
		margin: 4px auto 10px;
	}

	.qr-wrapper :global(.payment-qr) {
		margin: 0 auto;
	}

	.qr-wrapper :global(figcaption) {
		display: none;
	}

	.qr-wrapper :global(.payment-qr-frame) {
		width: min(174px, 46vw);
		aspect-ratio: 1;
		border-radius: 16px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
	}

	.creation-status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: center;
		margin-bottom: 2px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #48d7e8;
	}

	.creation-status span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #48d7e8;
		box-shadow: 0 0 8px #48d7e8;
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
		letter-spacing: -0.02em;
		text-shadow: 0 2px 14px rgba(0, 0, 0, 0.35);
	}

	.creation-amount small {
		font-size: 22px;
		font-weight: 550;
		color: rgba(255, 255, 255, 0.55);
	}


	.qr-wrapper {
		display: flex;
		justify-content: center;
		margin: 4px auto 14px;
	}

	.creation-brand-mark {
		display: grid;
		place-items: center;
		margin: 6px auto 14px;
		width: 64px;
		height: 64px;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.creation-brand-mark svg {
		width: 34px;
		height: 34px;
		fill: rgba(255, 255, 255, 0.85);
	}

	.table-qr-carousel {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 0 0 14px;
	}

	.carousel-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		margin-bottom: 8px;
	}

	.carousel-nav button {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.06);
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
	}

	.carousel-nav button:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.terminal-info strong {
		display: block;
		font-size: 13px;
	}

	.terminal-info span {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.5);
	}

	.draft-qr-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 220px;
		height: 220px;
		margin: 0 auto;
		background: #f5f6f7;
		border-radius: 16px;
		border: 1px dashed #d4d4d8;
	}

	.carousel-dots {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-top: 8px;
	}

	.carousel-dots button {
		width: 6px;
		height: 6px;
		border: 0;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.25);
		padding: 0;
		cursor: pointer;
	}

	.carousel-dots button.active {
		background: #0a84ff;
		width: 16px;
		border-radius: 999px;
	}

	.carousel-dots span {
		font-size: 10px;
		color: rgba(255, 255, 255, 0.45);
		margin-left: 4px;
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

	@media (prefers-reduced-motion: reduce) {
		.liquid-card {
			transition:
				left 250ms ease,
				top 250ms ease,
				width 250ms ease,
				height 250ms ease,
				border-radius 250ms ease !important;
		}
	}
</style>
