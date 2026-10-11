begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

do $$
declare
 source_body text;
 source_arguments text;
begin
 select prosrc, pg_get_function_arguments(oid) into strict source_body, source_arguments
 from pg_proc where oid = 'public.create_authoritative_invoice(uuid,uuid,text,text,text,numeric,numeric,integer,uuid,jsonb,timestamptz)'::regprocedure;
 if md5(replace(source_body, E'\r\n', E'\n')) not in (
  'a63d2e5f4a974ca26625e3cbad1e539b',
  'fc9a9a2a228173ee8ab2bc4644352e4c'
 ) then
	raise exception 'Unexpected invoice authority definition';
 end if;
 execute format('create function checkout_private.create_invoice_for_owner(p_owner uuid, %s) returns public.orders language plpgsql volatile security definer set search_path = %L as %L',
	source_arguments, '', replace(source_body, 'actor uuid := auth.uid();', 'actor uuid := p_owner;'));
end $$;
revoke all on function checkout_private.create_invoice_for_owner(uuid,uuid,uuid,text,text,text,numeric,numeric,integer,uuid,jsonb,timestamptz) from public,anon,authenticated;

create or replace function public.create_authoritative_invoice(
 p_merchant_id uuid, p_entity_id uuid, p_type text, p_title text, p_description text,
 p_base_amount numeric, p_delivery_fee numeric default 0, p_table_number integer default null,
 p_terminal_id uuid default null, p_scenario_config jsonb default null, p_expires_at timestamptz default null
) returns public.orders language sql volatile security definer set search_path = '' as $$
 select checkout_private.create_invoice_for_owner(auth.uid(),p_merchant_id,p_entity_id,p_type,p_title,
	p_description,p_base_amount,p_delivery_fee,p_table_number,p_terminal_id,p_scenario_config,p_expires_at)
$$;

alter table support_private.operations drop constraint operations_action_check;
alter table support_private.operations add constraint operations_action_check check (action in (
 'settings.table_ttl','structure.merchant.rename','structure.entity.create','structure.entity.update',
 'structure.entity.delete','structure.terminal.create','structure.terminal.update','structure.terminal.delete',
 'invoice.fixed.create'));
alter function support_private.dispatch(text,jsonb) rename to dispatch_structure_v1;
revoke all on function support_private.dispatch_structure_v1(text,jsonb) from public,anon,authenticated;

create function support_private.dispatch(p_action text,p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
 response jsonb;
 current_context support_private.contexts%rowtype;
 operation support_private.operations%rowtype;
 fields jsonb;
 before_document jsonb;
 canonical jsonb;
 invoice public.orders%rowtype;
 allowed_keys text[];
 is_invoice boolean := false;
begin
 if p_action = 'prepare' then
	is_invoice := coalesce(p_input ->> 'action' = 'invoice.fixed.create',false);
 elsif p_action = 'commit' then
	response := support_private.dispatch_structure_v1('operation',jsonb_build_object(
	 'sessionId',p_input -> 'sessionId','operationId',p_input -> 'operationId'));
	is_invoice := coalesce(response #>> '{operation,payload,action}' = 'invoice.fixed.create',false);
 end if;
 if not is_invoice then
	response := support_private.dispatch_structure_v1(p_action,p_input);
	if p_action = 'snapshot' then
	 response := jsonb_set(response,'{data,invoiceCreation}',jsonb_build_object('fixed',response #>> '{context,workspace}' = 'live'));
	elsif p_action = 'elevate' then
	 response := jsonb_set(response,'{capabilities}',(response -> 'capabilities') || '["invoice.fixed.create"]'::jsonb);
	end if;
	return response;
 end if;
 allowed_keys := case when p_action = 'prepare' then array['sessionId','action','fields']
	else array['sessionId','operationId','digest','acknowledgement'] end;
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text) > 32768
 or exists(select 1 from jsonb_object_keys(p_input) key where not key = any(allowed_keys))
 or exists(select 1 from unnest(allowed_keys) key where jsonb_typeof(p_input -> key)
	is distinct from case when key = 'fields' then 'object' else 'string' end) then
	raise exception 'Invalid support input' using errcode = '22023';
 end if;
 response := support_private.dispatch_structure_v1('snapshot',jsonb_build_object('sessionId',p_input -> 'sessionId'));
 select * into strict current_context from support_private.contexts where id=(p_input ->> 'sessionId')::uuid for update;
 if current_context.workspace <> 'live'
 or not exists(select 1 from support_private.operators where user_id=auth.uid() and enabled and can_write)
 or not exists(select 1 from auth.mfa_amr_claims where session_id=current_context.auth_session_id
	and authentication_method in ('totp','phone','webauthn')
	and updated_at > clock_timestamp()-interval '5 minutes' and updated_at <= clock_timestamp())
 or current_context.write_expires_at is null or current_context.write_expires_at <= clock_timestamp() then
	raise exception 'Support write forbidden' using errcode = '42501';
 end if;
 if p_action = 'commit' then
	select * into operation from support_private.operations where id=(p_input ->> 'operationId')::uuid
	 and context_id=current_context.id for update;
	if not found or operation.action <> 'invoice.fixed.create'
	 or operation.digest is distinct from p_input ->> 'digest'
	 or p_input ->> 'acknowledgement' is distinct from 'CHANGE_LIVE_BUSINESS' then
	 raise exception 'Support confirmation forbidden' using errcode = '42501';
	end if;
	if operation.state = 'committed' then return operation.result; end if;
	if operation.state <> 'prepared' or operation.expires_at <= clock_timestamp() then
	 raise exception 'Support operation conflict' using errcode = '23505';
	end if;
	fields := operation.payload -> 'fields';
 else
	fields := p_input -> 'fields';
 end if;
 if jsonb_typeof(fields) is distinct from 'object'
 or fields - array['entityId','title','description','amount','scenarioConfig'] <> '{}'::jsonb
 or jsonb_typeof(fields -> 'entityId') is distinct from 'string'
 or jsonb_typeof(fields -> 'title') is distinct from 'string'
 or length(btrim(fields ->> 'title')) not between 1 and 500
 or jsonb_typeof(fields -> 'description') is distinct from 'string'
 or length(fields ->> 'description') > 2000
 or jsonb_typeof(fields -> 'amount') is distinct from 'number'
 or (fields ->> 'amount')::numeric <= 0
 or (fields ->> 'amount')::numeric > 999999999.99
 or round((fields ->> 'amount')::numeric,2) <> (fields ->> 'amount')::numeric
 or jsonb_typeof(fields -> 'scenarioConfig') is distinct from 'object' then
	raise exception 'Invalid support invoice fields' using errcode = '22023';
 end if;
 perform id from public.merchants where id=current_context.merchant_id and user_id=current_context.target_id for share;
 if not found then raise exception 'Support merchant unavailable' using errcode = '42501'; end if;
 perform merchant_id from public.business_settings where merchant_id=current_context.merchant_id
	and owner_user_id=current_context.target_id for share;
 if not found then raise exception 'Invoice payment settings are not configured' using errcode = '22023'; end if;
 perform entity_id from public.business_settings_sellers where merchant_id=current_context.merchant_id
	and entity_id=(fields ->> 'entityId')::uuid and owner_user_id=current_context.target_id for update;
 if not found then raise exception 'Invoice seller settings are not configured' using errcode = '22023'; end if;
 perform id from public.business_entities where id=(fields ->> 'entityId')::uuid
	and user_id=current_context.target_id and is_active for share;
 if not found then raise exception 'Support seller unavailable' using errcode = '42501'; end if;
 select jsonb_build_object('settings',to_jsonb(settings),'seller',to_jsonb(seller),'entity',to_jsonb(entity))
 into before_document from public.business_settings settings
 join public.business_settings_sellers seller on seller.merchant_id=settings.merchant_id
 join public.business_entities entity on entity.id=seller.entity_id
 where settings.merchant_id=current_context.merchant_id and entity.id=(fields ->> 'entityId')::uuid;
 if p_action = 'prepare' then
	canonical := jsonb_build_object('action','invoice.fixed.create','contextId',current_context.id,
	 'workspace',current_context.workspace,'actorId',auth.uid(),'authSessionId',current_context.auth_session_id,
	 'targetId',current_context.target_id,'merchantId',current_context.merchant_id,'fields',fields,'before',before_document);
	insert into support_private.operations(context_id,action,payload,digest,expires_at)
	 values(current_context.id,'invoice.fixed.create',canonical,encode(sha256(convert_to(canonical::text,'UTF8')),'hex'),
		least(current_context.expires_at,current_context.write_expires_at,clock_timestamp()+interval '2 minutes')) returning * into operation;
	response := jsonb_build_object('operationId',operation.id,'digest',operation.digest,'payload',operation.payload,'expiresAt',operation.expires_at);
 else
	if operation.payload -> 'before' is distinct from before_document then
	 raise exception 'Support invoice settings conflict' using errcode = '23505';
	end if;
	invoice := checkout_private.create_invoice_for_owner(current_context.target_id,current_context.merchant_id,
	 (fields ->> 'entityId')::uuid,'fixed',fields ->> 'title',nullif(fields ->> 'description',''),
	 (fields ->> 'amount')::numeric,0,null,null,fields -> 'scenarioConfig',null);
	response := jsonb_build_object('committed',true,'operationId',operation.id,'action',operation.action,
	 'invoice',jsonb_build_object('id',invoice.id,'reference',invoice.order_number,'amount',invoice.total_amount,
		'shortId',invoice.short_id,'recipientName',invoice.payment_recipient_name,'recipientIban',invoice.payment_recipient_iban,
		'recipientTaxId',invoice.payment_recipient_tax_id,'purpose',invoice.payment_purpose));
	update support_private.operations set state='committed',result=response where id=operation.id;
 end if;
 insert into support_private.audit(actor_id,auth_session_id,context_id,operation_id,action)
	values(auth.uid(),current_context.auth_session_id,current_context.id,operation.id,p_action);
 return response;
end $$;
create or replace function public.support_dispatch(p_action text,p_input jsonb)
returns jsonb language sql volatile security invoker set search_path = '' as $$ select support_private.dispatch(p_action,p_input) $$;
revoke all on function support_private.dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function support_private.dispatch(text,jsonb) to authenticated;
commit;
