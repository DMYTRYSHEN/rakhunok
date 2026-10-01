import type { Dac7Role } from './dac7/types';

export const platformRoles = [
	{ id: 'seller', label: 'Самозайнятий' },
	{ id: 'platform', label: 'Платформа' },
	{ id: 'business', label: 'Бізнес (мерчант)' },
	{ id: 'gov', label: 'Держава (ДПС / Мінфін)' },
	{ id: 'admin', label: 'Адміністратор прав' },
	{ id: 'dev', label: 'Розробник платформи' },
	{ id: 'sso', label: 'Rahunok ID (Дія.Підпис)' },
	{ id: 'passport', label: 'Passkeys & pinPay' }
] satisfies { id: Dac7Role; label: string }[];

export function readDemoRole(value: string | null | undefined): Dac7Role {
	return platformRoles.find((role) => role.id === value)?.id ?? 'seller';
}