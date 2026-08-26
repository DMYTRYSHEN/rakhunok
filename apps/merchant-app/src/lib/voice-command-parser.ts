export type VoiceLanguage = 'uk' | 'ru';

export type VoiceCommand = {
	version: '1.0';
	language: VoiceLanguage;
	intent: { name: 'invoice.create' | null; confidence: number };
	entities: {
		customer: { name: string; confidence: number } | null;
		amount: { value_minor: number; currency: string; confidence: number } | null;
	};
	source: { type: 'speech'; text: string };
	validation: { valid: boolean; requires_confirmation: boolean; errors: string[] };
};

const currencyWords: Record<string, string> = {
	грн: 'UAH', гривня: 'UAH', гривні: 'UAH', гривень: 'UAH', гривню: 'UAH', гривнами: 'UAH',
	гривна: 'UAH', гривны: 'UAH', гривен: 'UAH', гривну: 'UAH', '₴': 'UAH',
	євро: 'EUR', евро: 'EUR', eur: 'EUR',
	долар: 'USD', долари: 'USD', доларів: 'USD', доллар: 'USD', долларов: 'USD', usd: 'USD', '$': 'USD',
	злотий: 'PLN', злотих: 'PLN', злотый: 'PLN', злотых: 'PLN', pln: 'PLN'
};

const minorWords = new Set(['коп', 'копійка', 'копійки', 'копійок', 'копійками', 'копейка', 'копейки', 'копеек', 'копейками']);
const connectors = new Set(['і', 'й', 'та', 'з', 'із', 'зі', 'и', 'с', 'со']);
const fillers = new Set(['будь', 'ласка', 'будьласка', 'ну', 'давай', 'пожалуйста']);

const units: Record<string, number> = {
	нуль: 0, нульова: 0, ноль: 0,
	один: 1, одна: 1, одну: 1, однією: 1,
	два: 2, дві: 2, двома: 2, две: 2,
	три: 3, трьома: 3, тремя: 3,
	чотири: 4, чотирма: 4, четыре: 4, четырьмя: 4,
	пять: 5, "п'ять": 5, "п'ятьма": 5, пятью: 5,
	шість: 6, шістьма: 6, шесть: 6, шестью: 6,
	сім: 7, сімома: 7, семь: 7, семью: 7,
	вісім: 8, вісьмома: 8, восемь: 8, восемью: 8,
	"дев'ять": 9, "дев'ятьма": 9, девять: 9, девятью: 9
};

const teens: Record<string, number> = {
	десять: 10, одинадцять: 11, дванадцять: 12, тринадцять: 13, чотирнадцять: 14,
	"п'ятнадцять": 15, шістнадцять: 16, сімнадцять: 17, вісімнадцять: 18, "дев'ятнадцять": 19,
	одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15,
	шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19
};

const tens: Record<string, number> = {
	двадцять: 20, тридцять: 30, сорок: 40, "п'ятдесят": 50,
	"п'ятдесятьма": 50, шістдесят: 60, сімдесят: 70, вісімдесят: 80, "дев'яносто": 90,
	двадцать: 20, тридцать: 30, пятьдесят: 50, пятьюдесятью: 50, шестьдесят: 60,
	семьдесят: 70, восемьдесят: 80, девяносто: 90
};

const hundreds: Record<string, number> = {
	сто: 100, двісті: 200, триста: 300, чотириста: 400, "п'ятсот": 500,
	шістсот: 600, сімсот: 700, вісімсот: 800, "дев'ятсот": 900,
	двести: 200, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900
};

const intentPatterns = [
	/(створи|створити|зроби|зробити|вистав|виставити|сформуй|сформувати)\s+(?:\S+\s+)?рахунок/,
	/(создай|создать|сделай|сделать|выставь|выставить|сформируй|сформировать)\s+(?:\S+\s+)?счет/,
	/(потрібен|потрібно|треба)\s+(?:\S+\s+)?рахунок/,
	/(нужен|нужно)\s+(?:\S+\s+)?счет/,
	/(?:^|\s)до\s+сплати(?=\s|$)/,
	/(?:^|\s)к\s+оплате(?=\s|$)/,
	/(?:^|\s)с\s+вас(?=\s|$)/
];

export function normalizeSpeechText(text: string) {
	return text
		.toLocaleLowerCase('uk-UA')
		.replace(/ё/g, 'е')
		.replace(/[’`ʼ]/g, "'")
		.replace(/[^\p{L}\p{N}'₴$.,\s-]/gu, ' ')
		.replace(/\bдл\s+я\b/g, 'для')
		.replace(/\s+/g, ' ')
		.trim();
}

export function parseVoiceCommand(text: string): VoiceCommand {
	const normalized = normalizeSpeechText(text);
	const language = detectLanguage(normalized);
	const negated = /(?:^|\s)(не|не треба|не потрібно|не нужно)\s+(створюй|створити|створи|створювати|создавай|создать|создай|выставляй|виставляй)(?=\s|$)/.test(normalized);
	const hasIntent = !negated && intentPatterns.some((pattern) => pattern.test(normalized));
	const amount = parseAmount(normalized);
	const customer = hasIntent ? parseCustomer(normalized) : null;
	const errors: string[] = [];
	if (!hasIntent) errors.push(negated ? 'Команда містить заперечення.' : 'Не вдалося визначити намір створити рахунок.');
	if (!amount) errors.push('Не вдалося визначити суму.');
	else if (amount.currency !== 'UAH') errors.push(`Валюта ${amount.currency} не підтримується checkout.`);
	else if (amount.value_minor <= 0) errors.push('Сума повинна бути більшою за нуль.');

	return {
		version: '1.0',
		language,
		intent: { name: hasIntent ? 'invoice.create' : null, confidence: hasIntent ? 0.98 : 0 },
		entities: { customer, amount },
		source: { type: 'speech', text },
		validation: {
			valid: errors.length === 0,
			requires_confirmation: Boolean(amount && amount.confidence < 0.8),
			errors
		}
	};
}

function detectLanguage(text: string): VoiceLanguage {
	return /[ыэъ]|(?:^|\s)(создай|создать|счет|выставь|нужно|пожалуйста|оплате|вас)(?=\s|$)/.test(text) ? 'ru' : 'uk';
}

function parseAmount(text: string): VoiceCommand['entities']['amount'] {
	const tokens = text.split(' ').filter((token) => !fillers.has(token));
	const currencyIndex = tokens.findIndex((token) => currencyWords[token]);
	const currency = currencyIndex >= 0 ? currencyWords[tokens[currencyIndex]] : 'UAH';
	const minorIndex = tokens.findIndex((token) => minorWords.has(token));
	const approximate = /(?:^|\s)(десь|приблизно|около|примерно)(?=\s|$)/.test(text);
	let major = 0;
	let minor = 0;
	let parsed = false;

	const decimalMatch = text.match(/(?:^|\s)(\d[\d\s]*)(?:[,.](\d{1,2}))(?:\s|$)/);
	if (decimalMatch) {
		major = Number(decimalMatch[1].replace(/\s/g, ''));
		minor = Number(decimalMatch[2].padEnd(2, '0'));
		parsed = Number.isSafeInteger(major);
	} else {
		const majorEnd = currencyIndex >= 0 ? currencyIndex : minorIndex >= 0 ? minorIndex : tokens.length;
		const majorStart = findNumberStart(tokens, majorEnd);
		const majorValue = parseNumberTokens(tokens.slice(majorStart, majorEnd));
		if (majorValue !== null) {
			major = majorValue;
			parsed = true;
		}
		if (minorIndex >= 0) {
			const minorStartBoundary = currencyIndex >= 0 ? currencyIndex + 1 : majorEnd;
			const minorTokens = tokens.slice(minorStartBoundary, minorIndex).filter((token) => !connectors.has(token));
			const minorValue = parseNumberTokens(minorTokens);
			if (minorValue !== null && minorValue >= 0 && minorValue < 100) minor = minorValue;
		}
	}

	if (!parsed || !Number.isSafeInteger(major) || major < 0 || minor > 99) return null;
	return {
		value_minor: major * 100 + minor,
		currency,
		confidence: approximate ? 0.65 : decimalMatch || currencyIndex >= 0 ? 0.99 : 0.9
	};
}

function findNumberStart(tokens: string[], end: number) {
	let start = end;
	while (start > 0 && (isNumberToken(tokens[start - 1]) || connectors.has(tokens[start - 1]))) start -= 1;
	while (start < end && connectors.has(tokens[start])) start += 1;
	return start;
}

function isNumberToken(token: string) {
	return /^\d+$/.test(token) || token in units || token in teens || token in tens || token in hundreds || /^(тисяча|тисячі|тисяч|тысяча|тысячу|тысячи|тысяч)$/.test(token);
}

function parseNumberTokens(tokens: string[]): number | null {
	if (tokens.length === 0) return null;
	const numeric = tokens.join('').match(/^\d+$/);
	if (numeric) return Number(numeric[0]);
	let total = 0;
	let group = 0;
	let consumed = false;
	for (const token of tokens) {
		if (connectors.has(token)) continue;
		if (token in units) group += units[token];
		else if (token in teens) group += teens[token];
		else if (token in tens) group += tens[token];
		else if (token in hundreds) group += hundreds[token];
		else if (/^(тисяча|тисячі|тисяч|тысяча|тысячу|тысячи|тысяч)$/.test(token)) {
			total += (group || 1) * 1000;
			group = 0;
		} else return null;
		consumed = true;
	}
	return consumed ? total + group : null;
}

function parseCustomer(text: string): VoiceCommand['entities']['customer'] {
	const withoutFillers = text.replace(/(?:^|\s)(будь ласка|пожалуйста|мені потрібно|мені треба|мне нужно)(?=\s|$)/g, ' ');
	const explicit = withoutFillers.match(/(?:^|\s)для\s+([а-яіїєґ'-]+)(?=\s|$)/i)?.[1];
	const beforeInvoice = withoutFillers.match(/(?:^|\s)(?:створи|створити|зроби|вистав|виставити|сформуй|создай|создать|сделай|выставь|выставить|сформируй)\s+([а-яіїєґ'-]+)\s+(?:рахунок|счет)(?=\s|$)/i)?.[1];
	const rawName = explicit || beforeInvoice;
	if (!rawName || isNumberToken(rawName) || currencyWords[rawName]) return null;
	return { name: normalizeName(rawName), confidence: explicit ? 0.96 : 0.92 };
}

function normalizeName(name: string) {
	const knownCases: Record<string, string> = {
		івана: 'Іван', івану: 'Іван', марії: 'Марія', олександру: 'Олександр', олександра: 'Олександр', олегу: 'Олег',
		ивана: 'Иван', ивану: 'Иван', марии: 'Мария', александру: 'Александр', александра: 'Александр'
	};
	return knownCases[name] || `${name.charAt(0).toLocaleUpperCase()}${name.slice(1)}`;
}