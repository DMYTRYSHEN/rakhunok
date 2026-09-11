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

function sha256Hex(ascii: string): string {
    function rightRotate(value: number, amount: number) {
        return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = '';
    const words: number[] = [];
    const asciiBitLength = ascii.length * 8;
    let hash: number[] = [];
    let k: number[] = [];
    let primeCounter = 0;
    const isComposite: Record<number, number> = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
            for (let i = candidate * candidate; i < 313; i += candidate) {
                isComposite[i] = candidate;
            }
            if (primeCounter < 8) hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
            k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
            primeCounter++;
        }
    }
    ascii += '\x80';
    while ((ascii.length % 64) - 56) ascii += '\x00';
    for (let i = 0; i < ascii.length; i++) {
        const j = ascii.charCodeAt(i);
        words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength | 0;
    for (let j = 0; j < words.length; ) {
        const w = words.slice(j, (j += 16));
        const oldHash = [...hash];
        for (let i = 0; i < 64; i++) {
            const w15 = w[i - 15], w2 = w[i - 2];
            const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
            const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
            const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
            const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
            const temp1 =
                (hash[7] +
                (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) +
                ch +
                k[i] +
                (w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0)) | 0;
            const temp2 =
                ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) +
                maj) | 0;
            hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
        }
        for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) {
        for (let b = 3; b >= 0; b--) {
            const byte = (hash[i] >> (b * 8)) & 255;
            result += (byte < 16 ? '0' : '') + byte.toString(16);
        }
    }
    return result;
}

export async function createGoogleNonce(): Promise<{ raw: string; hashed: string }> {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const raw = toBase64Url(randomBytes);
    try {
        if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
            return { raw, hashed: toHex(new Uint8Array(digest)) };
        }
    } catch {}
    return { raw, hashed: sha256Hex(raw) };
}