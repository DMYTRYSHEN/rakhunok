<script lang="ts">
	import { onMount } from 'svelte';
	import { Landmark, Pause, Play, RotateCw } from '@lucide/svelte';
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
	const logos = $derived(banks.filter((bank) => bank.logo && !failedLogos.includes(bank.id)));
	const outline = 'M44.3 12 L45.8 12.4 L46.8 10.1 L48.1 10.6 L52.2 9.6 L54.8 15.3 L53.8 17.3 L54.1 20.4 L57.3 20.9 L58.7 25.3 L58.6 27.2 L63.7 30.7 L66.8 29.2 L69.2 33.8 L71.6 33.7 L77.5 37 L77.5 39.9 L75.9 45.2 L76.8 50.7 L76.2 54 L72.3 54.7 L70.2 57.5 L70.1 62 L66.9 62.8 L64.2 66 L60.5 66.5 L57 70.3 L57.3 76.5 L59.2 78.9 L63.3 78.3 L62.5 81.9 L58.2 83.6 L52.7 89.4 L50.5 87.4 L51.4 82.7 L47 79.7 L47.7 77.8 L51.6 74.5 L50.4 72.2 L44.2 69.7 L43.9 65.9 L40.2 67.2 L38.7 72.7 L35.6 80.1 L33.8 78.4 L31.9 80 L30.1 78.1 L31.1 77 L31.8 73.6 L32.9 70.4 L32.7 68.6 L33.5 67.8 L33.9 69.2 L36.2 69.5 L37.3 68.8 L36.6 67.7 L36.8 66.3 L35.4 63.7 L34.9 59.5 L33.4 57.9 L33.7 54.5 L31.9 51.8 L30.2 51.4 L27.3 48.3 L24.6 49.3 L23.7 50.8 L22 50.8 L21 53.1 L18 54.1 L16.7 55.6 L14.8 53.2 L12.2 53.1 L9.8 52 L8 54.2 L7.8 51.5 L5.5 48.8 L6.3 44.7 L7.4 42.1 L8.3 42.7 L7.3 38.2 L10.9 29.9 L12.9 28.8 L13.3 25.9 L11.3 17.2 L13.2 16.8 L15.4 14.1 L18.5 13.9 L22.6 14.7 L27 17.1 L30.2 17.3 L31.7 18.7 L33.2 17 L34.2 19.3 L37.8 18.8 L39.4 19.8 L39.7 14.8 L40.9 12.6 L44.3 12 Z';
	const cities = {
		'Львів': [24.03, 49.84], 'Київ': [30.52, 50.45], 'Одеса': [30.73, 46.48],
		'Дніпро': [35.05, 48.46], 'Харків': [36.23, 49.99], 'Чернівці': [25.94, 48.29],
		'Вінниця': [28.47, 49.23], 'Полтава': [34.55, 49.59], 'Запоріжжя': [35.14, 47.84],
		'Миколаїв': [31.99, 46.98], 'Кропивницький': [32.26, 48.51], 'Тернопіль': [25.59, 49.55]
	} as const;
	const point = (city: keyof typeof cities) => [(cities[city][0] - 20.7) * 4, (53.3 - cities[city][1]) * 10];
	const route = (from: keyof typeof cities, to: keyof typeof cities, action = 'Переказ') => {
		const start = point(from);
		const end = point(to);
		const lift = Math.min(9, Math.abs(end[0] - start[0]) * .16 + 3);
		return { from, to, start, end, curve: `M ${start[0]} ${start[1]} Q ${(start[0] + end[0]) / 2} ${Math.min(start[1], end[1]) - lift} ${end[0]} ${end[1]}`, action };
	};
	const routes = [route('Львів', 'Київ', 'Оплата рахунку'), route('Одеса', 'Дніпро'), route('Харків', 'Київ', 'Оплата рахунку')];
	const backgroundRoutes = [route('Чернівці', 'Вінниця'), route('Київ', 'Дніпро'), route('Полтава', 'Харків'), route('Львів', 'Тернопіль'), route('Запоріжжя', 'Одеса'), route('Миколаїв', 'Кропивницький'), route('Тернопіль', 'Київ'), route('Дніпро', 'Запоріжжя'), route('Вінниця', 'Одеса'), route('Харків', 'Полтава'), route('Кропивницький', 'Дніпро'), route('Чернівці', 'Львів')];
	const current = $derived(routes[routeIndex]);
	const sender = $derived(logos.length ? logos[(routeIndex * 2) % logos.length] : undefined);
	const receiver = $derived(logos.length ? logos[(routeIndex * 2 + 1) % logos.length] : undefined);

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
		<div><p class="promo-kicker">СЦЕНАРІЙ ПЕРЕКАЗУ / ІЛЮСТРАЦІЯ</p><h3 id="promo-transfer-title">Від міста до міста.<br /><span>Від банку до банку.</span></h3></div>
		<p>Покупець відкриває рахунок, переходить до свого банку й підтверджує платіж. Бізнес перевіряє надходження окремо.</p>
	</div>
	<div class="promo-transfer-layout">
		<div class="promo-map-scene" class:playing={running && visible && !reducedMotion} aria-label={`Ілюстративні одночасні маршрути між містами України. У фокусі: ${current.from} — ${current.to}. ${current.action}. Це не дані реальних платежів.`}>
			<div class="promo-map-grid" aria-hidden="true"></div>
			<svg class="promo-map-shape" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
				<defs>
					<linearGradient id="promo-map-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4f8f8"/><stop offset=".17" stop-color="#a7b6bd"/><stop offset=".37" stop-color="#e3edf0"/><stop offset=".62" stop-color="#788b95"/><stop offset=".83" stop-color="#d2dee2"/><stop offset="1" stop-color="#667780"/></linearGradient>
					<pattern id="promo-map-engraving" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><path d="M0 0 H2" stroke="#fff" stroke-opacity=".12" stroke-width=".2"/></pattern>
					<clipPath id="promo-map-clip"><path d={outline}/></clipPath>
				</defs>
				<path class="promo-map-rim" d={outline}/>
				<path d={outline} fill="url(#promo-map-metal)"/>
				<path d={outline} fill="url(#promo-map-engraving)"/>
				<g clip-path="url(#promo-map-clip)" class="promo-map-relief">
					<path d="M 8 40 Q 20 28 30 34 T 53 25 T 81 34 M 7 46 Q 21 35 33 40 T 58 31 T 83 39 M 5 53 Q 23 40 36 47 T 63 38 T 82 45 M 12 60 Q 24 48 39 52 T 64 47 T 84 52 M 19 66 Q 31 54 45 59 T 66 52 T 82 58 M 31 73 Q 43 61 55 65 T 74 59"/>
				</g>
			</svg>
			<svg class="promo-map-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
				<defs><clipPath id="promo-route-clip"><path d={outline} /></clipPath></defs>
				<g clip-path="url(#promo-route-clip)">
				{#each backgroundRoutes as backgroundRoute, index (backgroundRoute.from + backgroundRoute.to)}
					<path class="promo-route-secondary" d={backgroundRoute.curve} pathLength="1" style:--route-delay={`${(index % 5) * -.42}s`} style:--route-duration={`${1.5 + (index % 3) * .32}s`} />
				{/each}
				<path class="promo-route-shadow" d={current.curve} />
				<path class="promo-route-line" class:active={stage > 0} d={current.curve} pathLength="1" />
				{#if stage === 1}<circle class="promo-route-particle" r="1.25"><animateMotion dur=".8s" fill="freeze" path={current.curve} /></circle>{/if}
				</g>
			</svg>
			<div class="promo-city promo-city-from" class:enlarged={stage === 0 || stage === 1} style:left={`${current.start[0]}%`} style:top={`${current.start[1]}%`}>
				<span class="promo-city-marker"><span class="promo-city-logo">{#if sender?.logo}<img src={sender.logo} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (failedLogos = [...failedLogos, sender.id])} />{:else}<Landmark size={20} />{/if}</span></span>
				<span class="promo-city-label">{current.from}</span>
			</div>
			<div class="promo-city promo-city-to" class:enlarged={stage === 2} style:left={`${current.end[0]}%`} style:top={`${current.end[1]}%`}>
				<span class="promo-city-marker"><span class="promo-city-logo">{#if receiver?.logo}<img src={receiver.logo} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (failedLogos = [...failedLogos, receiver.id])} />{:else}<Landmark size={20} />{/if}</span></span>
				<span class="promo-city-label">{current.to}</span>
			</div>
			<div class="promo-map-caption">UA / СХЕМА РУХУ</div>
		</div>
		<div class="promo-transfer-console">
			<div class="promo-transfer-console-top"><span>RAHUNOK / ПРИКЛАД</span><span>0{routeIndex + 1} / 0{routes.length}</span></div>
			<div class="promo-transfer-banks">
				<div class:active={stage === 0 || stage === 1}><span>ВІДПРАВНИК · {current.from}</span><div class="promo-transfer-bank">{#if sender?.logo}<img src={sender.logo} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (failedLogos = [...failedLogos, sender.id])} />{:else}<Landmark size={30} />{/if}<strong>{sender?.name ?? 'Банк із каталогу'}</strong></div></div>
				<div class="promo-transfer-arrow" aria-hidden="true">↓</div>
				<div class:active={stage === 2}><span>ОТРИМУВАЧ · {current.to}</span><div class="promo-transfer-bank">{#if receiver?.logo}<img src={receiver.logo} alt="" loading="lazy" referrerpolicy="no-referrer" onerror={() => (failedLogos = [...failedLogos, receiver.id])} />{:else}<Landmark size={30} />{/if}<strong>{receiver?.name ?? 'Банк із каталогу'}</strong></div></div>
			</div>
			<div class="promo-transfer-status" aria-live="off"><span class:active={stage === 0}>01 · Банк покупця</span><span class:active={stage === 1}>02 · Маршрут переказу</span><span class:active={stage === 2}>03 · Банк отримувача</span></div>
			<div class="promo-transfer-controls"><button type="button" title={running ? 'Призупинити анімацію' : 'Відтворити анімацію'} aria-label={running ? 'Призупинити анімацію' : 'Відтворити анімацію'} onclick={toggle} disabled={logos.length < 2}>{#if running}<Pause size={18} />{:else}<Play size={18} />{/if}</button><button type="button" onclick={replay} disabled={logos.length < 2}><RotateCw size={17} /> Інший маршрут</button></div>
		</div>
	</div>
	<p class="promo-transfer-disclaimer">Схема ілюстративна: вона не відображає реальні перекази, швидкість чи підтвердження зарахування. Логотипи з публічного каталогу не означають партнерства або доступності переказів між цими банками.</p>
</section>