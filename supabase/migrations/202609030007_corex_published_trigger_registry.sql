create table public.corex_published_trigger_registrations (
  id uuid primary key default gen_random_uuid(),
  process_version_id uuid not null,
  process_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('webhook', 'schedule', 'internal_event', 'queue')),
  trigger_key text not null check (
    trigger_key ~ '^[a-z0-9]+(?:[._:-][a-z0-9]+)*$'
    and char_length(trigger_key) <= 160
  ),
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  configuration_sha256 text not null check (configuration_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (process_version_id, kind, trigger_key),
  foreign key (process_version_id, process_id, owner_user_id)
    references public.corex_process_versions(id, process_id, owner_user_id) on delete restrict
);

alter table public.corex_published_trigger_registrations enable row level security;
revoke all on public.corex_published_trigger_registrations from public, anon, authenticated;
grant select, insert on public.corex_published_trigger_registrations to service_role;

create trigger corex_published_trigger_registrations_immutable
before update or delete on public.corex_published_trigger_registrations
for each row execute function corex_private.reject_published_trigger_mutation();

create or replace function public.corex_register_published_trigger(
  p_process_version_id uuid,
  p_owner_user_id uuid,
  p_kind text,
  p_trigger_key text,
  p_configuration jsonb
)
returns public.corex_published_trigger_registrations
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_version public.corex_process_versions;
  normalized_kind text := lower(trim(p_kind));
  normalized_trigger_key text := lower(trim(p_trigger_key));
  configuration_fingerprint text;
  existing_registration public.corex_published_trigger_registrations;
  registered_trigger public.corex_published_trigger_registrations;
begin
  select * into target_version
  from public.corex_process_versions
  where id = p_process_version_id
    and owner_user_id = p_owner_user_id
  for key share;

  if target_version.id is null then
    raise exception 'Corex published process version not found' using errcode = 'P0002';
  end if;

  if normalized_kind not in ('webhook', 'schedule', 'internal_event', 'queue') then
    raise exception 'Corex published trigger kind is invalid' using errcode = '22023';
  end if;

  if normalized_trigger_key is null
    or normalized_trigger_key !~ '^[a-z0-9]+(?:[._:-][a-z0-9]+)*$'
    or char_length(normalized_trigger_key) > 160 then
    raise exception 'Corex published trigger key is invalid' using errcode = '22023';
  end if;

  if p_configuration is null or jsonb_typeof(p_configuration) <> 'object' then
    raise exception 'Corex published trigger configuration is invalid' using errcode = '22023';
  end if;

  if jsonb_path_exists(
    p_configuration,
    'strict $.**.keyvalue() ? (@.key like_regex "^(secret|token|password|authorization|api[_-]?key)$" flag "i")'
  ) then
    raise exception 'Corex published trigger configuration contains secret material' using errcode = '22023';
  end if;

  if normalized_kind = 'webhook' and (
    coalesce(p_configuration ->> 'method', '') not in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
    or nullif(p_configuration ->> 'path', '') is null
    or p_configuration ->> 'path' !~ '^/[A-Za-z0-9._~!$&''()*+,;=:@%/-]*$'
    or p_configuration ->> 'path' ~ '//'
    or char_length(p_configuration ->> 'path') > 1024
  ) then
    raise exception 'Corex webhook trigger configuration is invalid' using errcode = '22023';
  elsif normalized_kind = 'schedule' and nullif(p_configuration ->> 'cron', '') is null then
    raise exception 'Corex schedule trigger configuration is invalid' using errcode = '22023';
  elsif normalized_kind = 'internal_event' and nullif(p_configuration ->> 'eventType', '') is null then
    raise exception 'Corex internal event trigger configuration is invalid' using errcode = '22023';
  elsif normalized_kind = 'queue' and nullif(p_configuration ->> 'queue', '') is null then
    raise exception 'Corex queue trigger configuration is invalid' using errcode = '22023';
  end if;

  configuration_fingerprint := encode(
    extensions.digest(convert_to(p_configuration::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select * into existing_registration
  from public.corex_published_trigger_registrations
  where process_version_id = target_version.id
    and kind = normalized_kind
    and trigger_key = normalized_trigger_key;

  if existing_registration.id is not null then
    if existing_registration.configuration_sha256 <> configuration_fingerprint then
      raise exception 'Corex published trigger registration conflicts' using errcode = 'PT409';
    end if;

    return existing_registration;
  end if;

  begin
    insert into public.corex_published_trigger_registrations (
      process_version_id,
      process_id,
      owner_user_id,
      kind,
      trigger_key,
      configuration,
      configuration_sha256
    ) values (
      target_version.id,
      target_version.process_id,
      target_version.owner_user_id,
      normalized_kind,
      normalized_trigger_key,
      p_configuration,
      configuration_fingerprint
    )
    returning * into registered_trigger;
  exception
    when unique_violation then
      select * into existing_registration
      from public.corex_published_trigger_registrations
      where process_version_id = target_version.id
        and kind = normalized_kind
        and trigger_key = normalized_trigger_key;

      if existing_registration.configuration_sha256 = configuration_fingerprint then
        return existing_registration;
      end if;

      raise exception 'Corex published trigger registration conflicts' using errcode = 'PT409';
  end;

  return registered_trigger;
end;
$$;

revoke all on function public.corex_register_published_trigger(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.corex_register_published_trigger(uuid, uuid, text, text, jsonb) to service_role;