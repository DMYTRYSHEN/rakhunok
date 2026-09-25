import { loadBankDirectory } from '$lib/features/landing/data/bank-directory';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => ({
	directory: await loadBankDirectory(fetch)
});