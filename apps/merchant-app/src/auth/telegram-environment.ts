/** Environment detection only; never inspect Login SDK private state/callbacks. */
export function telegramInAppEnvironment(host: {
	TelegramWebviewProxy?: unknown;
	TelegramWebviewProxyProto?: unknown;
	Telegram?: { WebApp?: { initData?: string; platform?: string } };
	navigator?: { userAgent?: string };
	location?: { hash?: string; search?: string };
} = window): boolean {
	const webApp = host.Telegram?.WebApp;
	return host.TelegramWebviewProxy !== undefined || host.TelegramWebviewProxyProto !== undefined
		|| Boolean(webApp?.initData)
		|| Boolean(webApp?.platform && webApp.platform !== 'unknown')
		|| /telegram/i.test(host.navigator?.userAgent ?? '')
		|| /(?:^|[?#&])tgWebApp(?:Data|Platform|Version)=/.test(`${host.location?.hash ?? ''}&${host.location?.search ?? ''}`);
}

export function isTelegramInApp(): boolean {
	return typeof window !== 'undefined' && telegramInAppEnvironment(window);
}