type HapticStyle = 'light' | 'medium' | 'selection';

interface TelegramWebApp {
	colorScheme?: 'light' | 'dark';
	ready(): void;
	expand(): void;
	setHeaderColor?(color: string): void;
	setBackgroundColor?(color: string): void;
	HapticFeedback?: {
		impactOccurred(style: 'light' | 'medium'): void;
		selectionChanged(): void;
	};
	BackButton?: {
		show(): void;
		hide(): void;
		onClick(callback: () => void): void;
		offClick(callback: () => void): void;
	};
}

declare global {
	interface Window {
		Telegram?: { WebApp?: TelegramWebApp };
	}
}

export function initializeTelegram(): void {
	const webApp = window.Telegram?.WebApp;
	if (!webApp) return;
	document.documentElement.dataset.host = 'telegram';
	if (webApp.colorScheme) document.documentElement.dataset.theme = webApp.colorScheme;
	webApp.setHeaderColor?.('#222222');
	webApp.setBackgroundColor?.('#222222');
	webApp.ready();
	webApp.expand();
}

export function haptic(style: HapticStyle): void {
	const feedback = window.Telegram?.WebApp?.HapticFeedback;
	if (style === 'selection') feedback?.selectionChanged();
	else feedback?.impactOccurred(style);
}

export function bindTelegramBackButton(visible: boolean, onBack: () => void): () => void {
	const backButton = window.Telegram?.WebApp?.BackButton;
	if (!backButton) return () => undefined;
	if (!visible) {
		backButton.hide();
		return () => undefined;
	}
	backButton.onClick(onBack);
	backButton.show();
	return () => {
		backButton.offClick(onBack);
		backButton.hide();
	};
}