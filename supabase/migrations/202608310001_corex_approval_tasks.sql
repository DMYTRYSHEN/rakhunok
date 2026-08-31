create type public.corex_approval_status as enum ('pending', 'approved', 'rejected', 'expired');

create table public.corex_approval_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.corex_runs(id) on delete cascade,
  process_id uuid not null references public.corex_processes(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  assignee_user_id uuid not null references auth.users(id) on delete cascade,
  step_name text not null,
  status public.corex_approval_status not null default 'pending',
  deadline_at timestamptz not null,
  decision_comment text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, step_name)
);

create index corex_approval_tasks_assignee_status_idx
  on public.corex_approval_tasks (assignee_user_id, status, created_at desc);

alter table public.corex_approval_tasks enable row level security;

create policy "assignees read Corex approval tasks"
  on public.corex_approval_tasks for select to authenticated
  using (assignee_user_id = (select auth.uid()));

revoke all on public.corex_approval_tasks from anon, authenticated;
grant select on public.corex_approval_tasks to authenticated;

create or replace function public.corex_create_approval_task_from_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.corex_runs;
begin
  if new.event_type <> 'step_started' or new.payload ->> 'stepType' <> 'approval' then
    return new;
  end if;

  select * into target_run from public.corex_runs where id = new.run_id;

  insert into public.corex_approval_tasks (
    run_id, process_id, owner_user_id, assignee_user_id, step_name, deadline_at
  ) values (
    new.run_id,
    target_run.process_id,
    new.owner_user_id,
    (new.payload ->> 'assigneeUserId')::uuid,
    new.step_name,
    now() + make_interval(secs => ((new.payload ->> 'timeoutMs')::bigint / 1000.0))
  )
  on conflict (run_id, step_name) do nothing;

  return new;
end;
$$;

create trigger corex_run_event_creates_approval_task
after insert on public.corex_run_events
for each row execute function public.corex_create_approval_task_from_event();

create or replace function public.corex_decide_approval_task(
  p_run_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_comment text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_task public.corex_approval_tasks;
  target_run public.corex_runs;
begin
  if p_decision not in ('approved', 'rejected') or length(coalesce(p_comment, '')) > 2000 then
    raise exception 'Invalid approval decision' using errcode = '22023';
  end if;

  select * into target_task
  from public.corex_approval_tasks
  where run_id = p_run_id
    and assignee_user_id = p_actor_user_id
  order by created_at desc
  limit 1
  for update;

  if target_task.id is null then
    raise exception 'Approval task is missing' using errcode = 'P0002';
  end if;

  if target_task.status = 'pending' and target_task.deadline_at <= now() then
    update public.corex_approval_tasks set status = 'expired' where id = target_task.id;
    raise exception 'Approval task expired' using errcode = '23505';
  end if;

  if target_task.status = 'pending' then
    update public.corex_approval_tasks
    set status = p_decision::public.corex_approval_status,
        decision_comment = nullif(p_comment, ''),
        decided_by = p_actor_user_id,
        decided_at = now()
    where id = target_task.id
    returning * into target_task;
  elsif target_task.status::text <> p_decision
    or target_task.decided_by is distinct from p_actor_user_id
    or target_task.decision_comment is distinct from nullif(p_comment, '')
  then
    raise exception 'Approval task already decided' using errcode = '23505';
  end if;

  select * into target_run from public.corex_runs where id = target_task.run_id;
  if target_run.id is null or target_run.status <> 'waiting' then
    raise exception 'Run cannot accept approval' using errcode = '23505';
  end if;

  return jsonb_build_object(
    'workflowInstanceId', target_run.workflow_instance_id,
    'payload', jsonb_build_object(
      'decision', p_decision,
      'comment', target_task.decision_comment,
      'actorUserId', p_actor_user_id,
      'taskId', target_task.id
    )
  );
end;
$$;

revoke all on function public.corex_decide_approval_task(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.corex_decide_approval_task(uuid, uuid, text, text) to service_role;

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

  select * into target_run from public.corex_runs
  where id = p_run_id and owner_user_id = p_owner_user_id for update;
  if target_run.id is null then raise exception 'Corex run is missing' using errcode = 'P0002'; end if;

  select * into existing_event from public.corex_run_events
  where run_id = target_run.id and sequence = p_sequence;
  if existing_event.id is not null then
    if existing_event.event_type <> p_event_type
      or existing_event.step_name is distinct from p_step_name
      or existing_event.payload <> coalesce(p_payload, '{}'::jsonb)
    then raise exception 'Conflicting Corex run event' using errcode = '22023'; end if;
    return jsonb_build_object('id', target_run.id, 'status', target_run.status);
  end if;

  if not (
    target_run.status = p_status
    or (target_run.status = 'queued' and p_status = 'running')
    or (target_run.status = 'running' and p_status in ('waiting', 'complete', 'errored'))
    or (target_run.status = 'waiting' and p_status in ('running', 'errored'))
  ) then raise exception 'Invalid Corex run status transition' using errcode = '22023'; end if;

  insert into public.corex_run_events (run_id, owner_user_id, sequence, event_type, step_name, payload)
  values (target_run.id, target_run.owner_user_id, p_sequence, p_event_type, p_step_name, coalesce(p_payload, '{}'::jsonb));

  update public.corex_runs
  set status = p_status,
      started_at = case when p_status = 'running' then coalesce(started_at, now()) else started_at end,
      finished_at = case when p_status in ('complete', 'errored') then coalesce(finished_at, now()) else finished_at end,
      output = case when p_status = 'complete' then p_output else output end,
      error = case when p_status = 'errored' then p_error else error end
  where id = target_run.id returning * into target_run;

  return jsonb_build_object('id', target_run.id, 'status', target_run.status);
end;
$$;