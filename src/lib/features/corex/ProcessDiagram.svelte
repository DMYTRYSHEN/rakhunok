<script lang="ts">
	import { AlertTriangle, GitBranch, LoaderCircle, Route, Workflow } from '@lucide/svelte';
	import type { CorexRunEvent } from './corex-process-gateway';
	import type { CorexLocale } from './i18n';
	import type { ProcessDefinition } from './process-definition';
	import { projectDefinitionMermaid, projectRunSequenceMermaid } from './process-diagram-projector';
	import type { ProcessFlowDefinition, ProcessFlowScenario } from './process-flow-definition';
	import { projectProcessFlowScenarioMermaid } from './process-flow-projector';

	let {
		definition,
		events = [],
		flow,
		flowScenarios = [],
		locale = 'uk'
	}: {
		definition: ProcessDefinition;
		events?: CorexRunEvent[];
		flow?: ProcessFlowDefinition;
		flowScenarios?: ProcessFlowScenario[];
		locale?: CorexLocale;
	} = $props();

	let view = $state<'definition' | 'run' | 'flow'>('definition');
	let selectedFlowScenarioId = $state('');
	let renderState = $state<'loading' | 'ready' | 'error'>('loading');
	let svg = $state('');
	let renderRequest = 0;
	let selectedFlowScenario = $derived(
		flowScenarios.find((scenario) => scenario.id === selectedFlowScenarioId) ?? flowScenarios[0]
	);
	let source = $derived.by(() => {
		if (view === 'definition') return projectDefinitionMermaid(definition);
		if (view === 'run') return projectRunSequenceMermaid(events);
		if (flow && selectedFlowScenario) {
			return projectProcessFlowScenarioMermaid(flow, selectedFlowScenario);
		}
		return 'sequenceDiagram\n\tNote over Corex: No flow scenario';
	});

	$effect(() => {
		const requestedSource = source;
		const request = ++renderRequest;
		renderState = 'loading';
		svg = '';

		void renderDiagram(requestedSource, request);

		return () => {
			if (renderRequest === request) renderRequest += 1;
		};
	});

	async function renderDiagram(requestedSource: string, request: number) {
		try {
			const { default: mermaid } = await import('mermaid');
			mermaid.initialize({
				startOnLoad: false,
				securityLevel: 'strict',
				theme: 'base',
				flowchart: { htmlLabels: false },
				themeVariables: {
					fontFamily: 'Manrope, sans-serif',
					primaryColor: '#eef6ff',
					primaryBorderColor: '#1a73e8',
					primaryTextColor: '#1e293b',
					lineColor: '#64748b',
					secondaryColor: '#f8fafc',
					tertiaryColor: '#ffffff'
				}
			});
			const result = await mermaid.render(`corex-diagram-${request}`, requestedSource);
			if (renderRequest !== request) return;
			svg = result.svg;
			renderState = 'ready';
		} catch {
			if (renderRequest !== request) return;
			renderState = 'error';
		}
	}

	function sanitizeSvg(value: string): Element {
		const document = new DOMParser().parseFromString(value, 'image/svg+xml');
		const root = document.documentElement;
		if (root.namespaceURI !== 'http://www.w3.org/2000/svg' || root.localName !== 'svg') {
			throw new Error('Mermaid did not return an SVG document.');
		}

		for (const element of root.querySelectorAll('script, iframe, object, embed')) {
			element.remove();
		}
		for (const element of root.querySelectorAll('*')) {
			for (const attribute of [...element.attributes]) {
				if (
					attribute.name.toLowerCase().startsWith('on') ||
					(['href', 'xlink:href'].includes(attribute.name.toLowerCase()) &&
						!attribute.value.startsWith('#'))
				) {
					element.removeAttribute(attribute.name);
				}
			}
		}

		return document.importNode(root, true);
	}

	function mountDiagram(node: HTMLDivElement, value: string) {
		function update(nextValue: string) {
			node.replaceChildren();
			if (nextValue) node.append(sanitizeSvg(nextValue));
		}

		update(value);
		return { update };
	}
</script>

<section
	class="process-diagram"
	aria-label={locale === 'uk' ? 'Діаграма процесу' : 'Process diagram'}
>
	<div
		class="diagram-tabs"
		class:has-flow={flow && flowScenarios.length > 0}
		role="tablist"
		aria-label={locale === 'uk' ? 'Вигляд діаграми' : 'Diagram view'}
	>
		<button
			type="button"
			role="tab"
			aria-selected={view === 'definition'}
			class:active={view === 'definition'}
			onclick={() => (view = 'definition')}
		>
			<GitBranch size={13} />{locale === 'uk' ? 'Структура' : 'Topology'}
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={view === 'run'}
			class:active={view === 'run'}
			onclick={() => (view = 'run')}
		>
			<Route size={13} />{locale === 'uk' ? 'Послідовність' : 'Sequence'}
		</button>
		{#if flow && flowScenarios.length > 0}
			<button
				type="button"
				role="tab"
				aria-selected={view === 'flow'}
				class:active={view === 'flow'}
				onclick={() => (view = 'flow')}
			>
				<Workflow size={13} />Flow
			</button>
		{/if}
	</div>
	{#if view === 'flow' && flow && selectedFlowScenario}
		<label class="flow-scenario">
			<span>{locale === 'uk' ? 'Сценарій' : 'Scenario'}</span>
			<select bind:value={selectedFlowScenarioId}>
				{#each flowScenarios as scenario (scenario.id)}
					<option value={scenario.id}>{scenario.name}</option>
				{/each}
			</select>
			<small>{flow.description}</small>
		</label>
	{/if}

	<div class="diagram-stage" aria-live="polite">
		{#if renderState === 'loading'}
			<div class="diagram-state">
				<span class="spin"><LoaderCircle size={18} /></span>{locale === 'uk'
					? 'Будуємо діаграму...'
					: 'Rendering diagram...'}
			</div>
		{:else if renderState === 'error'}
			<div class="diagram-state error" role="alert">
				<AlertTriangle size={18} />{locale === 'uk'
					? 'Не вдалося побудувати діаграму.'
					: 'Could not render the diagram.'}
			</div>
		{/if}
		<div class="diagram-svg" class:hidden={renderState !== 'ready'} use:mountDiagram={svg}></div>
	</div>
</section>

<style>
	.process-diagram {
		display: grid;
		gap: 12px;
	}
	.diagram-tabs {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 4px;
		padding: 3px;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		background: #f8fafc;
	}
	.diagram-tabs.has-flow {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.diagram-tabs button {
		min-width: 0;
		height: 30px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		border: 0;
		border-radius: 4px;
		color: #64748b;
		background: transparent;
		font:
			700 10px/1 'Manrope',
			sans-serif;
		cursor: pointer;
	}
	.diagram-tabs button.active {
		color: #1967d2;
		background: #ffffff;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
	}
	.flow-scenario {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 6px 10px;
		color: #475569;
		font:
			700 10px/1.3 'Manrope',
			sans-serif;
	}
	.flow-scenario select {
		min-width: 0;
		height: 32px;
		border: 1px solid #cbd5e1;
		border-radius: 5px;
		padding: 0 28px 0 9px;
		color: #1e293b;
		background: #ffffff;
		font:
			650 11px/1 'Manrope',
			sans-serif;
	}
	.flow-scenario small {
		grid-column: 1 / -1;
		color: #64748b;
		font-weight: 500;
	}
	.diagram-stage {
		min-height: 260px;
		overflow: auto;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		background:
			linear-gradient(#eef2f7 1px, transparent 1px),
			linear-gradient(90deg, #eef2f7 1px, transparent 1px), #ffffff;
		background-size: 20px 20px;
	}
	.diagram-state {
		min-height: 260px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 20px;
		color: #64748b;
		font:
			650 11px/1.4 'Manrope',
			sans-serif;
		text-align: center;
	}
	.diagram-state.error {
		color: #b42318;
	}
	.diagram-svg {
		min-width: 100%;
		padding: 16px;
	}
	.diagram-svg.hidden {
		display: none;
	}
	.diagram-svg :global(svg) {
		width: max-content;
		min-width: 100%;
		height: auto;
		max-width: none;
	}
	.spin {
		animation: spin 800ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spin {
			animation: none;
		}
	}
</style>
