begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

alter table support_private.contexts add column structure_workspace jsonb;
alter table support_private.operations drop constraint operations_action_check;
alter table support_private.operations add constraint operations_action_check check (action in (
 'settings.table_ttl', 'structure.merchant.rename', 'structure.entity.create', 'structure.entity.update',
 'structure.entity.delete', 'structure.terminal.create', 'structure.terminal.update', 'structure.terminal.delete'));

alter function support_private.dispatch(text, jsonb) rename to dispatch_contact_v1;
revoke all on function support_private.dispatch_contact_v1(text, jsonb) from public, anon, authenticated;

create function support_private.dispatch(p_action text, p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
 response jsonb;
 current_context support_private.contexts%rowtype;
 operation support_private.operations%rowtype;
 action_name text;
 fields jsonb;
 before_document jsonb;
 after_document jsonb;
 canonical jsonb;
 item jsonb;
 item_id uuid;
 collection text;
 required_keys text[];
 optional_keys text[] := array[]::text[];
 allowed_keys text[];
 is_structure boolean := false;
begin
 if p_action = 'prepare' then
	is_structure := coalesce(p_input ->> 'action' in ('structure.merchant.rename', 'structure.entity.create',
	 'structure.entity.update', 'structure.entity.delete', 'structure.terminal.create',
	 'structure.terminal.update', 'structure.terminal.delete'), false);
 elsif p_action = 'commit' then
	response := support_private.dispatch_contact_v1('operation', jsonb_build_object(
	 'sessionId', p_input -> 'sessionId', 'operationId', p_input -> 'operationId'));
	is_structure := coalesce(response #>> '{operation,payload,action}' like 'structure.%', false);
 end if;
 if not is_structure then
	response := support_private.dispatch_contact_v1(p_action, p_input);
	if p_action = 'snapshot' then
	 select * into current_context from support_private.contexts where id = (p_input ->> 'sessionId')::uuid;
	 if current_context.workspace = 'sandbox' and current_context.structure_workspace is not null then
		response := jsonb_set(response, '{data}', (response -> 'data') || current_context.structure_workspace);
	 end if;
	elsif p_action = 'end' then
	 update support_private.contexts set structure_workspace = null where id = (p_input ->> 'sessionId')::uuid;
	elsif p_action = 'elevate' then
	 response := jsonb_set(response, '{capabilities}', '["settings.table_ttl","structure.merchant.rename","structure.entity.create","structure.entity.update","structure.entity.delete","structure.terminal.create","structure.terminal.update","structure.terminal.delete"]'::jsonb);
	end if;
	return response;
 end if;
 allowed_keys := case when p_action = 'prepare' then array['sessionId','action','fields']
	else array['sessionId','operationId','digest','acknowledgement'] end;
 if jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text) > 32768
	or exists (select 1 from jsonb_object_keys(p_input) key where not key = any(allowed_keys))
	or exists (select 1 from unnest(allowed_keys) key where jsonb_typeof(p_input -> key)
	 is distinct from case when key = 'fields' then 'object' else 'string' end) then
	raise exception 'Invalid support input' using errcode = '22023';
 end if;
 response := support_private.dispatch_contact_v1('snapshot', jsonb_build_object('sessionId', p_input -> 'sessionId'));
 select * into current_context from support_private.contexts where id = (p_input ->> 'sessionId')::uuid for update;
 if not exists (select 1 from support_private.operators where user_id = auth.uid() and enabled and can_write)
	or not exists (select 1 from auth.mfa_amr_claims where session_id = current_context.auth_session_id
	 and authentication_method in ('totp','phone','webauthn')
	 and updated_at > clock_timestamp() - interval '5 minutes' and updated_at <= clock_timestamp()) then
	raise exception 'Support write forbidden' using errcode = '42501';
 end if;
 if current_context.write_expires_at is null or current_context.write_expires_at <= clock_timestamp() then
	raise exception 'Support elevation required' using errcode = '42501';
 end if;
 if current_context.workspace = 'live' then
	perform id from public.merchants where id = current_context.merchant_id and user_id = current_context.target_id for update;
	perform id from public.business_entities where user_id = current_context.target_id order by id for update;
	perform id from public.terminals where user_id = current_context.target_id order by id for update;
	perform contact.entity_id from public.business_entity_contacts contact
	 join public.business_entities entity on entity.id = contact.entity_id
	 where entity.user_id = current_context.target_id order by contact.entity_id for update of contact;
	response := jsonb_build_object('data', support_private.snapshot(current_context.target_id, current_context.merchant_id));
 end if;
 before_document := coalesce(current_context.structure_workspace, jsonb_build_object(
	'merchant', response #> '{data,merchant}', 'structure', response #> '{data,structure}'));
 if jsonb_typeof(before_document #> '{structure,entities}') is distinct from 'array'
	or jsonb_typeof(before_document #> '{structure,terminals}') is distinct from 'array' then
	raise exception 'Support structure unavailable' using errcode = '42501';
 end if;
 if p_action = 'prepare' then
	action_name := p_input ->> 'action';
	fields := p_input -> 'fields';
	if action_name = 'structure.merchant.rename' then
	 required_keys := array['businessName'];
	elsif action_name like 'structure.entity.%' then
	 collection := 'entities';
	 required_keys := case when action_name = 'structure.entity.delete' then array['id']
		else array['businessType','businessName','displayName','taxId','bankName','iban'] end;
	 if action_name = 'structure.entity.update' then required_keys := required_keys || array['id']; end if;
	 if action_name <> 'structure.entity.delete' then optional_keys := array['phone','contactEmail','website']; end if;
	else
	 collection := 'terminals';
	 required_keys := case when action_name = 'structure.terminal.delete' then array['id']
		else array['entityId','name','code','type'] end;
	 if action_name = 'structure.terminal.update' then required_keys := required_keys || array['id']; end if;
	end if;
	if exists (select 1 from jsonb_object_keys(fields) key where not key = any(required_keys || optional_keys))
	 or exists (select 1 from unnest(required_keys) key where jsonb_typeof(fields -> key) is distinct from 'string'
		or length(btrim(fields ->> key)) not between 1 and 500)
	 or exists (select 1 from unnest(optional_keys) key where fields ? key and
		(jsonb_typeof(fields -> key) is distinct from 'string' or length(fields ->> key) > 500)) then
	 raise exception 'Invalid support fields' using errcode = '22023';
	end if;
	if action_name in ('structure.entity.create','structure.entity.update') and
	 ((fields ->> 'businessType') not in ('fop','tov','self_employed','ngo')
		or (fields ->> 'iban') !~ '^UA[A-Z0-9]{27}$') then
	 raise exception 'Invalid support entity' using errcode = '22023';
	end if;
	if action_name in ('structure.terminal.create','structure.terminal.update') then
	 if fields ->> 'type' not in ('table','kasa','dynamic_qr','nfc_tag','courier')
		or not exists (select 1 from jsonb_array_elements(before_document #> '{structure,entities}') entity
		 where entity ->> 'id' = fields ->> 'entityId') then
		raise exception 'Support entity unavailable' using errcode = '42501';
	 end if;
	 if exists (select 1 from jsonb_array_elements(before_document #> '{structure,terminals}') terminal
		where terminal ->> 'code' = fields ->> 'code' and terminal ->> 'id' is distinct from fields ->> 'id') then
		raise exception 'Support terminal code conflict' using errcode = '23505';
	 end if;
	end if;
	after_document := before_document;
	if collection is null then
	 after_document := jsonb_set(after_document, '{merchant,name}', fields -> 'businessName');
	else
	 if action_name like '%.create' then
		item_id := gen_random_uuid();
		item := fields || jsonb_build_object('id', item_id, 'isActive', true);
	 else
		item_id := (fields ->> 'id')::uuid;
		select value into item from jsonb_array_elements(before_document #> array['structure',collection])
		 where value ->> 'id' = item_id::text;
		if not found then raise exception 'Support item unavailable' using errcode = '42501'; end if;
		if action_name like '%.update' then
		 item := fields || jsonb_build_object('isActive', item -> 'isActive');
		end if;
	 end if;
	 if action_name = 'structure.entity.delete' and (
		exists (select 1 from jsonb_array_elements(before_document #> '{structure,terminals}') terminal
		 where terminal ->> 'entityId' = item_id::text)
		or exists (select 1 from public.business_settings_sellers where entity_id = item_id)) then
		raise exception 'Support entity is in use' using errcode = '23503';
	 end if;
	 after_document := jsonb_set(after_document, array['structure',collection],
		(select coalesce(jsonb_agg(value order by value ->> 'id'), '[]'::jsonb)
		 from jsonb_array_elements(before_document #> array['structure',collection]) where value ->> 'id' <> item_id::text)
		|| case when action_name like '%.delete' then '[]'::jsonb else jsonb_build_array(item) end);
	end if;
	canonical := jsonb_build_object('action',action_name,'contextId',current_context.id,
	 'workspace',current_context.workspace,'actorId',auth.uid(),'authSessionId',current_context.auth_session_id,
	 'targetId',current_context.target_id,'merchantId',current_context.merchant_id,
	 'fields',fields,'itemId',item_id,'before',before_document,'after',after_document);
	insert into support_private.operations(context_id,action,payload,digest,expires_at)
	 values(current_context.id,action_name,canonical,encode(sha256(convert_to(canonical::text,'UTF8')),'hex'),
		least(current_context.expires_at,current_context.write_expires_at,clock_timestamp()+interval '2 minutes'))
	 returning * into operation;
	response := jsonb_build_object('operationId',operation.id,'digest',operation.digest,
	 'payload',operation.payload,'expiresAt',operation.expires_at);
 else
	select * into operation from support_private.operations where id = (p_input ->> 'operationId')::uuid
	 and context_id = current_context.id for update;
	if not found or operation.digest is distinct from p_input ->> 'digest'
	or p_input ->> 'acknowledgement' is distinct from (case when current_context.workspace = 'live'
	 then 'CHANGE_LIVE_BUSINESS' else 'CHANGE_SANDBOX' end) then
	 raise exception 'Support confirmation forbidden' using errcode = '42501';
	end if;
	if operation.state = 'committed' then return operation.result; end if;
	if operation.state <> 'prepared' or operation.expires_at <= clock_timestamp()
	 or operation.payload -> 'before' is distinct from before_document then
	 raise exception 'Support operation conflict' using errcode = '23505';
	end if;
	action_name := operation.action;
	fields := operation.payload -> 'fields';
	item_id := (operation.payload ->> 'itemId')::uuid;
	if current_context.workspace = 'sandbox' then
	 update support_private.contexts set structure_workspace = operation.payload -> 'after' where id = current_context.id;
	elsif action_name = 'structure.merchant.rename' then
	 update public.merchants set business_name = fields ->> 'businessName'
		where id = current_context.merchant_id and user_id = current_context.target_id;
	elsif action_name in ('structure.entity.create','structure.entity.update') then
	 if action_name = 'structure.entity.create' then
		insert into public.business_entities(id,user_id,business_type,business_name,display_name,tax_id,bank_name,iban,is_active)
		 values(item_id,current_context.target_id,fields ->> 'businessType',fields ->> 'businessName',
			fields ->> 'displayName',fields ->> 'taxId',fields ->> 'bankName',fields ->> 'iban',true);
	 else
		update public.business_entities set business_type=fields ->> 'businessType',business_name=fields ->> 'businessName',
		 display_name=fields ->> 'displayName',tax_id=fields ->> 'taxId',bank_name=fields ->> 'bankName',iban=fields ->> 'iban'
		 where id=item_id and user_id=current_context.target_id;
	 end if;
	 insert into public.business_entity_contacts(entity_id,user_id,phone,contact_email,website)
		values(item_id,current_context.target_id,nullif(fields ->> 'phone',''),nullif(fields ->> 'contactEmail',''),nullif(fields ->> 'website',''))
		on conflict(entity_id) do update set phone=excluded.phone,contact_email=excluded.contact_email,website=excluded.website
		 where public.business_entity_contacts.user_id = current_context.target_id;
	 if not found then raise exception 'Support contacts unavailable' using errcode = '42501'; end if;
	elsif action_name = 'structure.entity.delete' then
	 if exists (select 1 from public.terminals where entity_id=item_id)
		or exists (select 1 from public.business_settings_sellers where entity_id=item_id) then
		raise exception 'Support entity is in use' using errcode = '23503';
	 end if;
	 delete from public.business_entity_contacts where entity_id=item_id and user_id=current_context.target_id;
	 delete from public.business_entities where id=item_id and user_id=current_context.target_id;
	elsif action_name = 'structure.terminal.create' then
	 insert into public.terminals(id,user_id,entity_id,name,code,type,is_active)
		values(item_id,current_context.target_id,(fields ->> 'entityId')::uuid,fields ->> 'name',fields ->> 'code',fields ->> 'type',true);
	elsif action_name = 'structure.terminal.update' then
	 update public.terminals set entity_id=(fields ->> 'entityId')::uuid,name=fields ->> 'name',
		code=fields ->> 'code',type=fields ->> 'type' where id=item_id and user_id=current_context.target_id;
	elsif action_name = 'structure.terminal.delete' then
	 delete from public.terminals where id=item_id and user_id=current_context.target_id;
	else
	 raise exception 'Support operation unavailable' using errcode = '42501';
	end if;
	response := jsonb_build_object('committed',true,'operationId',operation.id,'action',action_name,'itemId',item_id);
	update support_private.operations set state='committed',result=response where id=operation.id;
 end if;
 insert into support_private.audit(actor_id,auth_session_id,context_id,operation_id,action)
	values(auth.uid(),current_context.auth_session_id,current_context.id,operation.id,p_action);
 return response;
end
$$;

create or replace function public.support_dispatch(p_action text, p_input jsonb)
returns jsonb language sql volatile security invoker set search_path = '' as $$
 select support_private.dispatch(p_action,p_input)
$$;
revoke all on function support_private.dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function support_private.dispatch(text,jsonb) to authenticated;
revoke all on function public.support_dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function public.support_dispatch(text,jsonb) to authenticated;
commit;
