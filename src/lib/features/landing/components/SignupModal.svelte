<script lang="ts">
	import { tick } from 'svelte';
	let { open = $bindable(false) }: { open: boolean } = $props();
	let submitted = $state(false);
	let nameInput = $state<HTMLInputElement>();
	let previousFocus: HTMLElement | null = null;

	async function close() {
		open = false;
		document.body.classList.remove('modal-open');
		submitted = false;
		await tick();
		previousFocus?.focus();
	}

	$effect(() => {
		if (!open) return;
		previousFocus = document.activeElement as HTMLElement | null;
		document.body.classList.add('modal-open');
		tick().then(() => nameInput?.focus());
		return () => document.body.classList.remove('modal-open');
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && open) close();
	}}
/>
{#if open}
	<div class="modal" role="dialog" aria-modal="true" aria-labelledby="signup-title">
		<button class="backdrop" type="button" aria-label="Закрити форму" onclick={close}></button>
		<div class="modal-card">
			<button class="modal-close" type="button" aria-label="Закрити" onclick={close}>×</button>
			{#if submitted}
				<div class="modal-success">
					<b>✓</b>
					<h2>Заявку збережено</h2>
					<p>
						Демо-форма спрацювала. Production-відправлення буде підключене лише до погодженого
						backend.
					</p>
					<button class="button button-dark" type="button" onclick={close}>Готово</button>
				</div>
			{:else}
				<p class="eyebrow dark-text">Заявка на підключення</p>
				<h2 id="signup-title">Створіть першу касу</h2>
				<p>Розкажіть коротко про бізнес. Це демонстраційна форма без мережевого запиту.</p>
				<form
					onsubmit={(event) => {
						event.preventDefault();
						submitted = true;
					}}
				>
					<label>Ім’я<input bind:this={nameInput} name="name" autocomplete="name" required /></label
					>
					<label
						>Телефон або Telegram<input
							name="phone"
							autocomplete="tel"
							placeholder="+380..."
							required
						/></label
					>
					<label
						>Тип бізнесу<select name="business" required
							><option value="">Оберіть варіант</option><option>Кафе або ресторан</option><option
								>Магазин</option
							><option>Сфера послуг</option><option>Онлайн-бізнес</option><option>Мережа</option
							><option>Інше</option></select
						></label
					>
					<label class="consent"
						><input type="checkbox" required /><span
							>Погоджуюся на обробку контактних даних для відповіді на заявку.</span
						></label
					>
					<button class="button button-primary full" type="submit">Надіслати заявку</button>
				</form>
			{/if}
		</div>
	</div>
{/if}
