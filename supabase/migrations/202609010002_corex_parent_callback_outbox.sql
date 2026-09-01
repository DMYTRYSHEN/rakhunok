create or replace function public.corex_record_run_event(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_sequence integer,
  p_status public.corex_run_status,
  p_event_type text,
  p_step_name text,
  p_payload jsonb,
  p_output jsonb,
  p_error jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.corex_runs;
  parent_run public.corex_runs;
  existing_event public.corex_run_events;
begin
  if p_sequence < 0 or p_event_type !~ '^[a-zA-Z0-9_][a-zA-Z0-9_-]*$' then
    raise exception 'Invalid Corex run event' using errcode = '22023';
  end if;

  select * into target_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_run.id is null then
    raise exception 'Corex run is missing' using errcode = 'P0002';
  end if;

  select * into existing_event
  from public.corex_run_events
  where run_id = target_run.id
    and sequence = p_sequence;

  if existing_event.id is not null then
    if existing_event.event_type <> p_event_type
      or existing_event.step_name is distinct from p_step_name
      or existing_event.payload <> coalesce(p_payload, '{}'::jsonb)
    then
      raise exception 'Conflicting Corex run event' using errcode = '22023';
    end if;

    return jsonb_build_object('id', target_run.id, 'status', target_run.status);
  end if;

  if not (
    target_run.status = p_status
    or (target_run.status = 'queued' and p_status = 'running')
    or (target_run.status = 'running' and p_status in ('waiting', 'complete', 'errored'))
    or (target_run.status = 'waiting' and p_status in ('running', 'errored'))
  ) then
    raise exception 'Invalid Corex run status transition' using errcode = '22023';
  end if;

  insert into public.corex_run_events (
    run_id, owner_user_id, sequence, event_type, step_name, payload
  ) values (
    target_run.id, target_run.owner_user_id, p_sequence, p_event_type, p_step_name,
    coalesce(p_payload, '{}'::jsonb)
  );

  update public.corex_runs
  set status = p_status,
      started_at = case when p_status = 'running' then coalesce(started_at, now()) else started_at end,
      finished_at = case when p_status in ('complete', 'errored') then coalesce(finished_at, now()) else finished_at end,
      output = case when p_status = 'complete' then p_output else output end,
      error = case when p_status = 'errored' then p_error else error end
  where id = target_run.id
  returning * into target_run;

  if target_run.parent_run_id is not null and p_status in ('complete', 'errored') then
    select * into parent_run
    from public.corex_runs
    where id = target_run.parent_run_id
      and owner_user_id = target_run.owner_user_id;

    if parent_run.id is null then
      raise exception 'Corex parent run is missing' using errcode = 'P0002';
    end if;

    insert into public.corex_outbox (
      owner_user_id, run_id, kind, semantic_key, workflow_instance_id, payload
    ) values (
      target_run.owner_user_id,
      target_run.id,
      'parent_callback',
      'parent_callback:' || target_run.id::text,
      parent_run.workflow_instance_id,
      jsonb_build_object(
        'type', 'corex-subprocess-result:' || target_run.id::text,
        'payload', jsonb_strip_nulls(jsonb_build_object(
          'childRunId', target_run.id,
          'status', p_status::text,
          'output', case when p_status = 'complete' then p_output else null end
        ))
      )
    ) on conflict (semantic_key) do nothing;
  end if;

  return jsonb_build_object('id', target_run.id, 'status', target_run.status);
end;
$$;

revoke all on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) to service_role;