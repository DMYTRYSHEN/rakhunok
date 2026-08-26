// =========================================================
// DeepLink & Bank Launch Orchestrator
// =========================================================

export async function initiateBankPayment(orderId, bankCode, customAmount) {
  const API_ENDPOINT = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? `http://localhost:8787/api/v1/checkout/${orderId}/initiate`
    : `/api/v1/checkout/${orderId}/initiate`;

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bank_code: bankCode,
        amount: customAmount
      })
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API initiate failed, using client-side fallback deep link:', err);
  }

  // Client-side fallback deep links
  const schemeMap = {
    TASB: `izibank://bank.gov.ua/qr/`,
    GLBU: `globus://bank.gov.ua/qr/`,
    UNJS: `https://send.monobank.ua/`,
    PBAN: `https://next.privat24.ua/pay/`,
    FUIB: `pumb-online.app://`,
    NOVA: `novapay-mobile://`
  };

  return {
    success: true,
    redirect_url: schemeMap[bankCode] || `https://qr.bank.gov.ua/`,
    fallback_url: `https://qr.bank.gov.ua/`
  };
}

export function launchDeepLink(redirectUrl, fallbackUrl) {
  // 1. Try to open the banking app
  window.location.href = redirectUrl;

  // 2. Trampoline fallback: If user remains in browser after 3.5s, app is not installed
  setTimeout(() => {
    if (document.hasFocus() || document.visibilityState === 'visible') {
      if (fallbackUrl && !fallbackUrl.startsWith('http://localhost')) {
        window.location.href = fallbackUrl;
      }
    }
  }, 3500);
}
