create table public.corex_external_event_requests (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null,
  run_id uuid not null references public.corex_runs(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, event_id)
);

alter table public.corex_external_event_requests enable row level security;
revoke all on public.corex_external_event_requests from public, anon, authenticated;

create or replace function public.corex_enqueue_workflow_event(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_event_id uuid,
  p_event_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.corex_runs;
  existing_request public.corex_external_event_requests;
  inserted_request_count integer;
begin
  if p_event_type !~ '^[a-zA-Z_][a-zA-Z0-9_-]{0,99}$'
    or lower(p_event_type) like 'corex-%'
    or pg_catalog.pg_column_size(coalesce(p_payload, 'null'::jsonb)) > 65536
  then
    raise exception 'Invalid external event' using errcode = '22023';
  end if;

  select * into existing_request
  from public.corex_external_event_requests
  where owner_user_id = p_owner_user_id
    and event_id = p_event_id
  for update;

  if existing_request.event_id is not null then
    if existing_request.run_id <> p_run_id
      or existing_request.event_type <> p_event_type
      or existing_request.payload <> coalesce(p_payload, 'null'::jsonb)
    then
      raise exception 'External event ID conflicts' using errcode = 'PT409';
    end if;

    return jsonb_build_object('accepted', true, 'eventId', p_event_id);
  end if;

  select * into target_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_run.id is null then
    raise exception 'Corex run is missing' using errcode = 'PT404';
  end if;

  if target_run.status not in ('running', 'waiting', 'paused') then
    raise exception 'Run cannot accept events' using errcode = 'PT409';
  end if;

  insert into public.corex_external_event_requests (
    owner_user_id, event_id, run_id, event_type, payload
  ) values (
    p_owner_user_id, p_event_id, p_run_id, p_event_type, coalesce(p_payload, 'null'::jsonb)
  ) on conflict (owner_user_id, event_id) do nothing;
  get diagnostics inserted_request_count = row_count;

  if inserted_request_count = 0 then
    select * into existing_request
    from public.corex_external_event_requests
    where owner_user_id = p_owner_user_id
      and event_id = p_event_id
    for update;

    if existing_request.run_id <> p_run_id
      or existing_request.event_type <> p_event_type
      or existing_request.payload <> coalesce(p_payload, 'null'::jsonb)
    then
      raise exception 'External event ID conflicts' using errcode = 'PT409';
    end if;

    return jsonb_build_object('accepted', true, 'eventId', p_event_id);
  end if;

  insert into public.corex_outbox (
    owner_user_id, run_id, kind, semantic_key, workflow_instance_id, payload
  ) values (
    p_owner_user_id,
    target_run.id,
    'workflow_event',
    'workflow_event:external:' || p_owner_user_id::text || ':' || p_event_id::text,
    target_run.workflow_instance_id,
    jsonb_build_object('type', p_event_type, 'payload', coalesce(p_payload, 'null'::jsonb))
  ) on conflict (semantic_key) do nothing;

  return jsonb_build_object('accepted', true, 'eventId', p_event_id);
end;
$$;

revoke all on function public.corex_enqueue_workflow_event(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.corex_enqueue_workflow_event(uuid, uuid, uuid, text, jsonb) to service_role;