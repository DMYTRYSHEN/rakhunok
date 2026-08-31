create extension if not exists pgcrypto with schema extensions;

create type public.corex_process_lifecycle as enum ('draft', 'published', 'retired');
create type public.corex_run_status as enum (
  'queued',
  'running',
  'waiting',
  'paused',
  'complete',
  'errored',
  'terminated'
);

create table public.corex_processes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  lifecycle public.corex_process_lifecycle not null default 'draft',
  revision bigint not null default 1 check (revision > 0),
  draft_definition jsonb not null,
  published_version integer check (published_version is null or published_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, slug)
);

create table public.corex_process_versions (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.corex_processes(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  definition jsonb not null,
  definition_sha256 text not null check (definition_sha256 ~ '^[a-f0-9]{64}$'),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default now(),
  unique (id, process_id, owner_user_id),
  unique (process_id, version),
  unique (process_id, definition_sha256)
);

create table public.corex_runs (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.corex_processes(id) on delete restrict,
  process_version_id uuid not null references public.corex_process_versions(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workflow_instance_id text not null unique,
  status public.corex_run_status not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (process_version_id, process_id, owner_user_id)
    references public.corex_process_versions(id, process_id, owner_user_id) on delete restrict
);

create table public.corex_run_events (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.corex_runs(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  event_type text not null check (event_type ~ '^[a-zA-Z0-9_][a-zA-Z0-9_-]*$'),
  step_name text,
  attempt integer check (attempt is null or attempt > 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, sequence)
);

create index corex_processes_owner_updated_idx
  on public.corex_processes (owner_user_id, updated_at desc);
create index corex_process_versions_process_idx
  on public.corex_process_versions (process_id, version desc);
create index corex_runs_process_created_idx
  on public.corex_runs (process_id, created_at desc);
create index corex_run_events_run_sequence_idx
  on public.corex_run_events (run_id, sequence);

alter table public.corex_processes enable row level security;
alter table public.corex_process_versions enable row level security;
alter table public.corex_runs enable row level security;
alter table public.corex_run_events enable row level security;

create policy "owners read Corex processes"
  on public.corex_processes for select to authenticated
  using (owner_user_id = (select auth.uid()));
create policy "owners create Corex processes"
  on public.corex_processes for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
create policy "owners update Corex processes"
  on public.corex_processes for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));
create policy "owners delete unpublished Corex processes"
  on public.corex_processes for delete to authenticated
  using (owner_user_id = (select auth.uid()) and published_version is null);

create policy "owners read Corex versions"
  on public.corex_process_versions for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy "owners read Corex runs"
  on public.corex_runs for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy "owners read Corex run events"
  on public.corex_run_events for select to authenticated
  using (owner_user_id = (select auth.uid()));

revoke all on public.corex_processes from anon, authenticated;
revoke all on public.corex_process_versions from anon, authenticated;
revoke all on public.corex_runs from anon, authenticated;
revoke all on public.corex_run_events from anon, authenticated;

grant select, delete on public.corex_processes to authenticated;
grant insert (owner_user_id, slug, name, description, draft_definition)
  on public.corex_processes to authenticated;
grant update (name, description, draft_definition)
  on public.corex_processes to authenticated;
grant select on public.corex_process_versions to authenticated;
grant select on public.corex_runs to authenticated;
grant select on public.corex_run_events to authenticated;

create schema if not exists corex_private;
revoke all on schema corex_private from public, anon, authenticated;

create or replace function corex_private.prepare_draft_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function corex_private.prepare_draft_update() from public, anon, authenticated;

create trigger corex_processes_prepare_draft_update
before update of name, description, draft_definition on public.corex_processes
for each row execute function corex_private.prepare_draft_update();

create or replace function corex_private.reject_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Corex process versions are immutable';
end;
$$;

revoke all on function corex_private.reject_version_mutation() from public, anon, authenticated;

create trigger corex_process_versions_immutable
before update or delete on public.corex_process_versions
for each row execute function corex_private.reject_version_mutation();

create or replace function public.corex_publish_process(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_expected_revision bigint
)
returns public.corex_process_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_process public.corex_processes;
  published_definition jsonb;
  published_sha256 text;
  next_version integer;
  published public.corex_process_versions;
begin
  select * into target_process
  from public.corex_processes
  where id = p_process_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_process.id is null or target_process.revision <> p_expected_revision then
    raise exception 'Corex publish revision conflict' using errcode = '40001';
  end if;

  published_definition := jsonb_set(
    jsonb_set(
      target_process.draft_definition,
      '{revision}',
      to_jsonb(target_process.revision),
      true
    ),
    '{lifecycle}',
    to_jsonb('published'::text),
    true
  );
  published_sha256 := encode(
    extensions.digest(convert_to(published_definition::text, 'UTF8'), 'sha256'),
    'hex'
  );

  if target_process.published_version is not null then
    select * into published
    from public.corex_process_versions
    where process_id = target_process.id
      and version = target_process.published_version
      and definition_sha256 = published_sha256;

    if published.id is not null then
      return published;
    end if;
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.corex_process_versions
  where process_id = target_process.id;

  insert into public.corex_process_versions (
    process_id,
    owner_user_id,
    version,
    definition,
    definition_sha256,
    published_by
  ) values (
    target_process.id,
    target_process.owner_user_id,
    next_version,
    published_definition,
    published_sha256,
    p_owner_user_id
  )
  returning * into published;

  update public.corex_processes
  set lifecycle = 'published',
      published_version = next_version,
      updated_at = now()
  where id = target_process.id;

  return published;
end;
$$;

revoke all on function public.corex_publish_process(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.corex_publish_process(uuid, uuid, bigint) to service_role;

create or replace function public.corex_start_process_run(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_workflow_instance_id text,
  p_input jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_process public.corex_processes;
  target_version public.corex_process_versions;
  created_run public.corex_runs;
begin
  select * into target_process
  from public.corex_processes
  where id = p_process_id
    and owner_user_id = p_owner_user_id;

  if target_process.id is null or target_process.published_version is null then
    raise exception 'Corex process has no published version' using errcode = 'P0002';
  end if;

  select * into target_version
  from public.corex_process_versions
  where process_id = target_process.id
    and owner_user_id = target_process.owner_user_id
    and version = target_process.published_version;

  if target_version.id is null then
    raise exception 'Corex published version is missing' using errcode = 'P0002';
  end if;

  insert into public.corex_runs (
    process_id,
    process_version_id,
    owner_user_id,
    workflow_instance_id,
    input
  ) values (
    target_process.id,
    target_version.id,
    target_process.owner_user_id,
    p_workflow_instance_id,
    coalesce(p_input, '{}'::jsonb)
  )
  returning * into created_run;

  return jsonb_build_object(
    'id', created_run.id,
    'workflowInstanceId', created_run.workflow_instance_id,
    'status', created_run.status,
    'definition', target_version.definition
  );
end;
$$;

revoke all on function public.corex_start_process_run(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.corex_start_process_run(uuid, uuid, text, jsonb) to service_role;

create or replace function public.corex_fail_process_run(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_error jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  failed_run public.corex_runs;
begin
  update public.corex_runs
  set status = 'errored',
      error = coalesce(p_error, '{"code":"workflow_create_failed"}'::jsonb),
      finished_at = now()
  where id = p_run_id
    and owner_user_id = p_owner_user_id
    and status = 'queued'
  returning * into failed_run;

  if failed_run.id is null then
    raise exception 'Corex queued run is missing' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'id', failed_run.id,
    'status', failed_run.status
  );
end;
$$;

revoke all on function public.corex_fail_process_run(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.corex_fail_process_run(uuid, uuid, jsonb) to service_role;

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

    return jsonb_build_object(
      'id', target_run.id,
      'status', target_run.status
    );
  end if;

  if not (
    target_run.status = p_status
    or (target_run.status = 'queued' and p_status = 'running')
    or (target_run.status = 'running' and p_status in ('complete', 'errored'))
  ) then
    raise exception 'Invalid Corex run status transition' using errcode = '22023';
  end if;

  insert into public.corex_run_events (
    run_id,
    owner_user_id,
    sequence,
    event_type,
    step_name,
    payload
  ) values (
    target_run.id,
    target_run.owner_user_id,
    p_sequence,
    p_event_type,
    p_step_name,
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

  return jsonb_build_object(
    'id', target_run.id,
    'status', target_run.status
  );
end;
$$;

revoke all on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.corex_record_run_event(uuid, uuid, integer, public.corex_run_status, text, text, jsonb, jsonb, jsonb) to service_role;
