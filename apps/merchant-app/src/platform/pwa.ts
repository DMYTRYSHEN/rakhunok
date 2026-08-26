type InstallPrompt = Event & {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let installPrompt: InstallPrompt | null = null;
let waitingWorker: ServiceWorker | null = null;

function emit(name: string, detail?: unknown) {
	window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function initializePwa() {
	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		installPrompt = event as InstallPrompt;
		emit('rahunok:install-available');
	});

	window.addEventListener('appinstalled', () => {
		installPrompt = null;
		emit('rahunok:installed');
	});

	if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
	window.addEventListener('load', () => {
		void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
			if (registration.waiting) {
				waitingWorker = registration.waiting;
				emit('rahunok:update-available');
			}
			registration.addEventListener('updatefound', () => {
				const worker = registration.installing;
				worker?.addEventListener('statechange', () => {
					if (worker.state === 'installed' && navigator.serviceWorker.controller) {
						waitingWorker = worker;
						emit('rahunok:update-available');
					}
				});
			});
		});
	});

	let reloading = false;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (reloading) return;
		reloading = true;
		window.location.reload();
	});
}

export async function promptInstall(): Promise<boolean> {
	if (!installPrompt) return false;
	await installPrompt.prompt();
	const choice = await installPrompt.userChoice;
	if (choice.outcome === 'accepted') installPrompt = null;
	return choice.outcome === 'accepted';
}

export function applyPwaUpdate() {
	waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
}

export function isStandalone() {
	return window.matchMedia('(display-mode: standalone)').matches;
}