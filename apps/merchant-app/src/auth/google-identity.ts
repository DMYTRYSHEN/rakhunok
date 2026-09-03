const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';

type GoogleCredentialResponse = {
	credential?: string;
};

type GoogleIdentityServices = {
	accounts: {
		id: {
			initialize(options: {
				client_id: string;
				callback: (response: GoogleCredentialResponse) => void;
				nonce: string;
			}): void;
			renderButton(
				parent: HTMLElement,
				options: {
					type: 'standard';
					theme: 'outline';
					size: 'large';
					text: 'signin_with';
					shape: 'rectangular';
					width: number;
				}
			): void;
		};
	};
};

declare global {
	interface Window {
		google?: GoogleIdentityServices;
	}
}

let scriptPromise: Promise<GoogleIdentityServices> | undefined;

export function loadGoogleIdentityServices(): Promise<GoogleIdentityServices> {
	if (window.google) return Promise.resolve(window.google);
	if (scriptPromise) return scriptPromise;

	const pendingScript = new Promise<GoogleIdentityServices>((resolve, reject) => {
		const existingScript = document.querySelector<HTMLScriptElement>(
			`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`
		);
		const script = existingScript ?? document.createElement('script');
		const handleLoad = () => {
			if (window.google) resolve(window.google);
			else reject(new Error('Google Identity Services API is unavailable.'));
		};
		const handleError = () => reject(new Error('Google Identity Services failed to load.'));

		script.addEventListener('load', handleLoad, { once: true });
		script.addEventListener('error', handleError, { once: true });
		if (!existingScript) {
			script.src = GOOGLE_IDENTITY_SCRIPT;
			script.async = true;
			script.defer = true;
			document.head.appendChild(script);
		}
	}).catch((error: unknown) => {
		scriptPromise = undefined;
		throw error;
	});
	scriptPromise = pendingScript;

	return pendingScript;
}

function toBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replaceAll('=', '');
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createGoogleNonce(): Promise<{ raw: string; hashed: string }> {
	const randomBytes = crypto.getRandomValues(new Uint8Array(32));
	const raw = toBase64Url(randomBytes);
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
	return { raw, hashed: toHex(new Uint8Array(digest)) };
}