import { getSupabaseBrowserClient } from '../api/supabase-browser';
import type { CheckoutTemplate, TemplateCreateInput } from '../types';

export async function listTemplates(merchantId: string): Promise<CheckoutTemplate[]> {
	const client = getSupabaseBrowserClient();
	if (!client) throw new Error('Supabase client not initialized');

	const { data, error } = await client
		.from('checkout_templates')
		.select('*')
		.eq('merchant_id', merchantId)
		.order('created_at', { ascending: false });

	if (error) throw error;
	return data as CheckoutTemplate[];
}

export async function getTemplate(id: string): Promise<CheckoutTemplate | null> {
	const client = getSupabaseBrowserClient();
	if (!client) throw new Error('Supabase client not initialized');

	const { data, error } = await client
		.from('checkout_templates')
		.select('*')
		.eq('id', id)
		.single();

	if (error) throw error;
	return data as CheckoutTemplate;
}

export async function createTemplate(merchantId: string, input: TemplateCreateInput): Promise<CheckoutTemplate> {
	const client = getSupabaseBrowserClient();
	if (!client) throw new Error('Supabase client not initialized');

	// If this is set as default, we need to unset the previous default
	if (input.is_default) {
		await unsetDefaultTemplate(merchantId);
	}

	const { data, error } = await client
		.from('checkout_templates')
		.insert({
			merchant_id: merchantId,
			...input
		})
		.select()
		.single();

	if (error) throw error;
	return data as CheckoutTemplate;
}

export async function updateTemplate(merchantId: string, id: string, updates: Partial<TemplateCreateInput>): Promise<CheckoutTemplate> {
	const client = getSupabaseBrowserClient();
	if (!client) throw new Error('Supabase client not initialized');

	if (updates.is_default) {
		await unsetDefaultTemplate(merchantId);
	}

	const { data, error } = await client
		.from('checkout_templates')
		.update(updates)
		.eq('id', id)
		.select()
		.single();

	if (error) throw error;
	return data as CheckoutTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
	const client = getSupabaseBrowserClient();
	if (!client) throw new Error('Supabase client not initialized');

	const { error } = await client
		.from('checkout_templates')
		.delete()
		.eq('id', id);

	if (error) throw error;
}

export async function setDefaultTemplate(merchantId: string, id: string): Promise<void> {
	const client = getSupabaseBrowserClient();
	if (!client) throw new Error('Supabase client not initialized');

	await unsetDefaultTemplate(merchantId);

	const { error } = await client
		.from('checkout_templates')
		.update({ is_default: true })
		.eq('id', id);

	if (error) throw error;
}

async function unsetDefaultTemplate(merchantId: string): Promise<void> {
	const client = getSupabaseBrowserClient();
	if (!client) throw new Error('Supabase client not initialized');

	await client
		.from('checkout_templates')
		.update({ is_default: false })
		.eq('merchant_id', merchantId)
		.eq('is_default', true);
}
