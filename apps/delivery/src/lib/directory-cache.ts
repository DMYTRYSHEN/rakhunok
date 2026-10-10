type Payload = { data: unknown[]; hasMore?: boolean; page?: number; source?: string };
type Entry = { key: string; expires: number; payload: Payload };
const maximumBytes = 1024 * 1024;
const maximumEntries = 60;

export async function cachedDirectory(url: string, userId: string, timeout = 15000, storage?: Storage): Promise<Payload> {
	let local = storage;
	try { local ??= localStorage; } catch { local = undefined; }
	const storageKey = `delivery:directory:v1:${userId}`;
	let entries: Entry[] = [];
	try {
		const raw = local?.getItem(storageKey);
		if (raw && raw.length * 2 <= maximumBytes) {
			const parsed: unknown = JSON.parse(raw);
			if (Array.isArray(parsed)) entries = parsed.filter((entry): entry is Entry =>
				entry && typeof entry.key === 'string' && Number.isFinite(entry.expires) && entry.expires > Date.now() &&
				Array.isArray(entry.payload?.data)).slice(-maximumEntries);
		}
	} catch { entries = []; }
	const hit = entries.find(entry => entry.key === url);
	if (hit) return structuredClone(hit.payload);
	const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeout) });
	if (!response.ok) throw new Error('Directory unavailable');
	const payload: Payload = await response.json();
	if (!Array.isArray(payload.data)) throw new Error('Invalid directory');
	const nearby = new URL(url, 'https://local.invalid').searchParams.get('kind') === 'nearby';
	entries.push({ key: url, expires: Date.now() + (nearby ? 15 * 60 * 1000 : 12 * 60 * 60 * 1000), payload });
	entries = entries.slice(-maximumEntries);
	let encoded = JSON.stringify(entries);
	while (entries.length && encoded.length * 2 > maximumBytes) {
		entries.shift(); encoded = JSON.stringify(entries);
	}
	try { local?.setItem(storageKey, encoded); } catch { return payload; }
	return payload;
}