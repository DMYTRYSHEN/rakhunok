export const HISTORY_KEY = 'delivery.guest-tracking.v1';
export const HISTORY_TTL = 21 * 24 * 60 * 60 * 1000;
export type HistoryEntry = { number: string; checkedAt: number };
type HistoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readHistory(storage: HistoryStorage, now = Date.now()): HistoryEntry[] {
	try {
		const raw = storage.getItem(HISTORY_KEY);
		const parsed: unknown = raw && raw.length <= 20000 ? JSON.parse(raw) : [];
		const entries: HistoryEntry[] = [];
		if (Array.isArray(parsed)) for (const entry of parsed) {
			if (!entry || typeof entry.number !== 'string' || !/^[A-Z0-9]{1,64}$/.test(entry.number) ||
				!Number.isSafeInteger(entry.checkedAt) || entry.checkedAt > now || now - entry.checkedAt >= HISTORY_TTL) continue;
			const existing = entries.find(item => item.number === entry.number);
			if (existing) existing.checkedAt = Math.max(existing.checkedAt, entry.checkedAt);
			else entries.push({ number: entry.number, checkedAt: entry.checkedAt });
		}
		const history = entries.sort((first, second) => second.checkedAt - first.checkedAt).slice(0, 30);
		if (raw !== (history.length ? JSON.stringify(history) : null)) writeHistory(storage, history);
		return history;
	} catch {
		writeHistory(storage, []);
		return [];
	}
}

export function writeHistory(storage: HistoryStorage, history: HistoryEntry[]) {
	try {
		if (history.length) storage.setItem(HISTORY_KEY, JSON.stringify(history));
		else storage.removeItem(HISTORY_KEY);
	} catch {}
}

export function rememberTracking(storage: HistoryStorage, input: string, now = Date.now()): HistoryEntry[] {
	const history = readHistory(storage, now);
	const number = input.trim().toUpperCase();
	if (!/^[A-Z0-9]{1,64}$/.test(number)) return history;
	const next = [{ number, checkedAt: now }, ...history.filter(entry => entry.number !== number)].slice(0, 30);
	writeHistory(storage, next);
	return next;
}