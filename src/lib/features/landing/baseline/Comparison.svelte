<script lang="ts">
	import type { BaselineCopy } from './copy';

	let { c }: { c: BaselineCopy } = $props();
</script>

<section id="comparison" class="b-section b-comparison" data-section="comparison7" aria-labelledby="b-comparison-heading">
	<div class="b-wrap">
		<h2 id="b-comparison-heading" class="b-heading">{c.comparisonTitle}</h2>
		<div class="b-panel b-comparison-table">
			<table class="b-comparison-matrix" aria-labelledby="b-comparison-heading">
				<thead>
					<tr>
						{#each c.comparisonHeads as heading, index (heading)}
							<th scope="col" class:b-comparison-highlight={index === 2}>{heading}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each c.comparisonRows as row (row[0])}
						<tr>
							<th scope="row">{row[0]}</th>
							<td>{row[1]}</td>
							<td class="b-comparison-highlight">{row[2]}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="b-grid b-comparison-cards">
			{#each c.comparisonRows as row (row[0])}
				<article class="b-panel b-comparison-card">
					<h3>{row[0]}</h3>
					<dl class="b-comparison-values">
						<div>
							<dt>{c.comparisonHeads[1]}</dt>
							<dd>{row[1]}</dd>
						</div>
						<div class="b-comparison-highlight">
							<dt>{c.comparisonHeads[2]}</dt>
							<dd>{row[2]}</dd>
						</div>
					</dl>
				</article>
			{/each}
		</div>
	</div>
</section>