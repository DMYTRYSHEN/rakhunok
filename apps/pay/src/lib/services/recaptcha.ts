declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = '6LdeMo0tAAAAACXUw3wf3o-09QH0__AQsI5oWyQV';
let cachedToken = '';
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let loadPromise: Promise<void> | null = null;

export function loadRecaptcha(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.grecaptcha) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function refreshRecaptchaToken(): Promise<string> {
  if (typeof window === 'undefined') return Promise.resolve('');
  if (!window.grecaptcha || typeof window.grecaptcha.ready !== 'function') {
    return Promise.resolve(cachedToken);
  }

  return new Promise((resolve) => {
    window.grecaptcha?.ready(async () => {
      try {
        const token = await window.grecaptcha?.execute(SITE_KEY, { action: 'checkout' });
        if (token) cachedToken = token;
        resolve(cachedToken);
      } catch {
        resolve(cachedToken);
      }
    });
  });
}

export function ensureRecaptcha(): Promise<string> {
  return loadRecaptcha().then(() => {
    if (!refreshTimer) {
      refreshTimer = setInterval(refreshRecaptchaToken, 90000);
    }
    return refreshRecaptchaToken();
  });
}

export function getCachedRecaptchaToken(): string {
  return cachedToken;
}
