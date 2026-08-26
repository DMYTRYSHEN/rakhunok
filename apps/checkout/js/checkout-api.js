export function getApiBase(location = window.location) {
  return location.hostname === 'localhost' && location.port !== '8787'
    ? 'http://localhost:8787'
    : '';
}

export async function fetchCheckoutOrder(orderId, options = {}) {
  if (!orderId) return { order: null, reason: 'missing-id' };

  const fetchImpl = options.fetchImpl || fetch;
  const apiBase = options.apiBase ?? getApiBase(options.location);
  try {
    const response = await fetchImpl(
      `${apiBase}/api/v1/checkout/${encodeURIComponent(orderId)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (response.status === 404) return { order: null, reason: 'not-found' };
    if (!response.ok) return { order: null, reason: 'server-error', status: response.status };
    return { order: await response.json(), reason: null };
  } catch (error) {
    return { order: null, reason: 'offline', error };
  }
}