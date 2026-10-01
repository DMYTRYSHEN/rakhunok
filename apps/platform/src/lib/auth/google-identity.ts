type GoogleIdentity = {
	accounts: { id: {
		initialize(options: { client_id: string; nonce: string; callback: (response: { credential?: string }) => void }): void;
		renderButton(parent: HTMLElement, options: { type: 'standard'; theme: 'outline'; size: 'large'; text: 'signin_with'; shape: 'rectangular'; width: number }): void;
	} };
};

const scriptUrl = 'https://accounts.google.com/gsi/client';
let pending: Promise<GoogleIdentity> | undefined;
const identity = () => (window as Window & { google?: GoogleIdentity }).google;

export function loadGoogleIdentityServices(): Promise<GoogleIdentity> {
	const loaded = identity();
	if (loaded) return Promise.resolve(loaded);
	if (pending) return pending;
	pending = new Promise<GoogleIdentity>((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
		const script = existing ?? document.createElement('script');
		script.addEventListener('load', () => {
			const google = identity();
			if (google) resolve(google);
			else reject(new Error('Google Identity Services is unavailable.'));
		}, { once: true });
		script.addEventListener('error', () => {
			script.remove();
			reject(new Error('Google Identity Services failed to load.'));
		}, { once: true });
		if (!existing) {
			script.src = scriptUrl;
			script.async = true;
			document.head.appendChild(script);
		}
	}).catch((error: unknown) => {
		pending = undefined;
		throw error;
	});
	return pending;
}

export async function createGoogleNonce() {
	const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
		.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
	const hashed = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
	return { raw, hashed };
}