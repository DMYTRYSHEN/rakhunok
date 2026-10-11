begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

alter table support_private.contexts add column templates_workspace jsonb;
alter table support_private.operations drop constraint operations_action_check;
alter table support_private.operations add constraint operations_action_check check (action in (
 'settings.table_ttl','settings.business.save','structure.merchant.rename','structure.entity.create',
 'structure.entity.update','structure.entity.delete','structure.terminal.create','structure.terminal.update',
 'structure.terminal.delete','invoice.fixed.create','invoice.create',
 'templates.create','templates.update','templates.delete','templates.default'));

alter function support_private.snapshot(uuid,uuid) rename to snapshot_before_templates;
revoke all on function support_private.snapshot_before_templates(uuid,uuid) from public,anon,authenticated;
create function support_private.snapshot(p_target uuid,p_merchant uuid)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare response jsonb;
begin
 response := support_private.snapshot_before_templates(p_target,p_merchant);
 return response || jsonb_build_object('templates',coalesce((select jsonb_agg(to_jsonb(template) order by template.id)
	from public.checkout_templates template where merchant_id=p_merchant),'[]'::jsonb));
end $$;
revoke all on function support_private.snapshot(uuid,uuid) from public,anon,authenticated;

alter function support_private.dispatch(text,jsonb) rename to dispatch_before_templates;
revoke all on function support_private.dispatch_before_templates(text,jsonb) from public,anon,authenticated;
create function support_private.dispatch(p_action text,p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
 response jsonb;
 current_context support_private.contexts%rowtype;
 operation support_private.operations%rowtype;
 template_action text;
 fields jsonb;
 template_input jsonb;
 config jsonb;
 before_rows jsonb;
 after_rows jsonb;
 template_row jsonb;
 template_id uuid;
 canonical jsonb;
 allowed_keys text[];
begin
 if p_action='prepare' then
	template_action := p_input ->> 'action';
 elsif p_action='commit' then
	response := support_private.dispatch_before_templates('operation',jsonb_build_object(
	 'sessionId',p_input -> 'sessionId','operationId',p_input -> 'operationId'));
	template_action := response #>> '{operation,payload,action}';
 end if;
 if template_action is null or template_action not in ('templates.create','templates.update','templates.delete','templates.default') then
	response := support_private.dispatch_before_templates(p_action,p_input);
	if p_action='snapshot' then
	 select * into strict current_context from support_private.contexts where id=(p_input ->> 'sessionId')::uuid;
	 if current_context.workspace='sandbox' and current_context.templates_workspace is not null then
		response := jsonb_set(response,'{data,templates}',current_context.templates_workspace);
	 end if;
	elsif p_action='end' then
	 update support_private.contexts set templates_workspace=null where id=(p_input ->> 'sessionId')::uuid;
	elsif p_action='elevate' then
	 response := jsonb_set(response,'{capabilities}',(response -> 'capabilities') ||
		'["templates.create","templates.update","templates.delete","templates.default"]'::jsonb);
	end if;
	return response;
 end if;
 allowed_keys := case when p_action='prepare' then array['sessionId','action','fields']
	else array['sessionId','operationId','digest','acknowledgement'] end;
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>32768
 or exists(select 1 from jsonb_object_keys(p_input) key where not key=any(allowed_keys))
 or exists(select 1 from unnest(allowed_keys) key where jsonb_typeof(p_input -> key)
	is distinct from case when key='fields' then 'object' else 'string' end) then
	raise exception 'Invalid support input' using errcode='22023';
 end if;
 if current_setting('transaction_isolation')<>'read committed' then
	raise exception 'Support templates require READ COMMITTED' using errcode='22023';
 end if;
 response := support_private.dispatch_before_templates('snapshot',jsonb_build_object('sessionId',p_input -> 'sessionId'));
 select * into strict current_context from support_private.contexts where id=(p_input ->> 'sessionId')::uuid for update;
 if not exists(select 1 from support_private.operators where user_id=auth.uid() and enabled and can_write)
 or not exists(select 1 from auth.mfa_amr_claims where session_id=current_context.auth_session_id
	and authentication_method in ('totp','phone','webauthn')
	and updated_at>clock_timestamp()-interval '5 minutes' and updated_at<=clock_timestamp())
 or current_context.write_expires_at is null or current_context.write_expires_at<=clock_timestamp() then
	raise exception 'Support write forbidden' using errcode='42501';
 end if;
 if p_action='commit' then
	select * into operation from support_private.operations where id=(p_input ->> 'operationId')::uuid
	 and context_id=current_context.id for update;
	if not found or operation.action<>template_action or operation.digest is distinct from p_input ->> 'digest'
	or p_input ->> 'acknowledgement' is distinct from (case when current_context.workspace='live'
	 then 'CHANGE_LIVE_BUSINESS' else 'CHANGE_SANDBOX' end) then
	 raise exception 'Support confirmation forbidden' using errcode='42501';
	end if;
	if operation.state='committed' then return operation.result; end if;
	if operation.state<>'prepared' or operation.expires_at<=clock_timestamp() then
	 raise exception 'Support operation conflict' using errcode='40001';
	end if;
	fields := operation.payload -> 'fields';
 else
	fields := p_input -> 'fields';
 end if;
 if fields-array['id','input','before']<>'{}'::jsonb or not fields ?& array['id','input','before']
 or jsonb_typeof(fields -> 'before') is distinct from 'array'
 or (template_action='templates.create' and fields -> 'id'<>'null'::jsonb)
 or (template_action<>'templates.create' and jsonb_typeof(fields -> 'id') is distinct from 'string') then
	raise exception 'Invalid support template' using errcode='22023';
 end if;
 template_id := (fields ->> 'id')::uuid;
 template_input := fields -> 'input';
 if template_action in ('templates.create','templates.update') then
	config := template_input -> 'scenario_config';
	if jsonb_typeof(template_input) is distinct from 'object'
	or template_input-array['name','scenario_type','scenario_config','is_default']<>'{}'::jsonb
	or not template_input ?& array['name','scenario_type','scenario_config','is_default']
	or jsonb_typeof(template_input -> 'name') is distinct from 'string'
	or char_length(btrim(template_input ->> 'name')) not between 1 and 120
	or jsonb_typeof(template_input -> 'scenario_type') is distinct from 'string'
	or (template_input ->> 'scenario_type') !~ '^[a-z][a-z0-9_]{0,63}$'
	or jsonb_typeof(template_input -> 'is_default') is distinct from 'boolean'
	or jsonb_typeof(config) is distinct from 'object'
	or exists(select 1 from unnest(array['allow_loyalty','allow_promo','allow_roundup','allow_tips',
	 'allow_split','allow_bnpl','allow_upsell','allow_delivery','allow_compliance_card','allow_nps_review','show_other_banks']) key
	 where jsonb_typeof(config -> key) is distinct from 'boolean')
	or (config ? 'flow_data' and jsonb_typeof(config -> 'flow_data') is distinct from 'object')
	or not (((template_input ->> 'scenario_type') in ('fixed','open_amount','table','delivery','tips') and not config ? 'checkout_flow')
	 or (jsonb_typeof(config -> 'checkout_flow')='object'
		and config #>> '{checkout_flow,id}'=template_input ->> 'scenario_type'
		and config #> '{checkout_flow,version}'='1'::jsonb
		and (not (config -> 'checkout_flow') ? 'invoice_type' or config #>> '{checkout_flow,invoice_type}' in ('fixed','open_amount','table','delivery'))
		and ((template_input ->> 'scenario_type') in ('fixed','open_amount','table','delivery','tips') or (config -> 'checkout_flow') ? 'invoice_type'))) is true then
	 raise exception 'Invalid support template' using errcode='22023';
	end if;
 elsif template_input<>'null'::jsonb then
	raise exception 'Invalid support template' using errcode='22023';
 end if;
 if current_context.workspace='live' then
	perform pg_advisory_xact_lock(hashtextextended(current_context.merchant_id::text,0));
	perform id from public.merchants where id=current_context.merchant_id and user_id=current_context.target_id for share;
	if not found then raise exception 'Support merchant unavailable' using errcode='42501'; end if;
	perform id from public.checkout_templates where merchant_id=current_context.merchant_id order by id for update;
	select coalesce(jsonb_agg(to_jsonb(template) order by id),'[]'::jsonb) into before_rows
	 from public.checkout_templates template where merchant_id=current_context.merchant_id;
 else
	before_rows := coalesce(current_context.templates_workspace,response #> '{data,templates}');
 end if;
 if jsonb_typeof(before_rows) is distinct from 'array' then
	raise exception 'Support templates unavailable; reopen context' using errcode='42501';
 end if;
 if before_rows is distinct from fields -> 'before' then
	raise exception 'Support templates conflict' using errcode='40001';
 end if;
 if template_action<>'templates.create' and not exists(select 1 from jsonb_array_elements(before_rows) row
	where row ->> 'id'=template_id::text and row ->> 'merchant_id'=current_context.merchant_id::text) then
	raise exception 'Support template unavailable' using errcode='42501';
 end if;
 if p_action='prepare' then
	canonical := jsonb_build_object('action',template_action,'contextId',current_context.id,'workspace',current_context.workspace,
	 'actorId',auth.uid(),'authSessionId',current_context.auth_session_id,'targetId',current_context.target_id,
	 'merchantId',current_context.merchant_id,'fields',fields);
	insert into support_private.operations(context_id,action,payload,digest,expires_at)
	 values(current_context.id,template_action,canonical,encode(sha256(convert_to(canonical::text,'UTF8')),'hex'),
		least(current_context.expires_at,current_context.write_expires_at,clock_timestamp()+interval '2 minutes')) returning * into operation;
	response := jsonb_build_object('operationId',operation.id,'digest',operation.digest,'payload',operation.payload,'expiresAt',operation.expires_at);
 else
	if current_context.workspace='live' then
	 if template_action='templates.create' then
		template_row := public.create_checkout_template(current_context.merchant_id,template_input);
	 elsif template_action='templates.update' then
		template_row := public.update_checkout_template(current_context.merchant_id,template_id,template_input);
	 elsif template_action='templates.delete' then
		perform public.delete_checkout_template(current_context.merchant_id,template_id);
	 else
		perform public.set_checkout_template_default(current_context.merchant_id,template_id);
	 end if;
	else
	 if template_action='templates.create' then
		template_id := gen_random_uuid();
		template_row := template_input || jsonb_build_object('id',template_id,'merchant_id',current_context.merchant_id,
		 'created_at',clock_timestamp(),'updated_at',clock_timestamp());
	 elsif template_action='templates.update' then
		select row || template_input || jsonb_build_object('updated_at',clock_timestamp()) into template_row
		 from jsonb_array_elements(before_rows) row where row ->> 'id'=template_id::text;
	 end if;
	 select coalesce(jsonb_agg(case
		when template_action='templates.default' then row || jsonb_build_object('is_default',row ->> 'id'=template_id::text)
		when template_row -> 'is_default'='true'::jsonb then row || '{"is_default":false}'::jsonb
		else row end),'[]'::jsonb) into after_rows from jsonb_array_elements(before_rows) row
		where template_action='templates.default' or row ->> 'id'<>template_id::text;
	 if template_row is not null then after_rows := after_rows || jsonb_build_array(template_row); end if;
	 select coalesce(jsonb_agg(row order by row ->> 'id'),'[]'::jsonb) into after_rows from jsonb_array_elements(after_rows) row;
	 update support_private.contexts set templates_workspace=after_rows where id=current_context.id;
	end if;
	response := jsonb_build_object('committed',true,'operationId',operation.id,'action',operation.action,'template',template_row);
	update support_private.operations set state='committed',result=response where id=operation.id;
 end if;
 insert into support_private.audit(actor_id,auth_session_id,context_id,operation_id,action)
	values(auth.uid(),current_context.auth_session_id,current_context.id,operation.id,p_action);
 return response;
end $$;
create or replace function public.support_dispatch(p_action text,p_input jsonb)
returns jsonb language sql volatile security invoker set search_path='' as $$ select support_private.dispatch(p_action,p_input) $$;
revoke all on function support_private.dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function support_private.dispatch(text,jsonb) to authenticated;
commit;
