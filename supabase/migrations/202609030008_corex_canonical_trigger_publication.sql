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
  trigger_node jsonb;
  trigger_count integer;
  trigger_type text;
  event_source text;
  trigger_configuration jsonb;
  published_trigger public.corex_published_triggers;
  target_environment_key constant text := 'default';
  target_route_namespace constant text := 'default';
  target_environment public.corex_environments;
  route_method text;
  route_path text;
begin
  select * into target_process
  from public.corex_processes
  where id = p_process_id
    and owner_user_id = p_owner_user_id
  for update;

  if target_process.id is null or target_process.revision <> p_expected_revision then
    raise exception 'Corex publish revision conflict' using errcode = '40001';
  end if;

  select count(*), jsonb_agg(node) -> 0
  into trigger_count, trigger_node
  from jsonb_array_elements(target_process.draft_definition -> 'nodes') node
  where node ->> 'type' in ('trigger-http', 'trigger-schedule', 'trigger-event');

  if trigger_count <> 1 then
    raise exception 'Corex publish requires exactly one trigger' using errcode = '22023';
  end if;

  trigger_type := trigger_node ->> 'type';
  if trigger_type = 'trigger-http' then
    route_method := trigger_node #>> '{config,method}';
    route_path := trigger_node #>> '{config,path}';
    if coalesce(route_method, '') not in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
      or route_path is null
      or route_path !~ '^/[A-Za-z0-9._~!$&''()*+,;=:@%/-]*$'
      or route_path ~ '//'
      or char_length(route_path) > 1024 then
      raise exception 'Corex HTTP trigger route is invalid' using errcode = '22023';
    end if;

    if corex_private.is_protected_http_route(route_path) then
      raise exception 'Corex HTTP route is protected' using errcode = 'PT403';
    end if;

    insert into public.corex_environments (owner_user_id, environment_key)
    values (target_process.owner_user_id, target_environment_key)
    on conflict (owner_user_id, environment_key) do nothing;

    select * into target_environment
    from public.corex_environments
    where owner_user_id = target_process.owner_user_id
      and environment_key = target_environment_key
    for update;

    insert into public.corex_route_namespaces (environment_id, route_namespace, owner_user_id)
    values (target_environment.id, target_route_namespace, target_process.owner_user_id)
    on conflict (environment_id, route_namespace) do nothing;
  elsif trigger_type = 'trigger-schedule' then
    if nullif(trim(trigger_node #>> '{config,cron}'), '') is null
      or nullif(trim(trigger_node #>> '{config,timezone}'), '') is null then
      raise exception 'Corex schedule trigger configuration is invalid' using errcode = '22023';
    end if;
  else
    event_source := trigger_node #>> '{config,source}';
    if coalesce(event_source, '') not in (
      'queue',
      'workflow-binding',
      'durable-object',
      'database-webhook',
      'custom'
    )
      or nullif(trim(trigger_node #>> '{config,eventType}'), '') is null
      or (
        event_source <> 'custom'
        and nullif(trim(trigger_node #>> '{config,binding}'), '') is null
      ) then
      raise exception 'Corex event trigger configuration is invalid' using errcode = '22023';
    end if;
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
  end if;

  if published.id is null then
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
  end if;

  delete from public.corex_active_http_routes
  where process_id = target_process.id;

  if trigger_type = 'trigger-http' then
    insert into public.corex_published_triggers (
      process_version_id,
      process_id,
      owner_user_id,
      kind,
      environment_id,
      route_namespace,
      http_method,
      route_path
    ) values (
      published.id,
      target_process.id,
      target_process.owner_user_id,
      'http',
      target_environment.id,
      target_route_namespace,
      route_method,
      route_path
    )
    on conflict (process_version_id) do nothing;

    select * into published_trigger
    from public.corex_published_triggers
    where process_version_id = published.id;

    begin
      insert into public.corex_active_http_routes (
        environment_id,
        route_namespace,
        http_method,
        route_path,
        trigger_id,
        process_id,
        owner_user_id
      ) values (
        published_trigger.environment_id,
        published_trigger.route_namespace,
        published_trigger.http_method,
        published_trigger.route_path,
        published_trigger.id,
        target_process.id,
        target_process.owner_user_id
      );
    exception
      when unique_violation then
        raise exception 'Corex HTTP route conflict' using errcode = '23505';
    end;
  elsif trigger_type = 'trigger-schedule' then
    perform public.corex_register_published_trigger(
      published.id,
      target_process.owner_user_id,
      'schedule',
      'primary',
      trigger_node -> 'config'
    );
  else
    trigger_configuration := trigger_node -> 'config';
    if event_source = 'queue' then
      trigger_configuration := jsonb_build_object(
        'queue', trigger_node #>> '{config,binding}',
        'eventType', trigger_node #>> '{config,eventType}',
        'source', event_source
      );
    end if;

    perform public.corex_register_published_trigger(
      published.id,
      target_process.owner_user_id,
      case when event_source = 'queue' then 'queue' else 'internal_event' end,
      'primary',
      trigger_configuration
    );
  end if;

  update public.corex_processes
  set lifecycle = 'published',
      published_version = published.version,
      updated_at = now()
  where id = target_process.id;

  return published;
end;
$$;

revoke all on function public.corex_publish_process(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.corex_publish_process(uuid, uuid, bigint) to service_role;