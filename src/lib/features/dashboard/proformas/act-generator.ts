import type { ActType, ProformaAct, ProformaDraft } from './types';
import { calculateProformaTotals } from './proforma-calc';
import { amountToWordsUAH } from './number-to-words-uk';

export function getActTitle(type: ActType): string {
	return type === 'services'
		? 'АКТ здачі-прийняття робіт (надання послуг)'
		: 'АКТ прийому-передачі товару';
}

export function getDefaultActStatement(type: ActType): string {
	if (type === 'services') {
		return 'Сторони цим підтверджують, що всі зазначені вище роботи виконані (послуги надані) Виконавцем належним чином, у повному обсязі та у встановлені строки. Замовник претензій щодо якості, повноти та строків виконання робіт (надання послуг) до Виконавця не має.';
	}
	return 'Сторони цим підтверджують, що зазначений вище товар переданий Постачальником та прийнятий Покупцем у повному обсязі, належної якості та комплектності. Претензій щодо кількості, якості та асортименту товару Покупець до Постачальника не має.';
}

export function generateActFromProforma(
	proforma: ProformaDraft,
	type: ActType = 'services',
	city: string = 'м. Київ'
): ProformaAct {
	const now = new Date();
	const dateStr = now.toISOString().slice(0, 10);
	const totals =
		proforma.totals ??
		calculateProformaTotals(proforma.items, proforma.taxRate, proforma.adjustment || 0);

	return {
		id: `act-${crypto.randomUUID()}`,
		type,
		number: `АКТ-${proforma.number}`,
		date: dateStr,
		city,
		proformaId: proforma.id,
		proformaNumber: proforma.number,
		proformaDate: proforma.issueDate,
		seller: { ...proforma.seller },
		customer: { ...proforma.customer },
		items: proforma.items.map((item) => ({ ...item })),
		totals: { ...totals },
		taxRate: proforma.taxRate,
		currency: proforma.currency,
		statement: getDefaultActStatement(type),
		status: 'draft',
		createdAt: now.toISOString()
	};
}

/**
 * Returns a canonical deterministic representation of the Act for digital signing
 */
export function generateActCanonicalPayload(act: ProformaAct): string {
	const lines: string[] = [
		`ДОКУМЕНТ: ${getActTitle(act.type)} № ${act.number}`,
		`ДАТА: ${act.date}`,
		`МІСЦЕ: ${act.city}`,
		`ПІДСТАВА: Рахунок-фактура № ${act.proformaNumber} від ${act.proformaDate}`,
		`ВИКОНАВЕЦЬ/ПОСТАЧАЛЬНИК: ${act.seller.name}, ЄДРПОУ/РНОКПП: ${act.seller.taxId}, IBAN: ${act.seller.iban}`,
		`ЗАМОВНИК/ПОКУПЕЦЬ: ${act.customer.name}, ЄДРПОУ/РНОКПП: ${act.customer.taxId || '—'}`,
		'ПОЗИЦІЇ:'
	];

	act.items.forEach((item, idx) => {
		if (item.type === 'heading') {
			lines.push(`--- ${item.name} ---`);
		} else {
			lines.push(
				`${idx + 1}. ${item.name} | ${item.quantity} ${item.unit} | ${item.price.toFixed(2)} грн | разом: ${item.total.toFixed(2)} грн`
			);
		}
	});

	lines.push(`ЗАГАЛЬНА СУМА: ${act.totals.total.toFixed(2)} грн (${amountToWordsUAH(act.totals.total)})`);
	if (act.taxRate > 0) {
		lines.push(`У Т.Ч. ПДВ (${act.taxRate}%): ${act.totals.taxAmount.toFixed(2)} грн`);
	} else {
		lines.push('ПДВ: Без ПДВ');
	}
	lines.push(`ЗАЯВА СТОРІН: ${act.statement}`);

	return lines.join('\n');
}

/**
 * Computes SHA-256 hash of the canonical act payload
 */
export async function computeActDigest(act: ProformaAct): Promise<string> {
	const canonical = generateActCanonicalPayload(act);
	const encoder = new TextEncoder();
	const data = encoder.encode(canonical);

	if (typeof crypto !== 'undefined' && crypto.subtle) {
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	}

	// Fallback simple hash for environments without crypto.subtle
	let hash = 0;
	for (let i = 0; i < canonical.length; i++) {
		hash = (hash << 5) - hash + canonical.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash).toString(16).padStart(64, '0');
}
