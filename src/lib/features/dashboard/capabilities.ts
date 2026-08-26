export type DashboardCapabilityState = 'live-read' | 'local-draft' | 'planned';

export type DashboardCapability = {
	state: DashboardCapabilityState;
	canRead: boolean;
	canWrite: boolean;
	label: string;
};

export const dashboardCapabilities = {
	invoices: { state: 'live-read', canRead: true, canWrite: true, label: 'Worker API: створення і скасування' },
	pos: { state: 'live-read', canRead: true, canWrite: true, label: 'RLS: замовлення, готівка і скасування' },
	structure: { state: 'live-read', canRead: true, canWrite: false, label: 'Редагування очікує RLS' },
	invoiceRules: { state: 'local-draft', canRead: true, canWrite: false, label: 'Локальна чернетка' },
	paymentMethods: { state: 'local-draft', canRead: true, canWrite: false, label: 'Інтеграція не активна' },
	publicProfile: { state: 'local-draft', canRead: true, canWrite: false, label: 'Публікація не активна' },
	staff: { state: 'planned', canRead: false, canWrite: false, label: 'Очікує membership і RLS' }
} satisfies Record<string, DashboardCapability>;