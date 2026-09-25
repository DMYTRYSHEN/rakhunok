<script lang="ts">
	import { Landmark, RotateCw } from '@lucide/svelte';
	import type { DirectoryBank } from '$lib/features/landing/data/bank-directory';
	let { banks }: { banks: DirectoryBank[] } = $props();
	let indices = $state([0, 1, 2]);
	let spinning = $state(false);
	let failures = $state<string[]>([]);
	let timer: ReturnType<typeof setInterval> | undefined;
	let stopTimer: ReturnType<typeof setTimeout> | undefined;
	const logos = $derived(banks.filter((bank) => bank.logo && !failures.includes(bank.id)));

	function spin() {
		if (spinning || logos.length === 0) return;
		spinning = true;
		let turns = 0;
		timer = setInterval(() => {
			indices = indices.map((index, reel) => (index + reel + 1) % logos.length);
			turns += 1;
			if (turns >= 16) {
				clearInterval(timer);
				stopTimer = setTimeout(() => (spinning = false), 300);
			}
		}, 90);
	}
	$effect(() => () => { clearInterval(timer); clearTimeout(stopTimer); });
</script>

<div class="promo-reels-section">
	<div class="promo-reels-copy"><p class="promo-kicker">КАТАЛОГ У РУСІ</p><h3>Знайомі банки.<br /><span>Новий погляд.</span></h3><p>Прокрутіть логотипи банків із каталогу. Це лише демонстрація, а не вибір банку для оплати.</p></div>
	<div class="promo-machine" aria-label="Демонстраційний автомат із логотипами банків">
		<div class="promo-machine-arch"><span>RAHUNOK</span><strong>БАНКІВСЬКИЙ КАТАЛОГ</strong></div>
		<div class="promo-machine-reels">
			{#each indices as index, reel (reel)}
				<div class="promo-machine-window" class:spinning aria-hidden="true">
					{#if logos.length > 0}{@const bank = logos[index % logos.length]}<img src={bank.logo!} alt="" width="66" height="66" loading="lazy" referrerpolicy="no-referrer" onerror={() => (failures = [...failures, bank.id])} />{:else}<Landmark size={40} strokeWidth={1.5} />{/if}
				</div>
			{/each}
		</div>
		<div class="promo-machine-controls"><span>LIBERTY / 01</span><button type="button" onclick={spin} disabled={logos.length === 0 || spinning} title="Прокрутити логотипи"><RotateCw size={18} /> Прокрутити</button></div>
		<div class="promo-machine-base" aria-hidden="true"></div>
	</div>
	<p class="promo-reels-status" role="status">{logos.length === 0 ? 'Логотипи зараз недоступні.' : spinning ? 'Логотипи прокручуються.' : 'Демонстрація каталогу банків.'}</p>
</div>