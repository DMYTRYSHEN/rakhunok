import { describe, expect, it } from 'vitest';
import { demoTeamMembers, demoTeamInvitations } from '../data/team';
import type { TeamRole } from '../types';

describe('Team & Invitations Management', () => {
	it('has default team roles including owner, manager, cashier and kso', () => {
		const roles = demoTeamMembers.map((m) => m.role);
		expect(roles).toContain('owner');
		expect(roles).toContain('manager');
		expect(roles).toContain('cashier');
		expect(roles).toContain('kso');
	});

	it('ensures invitations have valid tokens and 7 days expiration', () => {
		for (const inv of demoTeamInvitations) {
			expect(inv.token).toMatch(/^inv_/);
			expect(inv.status).toBe('pending');
			const created = new Date(inv.createdAt).getTime();
			const expires = new Date(inv.expiresAt).getTime();
			const diffDays = Math.round((expires - created) / (1000 * 60 * 60 * 24));
			expect(diffDays).toBe(7);
		}
	});

	it('correctly associates cashier or kso to terminals', () => {
		const cashier = demoTeamMembers.find((m) => m.role === 'cashier');
		const kso = demoTeamMembers.find((m) => m.role === 'kso');
		expect(cashier?.terminalId).toBeTruthy();
		expect(cashier?.terminalName).toContain('Каса');
		expect(kso?.terminalId).toBeTruthy();
		expect(kso?.terminalName).toContain('КСО');
	});
});
