const unitsFeminine = ['', 'одна', 'дві', 'три', 'чотири', 'п’ять', 'шість', 'сім', 'вісім', 'дев’ять'];
const unitsMasculine = ['', 'один', 'два', 'три', 'чотири', 'п’ять', 'шість', 'сім', 'вісім', 'дев’ять'];
const teens = [
	'десять',
	'одинадцять',
	'дванадцять',
	'тринадцять',
	'чотирнадцять',
	'п’ятнадцять',
	'шістнадцять',
	'сімнадцять',
	'вісімнадцять',
	'дев’ятнадцять'
];
const tens = [
	'',
	'',
	'двадцять',
	'тридцять',
	'сорок',
	'п’ятдесят',
	'шістдесят',
	'сімдесят',
	'вісімдесят',
	'дев’яносто'
];
const hundreds = [
	'',
	'сто',
	'двісті',
	'триста',
	'чотириста',
	'п’ятсот',
	'шістсот',
	'сімсот',
	'вісімсот',
	'дев’ятсот'
];

function pluralForm(n: number, one: string, two: string, five: string): string {
	const mod10 = n % 10;
	const mod100 = n % 100;
	if (mod100 >= 11 && mod100 <= 19) return five;
	if (mod10 === 1) return one;
	if (mod10 >= 2 && mod10 <= 4) return two;
	return five;
}

function tripletToWords(n: number, feminine: boolean): string {
	const h = Math.floor(n / 100);
	const t = Math.floor((n % 100) / 10);
	const u = n % 10;
	const parts: string[] = [];

	if (h > 0) parts.push(hundreds[h]);

	if (t === 1) {
		parts.push(teens[u]);
	} else {
		if (t > 1) parts.push(tens[t]);
		if (u > 0) parts.push(feminine ? unitsFeminine[u] : unitsMasculine[u]);
	}

	return parts.filter(Boolean).join(' ');
}

export function amountToWordsUAH(amount: number): string {
	const integerPart = Math.floor(Math.abs(amount));
	const kopecks = Math.round((Math.abs(amount) - integerPart) * 100);
	const kopecksStr = kopecks.toString().padStart(2, '0');

	if (integerPart === 0) {
		return `нуль гривень ${kopecksStr} коп.`;
	}

	const millions = Math.floor(integerPart / 1_000_000);
	const thousands = Math.floor((integerPart % 1_000_000) / 1_000);
	const ones = integerPart % 1_000;

	const parts: string[] = [];

	if (millions > 0) {
		const mWords = tripletToWords(millions, false);
		const mPlural = pluralForm(millions, 'мільйон', 'мільйони', 'мільйонів');
		parts.push(`${mWords} ${mPlural}`);
	}

	if (thousands > 0) {
		const tWords = tripletToWords(thousands, true);
		const tPlural = pluralForm(thousands, 'тисяча', 'тисячі', 'тисяч');
		parts.push(`${tWords} ${tPlural}`);
	}

	if (ones > 0 || parts.length === 0) {
		const oWords = tripletToWords(ones, true);
		parts.push(oWords);
	}

	const uahPlural = pluralForm(integerPart, 'гривня', 'гривні', 'гривень');
	parts.push(uahPlural);

	const words = parts.filter(Boolean).join(' ');
	return `${words} ${kopecksStr} коп.`;
}
