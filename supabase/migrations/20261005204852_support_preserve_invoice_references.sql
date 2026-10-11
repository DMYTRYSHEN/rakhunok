begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

do $$
declare
 source_body text;
 original_entity text := 'delete from public.business_entity_contacts where entity_id=item_id and user_id=current_context.target_id;';
 original_terminal text := 'delete from public.terminals where id=item_id and user_id=current_context.target_id;';
begin
 select prosrc into strict source_body from pg_proc
 where oid = 'support_private.dispatch_structure_v1(text,jsonb)'::regprocedure;
 if length(source_body) - length(replace(source_body, original_entity, '')) <> length(original_entity)
 or length(source_body) - length(replace(source_body, original_terminal, '')) <> length(original_terminal)
 or position('Support invoice reference protected' in source_body) > 0 then
	raise exception 'Unexpected support structure definition';
 end if;
 source_body := replace(source_body, original_entity,
	'if exists (select 1 from public.orders where entity_id=item_id) then
	 raise exception ''Support invoice reference protected'' using errcode = ''23503'';
	end if;
	' || original_entity);
 source_body := replace(source_body, original_terminal,
	'if exists (select 1 from public.orders where terminal_id=item_id) then
	 raise exception ''Support invoice reference protected'' using errcode = ''23503'';
	end if;
	' || original_terminal);
 execute format('create or replace function support_private.dispatch_structure_v1(p_action text, p_input jsonb)
	returns jsonb language plpgsql volatile security definer set search_path = %L as %L', '', source_body);
end $$;
revoke all on function support_private.dispatch_structure_v1(text,jsonb) from public,anon,authenticated;
commit;
