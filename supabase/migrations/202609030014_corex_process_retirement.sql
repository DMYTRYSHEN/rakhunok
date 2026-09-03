alter table public.corex_processes
  add column retired_at timestamptz,
  add column retired_by uuid references auth.users(id) on delete set null,
  add constraint corex_processes_retirement_consistent check (
    (lifecycle = 'retired' and retired_at is not null)
    or (lifecycle <> 'retired' and retired_at is null)
  );

create table public.corex_process_retirement_requests (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  process_id uuid not null references public.corex_processes(id) on delete cascade,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (owner_user_id, request_id)
);

alter table public.corex_process_retirement_requests enable row level security;
revoke all on public.corex_process_retirement_requests from public, anon, authenticated;

create or replace function corex_private.guard_process_retirement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.lifecycle = 'retired' and new.lifecycle <> 'retired' then
    raise exception 'Corex retired process cannot be reactivated' using errcode = 'PT409';
  end if;

  return new;
end;
$$;

revoke all on function corex_private.guard_process_retirement()
  from public, anon, authenticated;

create trigger corex_processes_guard_retirement
before update on public.corex_processes
for each row execute function corex_private.guard_process_retirement();

create or replace function corex_private.guard_run_for_active_process()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.corex_processes process
    where process.id = new.process_id
      and process.owner_user_id = new.owner_user_id
      and process.lifecycle = 'published'
  ) then
    raise exception 'Corex process cannot start runs' using errcode = 'PT409';
  end if;

  return new;
end;
$$;

revoke all on function corex_private.guard_run_for_active_process()
  from public, anon, authenticated;

create trigger corex_runs_guard_active_process
before insert on public.corex_runs
for each row execute function corex_private.guard_run_for_active_process();

create or replace function public.corex_retire_process(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_request public.corex_process_retirement_requests;
  target_process public.corex_processes;
  operation_result jsonb;
begin
  select * into existing_request
  from public.corex_process_retirement_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.process_id <> p_process_id then
      raise exception 'Corex process retirement request conflicts' using errcode = 'PT409';
    end if;

    return existing_request.result;
  end if;

  select * into target_process
  from public.corex_processes
  where id = p_process_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_process.id is null then
    raise exception 'Corex process is missing' using errcode = 'PT404';
  end if;

  select * into existing_request
  from public.corex_process_retirement_requests
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id
  for update;

  if existing_request.request_id is not null then
    if existing_request.process_id <> p_process_id then
      raise exception 'Corex process retirement request conflicts' using errcode = 'PT409';
    end if;

    return existing_request.result;
  end if;

  insert into public.corex_process_retirement_requests (
    owner_user_id,
    request_id,
    process_id
  ) values (
    p_owner_user_id,
    p_request_id,
    target_process.id
  );

  delete from public.corex_active_http_routes
  where process_id = target_process.id;

  update public.corex_processes
  set lifecycle = 'retired',
      retired_at = coalesce(retired_at, now()),
      retired_by = coalesce(retired_by, p_owner_user_id),
      updated_at = now()
  where id = target_process.id
  returning * into target_process;

  operation_result := jsonb_build_object(
    'id', target_process.id,
    'lifecycle', target_process.lifecycle,
    'retiredAt', target_process.retired_at,
    'accepted', true
  );

  update public.corex_process_retirement_requests
  set result = operation_result
  where owner_user_id = p_owner_user_id
    and request_id = p_request_id;

  return operation_result;
end;
$$;

revoke all on function public.corex_retire_process(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.corex_retire_process(uuid, uuid, uuid) to service_role;