import { describe, expect, it } from 'vitest';
import { getBaselineCopy, pilotHref } from './copy';

describe('baseline landing content contract', () => {
	for (const locale of ['uk', 'en', 'pl'] as const) {
		it(`${locale}: preserves the full information architecture`, () => {
			const copy = getBaselineCopy(locale);
			expect(copy.nav).toHaveLength(6);
			expect(copy.stats).toHaveLength(3);
			expect(copy.demoSteps).toHaveLength(3);
			expect(copy.caseTabs).toHaveLength(4);
			expect(new Set(copy.mockLabels).size).toBe(4);
			expect(copy.product.features).toHaveLength(8);
			expect(copy.comparisonRows).toHaveLength(6);
			expect(copy.securityCards).toHaveLength(3);
			expect(copy.faq).toHaveLength(12);
			expect(copy.statsNote.length).toBeGreaterThan(60);
			expect(copy.demoDisclaimer.length).toBeGreaterThan(30);
			expect(JSON.stringify(copy)).not.toMatch(/2[,.]3\s*(с|s)/);
		});
	}
	it('pilot CTA contacts the team rather than pretending to register', () => {
		expect(pilotHref).toBe('mailto:rahunok@rahunok.com?subject=Rahunok%20pilot');
	});
});