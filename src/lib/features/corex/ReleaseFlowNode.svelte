<script lang="ts">
	import { Check, CirclePause, Diamond, LoaderCircle, LockKeyhole, OctagonX, Play } from '@lucide/svelte';
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { statusText, type CorexLocale } from './i18n';
	import type { FlowNode } from './types';

	let { data, selected = false }: NodeProps = $props();
	let node = $derived(data as unknown as FlowNode & { locale: CorexLocale });
</script>

<article class:selected class:running={node.status === 'running'} class:decision={node.kind === 'decision'} class="flow-node" data-status={node.status} data-layer={node.layer}>
	<Handle type="target" position={Position.Left} class="port" />
	<header>
		<span class="kind-icon">
			{#if node.kind === 'trigger'}<Play size={13} fill="currentColor" />{:else if node.kind === 'decision'}<Diamond size={14} />{:else if node.kind === 'terminal'}<OctagonX size={14} />{:else}<span class="action-mark"></span>{/if}
		</span>
		<span>{node.eyebrow}</span>
		<span class="state" data-status={node.status}>
			{#if node.status === 'complete'}<Check size={11} />{:else if node.status === 'running'}<LoaderCircle size={11} />{:else if node.status === 'waiting'}<CirclePause size={11} />{:else}<LockKeyhole size={11} />{/if}
			{statusText[node.locale][node.status]}
		</span>
	</header>
	<div class="body">
		<h3>{node.title}</h3>
		<p>{node.detail}</p>
	</div>
	<footer>{node.meta}</footer>
	{#if node.kind === 'decision'}
		<Handle id="true" type="source" position={Position.Right} class="port branch-port true-port" />
		<Handle id="false" type="source" position={Position.Right} class="port branch-port false-port" />
	{:else if node.kind !== 'terminal'}
		<Handle id="next" type="source" position={Position.Right} class="port" />
	{/if}
</article>

<style>
	.flow-node { width: 238px; min-height: 146px; overflow: hidden; border: 1px solid rgb(60 60 67 / 18%); border-radius: 12px; color: #1d1d1f; background: rgb(255 255 255 / 96%); box-shadow: 0 1px 2px rgb(0 0 0 / 5%), 0 8px 24px rgb(0 0 0 / 7%); font-family: 'Manrope', sans-serif; transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
	.flow-node:hover { border-color: rgb(0 122 255 / 50%); box-shadow: 0 10px 28px rgb(0 0 0 / 10%); transform: translateY(-1px); }
	.flow-node.selected { border-color: #007aff; box-shadow: 0 0 0 3px rgb(0 122 255 / 16%), 0 12px 30px rgb(0 0 0 / 11%); }
	.flow-node.running { border-color: #ff9f0a; box-shadow: 0 0 0 3px rgb(255 159 10 / 14%), 0 10px 28px rgb(0 0 0 / 9%); }
	.flow-node[data-status='blocked'] { background: rgb(248 248 250 / 96%); }
	header { height: 36px; display: flex; align-items: center; gap: 7px; padding: 0 10px; border-bottom: 1px solid rgb(60 60 67 / 10%); color: #6e6e73; background: #f7f7f9; font: 750 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	.kind-icon { width: 20px; height: 20px; display: grid; flex: 0 0 auto; place-items: center; border-radius: 6px; color: #fff; background: #007aff; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 18%); }
	.flow-node[data-layer='auth'] .kind-icon { background: #ff9500; }
	.flow-node[data-layer='worker'] .kind-icon { background: #32ade6; }
	.flow-node[data-layer='database'] .kind-icon { background: #34c759; }
	.flow-node[data-layer='external'] .kind-icon { background: #af52de; }
	.flow-node[data-layer='deploy'] .kind-icon { background: #8e8e93; }
	.decision .kind-icon { color: #fff; background: #ff9f0a; }
	.action-mark { width: 7px; height: 7px; border-radius: 1px; background: currentColor; }
	.state { margin-left: auto; display: flex; align-items: center; gap: 4px; border-radius: 999px; padding: 4px 6px; color: #6e6e73; background: #e9e9ed; }
	.state[data-status='complete'] { color: #187a35; background: #e5f7ea; }
	.state[data-status='running'] { color: #9a5b00; background: #fff1d6; }
	.state[data-status='running'] :global(svg) { animation: spin 1.4s linear infinite; }
	.body { min-height: 77px; padding: 13px 14px 10px; }
	h3 { margin: 0 0 7px; font-size: 14px; line-height: 1.2; letter-spacing: 0; }
	p { margin: 0; color: #6e6e73; font-size: 10px; line-height: 1.45; }
	footer { padding: 8px 14px; border-top: 1px solid rgb(60 60 67 / 9%); color: #8e8e93; background: #fbfbfc; font: 700 9px/1 'Manrope', sans-serif; text-transform: uppercase; }
	:global(.port) { width: 12px !important; height: 12px !important; border: 3px solid #fff !important; background: #007aff !important; box-shadow: 0 0 0 1px rgb(0 122 255 / 65%), 0 2px 5px rgb(0 0 0 / 16%); }
	:global(.branch-port.true-port) { top: 38%; background: #34c759 !important; box-shadow: 0 0 0 1px rgb(52 199 89 / 70%), 0 2px 5px rgb(0 0 0 / 16%); }
	:global(.branch-port.false-port) { top: 68%; background: #ff453a !important; box-shadow: 0 0 0 1px rgb(255 69 58 / 70%), 0 2px 5px rgb(0 0 0 / 16%); }
	@keyframes spin { to { transform: rotate(360deg); } }
</style>