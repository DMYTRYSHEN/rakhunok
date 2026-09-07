<script lang="ts">
	import type { BaselineCopy } from './copy';

	let { c }: { c: BaselineCopy } = $props();
</script>

<section id="faq" class="b-section b-faq" data-section="faq12" aria-labelledby="b-faq-heading">
	<div class="b-wrap">
		<h2 id="b-faq-heading" class="b-heading">{c.product.faq}</h2>
		<p class="b-faq-intro">{c.product.faqText}</p>
		<div class="b-faq-list">
			{#each c.faq as [question, answer] (question)}
				<details class="b-panel b-faq-item">
					<summary class="b-faq-question">{question}</summary>
					<p class="b-faq-answer">{answer}</p>
				</details>
			{/each}
		</div>
	</div>
</section>