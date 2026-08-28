<script lang="ts">
	import { calculateAcquiringCosts, formatMoney } from '../utils/calculator';
	import SectionHeading from './SectionHeading.svelte';
	let turnover = $state(500_000);
	let fee = $state(1.5);
	let terminals = $state(2);
	let costs = $derived(calculateAcquiringCosts(turnover, fee, terminals));
</script>

<section class="section" id="calculator">
	<div class="calculator-layout container">
		<SectionHeading
			eyebrow="Орієнтовний розрахунок"
			title="Скільки коштує ваш"
			accent="поточний еквайринг?"
			copy="Вкажіть місячний оборот, ставку та кількість терміналів. Калькулятор покаже орієнтовні річні витрати."
		/>
		<div class="panel calculator-card">
			<label
				><span>Оборот на місяць <b>{formatMoney(turnover)}</b></span><input
					bind:value={turnover}
					type="range"
					min="50000"
					max="5000000"
					step="50000"
				/></label
			>
			<label
				><span>Ставка еквайрингу <b>{fee.toFixed(1).replace('.', ',')}%</b></span><input
					bind:value={fee}
					type="range"
					min="0.5"
					max="3"
					step="0.1"
				/></label
			>
			<label
				><span>Кількість POS-терміналів <b>{terminals}</b></span><input
					bind:value={terminals}
					type="range"
					min="0"
					max="30"
				/></label
			>
			<div class="result-grid">
				<div><span>Комісія за рік</span><b>{formatMoney(costs.annualCommission)}</b></div>
				<div><span>Оренда POS за рік</span><b>{formatMoney(costs.annualRent)}</b></div>
				<div class="accent"><span>Поточні витрати</span><b>{formatMoney(costs.annualCost)}</b></div>
				<div><span>Потенціал оптимізації</span><b>до {formatMoney(costs.annualCost)}</b></div>
			</div>
			<p class="microcopy">
				Розрахунок інформаційний і не враховує фактичну комісію Rahunok, умови банку та
				індивідуальні договори.
			</p>
		</div>
	</div>
</section>
