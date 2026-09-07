<script lang="ts">
	import photo from '../../../../../2.jpg';
	import { pilotHref, type BaselineCopy } from './copy';

	let { c }: { c: BaselineCopy } = $props();
</script>

<section id="contact" class="b-section b-final" data-section="final13" aria-labelledby="b-final-heading">
	<div class="b-wrap">
		<div class="b-panel b-final-panel">
			<div class="b-final-content">
				<h2 id="b-final-heading" class="b-heading">{c.finalTitle}</h2>
				<p class="b-final-text">{c.finalText}</p>
				<div class="b-final-actions">
					<a class="b-button" href={pilotHref}>{c.contact}</a>
					<a class="b-button b-secondary" href="/dashboard/">{c.shared.start}</a>
				</div>
			</div>
			<div class="b-final-media">
				<img class="b-final-photo" src={photo} alt="" loading="lazy" decoding="async" />
			</div>
		</div>
	</div>
</section>