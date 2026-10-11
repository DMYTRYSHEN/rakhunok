begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

alter table support_private.contexts add column settings_workspace jsonb;
alter table support_private.operations drop constraint operations_action_check;
alter table support_private.operations add constraint operations_action_check check (action in (
 'settings.table_ttl','settings.business.save','structure.merchant.rename','structure.entity.create',
 'structure.entity.update','structure.entity.delete','structure.terminal.create','structure.terminal.update',
 'structure.terminal.delete','invoice.fixed.create','invoice.create'));
alter function support_private.dispatch(text,jsonb) rename to dispatch_before_business_settings;
revoke all on function support_private.dispatch_before_business_settings(text,jsonb) from public,anon,authenticated;

create function support_private.dispatch(p_action text,p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
 response jsonb;
 current_context support_private.contexts%rowtype;
 operation support_private.operations%rowtype;
 fields jsonb;
 before_document jsonb;
 after_document jsonb;
 canonical jsonb;
 allowed_keys text[];
 is_settings boolean := false;
begin
 if p_action = 'prepare' then
	is_settings := coalesce(p_input ->> 'action' = 'settings.business.save',false);
 elsif p_action = 'commit' then
	response := support_private.dispatch_before_business_settings('operation',jsonb_build_object(
	 'sessionId',p_input -> 'sessionId','operationId',p_input -> 'operationId'));
	is_settings := coalesce(response #>> '{operation,payload,action}' = 'settings.business.save',false);
 end if;
 if not is_settings then
	response := support_private.dispatch_before_business_settings(p_action,p_input);
	if p_action = 'snapshot' then
	 select * into strict current_context from support_private.contexts where id=(p_input ->> 'sessionId')::uuid;
	 response := jsonb_set(response,'{data,settings}',coalesce(
		case when current_context.workspace='sandbox' then current_context.settings_workspace end,
		nullif(response #> '{data,settings}','null'::jsonb),jsonb_build_object('revision',0,'document',null)));
	elsif p_action = 'end' then
	 update support_private.contexts set settings_workspace=null where id=(p_input ->> 'sessionId')::uuid;
	elsif p_action = 'elevate' then
	 response := jsonb_set(response,'{capabilities}',(response -> 'capabilities') || '["settings.business.save"]'::jsonb);
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
 if current_setting('transaction_isolation') <> 'read committed' then
	raise exception 'Support settings require READ COMMITTED' using errcode='22023';
 end if;
 response := support_private.dispatch_before_business_settings('snapshot',jsonb_build_object('sessionId',p_input -> 'sessionId'));
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
	if not found or operation.action<>'settings.business.save'
	or operation.digest is distinct from p_input ->> 'digest'
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
 if jsonb_typeof(fields) is distinct from 'object' or fields-array['document','revision']<>'{}'::jsonb
 or not fields ?& array['document','revision'] or jsonb_typeof(fields -> 'revision') is distinct from 'number'
 or (fields ->> 'revision')::numeric not between 0 and 2147483646
 or trunc((fields ->> 'revision')::numeric)<>(fields ->> 'revision')::numeric
 or business_settings_private.valid_document(fields -> 'document') is not true then
	raise exception 'Invalid support settings' using errcode='22023';
 end if;
 if current_context.workspace='live' then
	perform merchant_id from public.business_settings where merchant_id=current_context.merchant_id for update;
	perform id from public.merchants where id=current_context.merchant_id and user_id=current_context.target_id for share;
	if not found then raise exception 'Support merchant unavailable' using errcode='42501'; end if;
	perform id from public.business_entities where user_id=current_context.target_id order by id for share;
	if exists(select 1 from public.business_settings where merchant_id=current_context.merchant_id
	 and owner_user_id is distinct from current_context.target_id)
	or exists(select 1 from (
	 select entity_id from public.business_settings_sellers where merchant_id=current_context.merchant_id
	 union select key::uuid from jsonb_object_keys(fields #> '{document,sellers}') key
	) referenced left join public.business_entities entity on entity.id=referenced.entity_id
	 where entity.user_id is distinct from current_context.target_id) then
	 raise exception 'Support seller unavailable' using errcode='42501';
	end if;
	response := jsonb_build_object('data',support_private.snapshot(current_context.target_id,current_context.merchant_id));
 end if;
 before_document := coalesce(case when current_context.workspace='sandbox' then current_context.settings_workspace end,
	nullif(response #> '{data,settings}','null'::jsonb),jsonb_build_object('revision',0,'document',null));
 if exists(select 1 from (
	select jsonb_object_keys(fields #> '{document,sellers}') seller_id
	union select jsonb_object_keys(before_document #> '{document,sellers}')
 ) referenced
	where not exists(select 1 from jsonb_array_elements(response #> '{data,structure,entities}') entity
	 where entity ->> 'id'=referenced.seller_id)) then
	raise exception 'Support seller unavailable' using errcode='42501';
 end if;
 if (before_document ->> 'revision')::integer<>(fields ->> 'revision')::integer then
	raise exception 'Support settings revision conflict' using errcode='40001';
 end if;
 after_document := jsonb_build_object('revision',(fields ->> 'revision')::integer+1,'document',fields -> 'document');
 if p_action='prepare' then
	canonical := jsonb_build_object('action','settings.business.save','contextId',current_context.id,
	 'workspace',current_context.workspace,'actorId',auth.uid(),'authSessionId',current_context.auth_session_id,
	 'targetId',current_context.target_id,'merchantId',current_context.merchant_id,
	 'fields',fields,'before',before_document);
	insert into support_private.operations(context_id,action,payload,digest,expires_at)
	 values(current_context.id,'settings.business.save',canonical,encode(sha256(convert_to(canonical::text,'UTF8')),'hex'),
		least(current_context.expires_at,current_context.write_expires_at,clock_timestamp()+interval '2 minutes')) returning * into operation;
	response := jsonb_build_object('operationId',operation.id,'digest',operation.digest,'payload',operation.payload,'expiresAt',operation.expires_at);
 else
	if operation.payload -> 'before' is distinct from before_document then
	 raise exception 'Support settings conflict' using errcode='40001';
	end if;
	if current_context.workspace='sandbox' then
	 update support_private.contexts set settings_workspace=after_document where id=current_context.id;
	else
	 if (fields ->> 'revision')::integer=0 then
		insert into public.business_settings(merchant_id,owner_user_id,revision,config)
		 values(current_context.merchant_id,current_context.target_id,1,(fields -> 'document')-'sellers')
		 on conflict(merchant_id) do nothing;
	 else
		update public.business_settings set revision=revision+1,config=(fields -> 'document')-'sellers'
		 where merchant_id=current_context.merchant_id and owner_user_id=current_context.target_id
			and revision=(fields ->> 'revision')::integer;
	 end if;
	 if not found then raise exception 'Support settings revision conflict' using errcode='40001'; end if;
	 delete from public.business_settings_sellers where merchant_id=current_context.merchant_id and owner_user_id=current_context.target_id;
	 insert into public.business_settings_sellers(merchant_id,owner_user_id,entity_id,seller_key,config)
		select current_context.merchant_id,current_context.target_id,key::uuid,key,value from jsonb_each(fields #> '{document,sellers}');
	end if;
	response := jsonb_build_object('committed',true,'operationId',operation.id,'action',operation.action,'settings',after_document);
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
