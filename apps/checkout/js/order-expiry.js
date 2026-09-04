export const DEFAULT_LEGACY_ORDER_TTL_MINUTES = 30;

function parseTimestamp(value) {
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value !== 'string' || !value) return null;
	const timestamp = new Date(value).getTime();
	return Number.isFinite(timestamp) ? timestamp : null;
}

export function getOrderExpiryTime(order, legacyTtlMinutes = DEFAULT_LEGACY_ORDER_TTL_MINUTES) {
	if (!order) return null;

	const hasSnakeCaseExpiry = Object.prototype.hasOwnProperty.call(order, 'expires_at');
	const hasExplicitExpiry =
		hasSnakeCaseExpiry || Object.prototype.hasOwnProperty.call(order, 'expiresAt');
	const explicitExpiryValue = hasSnakeCaseExpiry ? order.expires_at : order.expiresAt;
	if (hasExplicitExpiry && explicitExpiryValue === null) return Number.POSITIVE_INFINITY;

	const explicitExpiry = parseTimestamp(explicitExpiryValue);
	if (explicitExpiry !== null) return explicitExpiry;

	const createdAt = parseTimestamp(order.created_at ?? order.createdAt);
	if (createdAt === null) return null;
	const ttlMinutes =
		Number.isFinite(legacyTtlMinutes) && legacyTtlMinutes > 0
			? legacyTtlMinutes
			: DEFAULT_LEGACY_ORDER_TTL_MINUTES;
	return createdAt + ttlMinutes * 60_000;
}

export function getOrderRemainingSeconds(order, now = Date.now(), legacyTtlMinutes) {
	const expiryTime = getOrderExpiryTime(order, legacyTtlMinutes);
	if (expiryTime === null) return 0;
	if (!Number.isFinite(expiryTime)) return Number.POSITIVE_INFINITY;
	return Math.max(0, Math.ceil((expiryTime - now) / 1000));
}

export function getOrderTotalTtlSeconds(order, legacyTtlMinutes) {
	const expiryTime = getOrderExpiryTime(order, legacyTtlMinutes);
	const createdAt = parseTimestamp(order?.created_at ?? order?.createdAt);
	if (expiryTime === null || createdAt === null) return 0;
	if (!Number.isFinite(expiryTime)) return Number.POSITIVE_INFINITY;
	return Math.max(0, Math.ceil((expiryTime - createdAt) / 1000));
}

export function isOrderFresh(order, now = Date.now(), legacyTtlMinutes) {
	return getOrderRemainingSeconds(order, now, legacyTtlMinutes) > 0;
}

export function formatRemainingTime(totalSeconds) {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainder = seconds % 60;
	const parts = [minutes, remainder].map((part) => String(part).padStart(2, '0'));
	if (hours > 0) parts.unshift(String(hours).padStart(2, '0'));
	return parts.join(':');
}
