import type { BankOption } from './components/BankLogoCarousel.svelte';

export const checkoutBanks: readonly BankOption[] = [
	{
		id: 'pb',
		name: 'ПриватБанк',
		shortName: 'Приват24',
		code: '24',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/57/f8/e0/57f8e0bf-783f-766a-b52b-ba630accaef1/Placeholder.mill/200x200bb-75.webp',
		color: '#78be20'
	},
	{
		id: 'oschad',
		name: 'Ощадбанк',
		shortName: 'Ощад',
		code: 'ОЩ',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/fb/bd/c8/fbbdc880-5b61-b1a9-f33c-ace61c38be11/Placeholder.mill/200x200bb-75.webp',
		color: '#28cfc6'
	},
	{
		id: 'myraif',
		name: 'Райффайзен Банк',
		shortName: 'MyRaif',
		code: 'RA',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/2f/8f/ce/2f8fced9-fdee-7c58-2346-88d943faa770/Placeholder.mill/200x200bb-75.webp',
		color: '#d4bd00'
	},
	{
		id: 'pumb',
		name: 'ПУМБ',
		shortName: 'ПУМБ',
		code: 'ПУ',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/02/0a/09/020a099e-1a78-877b-6394-0919c2b247c4/Placeholder.mill/200x200bb-75.webp',
		color: '#ee3124'
	},
	{
		id: 'sensebank',
		name: 'Sense Bank',
		shortName: 'Sense',
		code: 'S',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/06/da/1c/06da1ccf-fdb3-ae36-cf00-e258e76e2284/Placeholder.mill/200x200bb-75.webp',
		color: '#2622fe'
	},
	{
		id: 'abank',
		name: 'А-Банк',
		shortName: 'А24',
		code: 'A',
		logo: 'https://a-bank.com.ua/favicon.ico',
		color: '#16a34a'
	},
	{
		id: 'mono',
		name: 'monobank',
		shortName: 'mono',
		code: 'MO',
		logo: 'https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/a7/06/5a/a7065ad9-93f8-5705-4b1a-81ade2916c05/Placeholder.mill/200x200bb-75.webp',
		color: '#171719'
	}
];