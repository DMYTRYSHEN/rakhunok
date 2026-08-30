const currencyFormatter = new Intl.NumberFormat('uk-UA', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

const dateFormatter = new Intl.DateTimeFormat('uk-UA', {
	day: '2-digit',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit'
});

export function formatMoney(amount: number) {
	return `${currencyFormatter.format(amount)} ₴`;
}

export function formatInvoiceDate(value: string) {
	return dateFormatter.format(new Date(value));
}
