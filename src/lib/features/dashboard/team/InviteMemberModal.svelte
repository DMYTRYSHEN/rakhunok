<script lang="ts">
	import { Building2, Check, Copy, Mail, ShieldAlert, Store, UserRoundPlus, X } from '@lucide/svelte';
	import type { PosTerminal, TeamRole, CreateInvitationInput } from '../types';

	let {
		terminals = [],
		onClose,
		onInvite
	}: {
		terminals: PosTerminal[];
		onClose: () => void;
		onInvite: (input: CreateInvitationInput) => Promise<{ token: string }>;
	} = $props();

	let email = $state('');
	let role = $state<TeamRole>('cashier');
	let terminalId = $state<string>('');
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);
	let createdInviteLink = $state<string | null>(null);
	let copiedLink = $state(false);

	const rolesConfig: { id: TeamRole; title: string; desc: string; icon: any }[] = [
		{
			id: 'manager',
			title: 'Менеджер / Статисник',
			desc: 'Бачить усі рахунки, аналітику, виписки та структуру бізнесу',
			icon: Building2
		},
		{
			id: 'cashier',
			title: 'Касир',
			desc: 'Виставляє рахунки, приймає оплати на призначеній касі / терміналі',
			icon: Store
		},
		{
			id: 'kso',
			title: 'Каса самообслуговування (КСО)',
			desc: 'Автономний термінал: генерує QR-коди для самостійної оплати клієнтами',
			icon: Store
		}
	];

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!email.trim() || isSubmitting) return;

		isSubmitting = true;
		errorMessage = null;

		try {
			const res = await onInvite({
				email: email.trim(),
				role,
				terminalId: role === 'cashier' || role === 'kso' ? terminalId || null : null
			});
			const origin = typeof window !== 'undefined' ? window.location.origin : '';
			createdInviteLink = `${origin}/invite/${res.token}`;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Не вдалося надіслати запрошення.';
		} finally {
			isSubmitting = false;
		}
	}

	async function copyLink() {
		if (!createdInviteLink) return;
		await navigator.clipboard.writeText(createdInviteLink);
		copiedLink = true;
		setTimeout(() => (copiedLink = false), 2000);
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
	<div class="relative w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
		<button
			type="button"
			onclick={onClose}
			class="absolute top-5 right-5 grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
		>
			<X size={18} />
		</button>

		<div class="flex items-center gap-3">
			<div class="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
				<UserRoundPlus size={20} />
			</div>
			<div>
				<h2 class="text-lg font-bold text-zinc-900">Запросити співробітника</h2>
				<p class="text-xs text-zinc-500">Надання доступу з визначеною роллю та правами в системі</p>
			</div>
		</div>

		{#if createdInviteLink}
			<div class="mt-6 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
				<div class="flex items-center gap-2 text-emerald-800 font-bold text-sm">
					<Check size={18} />
					<span>Запрошення успішно створено!</span>
				</div>
				<p class="text-xs text-emerald-700">
					Поділіться цим одноразовим посиланням із співробітником. Воно діє 7 днів:
				</p>
				<div class="flex items-center gap-2">
					<input
						type="text"
						readonly
						value={createdInviteLink}
						class="w-full rounded-lg border border-emerald-300 bg-white p-2.5 font-mono text-xs text-zinc-900 focus:outline-none"
					/>
					<button
						type="button"
						onclick={copyLink}
						class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
					>
						{#if copiedLink}
							<Check size={14} /> Скопійовано
						{:else}
							<Copy size={14} /> Копіювати
						{/if}
					</button>
				</div>
				<div class="pt-2 text-right">
					<button
						type="button"
						onclick={onClose}
						class="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-800"
					>
						Готово
					</button>
				</div>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="mt-6 space-y-4">
				{#if errorMessage}
					<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
						{errorMessage}
					</div>
				{/if}

				<!-- Email -->
				<div>
					<label for="invite-email" class="block text-xs font-bold text-zinc-700">
						Електронна пошта співробітника:
					</label>
					<div class="relative mt-1.5">
						<Mail size={16} class="absolute top-3 left-3 text-zinc-400" />
						<input
							id="invite-email"
							type="email"
							required
							bind:value={email}
							placeholder="colleague@example.com"
							class="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none"
						/>
					</div>
				</div>

				<!-- Role Selection -->
				<div>
					<span class="block text-xs font-bold text-zinc-700 mb-2">Оберіть роль та рівень доступу:</span>
					<div class="space-y-2">
						{#each rolesConfig as r (r.id)}
							<label
								class="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition {role === r.id
									? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-500'
									: 'border-zinc-200 hover:bg-zinc-50'}"
							>
								<input
									type="radio"
									name="role"
									value={r.id}
									bind:group={role}
									class="mt-1 size-4 text-blue-600 focus:ring-blue-500"
								/>
								<div class="min-w-0">
									<p class="text-xs font-bold text-zinc-900">{r.title}</p>
									<p class="mt-0.5 text-[11px] text-zinc-500">{r.desc}</p>
								</div>
							</label>
						{/each}
					</div>
				</div>

				<!-- Terminal assignment if cashier or KSO -->
				{#if role === 'cashier' || role === 'kso'}
					<div class="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
						<label for="invite-terminal" class="block text-xs font-bold text-zinc-700">
							Прив'язка до каси / робочого місця:
						</label>
						<select
							id="invite-terminal"
							bind:value={terminalId}
							class="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white p-2 text-xs font-medium text-zinc-900 focus:border-blue-500 focus:outline-none"
						>
							<option value="">Не призначати конкретний термінал</option>
							{#each terminals as t (t.id)}
								<option value={t.id}>{t.name} ({t.code}) · {t.type}</option>
							{/each}
						</select>
						<p class="mt-1 text-[11px] text-zinc-500">
							Касир бачитиме рахунки лише свого робочого місця та зможе приймати оплати.
						</p>
					</div>
				{/if}

				<div class="mt-6 flex items-center justify-end gap-3 border-t border-zinc-100 pt-4">
					<button
						type="button"
						onclick={onClose}
						class="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50"
					>
						Скасувати
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
					>
						{isSubmitting ? 'Створення…' : 'Створити запрошення'}
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>
