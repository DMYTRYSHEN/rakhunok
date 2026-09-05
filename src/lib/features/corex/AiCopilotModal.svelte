<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AlertCircle,
		CheckCircle2,
		ChevronDown,
		ChevronRight,
		LoaderCircle,
		Settings,
		Sparkles,
		X
	} from '@lucide/svelte';
	import type { ProcessDefinition } from './process-definition';
	import type { CorexLocale } from './i18n';
	import {
		DEFAULT_AI_WORKER_URL,
		requestAiProcessModification
	} from './ai-copilot-service';

	let {
		open = false,
		currentDefinition,
		locale = 'uk',
		initialPrompt = '',
		onApply,
		onClose
	}: {
		open: boolean;
		currentDefinition: ProcessDefinition;
		locale?: CorexLocale;
		initialPrompt?: string;
		onApply: (modified: ProcessDefinition) => void;
		onClose: () => void;
	} = $props();

	let promptText = $state('');

	$effect(() => {
		if (open && initialPrompt) {
			promptText = initialPrompt;
		}
	});
	let endpointUrl = $state(DEFAULT_AI_WORKER_URL);
	let azureApiKey = $state('');
	let showSettings = $state(false);
	let loading = $state(false);
	let errorMsg = $state('');
	let validationIssues = $state<string[]>([]);
	let generatedDefinition = $state<ProcessDefinition | null>(null);

	const quickPromptsUk = [
		'Додай перевірку: якщо сума > 1000 грн — застосувати знижку 10%',
		'Додай крок фіскалізації чека через Checkbox POS перед успішним завершенням',
		'Додай вузол очікування банківського вебхуку з таймаутом 5 хвилин',
		'Після успішної оплати додай відправку сповіщення про замовлення у Telegram'
	];

	const quickPromptsEn = [
		'Add condition: if amount > 1000 UAH apply 10% discount',
		'Add Checkbox POS fiscalization step before success terminal',
		'Add webhook event wait step with 5-minute timeout',
		'Send order confirmation to Telegram after payment success'
	];

	let quickPrompts = $derived(locale === 'uk' ? quickPromptsUk : quickPromptsEn);

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

	async function handleGenerate() {
		if (!promptText.trim() || loading) return;
		loading = true;
		errorMsg = '';
		validationIssues = [];
		generatedDefinition = null;
		saveSettings();

		try {
			const result = await requestAiProcessModification({
				userPrompt: promptText,
				currentDefinition,
				endpointUrl: endpointUrl.trim(),
				azureApiKey: azureApiKey.trim() || undefined
			});

			if (result.ok && result.processDefinition) {
				generatedDefinition = result.processDefinition;
			} else {
				errorMsg = result.errorMessage || 'Не вдалося згенерувати процес.';
				validationIssues = result.validationIssues || [];
			}
		} catch (e: unknown) {
			errorMsg = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	function handleApply() {
		if (generatedDefinition) {
			onApply(generatedDefinition);
			onClose();
		}
	}
</script>

{#if open}
	<div
		class="modal-backdrop"
		onclick={onClose}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="presentation"
	>
		<div
			class="modal-card"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<header class="modal-header">
				<div class="title-group">
					<span class="sparkle-badge"><Sparkles size={16} /></span>
					<div>
						<h2>{locale === 'uk' ? 'ШІ-Асистент процесів (AI Copilot)' : 'Process AI Copilot'}</h2>
						<p>{locale === 'uk' ? 'Модель Azure AI (gpt-5.6-sol)' : 'Azure AI Model (gpt-5.6-sol)'}</p>
					</div>
				</div>
				<button class="close-btn" type="button" onclick={onClose} aria-label="Close">
					<X size={16} />
				</button>
			</header>

			<div class="modal-body">
				<label class="input-label">
					<span>{locale === 'uk' ? 'Опишіть завдання або зміни:' : 'Describe task or changes:'}</span>
					<textarea
						bind:value={promptText}
						rows="3"
						placeholder={locale === 'uk'
							? 'Наприклад: Додай знижку 10% для чеків від 1000 грн і відправ чек у Telegram...'
							: 'E.g.: Add a 10% discount for bills over 1000 UAH and notify Telegram...'}
					></textarea>
				</label>

				<div class="quick-prompts">
					<span class="prompt-hint">{locale === 'uk' ? 'Швидкі ідеї:' : 'Quick suggestions:'}</span>
					<div class="prompt-chips">
						{#each quickPrompts as qp}
							<button type="button" class="chip-btn" onclick={() => (promptText = qp)}>
								{qp}
							</button>
						{/each}
					</div>
				</div>

				<div class="settings-toggle">
					<button type="button" onclick={() => (showSettings = !showSettings)}>
						<Settings size={13} />
						<span>{locale === 'uk' ? 'Налаштування AI Воркера та Azure' : 'AI Worker & Azure Settings'}</span>
						{#if showSettings}<ChevronDown size={13} />{:else}<ChevronRight size={13} />{/if}
					</button>
				</div>

				{#if showSettings}
					<div class="settings-panel">
						<label>
							<span>{locale === 'uk' ? 'URL Cloudflare AI Воркера:' : 'Cloudflare AI Worker URL:'}</span>
							<input
								bind:value={endpointUrl}
								placeholder="http://localhost:8787 або https://ai.letsrealtalk.com"
							/>
						</label>
						<label>
							<span>{locale === 'uk' ? 'Azure AI Key (опціонально якщо є у secrets воркера):' : 'Azure AI Key (optional if configured in worker secrets):'}</span>
							<input
								type="password"
								bind:value={azureApiKey}
								placeholder="Введіть ключ доступу Azure AI Services"
							/>
						</label>
					</div>
				{/if}

				{#if errorMsg}
					<div class="error-box">
						<AlertCircle size={15} />
						<div>
							<strong>{errorMsg}</strong>
							{#if validationIssues.length > 0}
								<ul>
									{#each validationIssues as issue}
										<li>{issue}</li>
									{/each}
								</ul>
							{/if}
						</div>
					</div>
				{/if}

				{#if generatedDefinition}
					<div class="success-preview">
						<div class="preview-header">
							<CheckCircle2 size={16} />
							<span>{locale === 'uk' ? 'Процес успішно згенеровано та валідовано!' : 'Process successfully generated and validated!'}</span>
						</div>
						<div class="stats-row">
							<span>{locale === 'uk' ? 'Вузлів:' : 'Nodes:'} <b>{generatedDefinition.nodes.length}</b></span>
							<span>{locale === 'uk' ? 'Ребер:' : 'Edges:'} <b>{generatedDefinition.edges.length}</b></span>
							<span>ID: <code>{generatedDefinition.id}</code></span>
						</div>
					</div>
				{/if}
			</div>

			<footer class="modal-footer">
				<button type="button" class="cancel-btn" onclick={onClose}>
					{locale === 'uk' ? 'Скасувати' : 'Cancel'}
				</button>
				{#if generatedDefinition}
					<button type="button" class="apply-btn" onclick={handleApply}>
						{locale === 'uk' ? 'Застосувати на канвас' : 'Apply to Canvas'}
					</button>
				{:else}
					<button
						type="button"
						class="generate-btn"
						disabled={loading || !promptText.trim()}
						onclick={handleGenerate}
					>
						{#if loading}
							<LoaderCircle size={14} class="spin" />
							<span>{locale === 'uk' ? 'Генерація...' : 'Generating...'}</span>
						{:else}
							<Sparkles size={14} />
							<span>{locale === 'uk' ? 'Згенерувати' : 'Generate'}</span>
						{/if}
					</button>
				{/if}
			</footer>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.55);
		backdrop-filter: blur(4px);
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}

	.modal-card {
		width: 100%;
		max-width: 580px;
		background: #ffffff;
		border-radius: 16px;
		box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.3);
		border: 1px solid #e2e8f0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: popIn 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes popIn {
		from {
			opacity: 0;
			transform: scale(0.96) translateY(8px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.modal-header {
		padding: 18px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #edf2f7;
		background: linear-gradient(180deg, #fafbfc 0%, #ffffff 100%);
	}

	.title-group {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.sparkle-badge {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
	}

	.title-group h2 {
		margin: 0;
		font-size: 15px;
		font-weight: 800;
		color: #0f172a;
	}

	.title-group p {
		margin: 2px 0 0;
		font-size: 11px;
		color: #64748b;
	}

	.close-btn {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: #64748b;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.close-btn:hover {
		background: #f1f5f9;
		color: #0f172a;
	}

	.modal-body {
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.input-label {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.input-label span {
		font-size: 12px;
		font-weight: 700;
		color: #334155;
	}

	.input-label textarea {
		width: 100%;
		border: 1px solid #cbd5e1;
		border-radius: 10px;
		padding: 10px 12px;
		font-family: inherit;
		font-size: 13px;
		line-height: 1.45;
		color: #0f172a;
		resize: vertical;
		box-sizing: border-box;
	}
	.input-label textarea:focus {
		outline: none;
		border-color: #10b981;
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
	}

	.quick-prompts {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.prompt-hint {
		font-size: 11px;
		font-weight: 700;
		color: #64748b;
	}

	.prompt-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.chip-btn {
		background: #f1f5f9;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		padding: 4px 8px;
		font-size: 11px;
		color: #334155;
		cursor: pointer;
		text-align: left;
		transition: all 140ms ease;
	}
	.chip-btn:hover {
		background: #e2e8f0;
		border-color: #cbd5e1;
		color: #0f172a;
	}

	.settings-toggle button {
		background: transparent;
		border: none;
		padding: 4px 0;
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11.5px;
		color: #64748b;
		cursor: pointer;
		font-weight: 600;
	}
	.settings-toggle button:hover {
		color: #0f172a;
	}

	.settings-panel {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.settings-panel label {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.settings-panel label span {
		font-size: 11px;
		font-weight: 600;
		color: #475569;
	}

	.settings-panel input {
		height: 32px;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		padding: 0 10px;
		font-size: 12px;
		background: #ffffff;
		box-sizing: border-box;
	}

	.error-box {
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 10px;
		padding: 10px 12px;
		color: #991b1b;
		font-size: 12px;
		display: flex;
		gap: 8px;
	}
	.error-box ul {
		margin: 4px 0 0;
		padding-left: 16px;
	}

	.success-preview {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 10px;
		padding: 12px;
		color: #166534;
	}

	.preview-header {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
		font-size: 13px;
	}

	.stats-row {
		margin-top: 8px;
		display: flex;
		gap: 16px;
		font-size: 12px;
		color: #374151;
	}
	.stats-row code {
		background: #e5e7eb;
		padding: 2px 6px;
		border-radius: 4px;
		font-family: monospace;
	}

	.modal-footer {
		padding: 14px 20px;
		border-top: 1px solid #edf2f7;
		background: #fafbfc;
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.cancel-btn {
		height: 36px;
		padding: 0 14px;
		border-radius: 8px;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		color: #475569;
		font-weight: 600;
		font-size: 12px;
		cursor: pointer;
	}
	.cancel-btn:hover {
		background: #f1f5f9;
		color: #0f172a;
	}

	.generate-btn {
		height: 36px;
		padding: 0 16px;
		border-radius: 8px;
		border: none;
		background: linear-gradient(135deg, #10b981 0%, #059669 100%);
		color: #ffffff;
		font-weight: 700;
		font-size: 12px;
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
	}
	.generate-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, #059669 0%, #047857 100%);
		transform: translateY(-1px);
	}
	.generate-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.apply-btn {
		height: 36px;
		padding: 0 16px;
		border-radius: 8px;
		border: none;
		background: #1e293b;
		color: #ffffff;
		font-weight: 700;
		font-size: 12px;
		cursor: pointer;
	}
	.apply-btn:hover {
		background: #0f172a;
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
</style>
