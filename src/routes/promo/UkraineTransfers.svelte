<script lang="ts">
	import { onMount } from 'svelte';
	import { Check, Copy, Landmark, Pause, Play, RotateCw } from '@lucide/svelte';
	import type { DirectoryBank } from '$lib/features/landing/data/bank-directory';

	let { banks }: { banks: DirectoryBank[] } = $props();
	let host: HTMLElement;
	let running = $state(false);
	let stage = $state(0);
	let routeIndex = $state(0);
	let failedLogos = $state<string[]>([]);
	let reducedMotion = $state(false);
	let visible = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let mouseX = $state(0);
	let mouseY = $state(0);
	let copied = $state(false);
	const logos = $derived(banks.filter((bank) => bank.logo && !failedLogos.includes(bank.id)));
	const outline = 'M44.3 12 L45.8 12.4 L46.8 10.1 L48.1 10.6 L52.2 9.6 L54.8 15.3 L53.8 17.3 L54.1 20.4 L57.3 20.9 L58.7 25.3 L58.6 27.2 L63.7 30.7 L66.8 29.2 L69.2 33.8 L71.6 33.7 L77.5 37 L77.5 39.9 L75.9 45.2 L76.8 50.7 L76.2 54 L72.3 54.7 L70.2 57.5 L70.1 62 L66.9 62.8 L64.2 66 L60.5 66.5 L57 70.3 L57.3 76.5 L59.2 78.9 L63.3 78.3 L62.5 81.9 L58.2 83.6 L52.7 89.4 L50.5 87.4 L51.4 82.7 L47 79.7 L47.7 77.8 L51.6 74.5 L50.4 72.2 L44.2 69.7 L43.9 65.9 L40.2 67.2 L38.7 72.7 L35.6 80.1 L33.8 78.4 L31.9 80 L30.1 78.1 L31.1 77 L31.8 73.6 L32.9 70.4 L32.7 68.6 L33.5 67.8 L33.9 69.2 L36.2 69.5 L37.3 68.8 L36.6 67.7 L36.8 66.3 L35.4 63.7 L34.9 59.5 L33.4 57.9 L33.7 54.5 L31.9 51.8 L30.2 51.4 L27.3 48.3 L24.6 49.3 L23.7 50.8 L22 50.8 L21 53.1 L18 54.1 L16.7 55.6 L14.8 53.2 L12.2 53.1 L9.8 52 L8 54.2 L7.8 51.5 L5.5 48.8 L6.3 44.7 L7.4 42.1 L8.3 42.7 L7.3 38.2 L10.9 29.9 L12.9 28.8 L13.3 25.9 L11.3 17.2 L13.2 16.8 L15.4 14.1 L18.5 13.9 L22.6 14.7 L27 17.1 L30.2 17.3 L31.7 18.7 L33.2 17 L34.2 19.3 L37.8 18.8 L39.4 19.8 L39.7 14.8 L40.9 12.6 L44.3 12 Z';
	const cities = {
		'Львів': [24.03, 49.84], 'Київ': [30.52, 50.45], 'Одеса': [30.73, 46.48],
		'Дніпро': [35.05, 48.46], 'Харків': [36.23, 49.99], 'Чернівці': [25.94, 48.29],
		'Вінниця': [28.47, 49.23], 'Полтава': [34.55, 49.59], 'Запоріжжя': [35.14, 47.84],
		'Миколаїв': [31.99, 46.98], 'Кропивницький': [32.26, 48.51], 'Тернопіль': [25.59, 49.55],
		'Ужгород': [22.28, 48.62], 'Івано-Франківськ': [24.71, 48.92], 'Луцьк': [25.32, 50.74],
		'Рівне': [26.25, 50.61], 'Хмельницький': [26.97, 49.42], 'Житомир': [28.66, 50.25],
		'Чернігів': [31.29, 51.49], 'Черкаси': [32.06, 49.44], 'Суми': [34.79, 50.90],
		'Херсон': [32.61, 46.63]
	} as const;
	const point = (city: keyof typeof cities) => [(cities[city][0] - 20.7) * 4, (53.3 - cities[city][1]) * 10];
	const route = (from: keyof typeof cities, to: keyof typeof cities, action = 'Переказ', uetr = 'eb6305c9-1f7f-49de-aed0-16487c27b42d') => {
		const start = point(from);
		const end = point(to);
		const lift = Math.min(9, Math.abs(end[0] - start[0]) * .16 + 3);
		return { from, to, start, end, curve: `M ${start[0]} ${start[1]} Q ${(start[0] + end[0]) / 2} ${Math.min(start[1], end[1]) - lift} ${end[0]} ${end[1]}`, action, uetr };
	};
	const routes = [
		route('Львів', 'Київ', 'Оплата рахунку', 'c9820f14-7e32-4d1a-96e0-264195cf82a1'),
		route('Одеса', 'Дніпро', 'Переказ', '7b4e1892-a160-49c5-8f33-149b08f36c50'),
		route('Харків', 'Київ', 'Оплата рахунку', 'f043e628-98bc-450f-a2e1-7d159a4c8e77'),
		route('Ужгород', 'Суми', 'Оплата рахунку', '3a9108e4-b725-41e9-906c-829d4f107b32'),
		route('Житомир', 'Черкаси', 'Переказ', '81e9f023-4b67-428a-8a19-0e429d71c89f'),
		route('Івано-Франківськ', 'Чернігів', 'Переказ', 'd6281094-c148-43bb-a5f1-379a0b82f6e4')
	];
	const backgroundRoutes = [route('Чернівці', 'Вінниця'), route('Київ', 'Дніпро'), route('Полтава', 'Харків'), route('Львів', 'Тернопіль'), route('Запоріжжя', 'Одеса'), route('Миколаїв', 'Кропивницький'), route('Тернопіль', 'Київ'), route('Дніпро', 'Запоріжжя'), route('Вінниця', 'Одеса'), route('Харків', 'Полтава'), route('Кропивницький', 'Дніпро'), route('Чернівці', 'Львів'), route('Рівне', 'Житомир'), route('Луцьк', 'Хмельницький'), route('Ужгород', 'Івано-Франківськ'), route('Суми', 'Полтава'), route('Херсон', 'Миколаїв'), route('Чернігів', 'Київ'), route('Черкаси', 'Кропивницький')];
	const current = $derived(routes[routeIndex]);
	const sender = $derived(logos.length ? logos[(routeIndex * 2) % logos.length] : undefined);
	const receiver = $derived(logos.length ? logos[(routeIndex * 2 + 1) % logos.length] : undefined);

	async function copyUetr() {
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			try {
				await navigator.clipboard.writeText(current.uetr);
				copied = true;
				setTimeout(() => { copied = false; }, 2000);
			} catch {}
		}
	}

	function advance() {
		if (!running || !visible || reducedMotion || logos.length < 2) return;
		if (stage === 2) {
			stage = 0;
			routeIndex = (routeIndex + 1) % routes.length;
		} else {
			stage += 1;
		}
		timer = setTimeout(advance, stage === 1 ? 850 : stage === 2 ? 650 : 450);
	}

	function replay() {
		clearTimeout(timer);
		stage = 0;
		routeIndex = (routeIndex + 1) % routes.length;
		running = true;
		if (visible && !reducedMotion) timer = setTimeout(advance, 220);
	}

	function toggle() {
		if (running) {
			running = false;
			clearTimeout(timer);
		} else {
			running = true;
			if (visible && !reducedMotion) timer = setTimeout(advance, 200);
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (reducedMotion || !host) return;
		const rect = host.getBoundingClientRect();
		const x = (e.clientX - rect.left) / rect.width;
		const y = (e.clientY - rect.top) / rect.height;
		mouseX = (x - 0.5) * 2;
		mouseY = (y - 0.5) * 2;
	}

	function handleMouseLeave() {
		mouseX = 0;
		mouseY = 0;
	}

	onMount(() => {
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotion = () => {
			reducedMotion = motion.matches;
			if (motion.matches) { running = false; clearTimeout(timer); }
			else if (visible && running) { clearTimeout(timer); timer = setTimeout(advance, 200); }
		};
		updateMotion();
		motion.addEventListener('change', updateMotion);
		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			clearTimeout(timer);
			if (visible && running && !reducedMotion) timer = setTimeout(advance, 200);
		}, { threshold: 0.05 });
		observer.observe(host.querySelector('.promo-map-scene') ?? host);
		if (!motion.matches) running = true;
		return () => { clearTimeout(timer); observer.disconnect(); motion.removeEventListener('change', updateMotion); };
	});
</script>

<section class="promo-transfer-section" aria-labelledby="promo-transfer-title" bind:this={host}>
	<div class="promo-transfer-heading">
		<div>
			<p class="promo-kicker">КІНЕТИЧНА ТОПОЛОГІЯ / СИСТЕМА ПЕРЕКАЗІВ</p>
			<h3 id="promo-transfer-title">Бездоганний рух коштів.<br /><span>З точністю до мілісекунди.</span></h3>
		</div>
		<p>Кожен переказ — це чиста геометрія зв'язку між клієнтом, його банком та бізнесом. Без зайвих посередників, без компромісів у безпеці.</p>
	</div>

	<div class="promo-transfer-layout" onmousemove={handleMouseMove} onmouseleave={handleMouseLeave} style="--mx: {mouseX}; --my: {mouseY};" role="presentation">
		<!-- Precision Engineering Reticles -->
		<div class="ive-crosshair top-left" aria-hidden="true">+</div>
		<div class="ive-crosshair top-right" aria-hidden="true">+</div>
		<div class="ive-crosshair bottom-left" aria-hidden="true">+</div>

		<div class="promo-map-scene" class:playing={running && visible && !reducedMotion} aria-label={`Ілюстративні одночасні маршрути між містами України. У фокусі: ${current.from} — ${current.to}. ${current.action}. Це не дані реальних платежів.`}>
			<div class="promo-map-3d-wrapper">
				<div class="promo-map-grid" aria-hidden="true"></div>
				
				<svg class="promo-map-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
					<defs>
						<!-- Jony Ive Liquid Mercury PBR Shader -->
						<linearGradient id="ive-mercury-surface" x1="15%" y1="0%" x2="85%" y2="100%">
							<stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
							<stop offset="12%" stop-color="#e3ebf2"/>
							<stop offset="28%" stop-color="#9eb0c0"/>
							<stop offset="46%" stop-color="#43505e"/>
							<stop offset="49%" stop-color="#192027"/>
							<stop offset="52%" stop-color="#556575"/>
							<stop offset="70%" stop-color="#b2c3d4"/>
							<stop offset="86%" stop-color="#edf3f8"/>
							<stop offset="100%" stop-color="#6f8194"/>
						</linearGradient>

						<linearGradient id="ive-specular-glare" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="#ffffff" stop-opacity="0.6"/>
							<stop offset="35%" stop-color="#ffffff" stop-opacity="0.05"/>
							<stop offset="70%" stop-color="#000000" stop-opacity="0.1"/>
							<stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
						</linearGradient>

						<pattern id="ive-guilloche" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
							<path d="M0 0 H3" stroke="#ffffff" stroke-opacity="0.07" stroke-width="0.2"/>
						</pattern>
						
						<clipPath id="ive-map-clip"><path d={outline}/></clipPath>

						<filter id="ive-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#000000" flood-opacity="0.7"/>
							<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#ffffff" flood-opacity="0.3"/>
						</filter>
					</defs>

					<!-- Liquid Mercury Silhouette with Meniscus Bevel -->
					<path class="promo-map-shadow-base" d={outline} filter="url(#ive-shadow)"/>
					<path class="promo-map-mercury" d={outline} fill="url(#ive-mercury-surface)"/>
					<path class="promo-map-glare" d={outline} fill="url(#ive-specular-glare)"/>
					<path d={outline} fill="url(#ive-guilloche)"/>

					<!-- Guilloché Micro-Relief Contours -->
					<g clip-path="url(#ive-map-clip)" class="promo-map-relief">
						<path d="M 8 40 Q 20 28 30 34 T 53 25 T 81 34 M 7 46 Q 21 35 33 40 T 58 31 T 83 39 M 5 53 Q 23 40 36 47 T 63 38 T 82 45 M 12 60 Q 24 48 39 52 T 64 47 T 84 52 M 19 66 Q 31 54 45 59 T 66 52 T 82 58 M 31 73 Q 43 61 55 65 T 74 59"/>
					</g>

					<path class="promo-map-rim" d={outline}/>
				</svg>

				<!-- Optical Fiber Transfer Routes -->
				<svg class="promo-map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
					<defs><clipPath id="promo-route-clip"><path d={outline} /></clipPath></defs>
					<g clip-path="url(#promo-route-clip)">
						{#each backgroundRoutes as backgroundRoute, index (backgroundRoute.from + backgroundRoute.to)}
							<path class="promo-route-secondary" d={backgroundRoute.curve} pathLength="1" style:--route-delay={`${(index % 5) * -.42}s`} style:--route-duration={`${1.6 + (index % 3) * .35}s`} />
						{/each}
						<path class="promo-route-shadow" d={current.curve} />
						<path class="promo-route-line" class:active={stage > 0} d={current.curve} pathLength="1" />
						{#if stage === 1}
							<circle class="promo-route-particle" r="1.35">
								<animateMotion dur=".75s" fill="freeze" path={current.curve} />
							</circle>
						{/if}
					</g>
				</svg>

				<!-- Node Points (Precision Sapphire Crystal Markers) -->
				<div class="promo-city promo-city-from" class:enlarged={stage === 0 || stage === 1} style:left={`${current.start[0]}%`} style:top={`${current.start[1]}%`}>
					<span class="promo-city-marker">
						<span class="promo-city-halo"></span>
						<span class="promo-city-logo">
							{#if sender?.logo}
								<img src={sender.logo} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (failedLogos = [...failedLogos, sender.id])} />
							{:else}
								<Landmark size={18} strokeWidth={1.5} />
							{/if}
						</span>
					</span>
					<span class="promo-city-label">{current.from}</span>
				</div>

				<div class="promo-city promo-city-to" class:enlarged={stage === 2} style:left={`${current.end[0]}%`} style:top={`${current.end[1]}%`}>
					<span class="promo-city-marker">
						<span class="promo-city-halo"></span>
						<span class="promo-city-logo">
							{#if receiver?.logo}
								<img src={receiver.logo} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (failedLogos = [...failedLogos, receiver.id])} />
							{:else}
								<Landmark size={18} strokeWidth={1.5} />
							{/if}
						</span>
					</span>
					<span class="promo-city-label">{current.to}</span>
				</div>
			</div>

			<div class="promo-map-caption">
				<span class="spec-label">RAHUNOK / KINETIC CLEARING PROTOCOL</span>
				<span class="spec-coords">48.3794° N, 31.1656° E</span>
				<span class="spec-uetr">UETR: {current.uetr}</span>
			</div>
		</div>

		<!-- Instrument Deck / Console -->
		<aside class="promo-transfer-console">
			<div class="promo-transfer-console-top">
				<span class="ive-live-indicator"><span class="ive-led"></span> КАТАЛОГ СИНХРОНІЗАЦІЇ</span>
				<span class="ive-counter">0{routeIndex + 1} &mdash; 0{routes.length}</span>
			</div>

			<!-- Live UETR Telemetry Strip -->
			<div class="ive-uetr-telemetry">
				<div class="uetr-meta">
					<span class="uetr-tag">ІДЕНТИФІКАТОР ПЛАТЕЖУ (UETR)</span>
					<span class="uetr-verified"><span class="uetr-check-dot"></span> ISO 20022</span>
				</div>
				<div class="uetr-body">
					<code class="uetr-value" title={`UETR: ${current.uetr}`}>{current.uetr}</code>
					<button type="button" class="uetr-copy-btn" class:copied onclick={copyUetr} title="Скопіювати UETR" aria-label="Скопіювати UETR">
						{#if copied}
							<Check size={12} strokeWidth={2.5} />
							<span>Скопійовано</span>
						{:else}
							<Copy size={12} strokeWidth={2} />
							<span>Копія</span>
						{/if}
					</button>
				</div>
			</div>

			<div class="promo-transfer-banks">
				<div class="ive-bank-bay" class:active={stage === 0 || stage === 1}>
					<div class="bay-head">
						<span class="bay-role">ДЖЕРЕЛО</span>
						<span class="bay-geo">{current.from}</span>
					</div>
					<div class="promo-transfer-bank">
						<div class="bank-avatar">
							{#if sender?.logo}
								<img src={sender.logo} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (failedLogos = [...failedLogos, sender.id])} />
							{:else}
								<Landmark size={22} strokeWidth={1.5} />
							{/if}
						</div>
						<div class="bank-meta">
							<strong>{sender?.name ?? 'Банк покупця'}</strong>
							<small>Прямий переказ</small>
						</div>
					</div>
				</div>

				<div class="promo-transfer-arrow" aria-hidden="true">
					<span class="arrow-line"></span>
					<span class="arrow-dot"></span>
				</div>

				<div class="ive-bank-bay" class:active={stage === 2}>
					<div class="bay-head">
						<span class="bay-role">ОТРИМУВАЧ</span>
						<span class="bay-geo">{current.to}</span>
					</div>
					<div class="promo-transfer-bank">
						<div class="bank-avatar">
							{#if receiver?.logo}
								<img src={receiver.logo} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (failedLogos = [...failedLogos, receiver.id])} />
							{:else}
								<Landmark size={22} strokeWidth={1.5} />
							{/if}
						</div>
						<div class="bank-meta">
							<strong>{receiver?.name ?? 'Банк бізнесу'}</strong>
							<small>Фіксація зарахування</small>
						</div>
					</div>
				</div>
			</div>

			<div class="promo-transfer-status" aria-live="off">
				<div class="status-segment" class:active={stage === 0}>
					<span class="seg-idx">01</span>
					<span class="seg-text">Ініціація</span>
				</div>
				<div class="status-segment" class:active={stage === 1}>
					<span class="seg-idx">02</span>
					<span class="seg-text">Маршрутизація</span>
				</div>
				<div class="status-segment" class:active={stage === 2}>
					<span class="seg-idx">03</span>
					<span class="seg-text">Зарахування</span>
				</div>
			</div>

			<div class="promo-transfer-controls">
				<button type="button" class="btn-tactile btn-icon" title={running ? 'Пауза' : 'Пуск'} aria-label={running ? 'Пауза' : 'Пуск'} onclick={toggle} disabled={logos.length < 2}>
					{#if running}<Pause size={17} strokeWidth={2} />{:else}<Play size={17} strokeWidth={2} />{/if}
				</button>
				<button type="button" class="btn-tactile btn-action" onclick={replay} disabled={logos.length < 2}>
					<RotateCw size={15} strokeWidth={2} /> <span>Змінити маршрут</span>
				</button>
			</div>
		</aside>
	</div>
	<p class="promo-transfer-disclaimer">Схема ілюстративна: вона не відображає реальні перекази, швидкість чи підтвердження зарахування. Логотипи з публічного каталогу не означають партнерства або доступності переказів між цими банками.</p>
</section>