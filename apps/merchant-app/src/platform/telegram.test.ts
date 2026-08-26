import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindTelegramBackButton } from './telegram';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Telegram BackButton', () => {
	it('binds a visible back action and removes it during cleanup', () => {
		const show = vi.fn();
		const hide = vi.fn();
		const onClick = vi.fn();
		const offClick = vi.fn();
		vi.stubGlobal('window', { Telegram: {
			WebApp: {
				ready: vi.fn(),
				expand: vi.fn(),
				BackButton: { show, hide, onClick, offClick }
			}
		} });
		const onBack = vi.fn();

		const cleanup = bindTelegramBackButton(true, onBack);
		expect(onClick).toHaveBeenCalledWith(onBack);
		expect(show).toHaveBeenCalledOnce();

		cleanup();
		expect(offClick).toHaveBeenCalledWith(onBack);
		expect(hide).toHaveBeenCalledOnce();
	});

	it('hides the host control when there is no internal back target', () => {
		const hide = vi.fn();
		vi.stubGlobal('window', { Telegram: {
			WebApp: {
				ready: vi.fn(),
				expand: vi.fn(),
				BackButton: { show: vi.fn(), hide, onClick: vi.fn(), offClick: vi.fn() }
			}
		} });

		bindTelegramBackButton(false, vi.fn());
		expect(hide).toHaveBeenCalledOnce();
	});
});