export type ProviderDate = { value: string; semantics: 'provider-local'; timeZone: 'Europe/Kyiv' };
export type NovaPoshtaDetails = {
	accessLevel: 'tracking-number-only';
	originalStatus: string | null;
	origin: { city: string | null; cityRef: string | null; warehouseRef: string | null };
	destination: { city: string | null; cityRef: string | null; warehouseRef: string | null };
	cargo: { description: string | null; weight: string | null; seats: string | null; service: string | null };
	amounts: { declared: string | null; delivery: string | null };
	dates: { created: ProviderDate | null; estimatedDelivery: ProviderDate | null; received: ProviderDate | null; scanned: ProviderDate | null; storageStarted: ProviderDate | null; paidStorageStarts: ProviderDate | null };
	parties: { sender: string | null; recipient: string | null; senderPhone: string | null; recipientPhone: string | null; residentialAddress: 'withheld' };
};

export function safeText(value: unknown, maximum = 240): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	return text && text.length <= maximum && !/[\u0000-\u001f\u007f<>]/.test(text) ? text : null;
}

export function providerRef(value: unknown): string | null {
	return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ? value : null;
}

export function decimal(value: unknown): string | null {
	const text = typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER ? String(value) : value;
	return typeof text === 'string' && /^\d{1,10}(?:\.\d{1,3})?$/.test(text) ? text : null;
}

function date(value: unknown): ProviderDate | null {
	if (typeof value !== 'string') return null;
	const match = /^(?:(\d{2})[.-](\d{2})[.-](\d{4})|(\d{4})-(\d{2})-(\d{2}))(?: (\d{2}):(\d{2}):(\d{2}))?$/.exec(value);
	if (!match) return null;
	const day = Number(match[1] ?? match[6]);
	const month = Number(match[2] ?? match[5]);
	const year = Number(match[3] ?? match[4]);
	if (year < 2000 || year > 2100) return null;
	const calendar = new Date(Date.UTC(year, month - 1, day));
	if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
	if (match[7] && (Number(match[7]) > 23 || Number(match[8]) > 59 || Number(match[9]) > 59)) return null;
	const normalized = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}${match[7] ? ` ${match[7]}:${match[8]}:${match[9]}` : ''}`;
	return { value: normalized, semantics: 'provider-local', timeZone: 'Europe/Kyiv' };
}

function maskedName(value: unknown): string | null {
	return safeText(value) ? '***' : null;
}

function maskedPhone(value: unknown): string | null {
	return typeof value === 'string' && /^\+?\d{10,15}$/.test(value) ? `***${value.slice(-2)}` : null;
}

export function sanitizeNovaPoshta(item: Record<string, unknown>): NovaPoshtaDetails {
	let originalStatus = safeText(item.Status);
	for (const field of ['SenderFullName', 'RecipientFullName', 'PhoneSender', 'PhoneRecipient', 'SenderAddress', 'RecipientAddress']) {
		const privateText = safeText(item[field]);
		if (originalStatus && privateText) originalStatus = originalStatus.split(privateText).join('***');
	}
	originalStatus = originalStatus?.replace(/\+?\d[\d ()-]{8,}\d/g, '***').replace(/\S+@\S+/g, '***') ?? null;
	return {
		accessLevel: 'tracking-number-only', originalStatus,
		origin: { city: safeText(item.CitySender), cityRef: providerRef(item.RefCitySender), warehouseRef: providerRef(item.WarehouseSenderInternetAddressRef) ?? providerRef(item.SenderWarehouseRef) },
		destination: { city: safeText(item.CityRecipient), cityRef: providerRef(item.RefCityRecipient), warehouseRef: providerRef(item.WarehouseRecipientRef) ?? providerRef(item.RecipientWarehouseRef) },
		cargo: { description: null, weight: decimal(item.DocumentWeight), seats: decimal(item.SeatsAmount), service: safeText(item.ServiceType, 40) },
		amounts: { declared: decimal(item.AnnouncedPrice), delivery: decimal(item.DocumentCost) },
		dates: { created: date(item.DateCreated), estimatedDelivery: date(item.ScheduledDeliveryDate), received: date(item.RecipientDateTime), scanned: date(item.DateScan), storageStarted: date(item.DateFirstDayStorage), paidStorageStarts: date(item.DatePayedKeeping) },
		parties: { sender: maskedName(item.SenderFullName), recipient: maskedName(item.RecipientFullName), senderPhone: maskedPhone(item.PhoneSender), recipientPhone: maskedPhone(item.PhoneRecipient), residentialAddress: 'withheld' }
	};
}

export function sanitizeDetails(value: unknown): NovaPoshtaDetails | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const details = value as Partial<NovaPoshtaDetails>;
	if (details.accessLevel !== 'tracking-number-only') return null;
	const sanitized = sanitizeNovaPoshta({
		Status: details.originalStatus, CitySender: details.origin?.city, RefCitySender: details.origin?.cityRef,
		SenderWarehouseRef: details.origin?.warehouseRef, CityRecipient: details.destination?.city,
		RefCityRecipient: details.destination?.cityRef, RecipientWarehouseRef: details.destination?.warehouseRef,
		DocumentWeight: details.cargo?.weight, SeatsAmount: details.cargo?.seats, ServiceType: details.cargo?.service,
		AnnouncedPrice: details.amounts?.declared, DocumentCost: details.amounts?.delivery,
		DateCreated: details.dates?.created?.value, ScheduledDeliveryDate: details.dates?.estimatedDelivery?.value,
		RecipientDateTime: details.dates?.received?.value, DateScan: details.dates?.scanned?.value,
		DateFirstDayStorage: details.dates?.storageStarted?.value, DatePayedKeeping: details.dates?.paidStorageStarts?.value
	});
	sanitized.parties.sender = details.parties?.sender === '***' ? '***' : null;
	sanitized.parties.recipient = details.parties?.recipient === '***' ? '***' : null;
	for (const field of ['senderPhone', 'recipientPhone'] as const) {
		const phone = details.parties?.[field];
		sanitized.parties[field] = typeof phone === 'string' && /^\*\*\*\d{2}$/.test(phone) ? phone : null;
	}
	return sanitized;
}