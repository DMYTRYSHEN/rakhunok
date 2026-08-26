export type PublicPageConfig = {
	slug: string;
	displayName: string;
	description: string;
};

export const PUBLIC_PAGE_STORAGE_KEY = 'rahunok.public-page.v1';
export const PUBLIC_SLUG_MIN_LENGTH = 3;
export const PUBLIC_SLUG_MAX_LENGTH = 40;

const reservedSlugs = new Set([
	'admin',
	'api',
	'checkout',
	'dashboard',
	'docs',
	'login',
	'p',
	'pay',
	'settings',
	'support'
]);

export const defaultPublicPageConfig: PublicPageConfig = {
	slug: '',
	displayName: '',
	description: ''
};

export function normalizePublicSlug(value: string) {
	return value
		.trim()
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\s_]+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, PUBLIC_SLUG_MAX_LENGTH);
}

export function validatePublicSlug(value: string) {
	if (!value) return 'Вкажіть публічний ідентифікатор.';
	if (value.length < PUBLIC_SLUG_MIN_LENGTH) {
		return `Ідентифікатор має містити щонайменше ${PUBLIC_SLUG_MIN_LENGTH} символи.`;
	}
	if (value.length > PUBLIC_SLUG_MAX_LENGTH) {
		return `Ідентифікатор має містити не більше ${PUBLIC_SLUG_MAX_LENGTH} символів.`;
	}
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
		return 'Використовуйте латинські літери, цифри та дефіси між словами.';
	}
	if (reservedSlugs.has(value)) return 'Цей ідентифікатор зарезервовано Rahunok.';
	return null;
}

export function loadPublicPageConfig(): PublicPageConfig {
	if (typeof localStorage === 'undefined') return { ...defaultPublicPageConfig };
	try {
		const stored = JSON.parse(
			localStorage.getItem(PUBLIC_PAGE_STORAGE_KEY) ?? '{}'
		) as Partial<PublicPageConfig>;
		return {
			slug: typeof stored.slug === 'string' ? normalizePublicSlug(stored.slug) : '',
			displayName: typeof stored.displayName === 'string' ? stored.displayName.slice(0, 80) : '',
			description: typeof stored.description === 'string' ? stored.description.slice(0, 180) : ''
		};
	} catch {
		return { ...defaultPublicPageConfig };
	}
}

export function savePublicPageConfig(config: PublicPageConfig) {
	localStorage.setItem(PUBLIC_PAGE_STORAGE_KEY, JSON.stringify(config));
}