export type DirectoryBank = { id: string; name: string; logo: string | null };
export type BankDirectory = { banks: DirectoryBank[]; unavailable: boolean };

const endpoint = 'https://bank-api.dmitrishen.workers.dev/v1/banks';

export function parseBanks(value: unknown): DirectoryBank[] {
	if (!Array.isArray(value)) throw new Error('Invalid bank directory');
	const seen = new Set<string>();
	return value.flatMap((bank) => {
		if (
			!bank ||
			typeof bank !== 'object' ||
			bank.active !== true ||
			typeof bank.id !== 'string' ||
			typeof bank.name !== 'string' ||
			!bank.id.trim() ||
			!bank.name.trim() ||
			seen.has(bank.id)
		)
			return [];
		seen.add(bank.id);
		return [{ id: bank.id, name: bank.name, logo: null }];
	});
}

export function parseLogo(value: unknown): string | null {
	if (!value || typeof value !== 'object' || !('logo' in value) || typeof value.logo !== 'string')
		return null;
	try {
		const url = new URL(value.logo);
		return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
	} catch {
		return null;
	}
}

export async function loadBankDirectory(fetcher: typeof fetch): Promise<BankDirectory> {
	try {
		const response = await fetcher(endpoint, { signal: AbortSignal.timeout(8000) });
		if (!response.ok) throw new Error('Bank directory unavailable');
		const banks = parseBanks(await response.json());
		let cursor = 0;
		await Promise.all(
			Array.from({ length: 6 }, async () => {
				while (cursor < banks.length) {
					const bank = banks[cursor++];
					try {
						const detail = await fetcher(`${endpoint}/${encodeURIComponent(bank.id)}`, {
							signal: AbortSignal.timeout(4000)
						});
						if (detail.ok) bank.logo = parseLogo(await detail.json());
					} catch {
						bank.logo = null;
					}
				}
			})
		);
		return { banks, unavailable: banks.length === 0 };
	} catch {
		return { banks: [], unavailable: true };
	}
}
