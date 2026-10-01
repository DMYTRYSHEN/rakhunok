import type { EvidenceDocument } from './documents';

export type DocumentDraft = Pick<EvidenceDocument, 'id' | 'category' | 'name' | 'content' | 'expires'>;
export const documentTemplate: DocumentDraft = { id: 'DEMO-doc-example', category: 'identity', name: 'DEMO-evidence.txt', content: 'DEMO synthetic evidence', expires: '2027-12-31' };

export function documentDraftError(draft: DocumentDraft, today: string): string {
	if (!/^DEMO-doc-[a-z0-9-]{1,40}$/i.test(draft.id)) return 'ID має починатися з DEMO-doc- і містити до 40 латинських літер, цифр або дефісів після префікса.';
	if (!['identity', 'account', 'registration', 'other'].includes(draft.category)) return 'Оберіть тип документа: identity, account, registration або other.';
	if (!/^DEMO-[^/\\]{1,100}\.txt$/.test(draft.name)) return 'Назва документа має відповідати DEMO-*.txt.';
	if (!draft.content.startsWith('DEMO')) return 'Синтетичний вміст має починатися з DEMO. Не додавайте справжні персональні дані.';
	if (new TextEncoder().encode(draft.content).length > 20000) return 'Вміст перевищує 20 000 байтів.';
	if (!/^20\d{2}-\d{2}-\d{2}$/.test(draft.expires) || !Number.isFinite(Date.parse(draft.expires)) || new Date(draft.expires).toISOString().slice(0, 10) !== draft.expires || draft.expires <= today) return 'Вкажіть дійсну майбутню дату у форматі РРРР-ММ-ДД.';
	return '';
}

export function parseDocumentFile(fileName: string, text: string, current: DocumentDraft, today: string): DocumentDraft {
	const json = /\.json$/i.test(fileName);
	if (!json && !/\.txt$/i.test(fileName)) throw new Error('Підтримуються TXT та JSON. PDF, фото й скани ще не розпізнаються.');
	if (new TextEncoder().encode(text).length > (json ? 150000 : 20000)) throw new Error('Файл перевищує ліміт: TXT 20 000 байтів, JSON 150 000 байтів.');
	let draft: DocumentDraft;
	if (json) {
		let value: unknown;
		try { value = JSON.parse(text); } catch { throw new Error('Некоректний JSON. Завантажте шаблон і перевірте його структуру.'); }
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON має містити один об’єкт документа.');
		const record = value as Record<string, unknown>;
		const keys = ['id', 'category', 'name', 'content', 'expires'];
		if (Object.keys(record).some(key => !keys.includes(key)) || keys.some(key => typeof record[key] !== 'string')) throw new Error('JSON має містити лише текстові поля id, category, name, content, expires. Власник і статус визначаються системою.');
		draft = { id: record.id as string, category: record.category as DocumentDraft['category'], name: record.name as string, content: record.content as string, expires: record.expires as string };
	} else {
		draft = { ...current, name: fileName, content: text };
	}
	const error = documentDraftError(draft, today);
	if (error) throw new Error(error);
	return draft;
}