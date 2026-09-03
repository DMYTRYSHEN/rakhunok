create table public.corex_privileged_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  can_delete_processes boolean not null default false,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  check (expires_at is null or expires_at > granted_at)
);

create table public.corex_process_legal_holds (
  process_id uuid primary key references public.corex_processes(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  placed_by uuid not null references auth.users(id),
  placed_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references auth.users(id),
  check (
    (released_at is null and released_by is null)
    or (released_at is not null and released_by is not null)
  )
);

create type public.corex_operation_kind as enum (
  'process_create',
  'run_terminate',
  'workflow_delete',
  'process_delete'
);
create type public.corex_operation_status as enum ('pending', 'processing', 'complete', 'partial', 'failed');
create type public.corex_operation_item_status as enum ('pending', 'processing', 'complete', 'failed');

create table public.corex_operations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  request_id uuid not null,
  kind public.corex_operation_kind not null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  status public.corex_operation_status not null default 'pending',
  item_count integer not null check (item_count between 1 and 100),
  completed_count integer not null default 0 check (completed_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (owner_user_id, request_id),
  check (completed_count + failed_count <= item_count),
  check ((status in ('complete', 'partial', 'failed')) = (completed_at is not null))
);

create table public.corex_operation_items (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.corex_operations(id) on delete cascade,
  ordinal integer not null check (ordinal between 0 and 99),
  target_id text not null check (char_length(target_id) between 1 and 200),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status public.corex_operation_item_status not null default 'pending',
  attempts integer not null default 0 check (attempts between 0 and 8),
  available_at timestamptz not null default now(),
  claim_token uuid,
  lease_expires_at timestamptz,
  result jsonb,
  error_code text check (error_code is null or char_length(error_code) between 1 and 80),
  completed_at timestamptz,
  unique (operation_id, ordinal),
  unique (operation_id, target_id),
  check (
    (status = 'processing' and claim_token is not null and lease_expires_at is not null)
    or (status <> 'processing' and claim_token is null and lease_expires_at is null)
  ),
  check ((status in ('complete', 'failed')) = (completed_at is not null))
);

create index corex_operation_items_claim_idx
  on public.corex_operation_items (available_at, operation_id, ordinal)
  where status in ('pending', 'processing') and attempts < 8;

create table public.corex_process_deletion_tombstones (
  process_id uuid primary key,
  owner_user_id uuid not null,
  operation_id uuid not null unique references public.corex_operations(id) on delete restrict,
  slug text not null,
  process_name text not null,
  deleted_by uuid not null,
  deleted_at timestamptz not null default now(),
  run_count integer not null check (run_count >= 0),
  version_count integer not null check (version_count >= 0)
);

alter table public.corex_privileged_operators enable row level security;
alter table public.corex_process_legal_holds enable row level security;
alter table public.corex_operations enable row level security;
alter table public.corex_operation_items enable row level security;
alter table public.corex_process_deletion_tombstones enable row level security;

create policy "owners read Corex operations"
  on public.corex_operations for select to authenticated
  using (owner_user_id = (select auth.uid()));
create policy "owners read Corex operation items"
  on public.corex_operation_items for select to authenticated
  using (exists (
    select 1 from public.corex_operations operation
    where operation.id = operation_id and operation.owner_user_id = (select auth.uid())
  ));

revoke all on public.corex_privileged_operators from public, anon, authenticated;
revoke all on public.corex_process_legal_holds from public, anon, authenticated;
revoke all on public.corex_operations from public, anon, authenticated;
revoke all on public.corex_operation_items from public, anon, authenticated;
revoke all on public.corex_process_deletion_tombstones from public, anon, authenticated;
grant select on public.corex_operations, public.corex_operation_items to authenticated;
grant select, insert, update, delete on public.corex_privileged_operators,
  public.corex_process_legal_holds, public.corex_operations, public.corex_operation_items,
  public.corex_process_deletion_tombstones to service_role;

create or replace function public.corex_submit_process_deletion(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_requested_by uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_operation public.corex_operations;
  target_process public.corex_processes;
  process_run_count integer;
  operation_fingerprint text := encode(extensions.digest(
    concat_ws(':', 'process_delete', p_process_id, p_owner_user_id), 'sha256'
  ), 'hex');
begin
  if p_requested_by <> p_owner_user_id then
    raise exception 'Corex deletion owner mismatch' using errcode = 'PT403';
  end if;
  if not exists (
    select 1 from public.corex_privileged_operators operator
    where operator.user_id = p_requested_by
      and operator.can_delete_processes
      and (operator.expires_at is null or operator.expires_at > now())
  ) then
    raise exception 'Corex deletion requires elevated authorization' using errcode = 'PT403';
  end if;

  select * into existing_operation
  from public.corex_operations
  where owner_user_id = p_owner_user_id and request_id = p_request_id
  for update;
  if existing_operation.id is not null then
    if existing_operation.kind <> 'process_delete'
      or existing_operation.fingerprint <> operation_fingerprint then
      raise exception 'Corex operation request conflicts' using errcode = 'PT409';
    end if;
    return jsonb_build_object('id', existing_operation.id, 'status', existing_operation.status,
      'itemCount', existing_operation.item_count);
  end if;

  select * into target_process
  from public.corex_processes
  where id = p_process_id and owner_user_id = p_owner_user_id
  for update;
  if target_process.id is null then
    raise exception 'Corex process is missing' using errcode = 'PT404';
  end if;
  if target_process.lifecycle <> 'retired' then
    raise exception 'Corex process must be retired before deletion' using errcode = 'PT409';
  end if;
  if exists (
    select 1 from public.corex_process_legal_holds hold
    where hold.process_id = p_process_id and hold.released_at is null
  ) then
    raise exception 'Corex process is under legal hold' using errcode = 'PT423';
  end if;
  if exists (
    select 1 from public.corex_runs run
    where run.process_id = p_process_id
      and run.status not in ('complete', 'errored', 'terminated')
  ) then
    raise exception 'Corex process has active runs' using errcode = 'PT409';
  end if;

  select count(*) into process_run_count
  from public.corex_runs run where run.process_id = p_process_id;
  if process_run_count > 99 then
    raise exception 'Corex process deletion exceeds the operation bound' using errcode = 'PT409';
  end if;

  insert into public.corex_operations (
    owner_user_id, requested_by, request_id, kind, fingerprint, item_count
  ) values (
    p_owner_user_id, p_requested_by, p_request_id, 'process_delete', operation_fingerprint,
    process_run_count + 1
  ) returning * into existing_operation;

  insert into public.corex_operation_items (operation_id, ordinal, target_id, payload)
  select existing_operation.id,
    row_number() over (order by run.created_at, run.id) - 1,
    run.workflow_instance_id,
    jsonb_build_object(
      'action', 'run_cleanup',
      'objectKeys', coalesce((
        select jsonb_agg(distinct attempt.output #>> '{external,key}')
        from public.corex_step_attempts attempt
        where attempt.run_id = run.id and attempt.output #>> '{external,key}' is not null
      ), '[]'::jsonb)
    )
  from public.corex_runs run
  where run.process_id = p_process_id;

  insert into public.corex_operation_items (operation_id, ordinal, target_id, payload)
  values (
    existing_operation.id,
    process_run_count,
    p_process_id::text,
    jsonb_build_object('action', 'process_finalize')
  );

  return jsonb_build_object('id', existing_operation.id, 'status', existing_operation.status,
    'itemCount', existing_operation.item_count);
end;
$$;

create or replace function public.corex_claim_operation_items(
  p_limit integer default 25,
  p_lease_seconds integer default 120
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  if p_limit not between 1 and 100 or p_lease_seconds not between 30 and 300 then
    raise exception 'Invalid Corex operation bounds' using errcode = '22023';
  end if;

  with candidates as (
    select item.id
    from public.corex_operation_items item
    where item.status in ('pending', 'processing')
      and item.attempts < 8
      and item.available_at <= now()
      and (item.lease_expires_at is null or item.lease_expires_at <= now())
      and (
        item.payload ->> 'action' <> 'process_finalize'
        or not exists (
          select 1 from public.corex_operation_items dependency
          where dependency.operation_id = item.operation_id
            and dependency.ordinal < item.ordinal
            and dependency.status <> 'complete'
        )
      )
    order by item.available_at, item.operation_id, item.ordinal
    limit p_limit
    for update skip locked
  ), leased as (
    update public.corex_operation_items item
    set status = 'processing', attempts = item.attempts + 1,
      claim_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      error_code = null
    from candidates
    where item.id = candidates.id
    returning item.*
  ), started as (
    update public.corex_operations operation
    set status = 'processing', started_at = coalesce(started_at, now())
    where operation.id in (select operation_id from leased)
    returning operation.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', leased.id,
    'operationId', leased.operation_id,
    'kind', operation.kind,
    'ownerUserId', operation.owner_user_id,
    'requestedBy', operation.requested_by,
    'targetId', leased.target_id,
    'payload', leased.payload,
    'claimToken', leased.claim_token
  ) order by leased.operation_id, leased.ordinal), '[]'::jsonb)
  into claimed
  from leased
  join public.corex_operations operation on operation.id = leased.operation_id;

  return claimed;
end;
$$;

create or replace function corex_private.refresh_operation(p_operation_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  item_total integer;
  item_complete integer;
  item_failed integer;
begin
  select count(*), count(*) filter (where status = 'complete'), count(*) filter (where status = 'failed')
  into item_total, item_complete, item_failed
  from public.corex_operation_items where operation_id = p_operation_id;

  update public.corex_operations
  set completed_count = item_complete,
    failed_count = item_failed,
    status = case
      when item_complete + item_failed < item_total then 'processing'::public.corex_operation_status
      when item_failed = 0 then 'complete'::public.corex_operation_status
      when item_complete = 0 then 'failed'::public.corex_operation_status
      else 'partial'::public.corex_operation_status
    end,
    completed_at = case when item_complete + item_failed = item_total then now() else null end
  where id = p_operation_id;
end;
$$;

revoke all on function corex_private.refresh_operation(uuid) from public, anon, authenticated;

create or replace function public.corex_complete_operation_item(
  p_item_id uuid,
  p_claim_token uuid,
  p_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_item public.corex_operation_items;
begin
  if jsonb_typeof(p_result) <> 'object' then
    raise exception 'Invalid Corex operation result' using errcode = '22023';
  end if;
  update public.corex_operation_items
  set status = 'complete', result = p_result, completed_at = now(),
    claim_token = null, lease_expires_at = null, error_code = null
  where id = p_item_id and status = 'processing' and claim_token = p_claim_token
    and lease_expires_at > now()
  returning * into target_item;
  if target_item.id is null then
    raise exception 'Corex operation claim is stale' using errcode = 'PT409';
  end if;
  perform corex_private.refresh_operation(target_item.operation_id);
  return jsonb_build_object('accepted', true);
end;
$$;

create or replace function public.corex_fail_operation_item(
  p_item_id uuid,
  p_claim_token uuid,
  p_error_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_item public.corex_operation_items;
begin
  if p_error_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'Invalid Corex operation error code' using errcode = '22023';
  end if;
  update public.corex_operation_items
  set status = case when attempts >= 8 then 'failed'::public.corex_operation_item_status
      else 'pending'::public.corex_operation_item_status end,
    available_at = now() + make_interval(secs => least(300, 5 * power(2, greatest(attempts - 1, 0))::integer)),
    completed_at = case when attempts >= 8 then now() else null end,
    claim_token = null, lease_expires_at = null, error_code = p_error_code
  where id = p_item_id and status = 'processing' and claim_token = p_claim_token
    and lease_expires_at > now()
  returning * into target_item;
  if target_item.id is null then
    raise exception 'Corex operation claim is stale' using errcode = 'PT409';
  end if;
  if target_item.status = 'failed' then
    update public.corex_operation_items dependency
    set status = 'failed', completed_at = now(), error_code = 'dependency_failed'
    where dependency.operation_id = target_item.operation_id
      and dependency.status = 'pending'
      and dependency.payload ->> 'action' = 'process_finalize';
  end if;
  perform corex_private.refresh_operation(target_item.operation_id);
  return jsonb_build_object('accepted', true, 'deadLettered', target_item.status = 'failed');
end;
$$;

revoke all on function public.corex_submit_process_deletion(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.corex_claim_operation_items(integer, integer)
  from public, anon, authenticated;
revoke all on function public.corex_complete_operation_item(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.corex_fail_operation_item(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.corex_submit_process_deletion(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.corex_claim_operation_items(integer, integer) to service_role;
grant execute on function public.corex_complete_operation_item(uuid, uuid, jsonb) to service_role;
grant execute on function public.corex_fail_operation_item(uuid, uuid, text) to service_role;