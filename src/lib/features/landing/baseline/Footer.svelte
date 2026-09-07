<script lang="ts">
	import type { BaselineCopy } from './copy';

	let { c }: { c: BaselineCopy } = $props();
	const year = new Date().getFullYear();
</script>

<footer class="b-section b-footer" data-section="footer14">
	<div class="b-wrap">
		<div class="b-grid b-footer-grid">
			<div class="b-footer-brand-column">
				<a class="b-footer-brand" href="#top">Rahunok</a>
				<p class="b-footer-description">{c.footerText}</p>
			</div>
			<div class="b-footer-column">
				<h2 class="b-footer-heading">{c.company}</h2>
				<p class="b-footer-company">
					<span>RAHUNOK</span>
					<span>Limited Liability Company</span>
					<span>45679768</span>
				</p>
			</div>
			<div class="b-footer-column">
				<h2 id="b-footer-contacts-heading" class="b-footer-heading">{c.contacts}</h2>
				<address class="b-footer-address" aria-labelledby="b-footer-contacts-heading">
					<a href="tel:+380676696060">+380 67 669 60 60</a>
					<a href="mailto:rahunok@rahunok.com">rahunok@rahunok.com</a>
					<a href="https://www.google.com/maps/search/?api=1&query=9a+Gareth+Jones+Street+Kyiv+03019+Ukraine" target="_blank" rel="noreferrer">
						03019 9a, str Gareth Jones, Kyiv, Ukraine
					</a>
				</address>
			</div>
			<nav class="b-footer-column b-footer-links" aria-labelledby="b-footer-information-heading">
				<h2 id="b-footer-information-heading" class="b-footer-heading">{c.legal}</h2>
				<a href="#features">{c.nav[2]}</a>
				<a href="#comparison">{c.comparisonHeads[0]}</a>
				<a href="#security">{c.nav[4]}</a>
				<a href="#pricing">{c.nav[5]}</a>
				<a href="#faq">{c.shared.nav[3]}</a>
				<a href="#contact">{c.contacts}</a>
			</nav>
		</div>
		<div class="b-footer-bottom">
			<span>© {year} Rahunok. {c.rights}</span>
			<span>Diia.City Resident.</span>
		</div>
	</div>
</footer>