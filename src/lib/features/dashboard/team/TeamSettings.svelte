<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Building2,
		Check,
		Clock,
		Copy,
		KeyRound,
		LockKeyhole,
		Mail,
		MapPin,
		MoreVertical,
		RefreshCw,
		ShieldAlert,
		ShieldCheck,
		Store,
		Trash2,
		UserCheck,
		UserRoundPlus,
		UsersRound,
		X
	} from '@lucide/svelte';
	import type {
		CreateInvitationInput,
		DashboardMerchant,
		PosTerminal,
		TeamInvitation,
		TeamMember,
		TeamRole
	} from '../types';
	import type { DashboardGateway } from '../api/dashboard-gateway';
	import { demoTeamInvitations, demoTeamMembers } from '../data/team';
	import InviteMemberModal from './InviteMemberModal.svelte';

	let {
		gateway,
		merchantId,
		terminals = [],
		demo = false
	}: {
		gateway?: DashboardGateway;
		merchantId?: string;
		terminals?: PosTerminal[];
		demo?: boolean;
	} = $props();

	let members = $state<TeamMember[]>([...demoTeamMembers]);
	let invitations = $state<TeamInvitation[]>([...demoTeamInvitations]);
	let isLoading = $state(false);
	let isInviteModalOpen = $state(false);
	let copiedToken = $state<string | null>(null);
	let notification = $state<{ type: 'success' | 'error'; message: string } | null>(null);

	const rolesOverview = [
		{
			name: 'Власник',
			role: 'owner',
			detail: 'Повний доступ до бізнесу, банківських рахунків, виписок та налаштувань',
			icon: ShieldCheck,
			badgeClass: 'bg-purple-50 text-purple-800 border-purple-200'
		},
		{
			name: 'Менеджер / Статисник',
			role: 'manager',
			detail: 'Бачить усі рахунки, аналітику продажів, каси та звіти без права зміни реквізитів',
			icon: Building2,
			badgeClass: 'bg-blue-50 text-blue-800 border-blue-200'
		},
		{
			name: 'Касир',
			role: 'cashier',
			detail: 'Своя сесія, робота з призначеною касою, виставлення рахунків і прийом оплат',
			icon: Store,
			badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
		},
		{
			name: 'КСО (Самообслуговування)',
			role: 'kso',
			detail: 'Автономна каса самообслуговування: клієнт сканує QR-код та оплачує без касира',
			icon: Store,
			badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
		}
	];

	function showNotification(message: string, type: 'success' | 'error' = 'success') {
		notification = { message, type };
		setTimeout(() => {
			if (notification?.message === message) notification = null;
		}, 3500);
	}

	async function loadTeamData() {
		if (demo || !gateway || !merchantId) {
			members = [...demoTeamMembers];
			invitations = [...demoTeamInvitations];
			return;
		}

		isLoading = true;
		try {
			const [loadedMembers, loadedInvitations] = await Promise.all([
				gateway.listTeamMembers(merchantId),
				gateway.listTeamInvitations(merchantId)
			]);
			if (loadedMembers.length > 0) members = loadedMembers;
			invitations = loadedInvitations;
		} catch (err) {
			console.error('Failed to load team data:', err);
		} finally {
			isLoading = false;
		}
	}

	async function handleCreateInvitation(input: CreateInvitationInput) {
		if (demo || !gateway || !merchantId) {
			const randomToken = `inv_demo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
			const newInv: TeamInvitation = {
				id: `inv-demo-${Date.now()}`,
				merchantId: merchantId || 'demo-merchant',
				email: input.email,
				role: input.role,
				terminalId: input.terminalId || null,
				terminalName: terminals.find((t) => t.id === input.terminalId)?.name || null,
				token: randomToken,
				status: 'pending',
				invitedBy: 'demo-user',
				invitedByName: 'Ви (Власник)',
				createdAt: new Date().toISOString(),
				expiresAt: new Date(Date.now() + 7 * 86400000).toISOString()
			};
			invitations = [newInv, ...invitations];
			showNotification(`Запрошення для ${input.email} створено`);
			return { token: randomToken };
		}

		const created = await gateway.createTeamInvitation(merchantId, input);
		invitations = [created, ...invitations];
		showNotification(`Запрошення для ${input.email} успішно створено`);
		return { token: created.token };
	}

	async function handleRevokeInvitation(invitationId: string) {
		if (!confirm('Скасувати це запрошення? Співробітник не зможе за ним приєднатися.')) return;

		if (demo || !gateway || !merchantId) {
			invitations = invitations.filter((i) => i.id !== invitationId);
			showNotification('Запрошення скасовано');
			return;
		}

		try {
			await gateway.revokeTeamInvitation(merchantId, invitationId);
			invitations = invitations.filter((i) => i.id !== invitationId);
			showNotification('Запрошення скасовано');
		} catch (err) {
			showNotification('Помилка при скасуванні запрошення', 'error');
		}
	}

	async function handleResendInvitation(invitationId: string) {
		if (demo || !gateway || !merchantId) {
			const target = invitations.find((i) => i.id === invitationId);
			if (target) {
				target.expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
				target.status = 'pending';
			}
			showNotification('Запрошення продовжено на 7 днів');
			return;
		}

		try {
			await gateway.resendTeamInvitation(merchantId, invitationId);
			await loadTeamData();
			showNotification('Термін дії запрошення оновлено');
		} catch (err) {
			showNotification('Не вдалося оновити запрошення', 'error');
		}
	}

	async function handleRemoveMember(memberId: string) {
		const target = members.find((m) => m.id === memberId);
		if (target?.role === 'owner') {
			alert('Неможливо видалити власника бізнесу.');
			return;
		}

		if (!confirm(`Видалити співробітника ${target?.fullName || target?.email} з команди?`)) return;

		if (demo || !gateway || !merchantId) {
			members = members.filter((m) => m.id !== memberId);
			showNotification('Співробітника видалено з команди');
			return;
		}

		try {
			await gateway.removeTeamMember(merchantId, memberId);
			members = members.filter((m) => m.id !== memberId);
			showNotification('Співробітника видалено з команди');
		} catch (err) {
			showNotification('Помилка при видаленні співробітника', 'error');
		}
	}

	async function copyInviteLink(token: string) {
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		const link = `${origin}/invite/${token}`;
		await navigator.clipboard.writeText(link);
		copiedToken = token;
		setTimeout(() => {
			if (copiedToken === token) copiedToken = null;
		}, 2000);
	}

	onMount(() => {
		loadTeamData();
	});
</script>

<div class="mx-auto max-w-6xl space-y-7">
	{#if notification}
		<div
			class="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold shadow-xl transition-all {notification.type ===
			'success'
				? 'border border-emerald-500/30 bg-emerald-950 text-emerald-200'
				: 'border border-rose-500/30 bg-rose-950 text-rose-200'}"
		>
			<Check size={16} />
			<span>{notification.message}</span>
		</div>
	{/if}

	<header class="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.14em] text-blue-700 uppercase">Операційна модель</p>
			<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">Команда, касири та КСО</h1>
			<p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
				Керування доступами: менеджери мають доступ до аналітики та звітів, касири прив'язані до робочих місць,
				а КСО термінали працюють в автономному режимі самообслуговування.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={() => (isInviteModalOpen = true)}
				class="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-xs font-extrabold text-white shadow-sm hover:bg-blue-700 transition"
			>
				<UserRoundPlus size={16} />
				<span>Запросити співробітника</span>
			</button>
		</div>
	</header>

	<!-- Role Matrix Grid -->
	<section class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
		<div class="border-b border-zinc-200 p-5 sm:px-6">
			<div class="flex items-start gap-3">
				<span class="grid size-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
					<UsersRound size={20} />
				</span>
				<div>
					<h2 class="font-extrabold text-zinc-900">Ієрархія прав та ролей</h2>
					<p class="mt-0.5 text-xs text-zinc-500">
						Розподіл повноважень з контролем доступу на рівні Supabase RLS та аутентифікації.
					</p>
				</div>
			</div>
		</div>
		<div class="grid gap-3 p-5 sm:p-6 md:grid-cols-2 lg:grid-cols-4">
			{#each rolesOverview as r (r.role)}
				<article class="rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-300">
					<div class="flex items-center justify-between">
						<span class="grid size-9 place-items-center rounded-lg bg-zinc-100 text-zinc-700">
							<r.icon size={18} />
						</span>
						<span class="rounded border px-2 py-0.5 text-[10px] font-bold uppercase {r.badgeClass}">
							{r.role}
						</span>
					</div>
					<h3 class="mt-3 text-sm font-extrabold text-zinc-900">{r.name}</h3>
					<p class="mt-1 text-xs leading-5 text-zinc-500">{r.detail}</p>
				</article>
			{/each}
		</div>
	</section>

	<!-- Pending Invitations Section -->
	{#if invitations.length > 0}
		<section class="rounded-xl border border-amber-200/80 bg-amber-50/20 p-5 sm:p-6 shadow-sm">
			<div class="flex items-center justify-between gap-4">
				<div class="flex items-center gap-2.5">
					<Clock size={18} class="text-amber-700" />
					<h2 class="text-sm font-extrabold text-zinc-900">
						Очікують прийняття ({invitations.filter((i) => i.status === 'pending').length})
					</h2>
				</div>
				<span class="text-xs text-zinc-500">Діють 7 днів з моменту генерації</span>
			</div>

			<div class="mt-4 divide-y divide-zinc-200/70 overflow-hidden rounded-xl border border-zinc-200 bg-white">
				{#each invitations as inv (inv.id)}
					<div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<div class="flex items-center gap-2">
								<span class="font-bold text-sm text-zinc-900">{inv.email}</span>
								<span class="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-700">
									{inv.role}
								</span>
								{#if inv.terminalName}
									<span class="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
										{inv.terminalName}
									</span>
								{/if}
								{#if inv.status === 'expired'}
									<span class="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Прострочено</span>
								{/if}
							</div>
							<p class="mt-1 text-[11px] text-zinc-500">
								Запросив: {inv.invitedByName || 'Власник'} · Діє до: {new Date(inv.expiresAt).toLocaleDateString('uk-UA')}
							</p>
						</div>

						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => copyInviteLink(inv.token)}
								class="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
							>
								{#if copiedToken === inv.token}
									<Check size={13} class="text-emerald-600" />
									<span>Скопійовано</span>
								{:else}
									<Copy size={13} />
									<span>Копіювати лінк</span>
								{/if}
							</button>
							{#if inv.status === 'expired'}
								<button
									type="button"
									onclick={() => handleResendInvitation(inv.id)}
									class="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
								>
									<RefreshCw size={13} />
									<span>Продовжити</span>
								</button>
							{/if}
							<button
								type="button"
								onclick={() => handleRevokeInvitation(inv.id)}
								class="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
								title="Скасувати запрошення"
							>
								<Trash2 size={14} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Active Team Members Table -->
	<section class="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
		<div class="border-b border-zinc-200 p-5 sm:px-6">
			<div class="flex items-center justify-between">
				<div>
					<h2 class="text-base font-extrabold text-zinc-900">Учасники команди ({members.length})</h2>
					<p class="mt-0.5 text-xs text-zinc-500">
						Користувачі, які пройшли авторизацію та мають активні права в системі
					</p>
				</div>
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="w-full min-w-[40rem] text-left text-xs">
				<thead class="border-b border-zinc-200 bg-zinc-50 font-bold uppercase text-[10px] tracking-wider text-zinc-500">
					<tr>
						<th class="px-6 py-3.5">Користувач</th>
						<th class="px-4 py-3.5">Роль</th>
						<th class="px-4 py-3.5">Призначена каса / термінал</th>
						<th class="px-4 py-3.5">Активність</th>
						<th class="px-4 py-3.5">Статус</th>
						<th class="px-6 py-3.5 text-right"><span class="sr-only">Дії</span></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-zinc-200">
					{#each members as member (member.id)}
						<tr class="hover:bg-zinc-50/70 transition">
							<td class="px-6 py-4">
								<div class="flex items-center gap-3">
									<div class="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-100 font-bold text-zinc-700 uppercase">
										{member.fullName.charAt(0) || member.email.charAt(0)}
									</div>
									<div>
										<p class="font-bold text-zinc-900">{member.fullName}</p>
										<p class="text-zinc-500 text-[11px]">{member.email}</p>
									</div>
								</div>
							</td>
							<td class="px-4 py-4">
								<span
									class="inline-flex rounded border px-2 py-0.5 text-[10px] font-bold uppercase {member.role ===
									'owner'
										? 'bg-purple-50 text-purple-800 border-purple-200'
										: member.role === 'manager'
											? 'bg-blue-50 text-blue-800 border-blue-200'
											: member.role === 'kso'
												? 'bg-amber-50 text-amber-800 border-amber-200'
												: 'bg-emerald-50 text-emerald-800 border-emerald-200'}"
								>
									{member.role === 'owner'
										? 'Власник'
										: member.role === 'manager'
											? 'Менеджер'
											: member.role === 'kso'
												? 'КСО'
												: 'Касир'}
								</span>
							</td>
							<td class="px-4 py-4">
								{#if member.terminalName}
									<span class="font-medium text-zinc-800">{member.terminalName}</span>
								{:else if member.role === 'cashier' || member.role === 'kso'}
									<span class="text-zinc-400">Усі каси</span>
								{:else}
									<span class="text-zinc-400">Весь бізнес</span>
								{/if}
							</td>
							<td class="px-4 py-4 text-zinc-500">
								{member.lastActiveAt || 'нещодавно'}
							</td>
							<td class="px-4 py-4">
								<span class="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
									<span class="size-1.5 rounded-full bg-emerald-500"></span> Активний
								</span>
							</td>
							<td class="px-6 py-4 text-right">
								{#if member.role !== 'owner'}
									<button
										type="button"
										onclick={() => handleRemoveMember(member.id)}
										class="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition"
										title="Видалити доступ"
									>
										<Trash2 size={14} />
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>

{#if isInviteModalOpen}
	<InviteMemberModal
		{terminals}
		onClose={() => (isInviteModalOpen = false)}
		onInvite={handleCreateInvitation}
	/>
{/if}
