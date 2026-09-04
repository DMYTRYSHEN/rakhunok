export type ClientOS = 'ios' | 'android' | 'desktop';

export function detectOS(): ClientOS {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream) {
    return 'ios';
  }
  if (/android/i.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

export function launchDeepLink(
  redirectUrl: string,
  fallbackUrl?: string,
  onFallback?: () => void
): void {
  if (typeof window === 'undefined') return;
  const os = detectOS();

  if (os === 'desktop') {
    if (redirectUrl) {
      window.open(redirectUrl, '_blank');
    }
    return;
  }

  // Mobile (iOS / Android): try deep link
  window.location.href = redirectUrl;

  // Trampoline fallback: If user remains in browser after 3.5s, app is not installed
  setTimeout(() => {
    if (document.hasFocus() || document.visibilityState === 'visible') {
      if (fallbackUrl && fallbackUrl !== redirectUrl) {
        window.location.href = fallbackUrl;
      }
      if (onFallback) onFallback();
    }
  }, 3500);
}
