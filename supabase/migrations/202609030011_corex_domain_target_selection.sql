create table public.corex_domain_targets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  hostname text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'failed')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (hostname),
  unique (id, owner_user_id),
  check (hostname = lower(hostname)),
  check (char_length(hostname) between 4 and 253),
  check (
    (verification_status = 'verified' and verified_at is not null)
    or (verification_status <> 'verified' and verified_at is null)
  )
);

create table public.corex_environment_domain_targets (
  environment_id uuid primary key,
  domain_target_id uuid not null unique,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  selected_at timestamptz not null default now(),
  unique (environment_id, owner_user_id),
  foreign key (environment_id, owner_user_id)
    references public.corex_environments(id, owner_user_id) on delete restrict,
  foreign key (domain_target_id, owner_user_id)
    references public.corex_domain_targets(id, owner_user_id) on delete restrict
);

alter table public.corex_domain_targets enable row level security;
alter table public.corex_environment_domain_targets enable row level security;
revoke all on public.corex_domain_targets from public, anon, authenticated;
revoke all on public.corex_environment_domain_targets from public, anon, authenticated;
grant select, insert on public.corex_domain_targets to service_role;
grant select, insert on public.corex_environment_domain_targets to service_role;

create or replace function corex_private.is_protected_domain(p_hostname text)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select p_hostname = 'rakhunok.com'
    or p_hostname like '%.rakhunok.com';
$$;

revoke all on function corex_private.is_protected_domain(text)
  from public, anon, authenticated;

create or replace function public.corex_register_domain_target(
  p_owner_user_id uuid,
  p_hostname text
)
returns public.corex_domain_targets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_hostname text := rtrim(lower(trim(p_hostname)), '.');
  target_domain public.corex_domain_targets;
begin
  if normalized_hostname is null
    or char_length(normalized_hostname) not between 4 and 253
    or normalized_hostname !~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$' then
    raise exception 'Corex domain hostname is invalid' using errcode = '22023';
  end if;

  if corex_private.is_protected_domain(normalized_hostname) then
    raise exception 'Corex domain is protected' using errcode = 'PT403';
  end if;

  insert into public.corex_domain_targets (owner_user_id, hostname)
  values (p_owner_user_id, normalized_hostname)
  on conflict (hostname) do nothing;

  select * into target_domain
  from public.corex_domain_targets
  where hostname = normalized_hostname
  for key share;

  if target_domain.owner_user_id <> p_owner_user_id then
    raise exception 'Corex domain target conflicts' using errcode = 'PT409';
  end if;

  return target_domain;
end;
$$;

create or replace function public.corex_select_environment_domain(
  p_environment_id uuid,
  p_domain_target_id uuid,
  p_owner_user_id uuid
)
returns public.corex_environment_domain_targets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_environment public.corex_environments;
  target_domain public.corex_domain_targets;
  existing_selection public.corex_environment_domain_targets;
  selected_domain public.corex_environment_domain_targets;
begin
  select * into target_environment
  from public.corex_environments
  where id = p_environment_id
    and owner_user_id = p_owner_user_id
    and lifecycle = 'active'
  for update;

  if target_environment.id is null then
    raise exception 'Corex active environment not found' using errcode = 'P0002';
  end if;

  select * into target_domain
  from public.corex_domain_targets
  where id = p_domain_target_id
    and owner_user_id = p_owner_user_id
  for key share;

  if target_domain.id is null then
    raise exception 'Corex domain target not found' using errcode = 'P0002';
  end if;

  select * into existing_selection
  from public.corex_environment_domain_targets
  where environment_id = target_environment.id
  for update;

  if existing_selection.environment_id is not null then
    if existing_selection.domain_target_id <> target_domain.id then
      raise exception 'Corex environment domain already selected' using errcode = 'PT409';
    end if;

    return existing_selection;
  end if;

  begin
    insert into public.corex_environment_domain_targets (
      environment_id,
      domain_target_id,
      owner_user_id
    ) values (
      target_environment.id,
      target_domain.id,
      p_owner_user_id
    )
    returning * into selected_domain;
  exception
    when unique_violation then
      raise exception 'Corex domain target already selected' using errcode = 'PT409';
  end;

  return selected_domain;
end;
$$;

revoke all on function public.corex_register_domain_target(uuid, text)
  from public, anon, authenticated;
grant execute on function public.corex_register_domain_target(uuid, text) to service_role;

revoke all on function public.corex_select_environment_domain(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.corex_select_environment_domain(uuid, uuid, uuid) to service_role;