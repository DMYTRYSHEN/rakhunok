import type { TeamMember, TeamInvitation } from '../types';

export const demoTeamMembers: TeamMember[] = [
	{
		id: 'member-001',
		merchantId: 'demo-merchant',
		userId: 'demo-user',
		email: 'dmytryshen@rahunok.app',
		fullName: 'Олександр Дмитришен',
		role: 'owner',
		terminalId: null,
		status: 'active',
		createdAt: '2026-08-01T10:00:00.000Z',
		lastActiveAt: 'щойно'
	},
	{
		id: 'member-002',
		merchantId: 'demo-merchant',
		userId: 'user-mgr-102',
		email: 'manager.olena@rahunok.app',
		fullName: 'Олена Коваленко',
		role: 'manager',
		terminalId: null,
		status: 'active',
		createdAt: '2026-08-15T14:30:00.000Z',
		lastActiveAt: '12 хв тому'
	},
	{
		id: 'member-003',
		merchantId: 'demo-merchant',
		userId: 'user-cashier-201',
		email: 'cashier.taras@rahunok.app',
		fullName: 'Тарас Шевчук',
		role: 'cashier',
		terminalId: 'terminal-1',
		terminalName: 'Каса 1 (Головна зала)',
		status: 'active',
		createdAt: '2026-08-20T08:15:00.000Z',
		lastActiveAt: '3 хв тому'
	},
	{
		id: 'member-004',
		merchantId: 'demo-merchant',
		userId: 'user-kso-301',
		email: 'kso.podil@rahunok.app',
		fullName: 'КСО #1 (Термінал самообслуговування)',
		role: 'kso',
		terminalId: 'terminal-2',
		terminalName: 'КСО Поділ (Стійка самообслуговування)',
		status: 'active',
		createdAt: '2026-08-22T11:00:00.000Z',
		lastActiveAt: 'щойно'
	}
];

export const demoTeamInvitations: TeamInvitation[] = [
	{
		id: 'inv-001',
		merchantId: 'demo-merchant',
		email: 'barista.andriy@gmail.com',
		role: 'cashier',
		terminalId: 'terminal-3',
		terminalName: 'Літня тераса (Бар)',
		token: 'inv_tok_98f4a1c02e5b7d91e843c9120485aaef',
		status: 'pending',
		invitedBy: 'demo-user',
		invitedByName: 'Олександр Дмитришен',
		createdAt: '2026-09-08T09:30:00.000Z',
		expiresAt: '2026-09-15T09:30:00.000Z'
	},
	{
		id: 'inv-002',
		merchantId: 'demo-merchant',
		email: 'analyst.iryna@corex.ua',
		role: 'manager',
		terminalId: null,
		token: 'inv_tok_11a3b9c77e82410f9921c54832bead19',
		status: 'pending',
		invitedBy: 'demo-user',
		invitedByName: 'Олександр Дмитришен',
		createdAt: '2026-09-09T16:45:00.000Z',
		expiresAt: '2026-09-16T16:45:00.000Z'
	}
];
