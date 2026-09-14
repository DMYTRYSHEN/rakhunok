export function googleEnvironmentMessage(secureContext: boolean, hasSubtleCrypto: boolean): string {
	return secureContext && hasSubtleCrypto ? '' :
		'Вхід через Google потребує HTTPS. На цьому комп’ютері відкрийте App через localhost; на телефоні потрібна захищена HTTPS-адреса. Оновлення сторінки не усуне це обмеження.';
}

export const telegramLocalMessage = 'Вхід через Telegram на цій адресі ще не активовано. Механізм сесій підготовлено; потрібне налаштування Telegram Login і провайдера Supabase на тестовому HTTPS-домені. Тут ця кнопка нічого не надсилає.';