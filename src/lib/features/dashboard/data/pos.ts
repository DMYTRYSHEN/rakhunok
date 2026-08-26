import type { PosBoard } from '../types';

export const demoPosBoard: PosBoard = {
	terminals: [
		{
			id: 'terminal-1',
			name: 'Стіл 1',
			code: 'table-1',
			type: 'table',
			entityId: 'demo-merchant',
			isActive: true
		},
		{
			id: 'terminal-2',
			name: 'Стіл 2',
			code: 'table-2',
			type: 'table',
			entityId: 'demo-merchant',
			isActive: true
		},
		{
			id: 'terminal-3',
			name: 'Бар',
			code: 'bar-nfc',
			type: 'nfc_tag',
			entityId: 'demo-merchant',
			isActive: true
		},
		{
			id: 'terminal-4',
			name: 'Головна каса',
			code: 'kasa-1',
			type: 'kasa',
			entityId: 'demo-merchant',
			isActive: true
		}
	],
	activeOrders: [
		{
			id: 'demo-1047',
			terminalId: 'terminal-2',
			title: 'Замовлення столу 2',
			amount: 640,
			status: 'pending',
			createdAt: '2026-08-25T18:24:00.000Z'
		},
		{
			id: 'demo-1045',
			terminalId: 'terminal-3',
			title: 'Замовлення біля бару',
			amount: 285,
			status: 'paid',
			createdAt: '2026-08-25T18:18:00.000Z'
		}
	]
};
