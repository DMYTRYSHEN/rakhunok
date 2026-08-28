<script lang="ts">
	import { Bot, Boxes, Braces, CalendarClock, Check, ChevronDown, ChevronRight, CirclePause, Clock3, Code2, Database, FileInput, FileOutput, FileUp, FolderTree, GitBranch, Globe2, History, KeyRound, LoaderCircle, LockKeyhole, MailCheck, PanelRightClose, RefreshCcw, Search, ShieldCheck, Shuffle, Sparkles, SquareFunction, Timer, Upload, Webhook, Workflow, XCircle } from '@lucide/svelte';
	import { Background, BackgroundVariant, Controls, MarkerType, MiniMap, SvelteFlow, type Edge, type Node, type NodeTypes } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { flowScenarios } from './flow-scenarios';
	import { canvasText, localizedCategory, localizedScenario, type CorexLocale } from './i18n';
	import { statusText } from './i18n';
	import ReleaseFlowNode from './ReleaseFlowNode.svelte';
	import type { FlowEdge, FlowNode, FlowScenario } from './types';

	const nodeTypes: NodeTypes = { release: ReleaseFlowNode };
	let { locale = 'uk' }: { locale?: CorexLocale } = $props();
	const initialScenario = flowScenarios[0];
	let activeScenario = $state(initialScenario);
	let nodes = $state.raw<Node[]>(createNodes(initialScenario, 'uk'));
	let edges = $state.raw<Edge[]>(createEdges(initialScenario));
	let selectedId = $state(initialScenario.nodes[0].id);
	let paletteQuery = $state('');
	let inspectorTab = $state<'details' | 'runs'>('details');
	let aiPrompt = $state('');
	let draftNotice = $state('');
	let selectedNode = $derived(activeScenario.nodes.find((node) => node.id === selectedId) ?? activeScenario.nodes[0]);
	let text = $derived(canvasText[locale]);
	let activeCopy = $derived(localizedScenario(activeScenario, locale));
	const paletteGroups = [
		{ label: 'Тригери', items: [
			{ label: 'Webhook / API', api: 'fetch → workflow.create()', icon: Webhook },
			{ label: 'Розклад', api: 'workflow schedules / cron', icon: CalendarClock },
			{ label: 'Подія', api: 'queue / binding → create()', icon: Sparkles }
		] },
		{ label: 'Маршрутизація', items: [
			{ label: 'Умова', api: 'if / else', icon: GitBranch },
			{ label: 'Switch', api: 'switch', icon: Workflow },
			{ label: 'Цикл', api: 'for / while', icon: RefreshCcw },
			{ label: 'Паралельно', api: 'Promise.all()', icon: Boxes },
			{ label: 'A/B Router', api: 'step.do() → deterministic branch', icon: Shuffle }
		] },
		{ label: 'Durable очікування', items: [
			{ label: 'Затримка', api: 'step.sleep()', icon: Timer },
			{ label: 'До дати', api: 'step.sleepUntil()', icon: Clock3 },
			{ label: 'Очікувати подію', api: 'step.waitForEvent()', icon: Webhook },
			{ label: 'Ручне погодження', api: 'waitForEvent() + dashboard', icon: MailCheck }
		] },
		{ label: 'Дані', items: [
			{ label: 'DB Read', api: 'step.do() → SELECT', icon: Database },
			{ label: 'DB Write', api: 'step.do() → INSERT / UPDATE', icon: Database },
			{ label: 'KV Get', api: 'step.do() → KV.get()', icon: KeyRound },
			{ label: 'KV Set', api: 'step.do() → KV.put()', icon: KeyRound },
			{ label: 'Перетворення даних', api: 'step.do() → serializable output', icon: Braces }
		] },
		{ label: 'Інтеграції', items: [
			{ label: 'HTTP Request', api: 'step.do() → fetch()', icon: Globe2 },
			{ label: 'Виклик підпроцесу', api: 'step.do() → WORKFLOW.create()', icon: SquareFunction }
		] },
		{ label: 'Стійкість', items: [
			{ label: 'Try / Catch', api: 'try / catch', icon: ShieldCheck }
		] },
		{ label: 'Завершення', items: [
			{ label: 'Успішне завершення', api: 'return serializable output', icon: FileOutput },
			{ label: 'Abort / Fail', api: 'throw NonRetryableError', icon: XCircle }
		] },
		{ label: 'Структура', items: [
			{ label: 'Функція', api: 'FunctionDef / Call', icon: Braces },
			{ label: 'Група кроків', api: 'BlockNode', icon: FolderTree },
			{ label: 'Вийти з циклу', api: 'break', icon: PanelRightClose }
		] }
	];
	let filteredPalette = $derived(paletteGroups.map((group) => ({ ...group, items: group.items.filter((item) => `${item.label} ${item.api}`.toLowerCase().includes(paletteQuery.trim().toLowerCase())) })).filter((group) => group.items.length));

	function createNodes(scenario: FlowScenario, nodeLocale: CorexLocale): Node[] {
		return scenario.nodes.map((item) => ({ id: item.id, type: 'release', position: item.position, data: { ...item, locale: nodeLocale } }));
	}

	function createEdges(scenario: FlowScenario): Edge[] {
		return scenario.edges.map((edge: FlowEdge) => ({
		id: edge.id,
		source: edge.source,
		target: edge.target,
		label: edge.label,
		type: 'smoothstep',
		animated: scenario.nodes.find((node) => node.id === edge.source)?.status === 'running',
		markerEnd: { type: MarkerType.ArrowClosed, color: edge.tone === 'danger' ? '#bf5748' : edge.tone === 'success' ? '#3f8a61' : '#77818a' },
		style: `stroke: ${edge.tone === 'danger' ? '#bf5748' : edge.tone === 'success' ? '#3f8a61' : '#77818a'}; stroke-width: 1.6px;`
	}));
	}

	function selectNode(event: { node: Node }) {
		selectedId = event.node.id;
	}

	function selectScenario(scenario: FlowScenario) {
		activeScenario = scenario;
		nodes = createNodes(scenario, locale);
		edges = createEdges(scenario);
		selectedId = scenario.nodes[0].id;
	}

	function prepareAiDraft() {
		if (!aiPrompt.trim()) return;
		draftNotice = locale === 'uk' ? 'Збережено як чернетку. AI та deploy не підключені.' : 'Saved as a draft. AI and deploy are not connected.';
	}

	$effect(() => {
		nodes = createNodes(activeScenario, locale);
	});
</script>

<div class="engine-shell">
	<div class="canvas-toolbar">
		<div class="workflow-identity">
			<span class="workflow-logo"><Workflow size={17} /></span>
			<div><span>{text.journeys}</span><label><select value={activeScenario.id} onchange={(event) => selectScenario(flowScenarios.find((scenario) => scenario.id === event.currentTarget.value) ?? initialScenario)}>{#each flowScenarios as scenario}<option value={scenario.id}>{localizedScenario(scenario, locale).label}</option>{/each}</select><ChevronDown size={12} /></label></div>
		</div>
		<div class="editor-actions">
			<span class="draft-state"><i></i>{locale === 'uk' ? 'Чернетка' : 'Draft'}</span>
			<button type="button"><FileUp size={14} />{locale === 'uk' ? 'Документація' : 'Docs'}</button>
			<button type="button"><Check size={14} />{locale === 'uk' ? 'Перевірити' : 'Validate'}</button>
			<button class="publish" type="button" disabled title={text.noMutation}><Upload size={14} />{locale === 'uk' ? 'Опублікувати' : 'Publish'}</button>
		</div>
	</div>
	<div class="workflow-summary scenario-heading"><div><div class="breadcrumbs"><span>{localizedCategory(activeScenario.category, locale)}</span><b>/</b><strong>{activeCopy.title}</strong><span class="revision">{text.trace}</span></div><p>{activeCopy.description}</p></div><div class="legend"><span><i class="complete"></i>{text.passed}</span><span><i class="running"></i>{text.active}</span><span><i></i>{text.pending}</span></div></div>

	<div class="engine-body">
		<aside class="node-palette process-catalog">
			<header><Boxes size={15} /><strong>{locale === 'uk' ? 'Палітра вузлів' : 'Node palette'}</strong></header>
			<label class="process-search">
				<Search size={14} />
				<input bind:value={paletteQuery} type="search" placeholder={locale === 'uk' ? 'Знайти вузол' : 'Find node'} />
			</label>
			<nav aria-label={locale === 'uk' ? 'Вузли Cloudflare Workflows' : 'Cloudflare Workflows nodes'}>
				{#each filteredPalette as group}
					<section><h3>{group.label}<ChevronDown size={11} /></h3>
						{#each group.items as item}
							{@const Icon = item.icon}
							<button type="button" draggable="true"><span class="palette-icon"><Icon size={14} /></span><span><b>{item.label}</b><small>{item.api}</small></span><ChevronRight size={11} /></button>
						{/each}
					</section>
				{/each}
				{#if filteredPalette.length === 0}<p class="empty-catalog">{text.empty}</p>{/if}
			</nav>
			<div class="palette-foot"><Code2 size={13} /><span>{locale === 'uk' ? 'Експорт у TypeScript Workflow' : 'TypeScript Workflow output'}</span></div>
		</aside>
		<div class="canvas" aria-label={text.canvas}>
			<div class="canvas-badge"><span><i></i>PREVIEW</span><button type="button" aria-label={locale === 'uk' ? 'Історія версій' : 'Version history'}><History size={14} /></button></div>
			<SvelteFlow
				bind:nodes
				bind:edges
				{nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.12, minZoom: 0.35, maxZoom: 0.72 }}
				minZoom={0.25}
				maxZoom={1.35}
				nodesConnectable={false}
				elementsSelectable
				deleteKey={null}
				onnodeclick={selectNode}
			>
				<Background variant={BackgroundVariant.Dots} gap={18} size={1.25} />
				<Controls position="bottom-left" showLock={false} />
				<MiniMap position="bottom-right" pannable zoomable nodeColor="#65758a" maskColor="rgb(15 21 32 / 78%)" />
			</SvelteFlow>
			<form class="ai-dock" onsubmit={(event) => { event.preventDefault(); prepareAiDraft(); }}>
				<span><Sparkles size={15} /></span><input bind:value={aiPrompt} placeholder={locale === 'uk' ? 'Опишіть процес або додайте документацію для AI...' : 'Describe a process or add documentation for AI...'} /><button type="submit" aria-label={locale === 'uk' ? 'Створити чернетку' : 'Create draft'}><Bot size={15} /></button>
				{#if draftNotice}<small>{draftNotice}</small>{/if}
			</form>
		</div>

		<aside class="inspector" aria-live="polite">
			<header><div><span>{text.inspector}</span><strong>{selectedNode.title} <small>({selectedNode.id})</small></strong></div><PanelRightClose size={17} /></header>
			<div class="inspector-tabs"><button class:active={inspectorTab === 'details'} onclick={() => inspectorTab = 'details'} type="button">{locale === 'uk' ? 'Налаштування' : 'Settings'}</button><button class:active={inspectorTab === 'runs'} onclick={() => inspectorTab = 'runs'} type="button">{locale === 'uk' ? 'Виконання' : 'Runs'}</button></div>
			<div class="inspector-body">
				{#if inspectorTab === 'runs'}
					<div class="execution-timeline"><span>{locale === 'uk' ? 'Хронологія виконання' : 'Execution timeline'}</span><div><i class="done"><Check size={10} /></i><b></b><i class="running"><LoaderCircle size={10} /></i><b></b><i><CirclePause size={10} /></i></div><small>starts: 2 · resolves: 3 · attempt: 1</small></div>
				{/if}
				<span class="node-type">{selectedNode.layer ?? 'process'} · {selectedNode.eyebrow}</span>
				<h3>{selectedNode.title}</h3>
				<p>{selectedNode.detail}</p>
				<div class="entrypoint"><span>{text.entry}</span><code>{activeScenario.entrypoint}</code></div>

				<div class="property-list">
					<div><span>{text.status}</span><strong data-status={selectedNode.status}>
						{#if selectedNode.status === 'complete'}<Check size={13} />{:else if selectedNode.status === 'running'}<LoaderCircle size={13} />{:else if selectedNode.status === 'waiting'}<CirclePause size={13} />{:else}<LockKeyhole size={13} />{/if}
						{statusText[locale][selectedNode.status]}
					</strong></div>
					<div><span>{text.execution}</span><strong>{text.simulation}</strong></div>
					<div><span>{text.result}</span><strong>{selectedNode.meta}</strong></div>
					<div><span>Retry</span><strong>3 · exponential</strong></div>
					<div><span>Timeout</span><strong>30 seconds</strong></div>
				</div>

				<div class="trace">
					<div><Code2 size={14} /><span>{text.communication}</span></div>
					{#if selectedNode.request}<code>{selectedNode.request}</code>{/if}
					{#if selectedNode.operation}<code><Database size={12} /> {selectedNode.operation}</code>{/if}
					{#if selectedNode.input}<p><b>IN</b> {selectedNode.input}</p>{/if}
					{#if selectedNode.output}<p><b>OUT</b> {selectedNode.output}</p>{/if}
				</div>

				<div class="protected">
					<ShieldCheck size={17} />
					<div><strong>{text.noMutation}</strong><span>{text.noMutationDetail}</span></div>
				</div>
			</div>
		</aside>
	</div>
</div>

<style>
	.engine-shell { overflow: hidden; border: 1px solid #bbc1c5; border-radius: 0 0 7px 7px; background: #e8ebec; font-family: 'Manrope', sans-serif; }
	.canvas-toolbar { min-height: 46px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 14px; border-bottom: 1px solid #c5cacf; color: #5d6469; background: #f7f8f8; font-size: 11px; }
	.scenario-heading { min-width: 0; padding-block: 9px; }
	.scenario-heading p { max-width: 780px; margin: 5px 0 0; overflow: hidden; color: #7b8286; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
	.breadcrumbs, .legend, .legend span { display: flex; align-items: center; }
	.breadcrumbs { gap: 8px; }
	.breadcrumbs b { color: #b1b6ba; }
	.breadcrumbs strong { color: #25292c; }
	.revision { padding: 4px 6px; border-radius: 3px; color: #667078; background: #e7eaec; font: 700 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.legend { gap: 13px; color: #747b80; font: 650 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.legend span { gap: 5px; }
	.legend i { width: 7px; height: 7px; border-radius: 50%; background: #8b9297; }
	.legend i.complete { background: #3f8a61; }
	.legend i.running { background: #d6952e; box-shadow: 0 0 0 3px rgb(214 149 46 / 16%); }
	.engine-body { height: min(700px, calc(100vh - 154px)); min-height: 540px; display: grid; grid-template-columns: 216px minmax(0, 1fr) 258px; }
	.process-catalog { min-width: 0; overflow: hidden; border-right: 1px solid #3e4549; color: #d4d9dc; background: #252a2d; }
	.process-catalog > header { height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 13px; border-bottom: 1px solid #3a4044; }
	.process-catalog > header strong { font: 750 11px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.process-search { height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 11px; border-bottom: 1px solid #3a4044; color: #899399; }
	.process-search input { min-width: 0; width: 100%; height: 29px; border: 1px solid #454d52; border-radius: 4px; outline: 0; padding: 0 8px; color: #eef1f2; background: #30363a; font: 650 10px/1 'Manrope', sans-serif; }
	.process-search input:focus { border-color: #7b94b8; box-shadow: 0 0 0 2px rgb(100 133 180 / 15%); }
	.process-search input::placeholder { color: #7f898e; }
	.process-catalog nav { height: calc(100% - 96px); overflow-y: auto; padding: 8px 7px 18px; scrollbar-width: thin; }
	.process-catalog section { margin-bottom: 10px; }
	.process-catalog h3 { height: 27px; display: flex; align-items: center; margin: 0; padding: 0 8px; color: #7f898e; font: 800 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.process-catalog button { width: 100%; min-height: 31px; display: flex; align-items: center; gap: 6px; border: 0; border-radius: 3px; padding: 0 7px 0 10px; color: #b9c0c4; background: transparent; font: 650 10px/1.25 'Manrope', sans-serif; text-align: left; }
	.process-catalog button span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.process-catalog button :global(svg) { flex: 0 0 auto; opacity: 0; }
	.process-catalog button:hover { color: #fff; background: #343a3e; }
	.empty-catalog { margin: 20px 8px; color: #8d969b; font: 650 10px/1.4 'Manrope', sans-serif; }
	.canvas { min-width: 0; height: 100%; background: #edf0f1; }
	.inspector { border-left: 1px solid #c5cacf; color: #282d30; background: #f8f9f9; }
	.inspector > header { min-height: 54px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid #d8dcdf; }
	.inspector > header div { display: grid; gap: 3px; }
	.inspector > header span { color: #858b8f; font: 700 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.inspector > header strong { font: 700 11px/1 monospace; }
	.inspector-body { padding: 22px 17px; }
	.node-type { color: #5272a8; font: 800 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.inspector h3 { margin: 10px 0 9px; font-size: 19px; letter-spacing: 0; }
	.inspector p { margin: 0; color: #6d7478; font-size: 12px; line-height: 1.55; }
	.entrypoint { margin-top: 16px; display: grid; gap: 5px; }
	.entrypoint span { color: #83898d; font: 700 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.entrypoint code { overflow-wrap: anywhere; color: #3d5868; font: 700 9px/1.4 monospace; }
	.property-list { margin-top: 24px; border-top: 1px solid #dde0e2; }
	.property-list > div { min-height: 43px; display: grid; grid-template-columns: 76px minmax(0, 1fr); align-items: center; gap: 8px; border-bottom: 1px solid #dde0e2; }
	.property-list span { color: #83898d; font-size: 10px; }
	.property-list strong { min-width: 0; display: flex; align-items: center; gap: 5px; overflow: hidden; color: #3e4448; font: 700 10px/1.2 'Manrope', sans-serif; text-overflow: ellipsis; text-transform: capitalize; }
	.property-list strong[data-status='complete'] { color: #28754e; }
	.property-list strong[data-status='running'] { color: #9a6413; }
	.trace { margin-top: 18px; display: grid; gap: 7px; padding: 11px; border: 1px solid #d7dcdf; border-radius: 5px; background: #eef1f2; }
	.trace > div { display: flex; align-items: center; gap: 6px; color: #68747b; }
	.trace > div span { font: 800 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.trace code { min-width: 0; display: flex; align-items: center; gap: 5px; overflow: hidden; color: #2f4858; font: 700 9px/1.4 monospace; text-overflow: ellipsis; white-space: nowrap; }
	.trace p { margin: 0; color: #687278; font: 650 9px/1.4 monospace; }
	.trace b { color: #405d6d; }
	.protected { margin-top: 24px; display: flex; gap: 10px; padding: 12px; border: 1px solid #d8caa5; border-radius: 5px; color: #785f21; background: #fff9e9; }
	.protected div { display: grid; gap: 4px; }
	.protected strong { font-size: 11px; }
	.protected span { color: #8b7950; font-size: 9px; line-height: 1.4; }
	:global(.svelte-flow__edge-text) { fill: #545d62; font: 800 10px/1 'Manrope', sans-serif; text-transform: uppercase; }
	:global(.svelte-flow__edge-textbg) { fill: #f6f7f7; }
	:global(.svelte-flow__controls) { overflow: hidden; border: 1px solid #b8bec2; border-radius: 5px; box-shadow: 0 5px 16px rgb(38 43 47 / 10%); }
	:global(.svelte-flow__controls-button) { border-bottom-color: #d4d8da; background: #fff; }
	:global(.svelte-flow__minimap) { overflow: hidden; border: 1px solid #b8bec2; border-radius: 4px; background: #f6f7f7; }
	@media (max-width: 760px) {
		.canvas-toolbar { align-items: flex-start; flex-direction: column; padding-block: 10px; }
		.scenario-heading p { white-space: normal; }
		.legend { display: none; }
		.engine-body { height: 780px; min-height: 0; grid-template-columns: 1fr; grid-template-rows: 104px 440px 236px; }
		.process-catalog { border-right: 0; border-bottom: 1px solid #3e4549; }
		.process-catalog > header { display: none; }
		.process-search { height: 42px; }
		.process-catalog nav { height: 62px; display: flex; gap: 4px; overflow-x: auto; overflow-y: hidden; padding: 5px 7px; }
		.process-catalog section { display: flex; gap: 3px; flex: 0 0 auto; margin: 0; }
		.process-catalog h3 { display: none; }
		.process-catalog button { width: auto; min-height: 32px; flex: 0 0 auto; padding-inline: 10px; border: 1px solid #3b4347; }
		.process-catalog button span { overflow: visible; }
		.process-catalog button :global(svg) { display: none; }
		.inspector { border-top: 1px solid #c5cacf; border-left: 0; overflow-y: auto; }
		.inspector > header { min-height: 44px; }
		.inspector-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; padding: 14px 16px; }
		.inspector-body > p { grid-column: 1 / -1; }
		.property-list, .protected { margin-top: 14px; }
	}

	/* Corex workbench: dashboard shell outside, dense orchestration surface inside. */
	.engine-shell { border-color: #252d3a; background: #101621; }
	.canvas-toolbar { min-height: 58px; padding: 0 12px; border-color: #2b3443; color: #c9d1dc; background: #151d29; }
	.workflow-identity, .workflow-identity > div, .workflow-identity label, .editor-actions { display: flex; align-items: center; }
	.workflow-identity { gap: 10px; }
	.workflow-logo { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 5px; color: #a9c2f5; background: #293753; }
	.workflow-identity > div { align-items: flex-start; flex-direction: column; gap: 3px; }
	.workflow-identity > div > span { color: #7c8899; font-size: 8px; font-weight: 800; text-transform: uppercase; }
	.workflow-identity label { position: relative; }
	.workflow-identity select { width: min(320px, 32vw); appearance: none; border: 0; padding: 0 19px 0 0; outline: 0; color: #eef3fa; background: transparent; font: 750 12px/1.2 'Manrope', sans-serif; }
	.workflow-identity label :global(svg) { position: absolute; right: 0; pointer-events: none; }
	.editor-actions { gap: 7px; }
	.editor-actions button { height: 32px; display: flex; align-items: center; gap: 6px; border: 1px solid #3a4557; border-radius: 5px; padding: 0 10px; color: #cbd3de; background: #232c3a; font: 700 10px/1 'Manrope', sans-serif; }
	.editor-actions button:not(:disabled):hover { border-color: #5a7198; background: #293548; }
	.editor-actions .publish { color: #727d8d; background: #29313d; }
	.draft-state { display: flex; align-items: center; gap: 6px; margin-right: 3px; color: #9ea8b5; font-size: 10px; }
	.draft-state i { width: 7px; height: 7px; border-radius: 50%; background: #dfa731; }
	.workflow-summary.scenario-heading { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 7px 14px; border-bottom: 1px solid #2b3443; color: #8d99aa; background: #121925; }
	.workflow-summary.scenario-heading p { max-width: 650px; margin-top: 4px; color: #748194; }
	.breadcrumbs strong { color: #e2e8f0; }
	.breadcrumbs b { color: #4d5868; }
	.revision { color: #9ba8b9; background: #252e3d; }
	.legend { color: #7d8999; }
	.engine-body { height: min(720px, calc(100vh - 154px)); min-height: 560px; grid-template-columns: 228px minmax(0, 1fr) 286px; }
	.node-palette.process-catalog { border-color: #30394a; color: #d5dbe4; background: #171f2b; }
	.node-palette.process-catalog > header { height: 44px; border-color: #30394a; }
	.node-palette.process-catalog > header strong { font-size: 10px; }
	.process-search { height: 43px; padding: 0 10px; border-color: #30394a; color: #778496; }
	.process-search input { height: 28px; border-color: #3b4658; color: #eef2f7; background: #202938; }
	.node-palette.process-catalog nav { height: calc(100% - 119px); padding: 7px; }
	.node-palette.process-catalog section { margin-bottom: 8px; }
	.node-palette.process-catalog h3 { height: 27px; justify-content: space-between; color: #818c9c; font-size: 8px; }
	.node-palette.process-catalog button { min-height: 42px; gap: 8px; border: 1px solid #333d4d; border-radius: 5px; margin-bottom: 5px; padding: 5px 7px; color: #c8d0dc; background: #222b39; }
	.node-palette.process-catalog button > span:nth-child(2) { min-width: 0; flex: 1; display: grid; gap: 3px; }
	.node-palette.process-catalog button b { font-size: 10px; }
	.node-palette.process-catalog button small { overflow: hidden; color: #788597; font: 650 8px/1 monospace; text-overflow: ellipsis; white-space: nowrap; }
	.node-palette.process-catalog button :global(svg) { opacity: 1; }
	.node-palette.process-catalog button:hover { border-color: #536b96; color: #fff; background: #293548; }
	.palette-icon { width: 24px; height: 24px; display: grid; flex: 0 0 auto; place-items: center; border-radius: 4px; color: #a3bbed; background: #31405a; }
	.palette-foot { height: 32px; display: flex; align-items: center; gap: 6px; padding: 0 10px; border-top: 1px solid #30394a; color: #748092; font-size: 8px; }
	.canvas { position: relative; background: #0f1520; }
	.canvas-badge { position: absolute; z-index: 5; top: 10px; right: 10px; display: flex; gap: 5px; }
	.canvas-badge span, .canvas-badge button { height: 27px; display: flex; align-items: center; gap: 5px; border: 1px solid #344053; border-radius: 4px; padding: 0 8px; color: #9daaba; background: #182130dd; font-size: 8px; font-weight: 800; }
	.canvas-badge span i { width: 6px; height: 6px; border-radius: 50%; background: #e1a72f; }
	.canvas-badge button { width: 28px; justify-content: center; padding: 0; }
	.ai-dock { position: absolute; z-index: 5; left: 50%; bottom: 16px; width: min(520px, calc(100% - 150px)); min-height: 42px; display: grid; grid-template-columns: 34px minmax(0, 1fr) 32px; align-items: center; border: 1px solid #3e4a60; border-radius: 7px; padding: 3px 5px; color: #a9bdf2; background: #192331f2; box-shadow: 0 16px 36px #0007; transform: translateX(-50%); }
	.ai-dock > span { display: grid; place-items: center; }
	.ai-dock input { min-width: 0; border: 0; outline: 0; color: #eef3fa; background: transparent; font: 600 10px/1.3 'Manrope', sans-serif; }
	.ai-dock input::placeholder { color: #748194; }
	.ai-dock button { width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: 4px; color: #0d1520; background: #9fbaf3; }
	.ai-dock small { grid-column: 2 / 4; padding: 2px 0 4px; color: #d3aa53; font-size: 8px; }
	.inspector { border-color: #30394a; color: #d8dee7; background: #171f2b; }
	.inspector > header { padding: 0 13px; border-color: #30394a; }
	.inspector > header strong { max-width: 230px; overflow: hidden; color: #e8edf4; font: 700 10px/1.25 'Manrope', sans-serif; text-overflow: ellipsis; white-space: nowrap; }
	.inspector > header strong small { color: #718093; font-family: monospace; }
	.inspector-tabs { height: 36px; display: flex; border-bottom: 1px solid #30394a; }
	.inspector-tabs button { flex: 1; border: 0; border-bottom: 2px solid transparent; color: #788597; background: transparent; font: 700 9px/1 'Manrope', sans-serif; }
	.inspector-tabs button.active { border-bottom-color: #829fda; color: #dce5f2; }
	.inspector-body { padding: 17px 14px; }
	.execution-timeline { display: grid; gap: 8px; margin-bottom: 17px; padding-bottom: 14px; border-bottom: 1px solid #30394a; }
	.execution-timeline > span { color: #8894a5; font-size: 9px; font-weight: 750; text-transform: uppercase; }
	.execution-timeline > div { display: flex; align-items: center; }
	.execution-timeline i { width: 19px; height: 19px; display: grid; place-items: center; border: 1px solid #596578; border-radius: 50%; color: #8793a4; }
	.execution-timeline i.done { border-color: #3e9366; color: #e1f6e8; background: #347b57; }
	.execution-timeline i.running { border-color: #d5a43b; color: #ffd878; }
	.execution-timeline b { height: 1px; flex: 1; background: #465165; }
	.execution-timeline small { color: #798698; font: 650 8px/1 monospace; }
	.inspector h3 { color: #f0f3f7; font-size: 17px; }
	.inspector p { color: #929dac; font-size: 11px; }
	.entrypoint code { color: #98b9ca; }
	.property-list { margin-top: 20px; border-color: #30394a; }
	.property-list > div { min-height: 39px; grid-template-columns: 68px minmax(0, 1fr); border-color: #30394a; }
	.property-list strong { color: #c8d1dc; font-size: 9px; }
	.trace { margin-top: 16px; padding: 10px; border-color: #313b4b; background: #111824; }
	.trace code { color: #9ebdce; }
	.protected { margin-top: 18px; border-color: #5a5033; color: #e5c979; background: #292517; }
	.protected span { color: #b7a770; }
	:global(.svelte-flow__edge-text) { fill: #bcc7d5; }
	:global(.svelte-flow__edge-textbg) { fill: #182130; }
	:global(.svelte-flow__background-pattern) { fill: #2b3547; }
	:global(.svelte-flow__controls) { border-color: #3c4758; box-shadow: 0 5px 16px #0005; }
	:global(.svelte-flow__controls-button) { border-bottom-color: #3b4555; color: #bdc7d4; background: #202938; }
	:global(.svelte-flow__minimap) { border-color: #3c4758; background: #151d29; }

	@media (max-width: 760px) {
		.editor-actions { width: 100%; overflow-x: auto; }
		.draft-state { margin-right: auto; }
		.workflow-summary.scenario-heading { min-height: 62px; }
		.workflow-summary.scenario-heading p, .workflow-summary .legend { display: none; }
		.workflow-identity select { width: min(270px, 68vw); }
		.node-palette.process-catalog { border-right: 0; border-bottom-color: #30394a; }
		.node-palette.process-catalog > header, .palette-foot { display: none; }
		.node-palette.process-catalog nav { height: 62px; }
		.node-palette.process-catalog button { width: auto; min-height: 36px; margin: 0; }
		.node-palette.process-catalog button small, .node-palette.process-catalog button > :global(svg) { display: none; }
		.ai-dock { width: calc(100% - 90px); }
		.inspector { border-top-color: #30394a; }
	}

	/* Light iOS-inspired editing surface with Corezoid-style operational hierarchy. */
	.engine-shell { border-color: rgb(60 60 67 / 16%); background: #f2f2f7; box-shadow: 0 16px 42px rgb(0 0 0 / 7%); }
	.canvas-toolbar { border-color: rgb(60 60 67 / 12%); color: #3a3a3c; background: rgb(255 255 255 / 92%); backdrop-filter: saturate(180%) blur(20px); }
	.workflow-logo { border-radius: 9px; color: #fff; background: #007aff; box-shadow: 0 4px 12px rgb(0 122 255 / 24%); }
	.workflow-identity > div > span { color: #8e8e93; }
	.workflow-identity select { color: #1d1d1f; }
	.editor-actions button { border-color: rgb(60 60 67 / 14%); border-radius: 8px; color: #3a3a3c; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 4%); }
	.editor-actions button:not(:disabled):hover { border-color: rgb(0 122 255 / 35%); color: #007aff; background: #f7fbff; }
	.editor-actions .publish { color: #aeaeb2; background: #f2f2f7; }
	.draft-state { color: #6e6e73; }
	.draft-state i { background: #ff9f0a; }
	.workflow-summary.scenario-heading { border-color: rgb(60 60 67 / 10%); color: #6e6e73; background: #fafafa; }
	.workflow-summary.scenario-heading p { color: #8e8e93; }
	.breadcrumbs strong { color: #1d1d1f; }
	.breadcrumbs b { color: #c7c7cc; }
	.revision { color: #636366; background: #e9e9ed; }
	.legend { color: #8e8e93; }
	.node-palette.process-catalog { border-color: rgb(60 60 67 / 12%); color: #1d1d1f; background: #f7f7f9; }
	.node-palette.process-catalog > header { border-color: rgb(60 60 67 / 10%); background: rgb(255 255 255 / 72%); }
	.process-search { border-color: rgb(60 60 67 / 10%); color: #8e8e93; }
	.process-search input { border-color: transparent; border-radius: 9px; color: #1d1d1f; background: #e9e9ed; }
	.process-search input:focus { border-color: rgb(0 122 255 / 42%); background: #fff; box-shadow: 0 0 0 3px rgb(0 122 255 / 12%); }
	.process-search input::placeholder { color: #8e8e93; }
	.node-palette.process-catalog h3 { color: #8e8e93; }
	.node-palette.process-catalog button { border-color: rgb(60 60 67 / 11%); border-radius: 9px; color: #3a3a3c; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 3%); }
	.node-palette.process-catalog button small { color: #8e8e93; }
	.node-palette.process-catalog button:hover { border-color: rgb(0 122 255 / 34%); color: #1d1d1f; background: #f5f9ff; box-shadow: 0 3px 10px rgb(0 122 255 / 8%); }
	.palette-icon { border-radius: 7px; color: #007aff; background: #e6f2ff; }
	.palette-foot { border-color: rgb(60 60 67 / 10%); color: #8e8e93; background: rgb(255 255 255 / 65%); }
	.canvas { background: #f5f5f7; }
	.canvas-badge span, .canvas-badge button { border-color: rgb(60 60 67 / 14%); border-radius: 8px; color: #636366; background: rgb(255 255 255 / 88%); box-shadow: 0 3px 12px rgb(0 0 0 / 7%); backdrop-filter: blur(16px); }
	.canvas-badge span i { background: #ff9f0a; }
	.ai-dock { border-color: rgb(60 60 67 / 18%); border-radius: 13px; color: #007aff; background: rgb(255 255 255 / 92%); box-shadow: 0 12px 34px rgb(0 0 0 / 13%); backdrop-filter: saturate(180%) blur(20px); }
	.ai-dock input { color: #1d1d1f; }
	.ai-dock input::placeholder { color: #8e8e93; }
	.ai-dock button { border-radius: 9px; color: #fff; background: #007aff; }
	.ai-dock small { color: #9a5b00; }
	.inspector { border-color: rgb(60 60 67 / 12%); color: #1d1d1f; background: #f7f7f9; }
	.inspector > header { border-color: rgb(60 60 67 / 10%); background: rgb(255 255 255 / 72%); }
	.inspector > header strong { color: #1d1d1f; }
	.inspector > header strong small { color: #8e8e93; }
	.inspector-tabs { border-color: rgb(60 60 67 / 10%); padding: 4px; background: #e9e9ed; }
	.inspector-tabs button { border: 0; border-radius: 7px; color: #6e6e73; }
	.inspector-tabs button.active { border: 0; color: #1d1d1f; background: #fff; box-shadow: 0 1px 4px rgb(0 0 0 / 12%); }
	.execution-timeline { border-color: rgb(60 60 67 / 10%); }
	.execution-timeline > span, .execution-timeline small { color: #8e8e93; }
	.execution-timeline i { border-color: #c7c7cc; color: #8e8e93; background: #fff; }
	.execution-timeline i.done { border-color: #34c759; color: #fff; background: #34c759; }
	.execution-timeline i.running { border-color: #ff9f0a; color: #ff9f0a; background: #fff8ea; }
	.execution-timeline b { background: #d1d1d6; }
	.inspector h3 { color: #1d1d1f; }
	.inspector p { color: #6e6e73; }
	.entrypoint code { color: #00718a; }
	.property-list, .property-list > div { border-color: rgb(60 60 67 / 10%); }
	.property-list strong { color: #3a3a3c; }
	.trace { border-color: rgb(60 60 67 / 11%); border-radius: 10px; background: #fff; }
	.trace code { color: #146079; }
	.protected { border-color: #f1d18d; border-radius: 10px; color: #7a5600; background: #fff8e8; }
	.protected span { color: #8a7445; }
	:global(.svelte-flow__edge-text) { fill: #636366; }
	:global(.svelte-flow__edge-textbg) { fill: #fff; }
	:global(.svelte-flow__background-pattern) { fill: #c7c7cc; }
	:global(.svelte-flow__controls) { border-color: rgb(60 60 67 / 16%); border-radius: 10px; box-shadow: 0 6px 18px rgb(0 0 0 / 10%); }
	:global(.svelte-flow__controls-button) { border-bottom-color: rgb(60 60 67 / 10%); color: #3a3a3c; background: rgb(255 255 255 / 94%); }
	:global(.svelte-flow__minimap) { border-color: rgb(60 60 67 / 16%); border-radius: 10px; background: rgb(255 255 255 / 92%); box-shadow: 0 6px 18px rgb(0 0 0 / 8%); }

	@media (max-width: 760px) {
		.node-palette.process-catalog { border-bottom-color: rgb(60 60 67 / 12%); }
		.inspector { border-top-color: rgb(60 60 67 / 12%); }
	}
</style>