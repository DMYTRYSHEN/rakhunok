begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

alter function support_private.dispatch(text, jsonb) rename to dispatch_context_v1;
revoke all on function support_private.dispatch_context_v1(text, jsonb) from public, anon, authenticated;

create function support_private.dispatch(p_action text, p_input jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
	response jsonb;
	current_context support_private.contexts%rowtype;
begin
	response := support_private.dispatch_context_v1(p_action, p_input);
	if p_action not in ('bootstrap', 'search', 'end') then
		select * into current_context from support_private.contexts
			where id = (case when p_action = 'open' then response ->> 'id' else p_input ->> 'sessionId' end)::uuid
				and actor_id = auth.uid() and auth_session_id = (auth.jwt() ->> 'session_id')::uuid
			for update;
		if not found then
			raise exception 'Support forbidden' using errcode = '42501';
		end if;
		if current_context.workspace = 'sandbox' then
			perform contact.entity_id from public.business_entity_contacts contact
				join jsonb_array_elements(current_context.snapshot #> '{structure,entities}') item
					on contact.entity_id = (item ->> 'id')::uuid
				where item ?| array['phone', 'contactEmail', 'website']
				order by contact.entity_id for share of contact;
			if exists (
				select 1 from jsonb_array_elements(current_context.snapshot #> '{structure,entities}') item
				left join public.business_entity_contacts contact on contact.entity_id = (item ->> 'id')::uuid
				where item ?| array['phone', 'contactEmail', 'website']
					and contact.user_id is distinct from current_context.target_id
			) then
				raise exception 'Support snapshot unavailable' using errcode = '42501';
			end if;
		end if;
	end if;
	return response;
end
$$;

create or replace function public.support_dispatch(p_action text, p_input jsonb)
returns jsonb language sql volatile security invoker set search_path = '' as $$
	select support_private.dispatch(p_action, p_input)
$$;

revoke all on function support_private.dispatch(text, jsonb) from public, anon, authenticated;
grant execute on function support_private.dispatch(text, jsonb) to authenticated;
revoke all on function public.support_dispatch(text, jsonb) from public, anon, authenticated;
grant execute on function public.support_dispatch(text, jsonb) to authenticated;

commit;
