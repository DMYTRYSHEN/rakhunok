create or replace function public.corex_terminate_subprocess_run(
  p_run_id uuid,
  p_owner_user_id uuid,
  p_parent_run_id uuid,
  p_parent_step_id text,
  p_workflow_instance_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  child_run public.corex_runs;
begin
  select * into child_run
  from public.corex_runs
  where id = p_run_id
    and owner_user_id = p_owner_user_id
    and parent_run_id = p_parent_run_id
    and parent_step_id = p_parent_step_id
    and workflow_instance_id = p_workflow_instance_id
  for update;

  if child_run.id is null then
    raise exception 'Corex subprocess run is missing' using errcode = 'P0002';
  end if;

  if child_run.status in ('queued', 'running', 'waiting', 'paused') then
    update public.corex_runs
    set status = 'terminated',
        finished_at = coalesce(finished_at, now()),
      error = '{"code":"parent_wait_failed"}'::jsonb
    where id = child_run.id
    returning * into child_run;
  end if;

  return jsonb_build_object(
    'id', child_run.id,
    'status', child_run.status,
    'workflowInstanceId', child_run.workflow_instance_id
  );
end;
$$;

revoke all on function public.corex_terminate_subprocess_run(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.corex_terminate_subprocess_run(uuid, uuid, uuid, text, text) to service_role;