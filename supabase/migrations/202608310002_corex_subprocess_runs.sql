alter table public.corex_runs
  add column parent_run_id uuid references public.corex_runs(id) on delete restrict,
  add column parent_step_id text,
  add column depth integer not null default 0 check (depth between 0 and 8);

alter table public.corex_runs
  add constraint corex_runs_parent_pair_check check (
    (parent_run_id is null and parent_step_id is null and depth = 0)
    or (parent_run_id is not null and parent_step_id is not null and char_length(parent_step_id) between 1 and 120 and depth > 0)
  );

create unique index corex_runs_parent_step_idx
  on public.corex_runs (parent_run_id, parent_step_id)
  where parent_run_id is not null;

create or replace function public.corex_start_subprocess_run(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_parent_run_id uuid,
  p_parent_step_id text,
  p_workflow_instance_id text,
  p_input jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_run public.corex_runs;
  target_process public.corex_processes;
  target_version public.corex_process_versions;
  child_run public.corex_runs;
  was_created boolean := false;
begin
  select * into parent_run
  from public.corex_runs
  where id = p_parent_run_id
    and owner_user_id = p_owner_user_id
  for update;

  if parent_run.id is null or parent_run.status not in ('running', 'waiting') then
    raise exception 'Corex parent run cannot start a subprocess' using errcode = 'P0002';
  end if;
  if parent_run.depth >= 8 then
    raise exception 'Corex subprocess depth limit reached' using errcode = '54001';
  end if;
  if p_parent_step_id is null or char_length(p_parent_step_id) not between 1 and 120 then
    raise exception 'Invalid Corex subprocess step' using errcode = '22023';
  end if;

  select * into child_run
  from public.corex_runs
  where parent_run_id = parent_run.id
    and parent_step_id = p_parent_step_id;

  if child_run.id is null then
    select * into target_process
    from public.corex_processes
    where id = p_process_id
      and owner_user_id = p_owner_user_id;

    if target_process.id is null or target_process.published_version is null then
      raise exception 'Corex subprocess has no published version' using errcode = 'P0002';
    end if;

    select * into target_version
    from public.corex_process_versions
    where process_id = target_process.id
      and owner_user_id = p_owner_user_id
      and version = target_process.published_version;

    if target_version.id is null then
      raise exception 'Corex subprocess published version is missing' using errcode = 'P0002';
    end if;

    insert into public.corex_runs (
      process_id, process_version_id, owner_user_id, workflow_instance_id,
      input, parent_run_id, parent_step_id, depth
    ) values (
      target_process.id, target_version.id, p_owner_user_id, p_workflow_instance_id,
      coalesce(p_input, '{}'::jsonb), parent_run.id, p_parent_step_id, parent_run.depth + 1
    )
    returning * into child_run;
    was_created := true;
  else
    select * into target_version
    from public.corex_process_versions
    where id = child_run.process_version_id;
  end if;

  return jsonb_build_object(
    'id', child_run.id,
    'workflowInstanceId', child_run.workflow_instance_id,
    'parentWorkflowInstanceId', parent_run.workflow_instance_id,
    'status', child_run.status,
    'definition', target_version.definition,
    'created', was_created
  );
end;
$$;

revoke all on function public.corex_start_subprocess_run(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.corex_start_subprocess_run(uuid, uuid, uuid, text, text, jsonb) to service_role;