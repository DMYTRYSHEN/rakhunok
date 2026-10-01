import { describe, expect, it } from 'vitest';
import { documentDraftError, documentTemplate, parseDocumentFile } from './document-import';

const today = '2026-09-28';
describe('document draft import', () => {
	it('imports JSON without mutating the current draft', () => {
		const current = { ...documentTemplate, id: 'DEMO-doc-current' };
		expect(parseDocumentFile('document.json', JSON.stringify(documentTemplate), current, today)).toEqual(documentTemplate);
		expect(current.id).toBe('DEMO-doc-current');
	});
	it('imports TXT while preserving manually entered metadata', () => {
		expect(parseDocumentFile('DEMO-upload.txt', 'DEMO new evidence', documentTemplate, today)).toEqual({ ...documentTemplate, name: 'DEMO-upload.txt', content: 'DEMO new evidence' });
	});
	it('rejects unsupported, malformed and privileged input', () => {
		for (const text of ['{', 'null', '[]', '{}', JSON.stringify({ ...documentTemplate, ownerId: 'other' }), JSON.stringify({ ...documentTemplate, status: 'accepted' }), JSON.stringify({ ...documentTemplate, content: 5 })]) {
			expect(() => parseDocumentFile('input.json', text, documentTemplate, today)).toThrow();
		}
		expect(() => parseDocumentFile('document.pdf', 'DEMO', documentTemplate, today)).toThrow();
	});
	it('validates names, identifiers, categories and calendar dates', () => {
		for (const patch of [{ id: 'real-id' }, { name: '../DEMO-file.txt' }, { category: 'invalid' }, { content: 'real data' }, { expires: '2027-02-30' }, { expires: today }, { expires: '2026-01-01' }]) {
			expect(documentDraftError({ ...documentTemplate, ...patch } as typeof documentTemplate, today)).not.toBe('');
		}
	});
	it('enforces byte limits including multibyte content', () => {
		expect(documentDraftError({ ...documentTemplate, content: `DEMO${'ї'.repeat(10000)}` }, today)).not.toBe('');
		expect(() => parseDocumentFile('input.json', ' '.repeat(150001), documentTemplate, today)).toThrow();
		expect(() => parseDocumentFile('DEMO-input.txt', `DEMO${'x'.repeat(20000)}`, documentTemplate, today)).toThrow();
		expect(documentDraftError({ ...documentTemplate, content: `DEMO${'x'.repeat(19996)}` }, today)).toBe('');
	});
});