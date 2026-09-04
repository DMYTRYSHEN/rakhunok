declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          cData?: string;
          callback?: (token: string) => void;
          'error-callback'?: (err: unknown) => void;
          'timeout-callback'?: () => void;
          theme?: 'auto' | 'light' | 'dark';
          appearance?: 'always' | 'execute' | 'interaction-only';
        }
      ) => string;
      execute: (container?: string | HTMLElement, options?: Record<string, unknown>) => void;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

// Cloudflare Turnstile Always-Pass Sitekey (or custom sitekey via env)
const DEFAULT_SITE_KEY = '1x00000000000000000000AA';

let cachedToken = '';
let turnstilePromise: Promise<string> | null = null;
let scriptLoaded = false;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => resolve());
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => {
      resolve(); // Graceful degradation if blocked
    };
    document.head.appendChild(script);
  });
}

/**
 * Executes Cloudflare Turnstile strictly upon button interaction.
 * Zero overhead during initial page load and First Contentful Paint.
 */
export async function executeTurnstile(action = 'pay'): Promise<string> {
  if (typeof window === 'undefined') return '';
  if (cachedToken) return cachedToken;
  if (turnstilePromise) return turnstilePromise;

  turnstilePromise = new Promise(async (resolve) => {
    // Safety timeout: never block payments if user is offline or using strict adblocker
    const timer = setTimeout(() => {
      resolve(cachedToken);
    }, 1800);

    try {
      await loadTurnstileScript();

      if (!window.turnstile) {
        clearTimeout(timer);
        return resolve(cachedToken);
      }

      let container = document.getElementById('cf-turnstile-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'cf-turnstile-container';
        container.style.display = 'none';
        document.body.appendChild(container);
      }

      const sitekey =
        (typeof import.meta !== 'undefined' &&
          (import.meta.env?.VITE_TURNSTILE_SITEKEY || import.meta.env?.PUBLIC_TURNSTILE_SITEKEY)) ||
        DEFAULT_SITE_KEY;

      window.turnstile.render(container, {
        sitekey,
        action,
        appearance: 'execute',
        callback: (token: string) => {
          clearTimeout(timer);
          cachedToken = token;
          resolve(token);
        },
        'error-callback': () => {
          clearTimeout(timer);
          resolve(cachedToken);
        },
        'timeout-callback': () => {
          clearTimeout(timer);
          resolve(cachedToken);
        }
      });
    } catch {
      clearTimeout(timer);
      resolve(cachedToken);
    }
  });

  return turnstilePromise;
}

export function getCachedTurnstileToken(): string {
  return cachedToken;
}
