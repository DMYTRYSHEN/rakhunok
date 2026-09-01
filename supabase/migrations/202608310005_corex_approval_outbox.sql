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
  target_step_id text;
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

  if target_task.status <> 'pending' and (
    target_task.status::text <> p_decision
    or target_task.decided_by is distinct from p_actor_user_id
    or target_task.decision_comment is distinct from nullif(p_comment, '')
  ) then
    raise exception 'Approval task already decided' using errcode = '23505';
  end if;

  select * into target_run
  from public.corex_runs
  where id = target_task.run_id
  for update;

  if target_run.id is null then
    raise exception 'Run cannot accept approval' using errcode = '23505';
  end if;

  if target_task.status <> 'pending' and target_run.status <> 'waiting' then
    return jsonb_build_object('accepted', true);
  end if;

  if target_run.status <> 'waiting' then
    raise exception 'Run cannot accept approval' using errcode = '23505';
  end if;

  select event.payload ->> 'stepId' into target_step_id
  from public.corex_run_events event
  where event.run_id = target_task.run_id
    and event.event_type = 'step_started'
    and event.step_name = target_task.step_name
    and event.payload ->> 'stepType' = 'approval'
  order by event.sequence desc
  limit 1;

  if target_step_id is null or target_step_id !~ '^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,79}$' then
    raise exception 'Approval step correlation is invalid' using errcode = '22023';
  end if;

  if target_task.status = 'pending' then
    update public.corex_approval_tasks
    set status = p_decision::public.corex_approval_status,
        decision_comment = nullif(p_comment, ''),
        decided_by = p_actor_user_id,
        decided_at = now()
    where id = target_task.id
    returning * into target_task;
  end if;

  insert into public.corex_outbox (
    owner_user_id, run_id, kind, semantic_key, workflow_instance_id, payload
  ) values (
    target_run.owner_user_id,
    target_run.id,
    'workflow_event',
    'workflow_event:approval:' || target_task.id::text,
    target_run.workflow_instance_id,
    jsonb_build_object(
      'type', 'corex-approval:' || target_step_id,
      'payload', jsonb_build_object(
        'decision', target_task.status::text,
        'comment', target_task.decision_comment,
        'actorUserId', target_task.decided_by,
        'taskId', target_task.id
      )
    )
  ) on conflict (semantic_key) do nothing;

  return jsonb_build_object('accepted', true);
end;
$$;

revoke all on function public.corex_decide_approval_task(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.corex_decide_approval_task(uuid, uuid, text, text) to service_role;

create or replace function public.corex_claim_outbox(
  p_limit integer default 25,
  p_lease_seconds integer default 60
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed jsonb;
begin
  if p_limit not between 1 and 100 or p_lease_seconds not between 10 and 300 then
    raise exception 'Invalid Corex outbox claim bounds' using errcode = '22023';
  end if;

  with candidates as (
    select id
    from public.corex_outbox
    where delivered_at is null
      and available_at <= now()
      and (lease_expires_at is null or lease_expires_at <= now())
    order by available_at, created_at
    limit p_limit
    for update skip locked
  ), leased as (
    update public.corex_outbox item
    set attempts = item.attempts + 1,
        claim_token = gen_random_uuid(),
        lease_expires_at = now() + make_interval(secs => p_lease_seconds)
    from candidates
    where item.id = candidates.id
    returning item.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'kind', kind,
    'workflowInstanceId', workflow_instance_id,
    'payload', payload,
    'attempts', attempts,
    'claimToken', claim_token
  ) order by created_at), '[]'::jsonb)
  into claimed
  from leased;

  return claimed;
end;
$$;

revoke all on function public.corex_claim_outbox(integer, integer) from public, anon, authenticated;
grant execute on function public.corex_claim_outbox(integer, integer) to service_role;