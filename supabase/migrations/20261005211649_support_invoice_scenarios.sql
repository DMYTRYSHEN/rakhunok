begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

alter table support_private.operations drop constraint operations_action_check;
alter table support_private.operations add constraint operations_action_check check (action in (
 'settings.table_ttl','structure.merchant.rename','structure.entity.create','structure.entity.update',
 'structure.entity.delete','structure.terminal.create','structure.terminal.update','structure.terminal.delete',
 'invoice.fixed.create','invoice.create'));

alter function support_private.dispatch(text,jsonb) rename to dispatch_fixed_v1;
revoke all on function support_private.dispatch_fixed_v1(text,jsonb) from public,anon,authenticated;

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
	is_invoice := coalesce(p_input ->> 'action' = 'invoice.create',false);
 elsif p_action = 'commit' then
	response := support_private.dispatch_fixed_v1('operation',jsonb_build_object(
	 'sessionId',p_input -> 'sessionId','operationId',p_input -> 'operationId'));
	is_invoice := coalesce(response #>> '{operation,payload,action}' = 'invoice.create',false);
 end if;
 if not is_invoice then
	response := support_private.dispatch_fixed_v1(p_action,p_input);
	if p_action = 'snapshot' then
	 response := jsonb_set(response,'{data,invoiceCreation}',jsonb_build_object(
		'fixed',response #>> '{context,workspace}' = 'live',
		'open_amount',response #>> '{context,workspace}' = 'live',
		'table',response #>> '{context,workspace}' = 'live',
		'delivery',response #>> '{context,workspace}' = 'live'));
	elsif p_action = 'elevate' then
	 response := jsonb_set(response,'{capabilities}',(response -> 'capabilities') || '["invoice.create"]'::jsonb);
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
 response := support_private.dispatch_fixed_v1('snapshot',jsonb_build_object('sessionId',p_input -> 'sessionId'));
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
	if not found or operation.action <> 'invoice.create'
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
 allowed_keys := array['type','entityId','title','description','amount','deliveryFee','terminalId','tableNumber','scenarioConfig'];
 if jsonb_typeof(fields) is distinct from 'object'
 or fields - allowed_keys <> '{}'::jsonb
 or not fields ?& allowed_keys
 or jsonb_typeof(fields -> 'type') is distinct from 'string'
 or fields ->> 'type' not in ('fixed','open_amount','table','delivery')
 or jsonb_typeof(fields -> 'entityId') is distinct from 'string'
 or jsonb_typeof(fields -> 'title') is distinct from 'string'
 or length(btrim(fields ->> 'title')) not between 1 and 500
 or jsonb_typeof(fields -> 'description') is distinct from 'string'
 or length(fields ->> 'description') > 2000
 or jsonb_typeof(fields -> 'amount') is distinct from 'number'
 or jsonb_typeof(fields -> 'deliveryFee') is distinct from 'number'
 or (fields ->> 'amount')::numeric < 0 or (fields ->> 'deliveryFee')::numeric < 0
 or (fields ->> 'amount')::numeric + (fields ->> 'deliveryFee')::numeric > 999999999.99
 or round((fields ->> 'amount')::numeric,2) <> (fields ->> 'amount')::numeric
 or round((fields ->> 'deliveryFee')::numeric,2) <> (fields ->> 'deliveryFee')::numeric
 or (fields ->> 'type' <> 'open_amount' and (fields ->> 'amount')::numeric + (fields ->> 'deliveryFee')::numeric <= 0)
 or (fields ->> 'type' <> 'delivery' and (fields ->> 'deliveryFee')::numeric <> 0)
 or (fields ->> 'type' <> 'table' and (fields -> 'terminalId' <> 'null'::jsonb or fields -> 'tableNumber' <> 'null'::jsonb))
 or (fields ->> 'type' = 'table' and (jsonb_typeof(fields -> 'terminalId') is distinct from 'string'
	or jsonb_typeof(fields -> 'tableNumber') is distinct from 'number'
	or (fields ->> 'tableNumber')::numeric not between 1 and 2147483647
	or trunc((fields ->> 'tableNumber')::numeric) <> (fields ->> 'tableNumber')::numeric))
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
 if fields ->> 'type' = 'table' then
	perform id from public.terminals where id=(fields ->> 'terminalId')::uuid
	 and entity_id=(fields ->> 'entityId')::uuid and user_id=current_context.target_id and is_active for share;
	if not found then raise exception 'Support terminal unavailable' using errcode = '42501'; end if;
 end if;
 select jsonb_build_object('settings',to_jsonb(settings),'seller',to_jsonb(seller),
	'entity',to_jsonb(entity),'terminal',(select to_jsonb(terminal) from public.terminals terminal
	 where terminal.id=(fields ->> 'terminalId')::uuid))
 into before_document from public.business_settings settings
 join public.business_settings_sellers seller on seller.merchant_id=settings.merchant_id
 join public.business_entities entity on entity.id=seller.entity_id
 where settings.merchant_id=current_context.merchant_id and entity.id=(fields ->> 'entityId')::uuid;
 if p_action = 'prepare' then
	canonical := jsonb_build_object('action','invoice.create','contextId',current_context.id,
	 'workspace',current_context.workspace,'actorId',auth.uid(),'authSessionId',current_context.auth_session_id,
	 'targetId',current_context.target_id,'merchantId',current_context.merchant_id,'fields',fields,'before',before_document);
	insert into support_private.operations(context_id,action,payload,digest,expires_at)
	 values(current_context.id,'invoice.create',canonical,encode(sha256(convert_to(canonical::text,'UTF8')),'hex'),
		least(current_context.expires_at,current_context.write_expires_at,clock_timestamp()+interval '2 minutes')) returning * into operation;
	response := jsonb_build_object('operationId',operation.id,'digest',operation.digest,'payload',operation.payload,'expiresAt',operation.expires_at);
 else
	if operation.payload -> 'before' is distinct from before_document then
	 raise exception 'Support invoice settings conflict' using errcode = '23505';
	end if;
	invoice := checkout_private.create_invoice_for_owner(current_context.target_id,current_context.merchant_id,
	 (fields ->> 'entityId')::uuid,fields ->> 'type',fields ->> 'title',nullif(fields ->> 'description',''),
	 (fields ->> 'amount')::numeric,(fields ->> 'deliveryFee')::numeric,
	 (fields ->> 'tableNumber')::integer,(fields ->> 'terminalId')::uuid,fields -> 'scenarioConfig',null);
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
