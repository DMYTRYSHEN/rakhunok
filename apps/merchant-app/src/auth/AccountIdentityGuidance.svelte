<script lang="ts">
	import type { User } from '@supabase/supabase-js';
	import { tick, untrack } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import Link2 from '@lucide/svelte/icons/link-2';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import X from '@lucide/svelte/icons/x';
	import { TELEGRAM_PROVIDER } from './telegram-session';

	let { context = 'guest', user }: {
		context?: 'guest' | 'profile' | 'onboarding';
		user?: Pick<User, 'identities'> & Partial<Pick<User, 'id'>>;
	} = $props();
	const id = $props.id();
	const hasGoogle = $derived(user?.identities?.some((identity) => identity.provider === 'google') ?? false);
	const hasTelegram = $derived(user?.identities?.some((identity) => identity.provider === TELEGRAM_PROVIDER) ?? false);
	const linked = $derived(context !== 'guest' && hasGoogle && hasTelegram);
	// Identity replacement matters even when the provider names remain the same.
	const scope = $derived(JSON.stringify([context, user?.id, user?.identities?.map((identity) =>
		[identity.provider, identity.identity_id, identity.id]).sort()]));
	const options = [
		{ value: 'new', mark: '+', title: 'Я тут уперше', detail: 'Ще немає акаунта й бізнесу' },
		{ value: 'google', mark: 'G', title: 'Починав із Google', detail: 'Бізнес у Google-акаунті' },
		{ value: 'telegram', mark: 'T', title: 'Починав із Telegram', detail: 'Бізнес у Telegram-акаунті' },
		{ value: 'separate', mark: '2', title: 'Уже є два акаунти', detail: 'Google і Telegram окремо' }
	] as const;
	type Choice = typeof options[number]['value'];
	let choice = $state<Choice | null>(null);
	let step = $state(0);
	let dialog: HTMLDialogElement;
	let heading: HTMLHeadingElement;
	let content: HTMLDivElement;
	let opener: HTMLButtonElement;
	let openedScope: string | null = null;
	let releaseScroll: (() => void) | undefined;
	let backdropPointer: number | null = null;
	const title = $derived(linked ? 'Два входи. Один профіль.' : step === 0 ? 'З чого почнемо?' : step === 1 ?
		(choice === 'new' ? 'Почніть із Google' : choice === 'google' ? 'Спочатку той самий Google' : choice === 'telegram' ? 'Залишайтеся з Telegram' : 'Поверніться до свого бізнесу') : 'Ваш безпечний наступний крок');

	function reset() { step = 0; choice = null; openedScope = null; backdropPointer = null; }
	function close() {
		dialog?.close();
		releaseScroll?.();
		releaseScroll = undefined;
		reset();
	}
	function afterClose() {
		// Ignore a queued close event if the user has already reopened the sheet.
		// bind:this is cleared before a queued native close event on unmount.
		if (!dialog || dialog.open) return;
		close();
		if (opener?.isConnected) opener.focus({ preventScroll: true });
	}
	function open() {
		if (dialog.open) return;
		reset();
		openedScope = scope;
		dialog.showModal();
		const root = document.documentElement;
		const overflow = root.style.getPropertyValue('overflow');
		const priority = root.style.getPropertyPriority('overflow');
		root.style.setProperty('overflow', 'hidden');
		releaseScroll = () => {
			if (overflow) root.style.setProperty('overflow', overflow, priority);
			else root.style.removeProperty('overflow');
		};
		content.scrollTop = 0;
		heading.focus({ preventScroll: true });
	}
	async function move(next: number) {
		step = next;
		await tick();
		if (!dialog?.open) return;
		content.scrollTop = 0;
		heading.focus({ preventScroll: true });
	}
	$effect(() => {
		const current = scope;
		untrack(() => { if (openedScope !== null && openedScope !== current) close(); });
	});
	function modalLifecycle(node: HTMLDialogElement) {
		return () => { if (node.open) node.close(); releaseScroll?.(); releaseScroll = undefined; };
	}
	function outside(event: MouseEvent | PointerEvent) {
		if (event.target !== dialog) return false;
		const rect = dialog.getBoundingClientRect();
		return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
	}
	function backdropRelease(event: PointerEvent) {
		const dismiss = backdropPointer === event.pointerId && outside(event);
		backdropPointer = null;
		if (dismiss) close();
	}
	function trapFocus(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;
		const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input'))
			.filter((element) => !(element instanceof HTMLInputElement) || element.checked || !choice && element.value === options[0].value);
		const first = controls[0];
		const last = controls[controls.length - 1];
		if (event.shiftKey && (document.activeElement === first || document.activeElement === heading)) {
			event.preventDefault(); last?.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault(); first?.focus();
		}
	}
</script>

<section class="identity-guidance" aria-label="Google і Telegram: один профіль">
	<div class="identity-heading"><ShieldCheck size={18} aria-hidden="true" /><h2>Один бізнес — один профіль</h2></div>
	{#if context === 'guest'}
		<p class="identity-warning">Окремі входи можуть створити окремі акаунти. Якщо бізнес уже є, користуйтеся початковим способом входу.</p>
	{/if}
	{#if context !== 'guest'}
		<p class="identity-status" role="status">
			{#if linked}У цьому профілі підтверджено Google і Telegram — два входи у той самий профіль.
			{:else if hasTelegram}У цьому профілі є Telegram; Google не підтверджено. Додавання Google до Telegram-профілю ще недоступне.
			{:else if hasGoogle}У цьому профілі є Google; Telegram ще не прив’язано.
			{:else}Google і Telegram у цьому профілі не підтверджено. Користуйтеся початковим способом входу.{/if}
		</p>
	{/if}
	{#if context === 'onboarding'}
		<p class="identity-caution"><strong>Бізнес уже існує?</strong> Увійдіть початковим способом у той самий акаунт. Відсутність бізнесу тут не означає, що потрібно створювати його знову.</p>
	{/if}
	<button bind:this={opener} class="identity-open" type="button" aria-haspopup="dialog" aria-controls={`${id}-sheet`} onclick={open}>
		Як зберегти один профіль <ArrowRight size={17} aria-hidden="true" />
	</button>
</section>

<dialog bind:this={dialog} {@attach modalLifecycle} id={`${id}-sheet`} class="identity-sheet" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
	onclose={afterClose} oncancel={(event) => { event.preventDefault(); close(); }}
	onpointerdown={(event) => { backdropPointer = event.isPrimary && event.button === 0 && outside(event) ? event.pointerId : null; }}
	onpointerup={backdropRelease} onpointercancel={() => { backdropPointer = null; }} onkeydown={trapFocus}>
	<div class="identity-frame">
		<header class="wizard-header">
			<span class="wizard-handle" aria-hidden="true"></span>
			<span class="wizard-label"><Link2 size={16} aria-hidden="true" /> Один профіль</span>
			<button class="wizard-close" type="button" aria-label="Закрити підказку" onclick={close}><X size={20} aria-hidden="true" /></button>
		</header>
		<div class="wizard-content" bind:this={content}>
			{#if !linked}
				<div class="wizard-progress" role="progressbar" aria-label="Крок підказки" aria-valuemin="1" aria-valuemax="3" aria-valuenow={step + 1} aria-valuetext={`Крок ${step + 1} з 3`}>
					{#each [0, 1, 2] as index (index)}<span class:complete={index <= step}></span>{/each}
				</div>
				<p class="wizard-kicker">Крок {step + 1} з 3 · {step === 0 ? 'Ваш спосіб входу' : step === 1 ? 'Що робити' : 'Підсумок'}</p>
			{:else}<div class="wizard-success" aria-hidden="true"><Check size={30} /></div>{/if}
			<h2 bind:this={heading} id={`${id}-title`} tabindex="-1">{title}</h2>
			<p id={`${id}-description`} class="wizard-description">{linked ? 'Google і Telegram підтверджено в поточному профілі.' : 'Це лише підказка. Вона не запускає вхід і не змінює акаунти.'}</p>
			{#if linked}
				<div class="wizard-note">Можна входити через будь-який із цих двох прив’язаних акаунтів у той самий профіль і бізнес. Інші Google- чи Telegram-акаунти не стають його частиною автоматично.</div>
			{:else if step === 0}
				<fieldset>
					<legend>Оберіть свою ситуацію</legend>
					{#each options as option (option.value)}
						<label class="wizard-option" class:selected={choice === option.value}>
							<input type="radio" name={`${id}-provider`} value={option.value} bind:group={choice} />
							<span class="provider-mark" aria-hidden="true">{option.mark}</span>
							<span class="option-copy"><strong>{option.title}</strong><small>{option.detail}</small></span>
						</label>
					{/each}
				</fieldset>
				<p class="wizard-footnote">Уже є акаунт? Оберіть початковий спосіб входу, навіть якщо бізнес ще не створено.</p>
			{:else if step === 1}
				{#if choice === 'new'}
					<ol class="wizard-instructions">
						<li><strong>Для першого входу рекомендуємо Google</strong><p>Закрийте підказку й скористайтеся доступною кнопкою Google на екрані входу. Ця підказка не реєструє вас.</p></li>
						<li><strong>Створіть бізнес лише один раз</strong><p>Після входу перевірте акаунт. Якщо бізнесу ще немає, налаштуйте його в особистому кабінеті.</p></li>
						<li><strong>Telegram можна додати пізніше</strong><p>У App → Профіль скористайтеся прив’язуванням, якщо воно доступне. Дочекайтеся підтвердження обох способів входу.</p></li>
					</ol>
					<div class="wizard-note">Уже входили через Telegram? Поверніться назад і виберіть Telegram. Окремий вхід через Google не об’єднає акаунти.</div>
				{:else if choice === 'google'}
					<ol class="wizard-instructions">
						<li><strong>Увійдіть у свій бізнес</strong><p>Використайте той самий Google-акаунт, з яким створювали бізнес.</p></li>
						<li><strong>Відкрийте App → Профіль</strong><p>Не виходячи з акаунта, натисніть «Прив’язати Telegram до цього акаунта», якщо кнопка доступна.</p></li>
						<li><strong>Дочекайтеся підтвердження</strong><p>Лише після підтвердження Google і Telegram у профілі обидва прив’язані способи ведуть у той самий акаунт і бізнес.</p></li>
					</ol>
					<div class="wizard-note">Немає кнопки або прив’язування не вдалося? Продовжуйте входити через Google. Окремий вхід через Telegram не замінює прив’язування.</div>
				{:else if choice === 'telegram'}
					<div class="wizard-note"><strong>Додавання Google до Telegram-профілю ще недоступне.</strong><p>Зберігайте початковий спосіб входу — Telegram. Не входьте окремо через Google для «об’єднання»: це може створити інший акаунт.</p></div>
				{:else}
					<div class="wizard-note"><strong>Окремі акаунти не об’єднуються автоматично.</strong><p>Поверніться до акаунта, де вже є ваш бізнес, початковим способом входу. Не видаляйте акаунти чи бізнес, щоб спробувати їх об’єднати.</p><p>Прив’язування Telegram у профілі не переносить бізнес з іншого акаунта. Якщо Telegram уже зайнятий іншим акаунтом, залишайтеся з початковим входом.</p></div>
				{/if}
			{:else}
				<div class="wizard-summary"><ShieldCheck size={25} aria-hidden="true" /><div><strong>{choice === 'new' ? 'Google спочатку. Telegram — після прив’язування.' : choice === 'google' ? 'Google → Профіль → прив’язування' : choice === 'telegram' ? 'Ваш вхід залишається через Telegram' : 'Збережіть акаунт із вашим бізнесом'}</strong>
					<p>{choice === 'new' ? 'Якщо акаунта ще немає, рекомендуємо перший вхід через Google. Тут нічого не створено — наступну дію ви обираєте самостійно після закриття підказки.' : choice === 'google' ? 'Залишайтеся у своєму Google-акаунті. Telegram використовуйте для входу лише після успішного прив’язування в профілі.' : choice === 'telegram' ? 'Не використовуйте окремий вхід через Google як спосіб додати його до профілю.' : 'Повторний вхід не об’єднає два акаунти. Не видаляйте їх і не створюйте бізнес повторно.'}</p>
				</div></div>
				<p class="wizard-footnote">Кнопка «Зрозуміло» лише закриє цю підказку.</p>
			{/if}
		</div>
		<footer class="wizard-footer">
			{#if !linked && step > 0}<button class="wizard-back" type="button" onclick={() => void move(step - 1)}><ArrowLeft size={18} aria-hidden="true" /> Назад</button>{/if}
			{#if linked || step === 2}<button class="wizard-next" type="button" onclick={close}>Зрозуміло <Check size={18} aria-hidden="true" /></button>
			{:else}<button class="wizard-next" type="button" disabled={step === 0 && !choice} onclick={() => void move(step + 1)}>Далі <ArrowRight size={18} aria-hidden="true" /></button>{/if}
		</footer>
	</div>
</dialog>

<style>
	.identity-guidance, .identity-sheet {
		--sheet-line: var(--line, #ffffff24);
		--sheet-surface: var(--surface, #222222);
		--sheet-ink: var(--ink, #f5f5f7);
		--sheet-key: var(--key, #ffffff0f);
		--sheet-brand: var(--brand, #0a84ff);
		box-sizing: border-box;
		font-family: inherit;
	}
	.identity-guidance :global(*), .identity-sheet :global(*) { box-sizing: border-box; }
	.identity-guidance { width: 100%; min-width: 0; padding: 14px 16px 4px; border: 1px solid var(--line, #ffffff24); border-radius: 18px; background: var(--panel, #28282d); color: var(--ink, #fff); text-align: left; overflow-wrap: anywhere; }
	.identity-heading { display: flex; align-items: center; gap: 8px; }
	.identity-guidance h2 { margin: 0; font-size: 14px; line-height: 1.4; }
	.identity-guidance p { margin: 8px 0; color: inherit; font-size: 12px; line-height: 1.6; }
	.identity-guidance strong { font-size: inherit; }
	.identity-status { padding-top: 8px; border-top: 1px solid var(--sheet-line); }
	.identity-guidance .identity-caution { padding: 10px; border-left: 3px solid #d99a26; border-radius: 6px; background: #d99a2614; }
	.identity-guidance .identity-open { display: flex; width: 100%; min-height: 46px; align-items: center; justify-content: space-between; gap: 8px; margin: 0; padding: 8px 0; border: 0; background: none; color: inherit; text-align: left; font-size: 13px; font-weight: 700; cursor: pointer; }
	.identity-sheet { position: fixed; inset: auto 0 0; width: min(100%, 480px); max-width: 100%; max-height: none; margin: 0 auto; padding: 0; overflow: visible; border: 1px solid var(--line, #ffffff24); border-bottom: 0; border-radius: 28px 28px 0 0; background: var(--surface, #222); color: var(--ink, #fff); text-align: left; box-shadow: 0 -12px 80px #0004; }
	.identity-sheet::backdrop { background: #080d18a8; backdrop-filter: blur(7px); }
	.identity-sheet[open] { animation: sheet-enter 220ms cubic-bezier(.2,.8,.2,1); }
	.identity-frame { display: flex; flex-direction: column; max-height: calc(100vh - 16px); max-height: calc(100dvh - max(16px, env(safe-area-inset-top, 0px))); overflow: hidden; border-radius: inherit; }
	.wizard-header { position: relative; display: flex; flex: none; align-items: center; justify-content: space-between; padding: 24px 20px 8px; }
	.wizard-handle { position: absolute; top: 9px; left: calc(50% - 18px); width: 36px; height: 4px; border-radius: 10px; background: var(--sheet-ink); opacity: .22; }
	.wizard-label { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 650; }
	.identity-sheet button { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: auto; min-height: 48px; margin: 0; padding: 12px 16px; border: 1px solid var(--sheet-line); border-radius: 16px; background: transparent; color: inherit; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
	.identity-sheet .wizard-close { width: 44px; min-height: 44px; padding: 0; border-radius: 50%; background: var(--sheet-key); }
	.wizard-content { min-height: 0; padding: 12px 24px 24px; overflow-y: auto; overscroll-behavior: contain; overflow-wrap: anywhere; scroll-padding-block: 12px; }
	.wizard-progress { display: flex; gap: 6px; }
	.wizard-progress span { flex: 1; height: 4px; border-radius: 6px; background: var(--sheet-line); }
	.wizard-progress .complete { background: var(--brand, #0a84ff); }
	.identity-sheet p { margin: 0; color: inherit; font-size: 14px; line-height: 1.65; }
	.identity-sheet .wizard-kicker { margin: 20px 0 10px; font-size: 12px; }
	.identity-sheet h2 { margin: 0 0 12px; max-width: 340px; font-size: clamp(25px, 7vw, 32px); font-weight: 750; line-height: 1.15; letter-spacing: -.6px; }
	.identity-sheet .wizard-description { margin-bottom: 24px; font-size: 13px; }
	.identity-sheet strong { font-size: 14px; line-height: 1.5; }
	/* Keep native fieldset/legend out of grid sizing (notably on small Safari screens). */
	fieldset { display: block; width: 100%; min-width: 0; margin: 0; padding: 0; border: 0; }
	legend { display: block; float: none; width: 100%; max-width: 100%; margin: 0 0 12px; padding: 0; font-size: 13px; font-weight: 650; line-height: 1.5; writing-mode: horizontal-tb; overflow-wrap: normal; word-break: normal; }
	.wizard-option + .wizard-option { margin-top: 10px; }
	.wizard-option { display: flex; align-items: center; gap: 12px; padding: 14px 12px; border: 1px solid var(--sheet-line); border-radius: 18px; background: var(--sheet-key); cursor: pointer; transition: border-color 140ms, background-color 140ms; }
	.wizard-option.selected { border-color: var(--sheet-brand); background: color-mix(in srgb, var(--sheet-brand) 12%, var(--sheet-surface)); }
	.wizard-option input { order: 3; flex: none; width: 18px; height: 18px; margin: 0 0 0 auto; accent-color: var(--sheet-brand); }
	.provider-mark { display: grid; flex: none; width: 36px; height: 36px; place-items: center; border: 1px solid var(--sheet-line); border-radius: 12px; font-size: 16px; font-weight: 750; }
	.option-copy { display: grid; min-width: 0; gap: 3px; }
	.option-copy small { font-size: 12px; line-height: 1.4; }
	.identity-sheet .wizard-footnote { margin-top: 16px; font-size: 12px; }
	.wizard-instructions { display: grid; gap: 20px; margin: 0 0 24px; padding-left: 24px; }
	.wizard-instructions li { padding-left: 6px; }
	.wizard-instructions li::marker { color: var(--sheet-brand); font-weight: 750; }
	.wizard-instructions p, .wizard-note p, .wizard-summary p { margin-top: 6px; }
	.wizard-note { padding: 18px; border: 1px solid var(--sheet-line); border-radius: 18px; background: var(--sheet-key); font-size: 14px; line-height: 1.65; }
	.wizard-summary { display: flex; align-items: flex-start; gap: 12px; padding: 20px 16px; border: 1px solid var(--sheet-line); border-radius: 20px; background: color-mix(in srgb, var(--sheet-brand) 8%, var(--sheet-surface)); }
	.wizard-summary :global(svg) { flex: none; }
	.wizard-success { display: grid; width: 64px; height: 64px; place-items: center; margin: 8px 0 24px; border-radius: 22px; background: var(--sheet-ink); color: var(--sheet-surface); }
	.wizard-footer { display: flex; flex: none; gap: 10px; padding: 16px 24px max(20px, env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--sheet-line); background: var(--sheet-surface); }
	.identity-sheet .wizard-next { flex: 1; border-color: transparent; background: var(--sheet-ink); color: var(--sheet-surface); }
	.identity-sheet button:disabled { opacity: .35; cursor: default; }
	.identity-sheet :focus-visible, .identity-open:focus-visible { outline: 3px solid var(--brand, #0a84ff); outline-offset: 3px; }
	.identity-sheet h2:focus { outline: none; }
	@keyframes sheet-enter { from { transform: translateY(24px); opacity: 0; } }
	@media (max-width: 350px) { .wizard-content { padding-inline: 16px; } .wizard-footer { padding-inline: 16px; } .wizard-option { gap: 9px; } }
	@media (min-width: 700px) { .identity-sheet { bottom: 20px; border-bottom: 1px solid var(--sheet-line); border-radius: 28px; } .identity-frame { max-height: calc(100dvh - 40px); } }
	@media (prefers-reduced-motion: reduce) { .identity-sheet[open] { animation: none; } .wizard-option { transition: none; } }
</style>