<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Translations } from '../data/translations';

	let { t }: { t: Translations } = $props();
</script>

<footer class="site-footer">
	<div class="footer-grid container">
		<div>
			<a class="brand" href={resolve('/#top')}>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 208 221"
					fill="none"
					class="brand-icon"
					style="margin-right: -4px;"
				>
					<g>
						<path
							d="M108.903 29.2451C119.845 29.2451 129.281 31.4851 137.211 35.9649C145.14 40.4448 151.167 46.3148 155.29 53.5752C159.413 60.8356 161.475 68.6366 161.475 76.9783C161.475 86.8647 158.62 96.0563 152.911 104.552C147.361 112.894 139.193 119.15 128.409 123.321L169.325 191.445C144.049 191.445 120.737 178.182 108.337 156.747L94.6296 133.053C82.5427 133.053 72.7443 142.588 72.7443 154.351V191.445C53.3001 191.445 37.5375 176.106 37.5375 157.183V137.192C37.5375 118.27 53.3001 102.93 72.7443 102.93C105.753 104.095 124.948 105.313 126.268 80.4542C126.648 60.1615 109.721 58.9323 72.7443 60.7583H69.9196C52.0355 60.7583 37.5375 46.6494 37.5375 29.2451H108.903ZM101.528 102.93C109.299 102.93 115.326 100.768 119.608 96.4421C124.048 91.9623 126.268 86.633 126.268 80.4542C126.268 74.7384 124.365 70.0268 120.559 66.3194C116.753 62.612 111.202 60.7583 103.907 60.7583H72.7443C109.721 58.9323 126.648 60.1615 126.268 80.4542C124.948 105.313 105.753 104.095 72.7443 102.93H101.528Z"
							fill="currentColor"
						/>
						<path
							d="M72.7443 102.93C53.3001 102.93 37.5375 118.27 37.5375 137.192V157.183C37.5375 176.106 53.3001 191.445 72.7443 191.445V154.351C72.7443 142.588 82.5427 133.053 94.6296 133.053L108.337 156.747C120.737 178.182 144.049 191.445 169.325 191.445L128.409 123.321C139.193 119.15 147.361 112.894 152.911 104.552C158.62 96.0563 161.475 86.8647 161.475 76.9783C161.475 68.6366 159.413 60.8356 155.29 53.5752C151.167 46.3148 145.14 40.4448 137.211 35.9649C129.281 31.4851 119.845 29.2451 108.903 29.2451H37.5375C37.5375 46.6494 52.0355 60.7583 69.9196 60.7583H72.7443M72.7443 102.93H101.528C109.299 102.93 115.326 100.768 119.608 96.4421C124.048 91.9623 126.268 86.633 126.268 80.4542M72.7443 102.93C105.753 104.095 124.948 105.313 126.268 80.4542M72.7443 60.7583H103.907C111.202 60.7583 116.753 62.612 120.559 66.3194C124.365 70.0268 126.268 74.7384 126.268 80.4542M72.7443 60.7583C109.721 58.9323 126.648 60.1615 126.268 80.4542"
							stroke="currentColor"
							stroke-width="0.05"
						/>
					</g>
				</svg>
				<span
					>{t.brand.name}
					<!--       	<span class="brand-dot" aria-hidden="true"></span>  -->
				</span>
			</a>
			<a class="footer-domain" href="https://rahunok.com/">Rahunok.com</a>
			<p>
				Building the sovereign financial infrastructure for the digital age. Diia.City Resident.
			</p>
		</div>

		<nav aria-label="Ecosystem">
			<strong>Ecosystem</strong>
			<a href="https://rahunok.com/#apps">Demo App</a>
			<a href="https://rahunok.com/#solutions">ORC-Loyalty system</a>
			<a href="https://rahunok.com/#solutions">SoftPOS Terminal</a>
			<a href="https://rahunok.com/#solutions">Payment Links</a>
		</nav>

		<div class="footer-column" aria-label="Company">
			<strong>Company</strong>
			<span>RAHUNOK</span>
			<span>Limited Liability Company</span>
			<span>45679768</span>
		</div>

		<address class="footer-column">
			<strong>Contact</strong>
			<a href="tel:+380676696060">+380 67 669 60 60</a>
			<a href="mailto:rahunok@rahunok.com">rahunok@rahunok.com</a>
			<a
				href="https://www.google.com/maps/search/?api=1&query=9a+Gareth+Jones+Street+Kyiv+03019+Ukraine"
				target="_blank"
				rel="noreferrer"
			>
				03019 9a, str Gareth Jones, Kyiv, Ukraine
			</a>
		</address>
	</div>

	<div class="footer-bottom container">
		<span>© {new Date().getFullYear()} {t.brand.name}. {t.footer.rights}</span>
		<span>Diia.City Resident.</span>
	</div>
</footer>
