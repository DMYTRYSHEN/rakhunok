alter table public.corex_runs
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null,
  add constraint corex_runs_archived_terminal_check check (
    archived_at is null or status in ('complete', 'errored', 'terminated')
  );

create index corex_runs_owner_archived_created_idx
  on public.corex_runs (owner_user_id, archived_at, created_at desc);

create table public.corex_run_archive_requests (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  run_id uuid not null references public.corex_runs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, request_id)
);

alter table public.corex_run_archive_requests enable row level security;
revoke all on public.corex_run_archive_requests from public, anon, authenticated;

create or replace function public.corex_request_run_archive(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_request public.corex_run_archive_requests;
  target_run public.corex_runs;
begin
  select * into existing_request
  from public.corex_run_archive_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.run_id <> p_run_id then
      raise exception 'Corex archive request conflicts' using errcode = 'PT409';
    end if;

    select * into target_run
    from public.corex_runs
    where id = existing_request.run_id
      and owner_user_id = p_owner_user_id;

    return jsonb_build_object(
      'id', target_run.id,
      'status', target_run.status,
      'archivedAt', target_run.archived_at,
      'accepted', true
    );
  end if;

  select * into target_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_run.id is null then
    raise exception 'Corex run is missing' using errcode = 'PT404';
  end if;

  select * into existing_request
  from public.corex_run_archive_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.run_id <> p_run_id then
      raise exception 'Corex archive request conflicts' using errcode = 'PT409';
    end if;

    return jsonb_build_object(
      'id', target_run.id,
      'status', target_run.status,
      'archivedAt', target_run.archived_at,
      'accepted', true
    );
  end if;

  if target_run.status not in ('complete', 'errored', 'terminated') then
    raise exception 'Corex run cannot be archived' using errcode = 'PT409';
  end if;

  insert into public.corex_run_archive_requests (owner_user_id, request_id, run_id)
  values (p_owner_user_id, p_request_id, target_run.id);

  update public.corex_runs
  set archived_at = coalesce(archived_at, now()),
      archived_by = coalesce(archived_by, p_owner_user_id)
  where id = target_run.id
  returning * into target_run;

  insert into public.corex_run_events (
    run_id, owner_user_id, execution_generation, sequence, event_type, payload
  ) values (
    target_run.id,
    p_owner_user_id,
    target_run.execution_generation,
    coalesce((
      select max(sequence) + 1
      from public.corex_run_events
      where run_id = target_run.id
        and execution_generation = target_run.execution_generation
    ), 0),
    'run_archived',
    jsonb_build_object('requestId', p_request_id)
  );

  return jsonb_build_object(
    'id', target_run.id,
    'status', target_run.status,
    'archivedAt', target_run.archived_at,
    'accepted', true
  );
end;
$$;

revoke all on function public.corex_request_run_archive(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.corex_request_run_archive(uuid, uuid, uuid) to service_role;