<script lang="ts">
	import { onMount, tick } from 'svelte';
	import {
		AlertCircle,
		Bot,
		Check,
		ChevronDown,
		ChevronUp,
		CornerDownLeft,
		LoaderCircle,
		Minus,
		RefreshCw,
		Send,
		Settings,
		Sparkles,
		Trash2,
		X
	} from '@lucide/svelte';
	import type { ProcessDefinition } from './process-definition';
	import type { CorexLocale } from './i18n';
	import {
		DEFAULT_AI_WORKER_URL,
		sendCopilotChatMessage,
		type CopilotChatMessage
	} from './ai-copilot-service';

	let {
		currentDefinition,
		locale = 'uk',
		isDraft = true,
		onApplyDefinition,
		onCloneScenarioIfNeeded
	}: {
		currentDefinition: ProcessDefinition;
		locale?: CorexLocale;
		isDraft?: boolean;
		onApplyDefinition: (definition: ProcessDefinition) => void;
		onCloneScenarioIfNeeded?: () => void;
	} = $props();

	let expanded = $state(false);
	let inputValue = $state('');
	let loading = $state(false);
	let errorMsg = $state('');
	let showSettings = $state(false);
	let endpointUrl = $state(DEFAULT_AI_WORKER_URL);
	let azureApiKey = $state('');
	let appliedMessageIds = $state<Set<string>>(new Set());

	let messages = $state<CopilotChatMessage[]>([]);
	let chatContainer = $state<HTMLDivElement | null>(null);
	let inputElement = $state<HTMLInputElement | HTMLTextAreaElement | null>(null);

	const quickQuestionsUk = [
		'Як працює цей процес?',
		'Чи є в процесі ризики або незахищені помилки?',
		'Додай перевірку: якщо сума > 1000 грн — знижка 10%',
		'Додай крок фіскалізації чека перед успішним завершенням'
	];

	const quickQuestionsEn = [
		'How does this process work?',
		'Are there any unhandled errors or risks?',
		'Add condition: if amount > 1000 UAH give 10% discount',
		'Add POS receipt fiscalization step before success terminal'
	];

	let quickQuestions = $derived(locale === 'uk' ? quickQuestionsUk : quickQuestionsEn);

	onMount(() => {
		const savedEndpoint = localStorage.getItem('corex_ai_worker_url');
		if (savedEndpoint) endpointUrl = savedEndpoint;
		const savedKey = localStorage.getItem('corex_azure_ai_key');
		if (savedKey) azureApiKey = savedKey;
	});

	function saveSettings() {
		localStorage.setItem('corex_ai_worker_url', endpointUrl);
		localStorage.setItem('corex_azure_ai_key', azureApiKey);
	}

	async function scrollToBottom() {
		await tick();
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	async function handleSendMessage(promptOverride?: string) {
		const text = (promptOverride || inputValue).trim();
		if (!text || loading) return;

		if (!isDraft && onCloneScenarioIfNeeded) {
			onCloneScenarioIfNeeded();
		}

		const userMsg: CopilotChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
			timestamp: Date.now()
		};

		messages = [...messages, userMsg];
		inputValue = '';
		loading = true;
		errorMsg = '';
		if (!expanded) expanded = true;
		await scrollToBottom();

		try {
			const chatHistory = messages.map((m) => ({
				role: m.role,
				content: m.content
			}));

			const res = await sendCopilotChatMessage({
				chatMessages: chatHistory,
				currentDefinition,
				endpointUrl: endpointUrl.trim(),
				azureApiKey: azureApiKey.trim() || undefined
			});

			if (!res.ok) {
				errorMsg = res.errorMessage || 'Помилка отримання відповіді від AI';
			} else {
				const assistantMsg: CopilotChatMessage = {
					id: crypto.randomUUID(),
					role: 'assistant',
					content: res.message,
					timestamp: Date.now(),
					proposedDefinition: res.proposedDefinition,
					validationIssues: res.validationIssues
				};
				messages = [...messages, assistantMsg];
			}
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
			await scrollToBottom();
		}
	}

	function handleApply(messageId: string, definition: ProcessDefinition) {
		onApplyDefinition(definition);
		appliedMessageIds = new Set([...appliedMessageIds, messageId]);
	}

	function clearHistory() {
		messages = [];
		errorMsg = '';
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			void handleSendMessage();
		}
	}

	function formatMarkdown(text: string): string {
		// Clean markdown fences for display in message body if they were ProcessDefinition JSON
		const cleaned = text.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/gi, '').trim();
		return cleaned || text;
	}
</script>

<div class="copilot-dock-container" class:is-expanded={expanded}>
	{#if expanded}
		<div class="copilot-chat-card" role="dialog" aria-label="Corex AI Copilot Chat">
			<!-- Header -->
			<header class="chat-header">
				<div class="header-title">
					<div class="ai-avatar">
						<Sparkles size={16} />
					</div>
					<div>
						<strong>Corex AI Copilot</strong>
						<span class="model-badge">gpt-5.6-sol</span>
					</div>
				</div>

				<div class="header-actions">
					<button
						type="button"
						class="btn-icon"
						onclick={() => (showSettings = !showSettings)}
						title={locale === 'uk' ? 'Налаштування endpoint' : 'Endpoint settings'}
						aria-label="Settings"
					>
						<Settings size={14} />
					</button>
					{#if messages.length > 0}
						<button
							type="button"
							class="btn-icon"
							onclick={clearHistory}
							title={locale === 'uk' ? 'Очистити чат' : 'Clear chat'}
							aria-label="Clear chat"
						>
							<Trash2 size={14} />
						</button>
					{/if}
					<button
						type="button"
						class="btn-icon"
						onclick={() => (expanded = false)}
						title={locale === 'uk' ? 'Згорнути чат' : 'Minimize chat'}
						aria-label="Minimize"
					>
						<Minus size={15} />
					</button>
				</div>
			</header>

			<!-- Settings Drawer -->
			{#if showSettings}
				<div class="settings-drawer">
					<div class="settings-row">
						<label for="chat-endpoint">AI Worker URL:</label>
						<input
							id="chat-endpoint"
							bind:value={endpointUrl}
							onchange={saveSettings}
							placeholder="http://localhost:8787"
						/>
					</div>
					<div class="settings-row">
						<label for="chat-key">Azure API Key (опціонально):</label>
						<input
							id="chat-key"
							type="password"
							bind:value={azureApiKey}
							onchange={saveSettings}
							placeholder="••••••••••••••••"
						/>
					</div>
				</div>
			{/if}

			<!-- Message List -->
			<div class="chat-body" bind:this={chatContainer}>
				{#if messages.length === 0}
					<div class="chat-welcome">
						<div class="welcome-icon">
							<Bot size={28} />
						</div>
						<h4>
							{locale === 'uk'
								? 'Чим я можу допомогти з процесом?'
								: 'How can I assist with your process?'}
						</h4>
						<p>
							{locale === 'uk'
								? 'Запитуйте про логіку поточної схеми або попросіть внести зміни:'
								: 'Ask about the current process logic or request changes:'}
						</p>

						<div class="quick-chips">
							{#each quickQuestions as q}
								<button type="button" class="chip-btn" onclick={() => handleSendMessage(q)}>
									<Sparkles size={11} />
									<span>{q}</span>
								</button>
							{/each}
						</div>
					</div>
				{:else}
					<div class="messages-stream">
						{#each messages as msg (msg.id)}
							<div class="message-row" class:is-user={msg.role === 'user'}>
								<div class="message-avatar">
									{#if msg.role === 'user'}
										<span>👤</span>
									{:else}
										<Bot size={15} />
									{/if}
								</div>

								<div class="message-content">
									<div class="bubble">
										<p class="bubble-text">{formatMarkdown(msg.content)}</p>
									</div>

									{#if msg.proposedDefinition}
										<div class="process-action-card">
											<div class="card-header">
												<Sparkles size={14} class="sparkle-icon" />
												<div>
													<strong>{msg.proposedDefinition.name || msg.proposedDefinition.id}</strong>
													<small
														>{msg.proposedDefinition.nodes.length} вузлів · {msg.proposedDefinition
															.edges.length} переходів</small
													>
												</div>
											</div>

											{#if msg.validationIssues && msg.validationIssues.length > 0}
												<div class="validation-warning">
													<AlertCircle size={12} />
													<span>{msg.validationIssues.join('; ')}</span>
												</div>
											{/if}

											<div class="card-actions">
												{#if appliedMessageIds.has(msg.id)}
													<span class="badge-applied">
														<Check size={13} />
														<span>{locale === 'uk' ? 'Застосовано до схеми' : 'Applied to canvas'}</span>
													</span>
												{:else}
													<button
														type="button"
														class="btn-apply"
														onclick={() => handleApply(msg.id, msg.proposedDefinition!)}
													>
														<Sparkles size={13} />
														<span>{locale === 'uk' ? '⚡ Застосувати до полотна' : '⚡ Apply to Canvas'}</span>
													</button>
												{/if}
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/each}

						{#if loading}
							<div class="message-row is-loading">
								<div class="message-avatar">
									<Bot size={15} />
								</div>
								<div class="bubble loading-bubble">
									<LoaderCircle size={14} class="spin" />
									<span>{locale === 'uk' ? 'Аналізую процес...' : 'Analyzing process...'}</span>
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if errorMsg}
					<div class="chat-error">
						<AlertCircle size={14} />
						<span>{errorMsg}</span>
					</div>
				{/if}
			</div>

			<!-- Footer Input -->
			<footer class="chat-footer">
				<form
					class="input-wrapper"
					onsubmit={(e) => {
						e.preventDefault();
						void handleSendMessage();
					}}
				>
					<input
						bind:value={inputValue}
						bind:this={inputElement}
						onkeydown={handleKeyDown}
						placeholder={locale === 'uk'
							? 'Запитайте або опишіть зміну процесу...'
							: 'Ask a question or describe a change...'}
						disabled={loading}
					/>
					<button
						type="submit"
						class="btn-send"
						disabled={!inputValue.trim() || loading}
						title="Надіслати (Enter)"
						aria-label="Send"
					>
						{#if loading}
							<LoaderCircle size={14} class="spin" />
						{:else}
							<Send size={14} />
						{/if}
					</button>
				</form>
			</footer>
		</div>
	{:else}
		<!-- Collapsed Dock Bar -->
		<form
			class="collapsed-dock"
			onsubmit={(e) => {
				e.preventDefault();
				void handleSendMessage();
			}}
		>
			<button
				type="button"
				class="dock-icon-btn"
				onclick={() => (expanded = true)}
				title={locale === 'uk' ? 'Відкрити ШІ-чат' : 'Open AI Chat'}
			>
				<Sparkles size={16} />
			</button>

			<input
				bind:value={inputValue}
				placeholder={locale === 'uk'
					? 'Запитайте ШІ про процес або напишіть, що змінити...'
					: 'Ask AI about this process or describe changes...'}
				onfocus={() => {
					if (messages.length > 0) expanded = true;
				}}
			/>

			<div class="dock-actions">
				{#if messages.length > 0}
					<button
						type="button"
						class="badge-history"
						onclick={() => (expanded = true)}
						title={locale === 'uk' ? 'Історія діалогу' : 'Chat history'}
					>
						<span>💬 {messages.length}</span>
					</button>
				{/if}

				<button
					type="submit"
					class="dock-send-btn"
					disabled={loading}
					title={locale === 'uk' ? 'Надіслати ШІ' : 'Send to AI'}
					aria-label="Send"
				>
					<Bot size={16} />
				</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.copilot-dock-container {
		position: absolute;
		z-index: 25;
		left: 50%;
		bottom: 18px;
		transform: translateX(-50%);
		font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	/* Collapsed Pill Dock */
	.collapsed-dock {
		width: min(600px, calc(100vw - 120px));
		min-height: 48px;
		display: grid;
		grid-template-columns: 38px minmax(0, 1fr) auto;
		align-items: center;
		gap: 6px;
		border: 1.5px solid transparent;
		border-radius: 9999px;
		padding: 4px 8px;
		background-clip: padding-box, border-box;
		background-origin: padding-box, border-box;
		background-image:
			linear-gradient(#ffffff, #ffffff),
			linear-gradient(135deg, #1a73e8, #7c3aed, #ea4335, #34a853);
		box-shadow:
			0 12px 36px rgba(26, 115, 232, 0.18),
			0 2px 12px rgba(0, 0, 0, 0.05);
		transition: box-shadow 200ms ease, transform 150ms ease;
	}

	.collapsed-dock:focus-within {
		box-shadow:
			0 16px 44px rgba(124, 58, 237, 0.28),
			0 0 0 2px rgba(26, 115, 232, 0.2);
	}

	.dock-icon-btn {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		color: #7c3aed;
		background: #f3f0ff;
		cursor: pointer;
		transition: transform 120ms ease;
	}

	.dock-icon-btn:hover {
		transform: scale(1.1);
	}

	.collapsed-dock input {
		min-width: 0;
		border: 0;
		outline: 0;
		color: #1e293b;
		background: transparent;
		font: 600 12px/1.3 'Manrope', sans-serif;
	}

	.collapsed-dock input::placeholder {
		color: #94a3b8;
	}

	.dock-actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.badge-history {
		border: 1px solid #e2e8f0;
		border-radius: 9999px;
		padding: 3px 8px;
		background: #f8fafc;
		color: #475569;
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
	}

	.dock-send-btn {
		width: 34px;
		height: 34px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		color: #ffffff;
		background: linear-gradient(135deg, #1a73e8, #7c3aed);
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(124, 58, 237, 0.4);
		transition: transform 140ms ease;
	}

	.dock-send-btn:hover {
		transform: scale(1.08);
	}

	/* Expanded Chat Card */
	.copilot-chat-card {
		width: min(560px, calc(100vw - 40px));
		height: 520px;
		max-height: calc(100vh - 100px);
		display: flex;
		flex-direction: column;
		border-radius: 18px;
		background: #ffffff;
		border: 1px solid #e2e8f0;
		box-shadow:
			0 20px 50px -8px rgba(15, 23, 42, 0.16),
			0 0 0 1px rgba(26, 115, 232, 0.1);
		overflow: hidden;
		animation: popUp 180ms ease-out;
	}

	@keyframes popUp {
		from {
			opacity: 0;
			transform: scale(0.96) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	/* Header */
	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid #f1f5f9;
		background: #fafcff;
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.ai-avatar {
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border-radius: 8px;
		background: linear-gradient(135deg, #1a73e8, #7c3aed);
		color: #ffffff;
	}

	.header-title strong {
		display: block;
		color: #0f172a;
		font-size: 13px;
		font-weight: 750;
		line-height: 1.2;
	}

	.model-badge {
		color: #1a73e8;
		font-size: 10px;
		font-weight: 700;
		font-family: monospace;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.btn-icon {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 6px;
		color: #64748b;
		background: transparent;
		cursor: pointer;
		transition: background 120ms ease, color 120ms ease;
	}

	.btn-icon:hover {
		background: #f1f5f9;
		color: #0f172a;
	}

	/* Settings Drawer */
	.settings-drawer {
		padding: 10px 16px;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
		display: grid;
		gap: 8px;
		font-size: 11px;
	}

	.settings-row {
		display: grid;
		grid-template-columns: 140px 1fr;
		align-items: center;
		gap: 8px;
	}

	.settings-row label {
		color: #475569;
		font-weight: 600;
	}

	.settings-row input {
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		padding: 4px 8px;
		font-size: 11px;
		outline: 0;
		background: #ffffff;
	}

	/* Chat Body */
	.chat-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
		background: #ffffff;
	}

	/* Welcome State */
	.chat-welcome {
		margin: auto 0;
		text-align: center;
		padding: 20px 10px;
	}

	.welcome-icon {
		width: 50px;
		height: 50px;
		margin: 0 auto 12px;
		display: grid;
		place-items: center;
		border-radius: 16px;
		background: #f0fdf4;
		color: #16a34a;
	}

	.chat-welcome h4 {
		margin: 0 0 6px;
		color: #0f172a;
		font-size: 15px;
		font-weight: 750;
	}

	.chat-welcome p {
		margin: 0 0 16px;
		color: #64748b;
		font-size: 12px;
	}

	.quick-chips {
		display: flex;
		flex-direction: column;
		gap: 7px;
		text-align: left;
	}

	.chip-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 8px 12px;
		background: #f8fafc;
		color: #334155;
		font-size: 11.5px;
		font-weight: 600;
		cursor: pointer;
		transition: all 120ms ease;
	}

	.chip-btn:hover {
		background: #f1f5f9;
		border-color: #cbd5e1;
		color: #0f172a;
		transform: translateX(2px);
	}

	/* Messages Stream */
	.messages-stream {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.message-row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}

	.message-row.is-user {
		flex-direction: row-reverse;
	}

	.message-avatar {
		width: 26px;
		height: 26px;
		flex-shrink: 0;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: #f1f5f9;
		color: #475569;
		font-size: 12px;
	}

	.message-row.is-user .message-avatar {
		background: #e0f2fe;
		color: #0284c7;
	}

	.message-content {
		max-width: 82%;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.bubble {
		border-radius: 14px;
		padding: 9px 13px;
		font-size: 12.5px;
		line-height: 1.45;
		color: #1e293b;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
	}

	.message-row.is-user .bubble {
		background: linear-gradient(135deg, #1a73e8, #2563eb);
		border-color: transparent;
		color: #ffffff;
		border-bottom-right-radius: 4px;
	}

	.message-row:not(.is-user) .bubble {
		border-bottom-left-radius: 4px;
	}

	.bubble-text {
		margin: 0;
		white-space: pre-wrap;
	}

	/* Process Action Card */
	.process-action-card {
		border: 1px solid #c7d2fe;
		border-radius: 12px;
		padding: 10px 12px;
		background: #eef2ff;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.card-header :global(.sparkle-icon) {
		color: #4f46e5;
	}

	.card-header strong {
		display: block;
		color: #312e81;
		font-size: 12px;
	}

	.card-header small {
		color: #6366f1;
		font-size: 10.5px;
	}

	.validation-warning {
		display: flex;
		align-items: center;
		gap: 5px;
		color: #b45309;
		font-size: 10.5px;
		font-weight: 600;
	}

	.card-actions {
		display: flex;
		align-items: center;
	}

	.btn-apply {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 0;
		border-radius: 8px;
		padding: 6px 12px;
		background: linear-gradient(135deg, #4f46e5, #7c3aed);
		color: #ffffff;
		font-size: 11.5px;
		font-weight: 750;
		cursor: pointer;
		transition: transform 120ms ease, opacity 120ms ease;
	}

	.btn-apply:hover {
		transform: scale(1.03);
		opacity: 0.95;
	}

	.badge-applied {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border-radius: 6px;
		padding: 4px 8px;
		background: #dcfce7;
		color: #15803d;
		font-size: 11px;
		font-weight: 700;
	}

	/* Loading Indicator */
	.loading-bubble {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #64748b;
		font-style: italic;
	}

	:global(.spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.chat-error {
		display: flex;
		align-items: center;
		gap: 6px;
		border-radius: 8px;
		padding: 8px 12px;
		background: #fef2f2;
		border: 1px solid #fee2e2;
		color: #b91c1c;
		font-size: 11.5px;
	}

	/* Footer */
	.chat-footer {
		padding: 10px 14px;
		border-top: 1px solid #f1f5f9;
		background: #fafcff;
	}

	.input-wrapper {
		display: flex;
		align-items: center;
		gap: 8px;
		border: 1.5px solid #cbd5e1;
		border-radius: 12px;
		padding: 4px 6px 4px 12px;
		background: #ffffff;
		transition: border-color 140ms ease, box-shadow 140ms ease;
	}

	.input-wrapper:focus-within {
		border-color: #1a73e8;
		box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.15);
	}

	.input-wrapper input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		color: #1e293b;
		font: 600 12px/1.4 'Manrope', sans-serif;
	}

	.btn-send {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 8px;
		background: #1a73e8;
		color: #ffffff;
		cursor: pointer;
		transition: opacity 120ms ease, transform 120ms ease;
	}

	.btn-send:hover:not(:disabled) {
		transform: scale(1.05);
	}

	.btn-send:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
</style>
