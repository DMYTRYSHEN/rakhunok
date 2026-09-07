<script lang="ts">
	import type { BaselineCopy } from './copy';

	let { c }: { c: BaselineCopy } = $props();
</script>

<section id="plan-b" class="b-section b-plan-b" data-section="planB9" aria-labelledby="b-plan-b-heading">
	<div class="b-wrap">
		<div class="b-panel b-plan-b-panel">
			<h2 id="b-plan-b-heading" class="b-heading">{c.planTitle}</h2>
			<ol class="b-grid b-plan-b-steps">
				{#each c.planSteps as step, index (step)}
					<li class="b-plan-b-step">
						<span class="b-plan-b-number" aria-hidden="true">{index + 1}</span>
						<span>{step}</span>
					</li>
				{/each}
			</ol>
			<p class="b-note b-plan-b-note">{c.planNote}</p>
		</div>
	</div>
</section>