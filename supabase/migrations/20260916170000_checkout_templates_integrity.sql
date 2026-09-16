begin;

update public.checkout_templates
set scenario_config = jsonb_build_object(
	'allow_loyalty', true,
	'allow_promo', true,
	'allow_roundup', true,
	'allow_tips', false,
	'allow_split', false,
	'allow_bnpl', true,
	'allow_upsell', true,
	'allow_delivery', false,
	'allow_compliance_card', false,
	'allow_nps_review', true,
	'show_other_banks', true
) || case when jsonb_typeof(scenario_config) = 'object' then scenario_config else '{}'::jsonb end;

alter table public.checkout_templates
	alter column scenario_config drop default,
	add constraint checkout_templates_name_check
		check (char_length(btrim(name)) between 1 and 120),
	add constraint checkout_templates_scenario_type_check
		check (scenario_type ~ '^[a-z][a-z0-9_]{0,63}$'),
	add constraint checkout_templates_scenario_config_check
		check (
			jsonb_typeof(scenario_config) = 'object'
			and scenario_config ?& array[
				'allow_loyalty', 'allow_promo', 'allow_roundup', 'allow_tips',
				'allow_split', 'allow_bnpl', 'allow_upsell', 'allow_delivery',
				'allow_compliance_card', 'allow_nps_review', 'show_other_banks'
			]
			and jsonb_typeof(scenario_config -> 'allow_loyalty') = 'boolean'
			and jsonb_typeof(scenario_config -> 'allow_promo') = 'boolean'
			and jsonb_typeof(scenario_config -> 'allow_roundup') = 'boolean'
			and jsonb_typeof(scenario_config -> 'allow_tips') = 'boolean'
			and jsonb_typeof(scenario_config -> 'allow_split') = 'boolean'
			and jsonb_typeof(scenario_config -> 'allow_bnpl') = 'boolean'
			and jsonb_typeof(scenario_config -> 'allow_upsell') = 'boolean'
			and jsonb_typeof(scenario_config -> 'allow_delivery') = 'boolean'
			and jsonb_typeof(scenario_config -> 'allow_compliance_card') = 'boolean'
			and jsonb_typeof(scenario_config -> 'allow_nps_review') = 'boolean'
			and jsonb_typeof(scenario_config -> 'show_other_banks') = 'boolean'
			and ((
				(
					scenario_type in ('fixed', 'open_amount', 'table', 'delivery', 'tips')
					and not scenario_config ? 'checkout_flow'
				)
				or (
					jsonb_typeof(scenario_config -> 'checkout_flow') = 'object'
					and scenario_config -> 'checkout_flow' ->> 'id' = scenario_type
					and scenario_config -> 'checkout_flow' ->> 'id' ~ '^[a-z][a-z0-9_]{0,63}$'
					and scenario_config -> 'checkout_flow' -> 'version' = '1'::jsonb
					and (
						not scenario_config -> 'checkout_flow' ? 'invoice_type'
						or scenario_config -> 'checkout_flow' ->> 'invoice_type'
							in ('fixed', 'open_amount', 'table', 'delivery')
					)
					and (
						scenario_type in ('fixed', 'open_amount', 'table', 'delivery', 'tips')
						or scenario_config -> 'checkout_flow' ? 'invoice_type'
					)
				)
			) is true)
			and (
				not scenario_config ? 'flow_data'
				or jsonb_typeof(scenario_config -> 'flow_data') = 'object'
			)
		);

drop policy if exists "Merchants can view their own templates" on public.checkout_templates;
drop policy if exists "Merchants can insert their own templates" on public.checkout_templates;
drop policy if exists "Merchants can update their own templates" on public.checkout_templates;
drop policy if exists "Merchants can delete their own templates" on public.checkout_templates;

create policy "Active members can view checkout templates"
	on public.checkout_templates for select to authenticated
	using (
		exists (
			select 1 from public.merchants
			where id = merchant_id and user_id = (select auth.uid())
		)
		or exists (
			select 1 from public.merchant_memberships
			where merchant_id = checkout_templates.merchant_id
				and user_id = (select auth.uid())
				and status = 'active'
		)
	);

create policy "Owners and managers can insert checkout templates"
	on public.checkout_templates for insert to authenticated
	with check (public.get_merchant_role(merchant_id, (select auth.uid())) in ('owner', 'manager'));

create policy "Owners and managers can update checkout templates"
	on public.checkout_templates for update to authenticated
	using (public.get_merchant_role(merchant_id, (select auth.uid())) in ('owner', 'manager'))
	with check (public.get_merchant_role(merchant_id, (select auth.uid())) in ('owner', 'manager'));

create policy "Owners and managers can delete checkout templates"
	on public.checkout_templates for delete to authenticated
	using (public.get_merchant_role(merchant_id, (select auth.uid())) in ('owner', 'manager'));

create or replace function public.create_checkout_template(p_merchant_id uuid, p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_template public.checkout_templates;
	v_default boolean := coalesce((p_input ->> 'is_default')::boolean, false);
begin
	perform pg_advisory_xact_lock(hashtextextended(p_merchant_id::text, 0));
	if v_default then
		update public.checkout_templates set is_default = false
		where merchant_id = p_merchant_id and is_default;
	end if;
	insert into public.checkout_templates (merchant_id, name, scenario_type, scenario_config, is_default)
	values (p_merchant_id, p_input ->> 'name', p_input ->> 'scenario_type', p_input -> 'scenario_config', v_default)
	returning * into v_template;
	return to_jsonb(v_template);
end;
$$;

create or replace function public.update_checkout_template(p_merchant_id uuid, p_template_id uuid, p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	v_template public.checkout_templates;
	v_default boolean := coalesce((p_input ->> 'is_default')::boolean, false);
begin
	perform pg_advisory_xact_lock(hashtextextended(p_merchant_id::text, 0));
	if v_default then
		update public.checkout_templates set is_default = false
		where merchant_id = p_merchant_id and id <> p_template_id and is_default;
	end if;
	update public.checkout_templates
	set name = p_input ->> 'name',
		scenario_type = p_input ->> 'scenario_type',
		scenario_config = p_input -> 'scenario_config',
		is_default = v_default
	where id = p_template_id and merchant_id = p_merchant_id
	returning * into v_template;
	if v_template.id is null then raise exception 'checkout_template_not_found' using errcode = 'P0002'; end if;
	return to_jsonb(v_template);
end;
$$;

create or replace function public.delete_checkout_template(p_merchant_id uuid, p_template_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
	delete from public.checkout_templates
	where id = p_template_id and merchant_id = p_merchant_id;
	if not found then raise exception 'checkout_template_not_found' using errcode = 'P0002'; end if;
end;
$$;

create or replace function public.set_checkout_template_default(p_merchant_id uuid, p_template_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
	perform pg_advisory_xact_lock(hashtextextended(p_merchant_id::text, 0));
	if not exists (
		select 1 from public.checkout_templates
		where id = p_template_id and merchant_id = p_merchant_id
	) then
		raise exception 'checkout_template_not_found' using errcode = 'P0002';
	end if;
	update public.checkout_templates set is_default = (id = p_template_id)
	where merchant_id = p_merchant_id and (is_default or id = p_template_id);
end;
$$;

revoke all on function public.create_checkout_template(uuid, jsonb) from public, anon;
revoke all on function public.update_checkout_template(uuid, uuid, jsonb) from public, anon;
revoke all on function public.delete_checkout_template(uuid, uuid) from public, anon;
revoke all on function public.set_checkout_template_default(uuid, uuid) from public, anon;
grant execute on function public.create_checkout_template(uuid, jsonb) to authenticated;
grant execute on function public.update_checkout_template(uuid, uuid, jsonb) to authenticated;
grant execute on function public.delete_checkout_template(uuid, uuid) to authenticated;
grant execute on function public.set_checkout_template_default(uuid, uuid) to authenticated;

commit;