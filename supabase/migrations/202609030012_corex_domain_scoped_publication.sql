alter table public.corex_published_triggers
  add column domain_target_id uuid;

alter table public.corex_published_triggers
  add foreign key (domain_target_id, owner_user_id)
    references public.corex_domain_targets(id, owner_user_id) on delete restrict,
  add constraint corex_published_http_trigger_domain_required
    check (kind <> 'http' or domain_target_id is not null) not valid;

revoke execute on function public.corex_publish_process(uuid, uuid, bigint) from service_role;

create or replace function public.corex_publish_process(
  p_process_id uuid,
  p_owner_user_id uuid,
  p_expected_revision bigint,
  p_environment_id uuid,
  p_route_namespace text
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
  target_environment public.corex_environments;
  target_domain_selection public.corex_environment_domain_targets;
  normalized_route_namespace text := lower(trim(p_route_namespace));
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

    if normalized_route_namespace is null
      or normalized_route_namespace !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      or char_length(normalized_route_namespace) > 63 then
      raise exception 'Corex route namespace is invalid' using errcode = '22023';
    end if;

    select * into target_environment
    from public.corex_environments
    where id = p_environment_id
      and owner_user_id = target_process.owner_user_id
      and lifecycle = 'active'
    for update;

    if target_environment.id is null then
      raise exception 'Corex active environment not found' using errcode = 'P0002';
    end if;

    perform 1
    from public.corex_route_namespaces
    where environment_id = target_environment.id
      and route_namespace = normalized_route_namespace
      and owner_user_id = target_process.owner_user_id
      and lifecycle = 'active'
    for key share;

    if not found then
      raise exception 'Corex active route namespace not found' using errcode = 'P0002';
    end if;

    select * into target_domain_selection
    from public.corex_environment_domain_targets
    where environment_id = target_environment.id
      and owner_user_id = target_process.owner_user_id
    for key share;

    if target_domain_selection.environment_id is null then
      raise exception 'Corex environment domain is not selected' using errcode = 'PT409';
    end if;
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
      route_path,
      domain_target_id
    ) values (
      published.id,
      target_process.id,
      target_process.owner_user_id,
      'http',
      target_environment.id,
      normalized_route_namespace,
      route_method,
      route_path,
      target_domain_selection.domain_target_id
    )
    on conflict (process_version_id) do nothing;

    select * into published_trigger
    from public.corex_published_triggers
    where process_version_id = published.id;

    if published_trigger.environment_id <> target_environment.id
      or published_trigger.route_namespace <> normalized_route_namespace
      or published_trigger.domain_target_id <> target_domain_selection.domain_target_id then
      raise exception 'Corex published domain target conflicts' using errcode = 'PT409';
    end if;

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

revoke all on function public.corex_publish_process(uuid, uuid, bigint, uuid, text)
  from public, anon, authenticated;
grant execute on function public.corex_publish_process(uuid, uuid, bigint, uuid, text)
  to service_role;