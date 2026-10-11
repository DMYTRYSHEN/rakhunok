<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { ArrowRight, ArrowUpRight, Search, X, History, Trash2 } from '@lucide/svelte';
	import TrackingHeader from '#lib/TrackingHeader.svelte';
	import { readHistory, rememberTracking, writeHistory, type HistoryEntry, HISTORY_KEY } from '#lib/guest-tracking-history.ts';
	let history = $state<HistoryEntry[]>([]);
	let trackingNumber = $state('');
	let submitting = $state(false);
	let error = $state('');
	function syncHistory() {
		try { history = readHistory(localStorage); }
		catch { history = []; }
	}
	function removeHistory(number: string) {
		history = history.filter(entry => entry.number !== number);
		try { writeHistory(localStorage, history); } catch {}
	}
	onMount(() => {
		syncHistory();
		const timer = setInterval(syncHistory, 60000);
		const changed = (event: StorageEvent) => { if (event.key === HISTORY_KEY || event.key === null) syncHistory(); };
		window.addEventListener('storage', changed);
		document.addEventListener('visibilitychange', syncHistory);
		return () => {
			clearInterval(timer);
			window.removeEventListener('storage', changed);
			document.removeEventListener('visibilitychange', syncHistory);
		};
	});
	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		await openTracking(trackingNumber);
	}
	async function openTracking(input: string) {
		if (submitting) return;
		const number = input.trim().toUpperCase();
		if (!/^[A-Z0-9]{1,64}$/.test(number)) return;
		trackingNumber = input;
		submitting = true;
		error = '';
		try {
			await goto(resolve('/(public)/[trackingNumber]', { trackingNumber: number }));
			try { history = rememberTracking(localStorage, number); } catch {}
		}
		catch { error = 'Не вдалося відкрити відправлення. Спробуйте ще раз.'; }
		finally { submitting = false; }
	}
</script>

<svelte:head>
	<title>Rahunok Delivery — Відстеження відправлень</title>
	<meta name="description" content="Rahunok Delivery — відстеження та підготовка відправлень." />
</svelte:head>
<div class="tracking-page">
	<TrackingHeader />
	<main class="tracking-main">
		<section class="search-workspace" aria-labelledby="tracking-title">
			<div class="section-overline"><span class="signal-dot"></span> ВІДСТЕЖЕННЯ ВІДПРАВЛЕНЬ</div>
			<h1 id="tracking-title">Ваша посилка.<br /><span>Усе під контролем.</span></h1>
			<form class="tracking-form" onsubmit={handleSubmit} aria-busy={submitting}>
				<label for="tracking-number">Номер накладної</label>
				<div class="search-field tracking-query" class:query-pending={submitting}><Search size={23} strokeWidth={1.7} />
					<input id="tracking-number" name="tracking" bind:value={trackingNumber} placeholder="Номер відправлення" maxlength={64} pattern={'[A-Za-z0-9]{1,64}'} required autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="tracking-disclosure" />
					{#if trackingNumber}<button type="button" class="icon-button clear-search" title="Очистити номер" aria-label="Очистити номер" onclick={() => trackingNumber = ''}><X size={18} /></button>{/if}
					<button type="submit" class="search-submit" disabled={!trackingNumber.trim() || submitting}><span>{submitting ? 'Відкриваємо' : 'Відстежити'}</span><ArrowRight size={19} /></button>
				</div>
				<p id="tracking-disclosure" class="search-disclosure">Статус доставки від перевізника.</p>
				{#if error}<p role="alert" class="form-error">{error}</p>{/if}
			</form>
			{#if history.length}
				<section class="recent-tracking" aria-labelledby="recent-tracking-title">
					<h2 id="recent-tracking-title"><History size={16} /> Попередні пошуки</h2>
					<ul>
						{#each history as entry (entry.number)}
							<li>
								<button type="button" class="history-open" disabled={submitting} onclick={() => openTracking(entry.number)}><span>{entry.number}</span><ArrowUpRight size={16} /></button>
								<button type="button" class="history-remove" title={`Видалити ${entry.number}`} aria-label={`Видалити ${entry.number}`} onclick={() => removeHistory(entry.number)}><Trash2 size={16} /></button>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
			<div class="carrier-strip"><span><i class="carrier-dot red"></i>Нова пошта</span><span><i class="carrier-dot yellow"></i>Укрпошта</span></div>
		</section>
		<a class="business-entry" href={resolve('/(business)/business')}><span class="entry-index">01 /</span><div><h2>Усі відправлення бізнесу</h2><span>Робочий простір</span></div><span class="entry-arrow"><ArrowUpRight size={23} /></span></a>
	</main>
	<footer class="tracking-footer"><span>Rahunok Delivery</span><a href={resolve('/login')}>Увійти <ArrowUpRight size={13} /></a></footer>
</div>

<style>
	.recent-tracking { margin-top: 24px; }
	.recent-tracking h2 { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--color-text-secondary); }
	.recent-tracking ul { list-style: none; padding: 0; margin: 10px 0 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 20px; }
	.recent-tracking li { display: flex; min-width: 0; border-bottom: 1px solid var(--color-border-default); }
	.history-open { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex: 1; min-width: 0; padding: 12px 0; background: transparent; border: 0; cursor: pointer; text-align: left; font: inherit; font-size: 13px; }
	.history-open span { min-width: 0; overflow-wrap: anywhere; }
	.history-open :global(svg) { flex-shrink: 0; }
	.history-remove { display: grid; place-items: center; width: 40px; flex-shrink: 0; background: transparent; border: 0; cursor: pointer; color: var(--color-text-secondary); }
	.history-open:hover, .history-remove:hover { color: var(--color-brand-600, #167454); }
	@media (max-width: 600px) { .recent-tracking ul { grid-template-columns: minmax(0, 1fr); } }
</style>