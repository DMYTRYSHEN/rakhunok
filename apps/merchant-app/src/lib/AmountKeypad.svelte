<script lang="ts">
	import Calculator from '@lucide/svelte/icons/calculator';
	import Delete from '@lucide/svelte/icons/delete';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	let { onpress }: { onpress: (key: string) => void } = $props();
	let expanded = $state(false);
	const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0'];
</script>

<div class="amount-keypad" class:expanded>
	<div class="keypad-tools">
		<button type="button" aria-label="Очистити суму" title="Очистити суму" onclick={() => onpress('C')}><RotateCcw size={18} aria-hidden="true" /><span>Очистити</span></button>
		<button type="button" aria-label="Калькулятор" title="Арифметичні дії" aria-expanded={expanded} onclick={() => expanded = !expanded}><Calculator size={18} /><span>Калькулятор</span></button>
	</div>
	{#if expanded}
		<div class="arithmetic" aria-label="Арифметичні дії">
			{#each ['÷', '×', '−', '+', '='] as operator (operator)}
				<button type="button" onclick={() => onpress(operator)}>{operator}</button>
			{/each}
		</div>
	{/if}
	<div class="keypad" aria-label="Клавіатура суми">
		{#each digits as digit (digit)}
			<button type="button" onclick={() => onpress(digit)}>{digit}</button>
		{/each}
		<button type="button" aria-label="Видалити цифру" title="Видалити цифру" onclick={() => onpress('⌫')}><Delete size={24} /></button>
	</div>
</div>

<style>
	.amount-keypad { width: 100%; min-width: 0; }
	.keypad-tools { display: flex; justify-content: space-between; border-top: 1px solid var(--line); padding: 4px 0; }
	.keypad-tools button { display: flex; gap: 8px; align-items: center; min-height: 44px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-size: 12px; }
	.keypad-tools button[aria-expanded="true"] { color: var(--brand); background: var(--key); }
	.arithmetic { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; padding-bottom: 8px; }
	.arithmetic button { min-height: 44px; border: 1px solid var(--line); border-radius: 6px; background: var(--key); font-size: 21px; }
	.amount-keypad .keypad { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-auto-rows: 58px; gap: 6px; margin: 0; padding: 0; border: 0; }
	.amount-keypad .keypad button { display: grid; place-items: center; min-height: 0; border: 0; background: var(--key); border-radius: 8px; color: var(--ink); font-size: 27px; font-weight: 500; box-shadow: none; transition: background 120ms, transform 120ms; }
	.amount-keypad button:active { transform: scale(.97); background: var(--line); }
	@media (hover: hover) { .amount-keypad button:hover { background: var(--line); } }
	@media (min-width: 900px) { .amount-keypad .keypad { grid-auto-rows: 70px; gap: 8px; } }
	@media (max-height: 740px) and (max-width: 899px) {
		.keypad-tools { padding: 0; }
		.keypad-tools button { font-size: .75rem; }
		.amount-keypad .keypad { grid-auto-rows: 48px; gap: 4px; }
		.amount-keypad .keypad button { font-size: 1.5rem; }
		.expanded { display: grid; grid-template-columns: minmax(0, 1fr) 48px; gap: 4px; }
		.expanded .keypad-tools { grid-column: 1; grid-row: 1; }
		.expanded .keypad-tools button { min-width: 44px; justify-content: center; padding-inline: 8px; }
		.expanded .keypad-tools span { display: none; }
		.expanded .keypad { grid-column: 1; grid-row: 2; }
		.expanded .arithmetic { grid-column: 2; grid-row: 1 / 3; grid-template-columns: 1fr; grid-template-rows: repeat(5, minmax(44px, 1fr)); gap: 4px; padding: 0; }
	}
	@media (prefers-reduced-motion: reduce) { .amount-keypad button { transition: none; } }
</style>