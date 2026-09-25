<script lang="ts">
	import { tick, onMount } from 'svelte';
	import { ArrowLeft, ArrowRight, X } from '@lucide/svelte';
	let { onclose }: { onclose: () => void } = $props();
	let dialog: HTMLDialogElement;
	let step = $state(0);
	let name = $state('');
	let email = $state('');
	let business = $state('');
	let website = $state('');
	let task = $state('');
	let timeline = $state('');
	let ready = $state(false);
	const titles = ['Розкажіть про себе', 'Чим займається ваша справа?', 'Яке завдання вирішуємо?', 'Перевірте звернення'];
	const draft = $derived(`Вітаю!\n\nМене звати ${name}.\nКонтакт: ${email}\nБізнес: ${business}\nСайт або сторінка: ${website || 'не вказано'}\nЗавдання: ${task}\nБажані терміни: ${timeline || 'не вказано'}\n\nНадіслано з форми Rahunok Promo.`);
	const mailto = $derived(`mailto:rahunok@rahunok.com?subject=${encodeURIComponent(`Обговорити проєкт: ${business}`)}&body=${encodeURIComponent(draft)}`);

	onMount(() => {
		dialog.showModal();
		return () => dialog.close();
	});

	async function next() {
		step += 1;
		await tick();
		dialog.querySelector<HTMLElement>('h2')?.focus();
	}
</script>

<dialog bind:this={dialog} class="promo-wizard" onclose={onclose} onclick={(event) => { if (event.target === dialog) dialog.close(); }}>
	<div class="promo-wizard-body">
		<div class="promo-wizard-top"><span>RAHUNOK / ПРОЄКТ</span><button type="button" aria-label="Закрити форму" title="Закрити" onclick={() => dialog.close()}><X size={21} /></button></div>
		<div class="promo-wizard-progress" aria-label={`Крок ${step + 1} з 4`}>{#each titles as title, index (title)}<span class:current={index === step} class:done={index < step}></span>{/each}</div>
		<p class="promo-kicker">КРОК {step + 1} / 4</p>
		<h2 tabindex="-1">{titles[step]}</h2>
		{#if step < 3}
			<form onsubmit={(event) => { event.preventDefault(); void next(); }}>
				{#if step === 0}
					<label>Ваше ім’я<input bind:value={name} autocomplete="name" required minlength="2" maxlength="100" placeholder="Як до вас звертатися" /></label>
					<label>Електронна пошта<input bind:value={email} type="email" autocomplete="email" required maxlength="200" placeholder="name@company.com" /></label>
				{:else if step === 1}
					<label>Назва та сфера бізнесу<textarea bind:value={business} required minlength="5" maxlength="500" rows="3" placeholder="Що ви робите і для кого" ></textarea></label>
					<label>Сайт або сторінка (необов’язково)<input bind:value={website} type="text" maxlength="200" placeholder="Посилання на ваш проєкт" /></label>
				{:else}
					<label>Опишіть завдання<textarea bind:value={task} required minlength="10" maxlength="2000" rows="5" placeholder="Який процес хочете налагодити, що зараз не працює" ></textarea></label>
					<label>Бажані терміни (необов’язково)<input bind:value={timeline} maxlength="150" placeholder="Коли плануєте запуск" /></label>
				{/if}
				<div class="promo-wizard-actions">{#if step > 0}<button class="promo-wizard-back" type="button" onclick={() => (step -= 1)}><ArrowLeft size={18} /> Назад</button>{/if}<button class="promo-button promo-button-accent" type="submit">Далі <ArrowRight size={18} /></button></div>
			</form>
		{:else}
			<div class="promo-wizard-review"><p><strong>Контакт</strong><span>{name} · {email}</span></p><p><strong>Бізнес</strong><span>{business}</span></p><p><strong>Завдання</strong><span>{task}</span></p></div>
			<p class="promo-wizard-note">Наступна кнопка відкриє ваш поштовий застосунок із готовим листом. Звернення буде надіслано лише після вашого підтвердження у пошті.</p>
			{#if ready}<p class="promo-wizard-note" role="status">Чернетку відкрито. Якщо поштовий застосунок не запустився, скористайтеся копіюванням нижче.</p>{/if}
			<div class="promo-wizard-actions"><button class="promo-wizard-back" type="button" onclick={() => (step = 2)}><ArrowLeft size={18} /> Назад</button><button class="promo-wizard-back" type="button" onclick={() => { void navigator.clipboard.writeText(draft); }}>Копіювати текст</button><a class="promo-button promo-button-accent" rel="external" href={mailto} onclick={() => (ready = true)}>Відкрити лист <ArrowRight size={18} /></a></div>
		{/if}
	</div>
</dialog>