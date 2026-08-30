<script lang="ts">
	import { tick } from 'svelte';
	import { CheckCircle2, Sparkles, X } from '@lucide/svelte';
	import type { Translations } from '../data/translations';

	let { open = $bindable(false), t }: { open: boolean; t: Translations } = $props();
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
			<button class="modal-close" type="button" aria-label="Закрити" onclick={close}>
				<X size={18} />
			</button>

			{#if submitted}
				<div class="modal-success">
					<b>✓</b>
					<h2 id="signup-title">{t.modal.successTitle}</h2>
					<p>
						{t.modal.demoNotice}
					</p>
					<button class="button button-primary full" type="button" onclick={close}>
						{t.modal.closeBtn}
					</button>
				</div>
			{:else}
				<p class="eyebrow" style="margin-bottom: 12px;">
					<span>{t.modal.badge}</span>
				</p>
				<h2 id="signup-title">{t.modal.title}</h2>
				<p>
					{t.modal.desc}
				</p>
				<p>{t.modal.demoNotice}</p>

				<form
					onsubmit={(event) => {
						event.preventDefault();
						submitted = true;
					}}
				>
					<label>
						{t.modal.nameLabel}
						<input
							bind:this={nameInput}
							name="name"
							autocomplete="name"
							placeholder="Олександр"
							required
						/>
					</label>

					<label>
						{t.modal.phoneLabel}
						<input name="phone" autocomplete="tel" placeholder="+380... / email" required />
					</label>

					<label>
						{t.modal.businessLabel}
						<input name="business" placeholder="Coffee shop / Brand / Store" required />
					</label>

					<button class="button button-primary full" type="submit" style="margin-top: 12px;">
						{t.modal.submitBtn}
					</button>
				</form>
			{/if}
		</div>
	</div>
{/if}
