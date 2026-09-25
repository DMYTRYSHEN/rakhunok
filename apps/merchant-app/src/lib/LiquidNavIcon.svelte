<script lang="ts">
	import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
	import File from '@lucide/svelte/icons/file';
	import UserRound from '@lucide/svelte/icons/user-round';
	let { kind, active = false }: { kind: 'kasa' | 'history' | 'profile'; active?: boolean } = $props();
</script>

<span class="liquid-icon" class:active aria-hidden="true" data-liquid-icon={kind}>
	{#if kind === 'kasa'}
		<span class="bag motion"><ShoppingBag size={28} strokeWidth={1.65} /></span>
	{:else if kind === 'history'}
		<span class="invoice motion"><File size={28} strokeWidth={1.65} /><span class="invoice-currency">₴</span><span class="invoice-lines"></span></span>
	{:else}
		<span class="avatar motion"><UserRound size={28} strokeWidth={1.65} /></span>
	{/if}
</span>

<style>
	.liquid-icon, .liquid-icon > span { display: grid; place-items: center; width: 28px; height: 28px; flex-shrink: 0; color: inherit; }
	.invoice { position: relative; }
	.invoice-currency { position: absolute; left: 9px; top: 8px; font-family: "Segoe UI", sans-serif; font-size: 11px; line-height: 12px; font-weight: 600; }
	.invoice-lines { position: absolute; left: 9px; top: 21px; width: 10px; height: 1.5px; border-radius: 1px; background: currentColor; }
	.motion, .bag :global(path:last-child), .avatar :global(circle) { transform-origin: center; transform-box: fill-box; animation-duration: 720ms; animation-timing-function: cubic-bezier(.2,.7,.25,1); animation-fill-mode: both; }
	.liquid-icon:is(.active, :global(button:hover) .liquid-icon, :global(button:focus-visible) .liquid-icon) .bag { animation-name: settle-bag; }
	.liquid-icon:is(.active, :global(button:hover) .liquid-icon, :global(button:focus-visible) .liquid-icon) .bag :global(path:last-child) { animation-name: lift-handle; }
	.liquid-icon:is(.active, :global(button:hover) .liquid-icon, :global(button:focus-visible) .liquid-icon) .invoice { animation-name: unfold-invoice; transform-origin: center bottom; }
	.liquid-icon:is(.active, :global(button:hover) .liquid-icon, :global(button:focus-visible) .liquid-icon) .avatar { animation-name: reveal-avatar; }
	.liquid-icon:is(.active, :global(button:hover) .liquid-icon, :global(button:focus-visible) .liquid-icon) .avatar :global(circle) { animation-name: greet-avatar; }
	@keyframes settle-bag { from { transform: translateY(2px); } to { transform: none; } }
	@keyframes lift-handle { 0% { transform: translateY(1px) scaleY(.8); } 45% { transform: translateY(-.6px); } 100% { transform: none; } }
	@keyframes unfold-invoice { from { opacity: .5; transform: translateY(2px) scaleY(.88); } to { opacity: 1; transform: none; } }
	@keyframes reveal-avatar { from { opacity: .5; transform: translateY(1.5px); } to { opacity: 1; transform: none; } }
	@keyframes greet-avatar { from { transform: translateY(1px); } to { transform: none; } }
	@media (prefers-reduced-motion: reduce) { .motion, .bag :global(path:last-child), .avatar :global(circle) { animation: none !important; } }
</style>
