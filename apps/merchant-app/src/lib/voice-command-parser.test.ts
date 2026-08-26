import { describe, expect, it } from 'vitest';
import { parseVoiceCommand } from './voice-command-parser';

describe('parseVoiceCommand', () => {
	it.each([
		['Створи рахунок на 345 гривень', 34500, 'uk'],
		['Створи рахунок на 345,50 грн', 34550, 'uk'],
		["Створи рахунок на триста сорок п'ять гривень п'ятдесят копійок", 34550, 'uk'],
		["Створи рахунок на триста сорок п'ять гривень з п'ятдесятьма копійками", 34550, 'uk'],
		['Создай счёт на 345 гривен 50 копеек', 34550, 'ru'],
		['Создай счёт на триста сорок пять гривен с пятьюдесятью копейками', 34550, 'ru'],
		['Выставь счёт на сто двадцать три тысячи четыреста пятьдесят шесть гривен', 12345600, 'ru'],
		['Створи рахунок на 500', 50000, 'uk'],
		['До сплати 730 гривень', 73000, 'uk'],
		['К оплате 840 гривен', 84000, 'ru'],
		['С вас 950 гривен', 95000, 'ru']
	])('%s', (text, valueMinor, language) => {
		const result = parseVoiceCommand(text);
		expect(result.intent.name).toBe('invoice.create');
		expect(result.entities.amount?.value_minor).toBe(valueMinor);
		expect(result.entities.amount?.currency).toBe('UAH');
		expect(result.language).toBe(language);
		expect(result.source.text).toBe(text);
		expect(result.validation.valid).toBe(true);
	});

	it.each([
		['Створи рахунок для Івана на 500 гривень', 'Іван'],
		['Вистав Івану рахунок на 500 гривень', 'Іван'],
		['Мені потрібно виставити Марії рахунок на 1200 гривень', 'Марія'],
		['Создай счёт для Александра на 500 гривен', 'Александр'],
		['Выставь Олегу счёт на тысячу гривен', 'Олег']
	])('extracts customer from %s', (text, customer) => {
		expect(parseVoiceCommand(text).entities.customer?.name).toBe(customer);
	});

	it('parses the Russian accusative form for one thousand', () => {
		expect(parseVoiceCommand('Выставь Олегу счёт на тысячу гривен').entities.amount?.value_minor).toBe(100000);
	});

	it('rejects negated creation', () => {
		const result = parseVoiceCommand('Не створюй рахунок на 500 гривень');
		expect(result.intent.name).toBeNull();
		expect(result.validation.valid).toBe(false);
	});

	it('marks approximate amounts for confirmation', () => {
		const result = parseVoiceCommand('Створи рахунок десь на триста гривень');
		expect(result.entities.amount).toMatchObject({ value_minor: 30000, confidence: 0.65 });
		expect(result.validation.requires_confirmation).toBe(true);
	});

	it('returns unsupported currencies as validation errors', () => {
		const result = parseVoiceCommand('Створи рахунок на 50 євро');
		expect(result.entities.amount?.currency).toBe('EUR');
		expect(result.validation.valid).toBe(false);
	});
});