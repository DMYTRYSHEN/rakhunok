<script lang="ts">
	import {
		Building2,
		KeyRound,
		LockKeyhole,
		MapPin,
		ShieldCheck,
		Store,
		UserRoundPlus,
		UsersRound
	} from '@lucide/svelte';
	import { dashboardCapabilities } from '../capabilities';

	const roles = [
		{
			name: 'Власник',
			detail: 'Повний доступ до бізнесу, команди та налаштувань',
			icon: ShieldCheck
		},
		{ name: 'Менеджер', detail: 'Операції, звіти та керування робочими місцями', icon: Building2 },
		{ name: 'Касир', detail: 'Своя сесія, призначена каса та приймання оплат', icon: Store }
	];
</script>

<div class="mx-auto max-w-6xl">
	<header class="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
		<div>
			<p class="text-xs font-bold tracking-[0.14em] text-blue-700 uppercase">Операційна модель</p>
			<h1 class="mt-2 text-2xl font-extrabold sm:text-3xl">Команда й касири</h1>
			<p class="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
				Окремий логін кожного працівника, роль та доступ лише до призначеного бізнесу, локації й
				каси.
			</p>
		</div>
		<span
			class="inline-flex w-fit items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-700"
			><LockKeyhole size={14} aria-hidden="true" /> {dashboardCapabilities.staff.label}</span
		>
	</header>

	<section class="overflow-hidden rounded-lg border border-zinc-200 bg-white">
		<div class="border-b border-zinc-200 p-5 sm:p-6">
			<div class="flex items-start gap-3">
				<span class="grid size-10 shrink-0 place-items-center rounded-md bg-blue-50 text-blue-700"
					><UsersRound size={19} aria-hidden="true" /></span
				>
				<div>
					<h2 class="font-extrabold">Модель доступу</h2>
					<p class="mt-1 text-sm leading-6 text-zinc-500">
						Ролі присутні в продукті як запланований контур, але ще не є авторизацією.
					</p>
				</div>
			</div>
		</div>
		<div class="grid gap-3 p-5 sm:p-6 md:grid-cols-3">
			{#each roles as role (role.name)}
				<article class="rounded-md border border-zinc-200 p-4">
					<span class="grid size-10 place-items-center rounded-md bg-zinc-100 text-zinc-700"
						><role.icon size={18} aria-hidden="true" /></span
					>
					<h3 class="mt-4 text-sm font-extrabold">{role.name}</h3>
					<p class="mt-1 text-xs leading-5 text-zinc-500">{role.detail}</p>
				</article>
			{/each}
		</div>
	</section>

	<div class="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
		<section class="rounded-lg border border-zinc-200 bg-white p-5 sm:p-6">
			<div class="flex items-center justify-between gap-4">
				<div>
					<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Працівники</p>
					<h2 class="mt-1 font-extrabold">Запрошення та призначення</h2>
				</div>
				<button
					type="button"
					disabled
					class="inline-flex h-10 items-center gap-2 rounded-md bg-zinc-200 px-3 text-sm font-extrabold text-zinc-500"
					><UserRoundPlus size={16} aria-hidden="true" /> Запросити</button
				>
			</div>
			<div class="mt-6 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
				<KeyRound size={24} class="mx-auto text-zinc-400" aria-hidden="true" />
				<p class="mt-3 text-sm font-bold">Список команди ще не підключено</p>
				<p class="mx-auto mt-2 max-w-md text-xs leading-5 text-zinc-500">
					Не симулюємо касирів у localStorage: доступ має перевірятися сервером у кожному запиті.
				</p>
			</div>
		</section>
		<aside class="rounded-lg border border-zinc-200 bg-white p-5">
			<p class="text-xs font-bold tracking-[0.12em] text-zinc-500 uppercase">Майбутня прив’язка</p>
			<div class="mt-4 space-y-4 text-sm">
				<div class="flex gap-3">
					<Building2 size={17} class="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" /><span
						><strong class="block">Бізнес</strong><span
							class="mt-1 block text-xs leading-5 text-zinc-500">Membership користувача</span
						></span
					>
				</div>
				<div class="flex gap-3">
					<MapPin size={17} class="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" /><span
						><strong class="block">Локація</strong><span
							class="mt-1 block text-xs leading-5 text-zinc-500"
							>Доступ до однієї або кількох точок</span
						></span
					>
				</div>
				<div class="flex gap-3">
					<Store size={17} class="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" /><span
						><strong class="block">Каса</strong><span
							class="mt-1 block text-xs leading-5 text-zinc-500">Призначений термінал і зміна</span
						></span
					>
				</div>
			</div>
		</aside>
	</div>

	<div
		class="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"
	>
		<strong>Що розблокує модуль:</strong> таблиця membership, ролі, прив’язки до локацій/терміналів та
		RLS, що перевіряє ці зв’язки. До цього моменту жоден frontend-перемикач ролі не надає доступу.
	</div>
</div>
