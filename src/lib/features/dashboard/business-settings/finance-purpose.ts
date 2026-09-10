export const financePurposeTokens = ['business_purpose', 'seller_name', 'seller_iban',
	'seller_tax_id', 'provider_code', 'provider_seller_id', 'contract_reference', 'payment_id'] as const;
export type FinancePurposeToken = typeof financePurposeTokens[number];
export const defaultFinancePurposeTemplate = '{business_purpose} | Юридична назва продавця: {seller_name}; власний IBAN продавця: {seller_iban}; Код провайдера: {provider_code}; ID продавця: {provider_seller_id}; код продавця: {seller_tax_id}; договір: {contract_reference}; ID платежу: {payment_id}';

export function validateFinancePurposeTemplate(value: unknown): string {
	if (typeof value !== 'string' || !value.trim() || value.length > 1000 ||
		Array.from(value).some((char) => char.charCodeAt(0) < 32 || (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159)) ||
		/[{}]/.test(value.replace(/\{([a-z_]+)\}/g, (token, key) =>
			financePurposeTokens.includes(key) ? '' : token))) {
		throw new Error('Некоректний шаблон фінкомпанії: до 1000 символів, лише дозволені підстановки, без переносів рядка.');
	}
	return value;
}

/** Single pass only. Never creates payment identifiers or certifies provider readiness. */
export function previewFinancePurpose(template: string, values: Partial<Record<FinancePurposeToken, string>>): string {
	try { validateFinancePurposeTemplate(template); } catch (cause) {
		return cause instanceof Error ? cause.message : 'Некоректний шаблон.';
	}
	const rendered = template.replace(/\{([a-z_]+)\}/g, (_, key: FinancePurposeToken) =>
		key === 'payment_id' ? '[буде створено сервером — не реальний ID]' : values[key] || `[не задано: ${key}]`);
	return rendered.length <= 4000 ? `Ілюстрація, не платіжний payload: ${rendered}`
		: 'Приклад перевищує 4000 символів. Скоротіть шаблон або значення; формат провайдера не перевірено.';
}