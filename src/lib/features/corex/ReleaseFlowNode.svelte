<script lang="ts">
	import { Check, CirclePause, Diamond, LoaderCircle, LockKeyhole, OctagonX, Play } from '@lucide/svelte';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { statusText, type CorexLocale } from './i18n';
	import type { FlowNode } from './types';

	let { data, selected = false }: NodeProps = $props();
	let node = $derived(data as unknown as FlowNode & { locale: CorexLocale });
</script>

<article
	class:selected
	class:running={node.status === 'running'}
	class:decision={node.kind === 'decision'}
	class="flow-node"
	data-status={node.status}
	data-layer={node.layer}
>
	<Handle type="target" position={Position.Left} class="port target-port" />
	<header>
		<span class="kind-icon">
			{#if node.kind === 'trigger'}<Play size={11} fill="currentColor" />{:else if node.kind === 'decision'}<Diamond size={12} />{:else if node.kind === 'terminal'}<OctagonX size={12} />{:else}<span class="action-mark"></span>{/if}
		</span>
		<span class="eyebrow">{node.eyebrow}</span>
		<span class="state" data-status={node.status}>
			{#if node.status === 'complete'}<Check size={11} />{:else if node.status === 'running'}<LoaderCircle size={11} />{:else if node.status === 'waiting'}<CirclePause size={11} />{:else}<LockKeyhole size={11} />{/if}
			{statusText[node.locale][node.status]}
		</span>
	</header>
	<div class="body">
		<h3>{node.title}</h3>
		<p>{node.detail}</p>
	</div>
	<footer>
		<span class="meta-badge">{node.meta}</span>
	</footer>
	{#if node.workflow?.type === 'switch'}
		{#each node.workflow.branches ?? [] as branch, index (branch)}
			<Handle
				id={branch}
				type="source"
				position={Position.Right}
				class={`port branch-port switch-port${branch === 'default' ? ' default-port' : ''}`}
				style={`top: ${((index + 1) / ((node.workflow?.branches?.length ?? 0) + 1)) * 100}%`}
				title={branch}
			/>
		{/each}
	{:else if node.kind === 'decision'}
		<Handle id="true" type="source" position={Position.Right} class="port branch-port true-port" title="True / Yes" />
		<Handle id="false" type="source" position={Position.Right} class="port branch-port false-port" title="False / No" />
	{:else if node.kind !== 'terminal'}
		<Handle id="next" type="source" position={Position.Right} class="port" />
	{/if}
</article>

<style>
	.flow-node {
		width: 256px;
		min-height: 152px;
		overflow: visible;
		position: relative;
		border: 1px solid #e8ecf2;
		border-radius: 14px;
		color: #1f2937;
		background: rgba(255, 255, 255, 0.98);
		backdrop-filter: blur(16px);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 24px -4px rgba(26, 115, 232, 0.07), 0 0 0 1px rgba(255, 255, 255, 0.8) inset;
		font-family: 'Manrope', sans-serif;
		transition: all 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	.flow-node:hover {
		border-color: rgba(26, 115, 232, 0.45);
		box-shadow: 0 4px 12px rgba(26, 115, 232, 0.08), 0 16px 36px -6px rgba(26, 115, 232, 0.14);
		transform: translateY(-3px) scale(1.008);
	}
	.flow-node.selected {
		border-color: #1a73e8;
		box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.22), 0 12px 32px -4px rgba(26, 115, 232, 0.2);
	}
	.flow-node.running {
		border-color: transparent;
		box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(26, 115, 232, 0.35), 0 14px 36px rgba(124, 58, 237, 0.18);
		animation: geminiAura 3s ease-in-out infinite alternate;
	}
	.flow-node[data-status='blocked'] {
		opacity: 0.7;
		background: #f8fafc;
	}

	header {
		height: 40px;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 0 12px;
		border-top-left-radius: 13px;
		border-top-right-radius: 13px;
		border-bottom: 1px solid #f1f4f8;
		background: linear-gradient(180deg, #fcfdfe 0%, #f8fafd 100%);
	}
	.eyebrow {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: #5f6368;
		font: 750 9.5px/1 'Manrope', sans-serif;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.kind-icon {
		width: 22px;
		height: 22px;
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 7px;
		color: #fff;
		background: linear-gradient(135deg, #1a73e8 0%, #4285f4 100%);
		box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);
	}
	.flow-node[data-layer='auth'] .kind-icon { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3); }
	.flow-node[data-layer='worker'] .kind-icon { background: linear-gradient(135deg, #0284c7 0%, #06b6d4 100%); box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3); }
	.flow-node[data-layer='database'] .kind-icon { background: linear-gradient(135deg, #16a34a 0%, #10b981 100%); box-shadow: 0 2px 6px rgba(22, 163, 74, 0.3); }
	.flow-node[data-layer='external'] .kind-icon { background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%); box-shadow: 0 2px 6px rgba(147, 51, 234, 0.3); }
	.flow-node[data-layer='deploy'] .kind-icon { background: linear-gradient(135deg, #5f6368 0%, #475569 100%); box-shadow: 0 2px 6px rgba(100, 116, 139, 0.3); }
	.decision .kind-icon { color: #fff; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); box-shadow: 0 2px 6px rgba(234, 88, 12, 0.3); }
	.action-mark { width: 6px; height: 6px; border-radius: 2px; background: currentColor; }

	.state {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 4px;
		border-radius: 9999px;
		padding: 3px 8px;
		color: #5f6368;
		background: #f1f4f8;
		font: 700 9px/1 'Manrope', sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.state[data-status='complete'] { color: #137333; background: #e6f4ea; border: 1px solid #ceead6; }
	.state[data-status='running'] { color: #b06000; background: #fef7e0; border: 1px solid #feefc3; }
	.state[data-status='running'] :global(svg) { animation: spin 1.2s linear infinite; }
	.state[data-status='waiting'] { color: #1967d2; background: #e8f0fe; border: 1px solid #d2e3fc; }
	.state[data-status='failed'] { color: #c5221f; background: #fce8e6; border: 1px solid #fad2cf; }

	.body {
		min-height: 76px;
		padding: 13px 15px 11px;
	}
	h3 {
		margin: 0 0 6px;
		color: #1e293b;
		font-size: 14px;
		font-weight: 700;
		line-height: 1.25;
		letter-spacing: -0.015em;
	}
	p {
		margin: 0;
		color: #64748b;
		font-size: 10.5px;
		line-height: 1.5;
		font-family: 'Manrope', sans-serif;
	}

	footer {
		padding: 8px 14px 9px;
		border-bottom-left-radius: 13px;
		border-bottom-right-radius: 13px;
		border-top: 1px solid #f1f4f8;
		background: #fafbfd;
	}
	.meta-badge {
		display: inline-block;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: #64748b;
		font: 700 9px/1.2 monospace;
		letter-spacing: 0.03em;
	}

	:global(.port) {
		width: 13px !important;
		height: 13px !important;
		border: 2.5px solid #ffffff !important;
		border-radius: 50% !important;
		background: #1a73e8 !important;
		box-shadow: 0 0 0 1px rgba(26, 115, 232, 0.6), 0 2px 8px rgba(26, 115, 232, 0.35) !important;
		transition: transform 140ms ease, box-shadow 140ms ease;
	}
	:global(.port:hover) {
		transform: scale(1.35) !important;
		box-shadow: 0 0 0 2px #ffffff, 0 0 10px #1a73e8 !important;
	}
	:global(.target-port) {
		left: -6.5px !important;
	}
	:global(.branch-port.true-port) {
		top: 36% !important;
		background: #1e8e3e !important;
		box-shadow: 0 0 0 1px rgba(30, 142, 62, 0.7), 0 2px 8px rgba(30, 142, 62, 0.4) !important;
	}
	:global(.branch-port.false-port) {
		top: 68% !important;
		background: #d93025 !important;
		box-shadow: 0 0 0 1px rgba(217, 48, 37, 0.7), 0 2px 8px rgba(217, 48, 37, 0.4) !important;
	}
	:global(.branch-port.switch-port) {
		background: #1e8e3e !important;
		box-shadow: 0 0 0 1px rgba(30, 142, 62, 0.7), 0 2px 8px rgba(30, 142, 62, 0.4) !important;
	}
	:global(.branch-port.switch-port.default-port) {
		background: #d93025 !important;
		box-shadow: 0 0 0 1px rgba(217, 48, 37, 0.7), 0 2px 8px rgba(217, 48, 37, 0.4) !important;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
	@keyframes geminiAura {
		0% {
			box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(26, 115, 232, 0.35), 0 12px 28px rgba(26, 115, 232, 0.15);
		}
		50% {
			box-shadow: 0 0 0 2px #fff, 0 0 0 5px rgba(124, 58, 237, 0.4), 0 16px 36px rgba(124, 58, 237, 0.22);
		}
		100% {
			box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(217, 101, 112, 0.4), 0 14px 32px rgba(217, 101, 112, 0.18);
		}
	}
</style>