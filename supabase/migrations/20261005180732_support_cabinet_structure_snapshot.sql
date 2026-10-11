begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create or replace function support_private.snapshot(p_target uuid, p_merchant uuid)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
begin
	if not exists (select 1 from public.merchants where id = p_merchant and user_id = p_target) then
		raise exception 'Support merchant unavailable' using errcode = '42501';
	end if;
	if exists (select 1 from public.business_settings_sellers seller
		left join public.business_entities entity on entity.id = seller.entity_id
		where seller.merchant_id = p_merchant and
			(seller.owner_user_id is distinct from p_target or entity.user_id is distinct from p_target)) then
		raise exception 'Support settings unavailable' using errcode = '42501';
	end if;
	if exists (select 1 from public.terminals terminal
		left join public.business_entities entity on entity.id = terminal.entity_id
		where terminal.user_id = p_target and terminal.entity_id is not null
			and entity.user_id is distinct from p_target) then
		raise exception 'Support structure unavailable' using errcode = '42501';
	end if;
	if exists (select 1 from public.business_entity_contacts contact
		join public.business_entities entity on entity.id = contact.entity_id
		where entity.user_id = p_target and contact.user_id is distinct from p_target) then
		raise exception 'Support contacts unavailable' using errcode = '42501';
	end if;
	return jsonb_build_object(
		'merchant', (select jsonb_build_object('id', id, 'name', business_name,
			'active', is_active, 'onboardingComplete', onboarding_completed)
			from public.merchants where id = p_merchant and user_id = p_target),
		'settings', (select jsonb_build_object('revision', revision, 'document', config ||
			jsonb_build_object('sellers', coalesce((select jsonb_object_agg(seller_key, config)
				from public.business_settings_sellers where merchant_id = p_merchant and owner_user_id = p_target), '{}'::jsonb)))
			from public.business_settings where merchant_id = p_merchant and owner_user_id = p_target),
		'tableTtl', jsonb_build_object('storedSeconds', (select table_order_ttl_seconds
			from public.merchant_settings where merchant_id = p_merchant),
			'effectiveSeconds', coalesce((select table_order_ttl_seconds
			from public.merchant_settings where merchant_id = p_merchant), 1800)),
		'entities', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', business_name,
			'iban', iban, 'taxId', tax_id, 'active', is_active) order by id)
			from public.business_entities where user_id = p_target), '[]'::jsonb),
		'terminals', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name,
			'entityId', entity_id, 'active', is_active) order by id)
			from public.terminals where user_id = p_target), '[]'::jsonb),
		'structure', jsonb_build_object(
			'entities', coalesce((select jsonb_agg(jsonb_build_object(
				'id', entity.id, 'businessType', entity.business_type, 'businessName', entity.business_name,
				'displayName', entity.display_name, 'taxId', entity.tax_id, 'bankName', entity.bank_name,
				'iban', entity.iban, 'isActive', entity.is_active) || jsonb_strip_nulls(jsonb_build_object(
				'phone', contact.phone, 'contactEmail', contact.contact_email, 'website', contact.website)) order by entity.id)
				from public.business_entities entity left join public.business_entity_contacts contact
					on contact.entity_id = entity.id and contact.user_id = p_target
				where entity.user_id = p_target), '[]'::jsonb),
			'terminals', coalesce((select jsonb_agg(jsonb_build_object(
				'id', id, 'name', name, 'code', code, 'type', type,
				'entityId', entity_id, 'isActive', is_active) order by id)
				from public.terminals where user_id = p_target), '[]'::jsonb)),
		'invoices', coalesce((select jsonb_agg(item order by created_at desc, id desc) from (
			select id, created_at, jsonb_build_object('id', id, 'number', order_number,
				'type', type, 'title', title, 'status', status, 'amount', total_amount,
				'currency', currency, 'createdAt', created_at, 'expiresAt', expires_at) item
			from public.orders where merchant_id = p_merchant order by created_at desc, id desc limit 100
		) recent), '[]'::jsonb));
end
$$;

revoke all on function support_private.snapshot(uuid, uuid) from public, anon, authenticated;

commit;
