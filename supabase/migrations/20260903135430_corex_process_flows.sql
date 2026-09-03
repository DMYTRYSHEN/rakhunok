create table if not exists public.corex_process_flows (
	id uuid primary key default gen_random_uuid(),
	owner_user_id uuid not null references auth.users(id) on delete cascade,
	slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
	name text not null check (char_length(name) between 1 and 120),
	description text not null default '' check (char_length(description) <= 2000),
	lifecycle public.corex_process_lifecycle not null default 'draft',
	revision bigint not null default 1 check (revision > 0),
	draft_definition jsonb not null check (jsonb_typeof(draft_definition) = 'object'),
	published_version integer check (published_version is null or published_version > 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (id, owner_user_id),
	unique (owner_user_id, slug)
);

create table if not exists public.corex_process_flow_versions (
	id uuid primary key default gen_random_uuid(),
	flow_id uuid not null,
	owner_user_id uuid not null references auth.users(id) on delete cascade,
	version integer not null check (version > 0),
	resolved_definition jsonb not null check (jsonb_typeof(resolved_definition) = 'object'),
	definition_sha256 text not null check (definition_sha256 ~ '^[a-f0-9]{64}$'),
	published_by uuid not null references auth.users(id),
	published_at timestamptz not null default now(),
	foreign key (flow_id, owner_user_id)
		references public.corex_process_flows(id, owner_user_id) on delete cascade,
	unique (id, flow_id, owner_user_id),
	unique (flow_id, version)
);

create index if not exists corex_process_flows_owner_updated_idx
	on public.corex_process_flows (owner_user_id, updated_at desc);
create index if not exists corex_process_flow_versions_flow_idx
	on public.corex_process_flow_versions (flow_id, version desc);
create index if not exists corex_process_flow_versions_owner_published_idx
	on public.corex_process_flow_versions (owner_user_id, published_at desc);

create table if not exists public.corex_process_flow_runs (
	id uuid primary key default gen_random_uuid(),
	flow_version_id uuid not null,
	flow_id uuid not null,
	owner_user_id uuid not null references auth.users(id) on delete cascade,
	request_id uuid not null,
	scenario_id text not null check (char_length(scenario_id) between 1 and 120),
	started_at timestamptz not null default now(),
	foreign key (flow_version_id, flow_id, owner_user_id)
		references public.corex_process_flow_versions(id, flow_id, owner_user_id) on delete restrict,
	unique (id, owner_user_id),
	unique (owner_user_id, request_id)
);

create table if not exists public.corex_process_flow_run_members (
	flow_run_id uuid not null,
	run_id uuid not null references public.corex_runs(id) on delete cascade,
	owner_user_id uuid not null references auth.users(id) on delete cascade,
	participant_id text not null check (char_length(participant_id) between 1 and 120),
	linked_at timestamptz not null default now(),
	primary key (flow_run_id, run_id),
	foreign key (flow_run_id, owner_user_id)
		references public.corex_process_flow_runs(id, owner_user_id) on delete cascade,
	unique (run_id),
	unique (flow_run_id, participant_id, run_id)
);

create index if not exists corex_process_flow_runs_owner_started_idx
	on public.corex_process_flow_runs (owner_user_id, started_at desc);
create index if not exists corex_process_flow_run_members_run_idx
	on public.corex_process_flow_run_members (run_id);

alter table public.corex_process_flows enable row level security;
alter table public.corex_process_flow_versions enable row level security;
alter table public.corex_process_flow_runs enable row level security;
alter table public.corex_process_flow_run_members enable row level security;

create policy "owners read Corex process flows"
	on public.corex_process_flows for select to authenticated
	using ((select auth.uid()) = owner_user_id);

create policy "owners create Corex process flows"
	on public.corex_process_flows for insert to authenticated
	with check ((select auth.uid()) = owner_user_id);

create policy "owners update Corex process flows"
	on public.corex_process_flows for update to authenticated
	using ((select auth.uid()) = owner_user_id)
	with check ((select auth.uid()) = owner_user_id);

create policy "owners read Corex process flow versions"
	on public.corex_process_flow_versions for select to authenticated
	using ((select auth.uid()) = owner_user_id);

create policy "owners read Corex process Flow runs"
	on public.corex_process_flow_runs for select to authenticated
	using ((select auth.uid()) = owner_user_id);

create policy "owners read Corex process Flow run members"
	on public.corex_process_flow_run_members for select to authenticated
	using ((select auth.uid()) = owner_user_id);

revoke all on table public.corex_process_flows from anon, authenticated;
revoke all on table public.corex_process_flow_versions from anon, authenticated;
revoke all on table public.corex_process_flow_runs from anon, authenticated;
revoke all on table public.corex_process_flow_run_members from anon, authenticated;

grant select on table public.corex_process_flows to authenticated;
grant insert (owner_user_id, slug, name, description, draft_definition)
	on table public.corex_process_flows to authenticated;
grant update (name, description, draft_definition)
	on table public.corex_process_flows to authenticated;
grant select on table public.corex_process_flow_versions to authenticated;
grant select on table public.corex_process_flow_runs to authenticated;
grant select on table public.corex_process_flow_run_members to authenticated;

create schema if not exists corex_private;
revoke all on schema corex_private from public, anon, authenticated;

create or replace function corex_private.prepare_process_flow_draft_update()
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

revoke all on function corex_private.prepare_process_flow_draft_update()
	from public, anon, authenticated;

create trigger corex_process_flows_prepare_draft_update
before update of name, description, draft_definition on public.corex_process_flows
for each row execute function corex_private.prepare_process_flow_draft_update();

create or replace function corex_private.prevent_process_flow_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
	raise exception using
		errcode = '55000',
		message = 'Corex process Flow versions are immutable';
end;
$$;

revoke all on function corex_private.prevent_process_flow_version_mutation()
	from public, anon, authenticated;

create trigger corex_process_flow_versions_immutable
before update or delete on public.corex_process_flow_versions
for each row execute function corex_private.prevent_process_flow_version_mutation();

create or replace function public.corex_publish_process_flow(
	p_flow_id uuid,
	p_owner_user_id uuid,
	p_expected_revision bigint
)
returns public.corex_process_flow_versions
language plpgsql
security invoker
set search_path = ''
as $$
declare
	target_flow public.corex_process_flows;
	target_process public.corex_processes;
	target_process_version public.corex_process_versions;
	participant jsonb;
	participant_process_id uuid;
	resolved_participants jsonb := '[]'::jsonb;
	resolved_definition jsonb;
	published_sha256 text;
	next_version integer;
	published public.corex_process_flow_versions;
begin
	select * into target_flow
	from public.corex_process_flows
	where id = p_flow_id
		and owner_user_id = p_owner_user_id
	for update;

	if target_flow.id is null or target_flow.revision <> p_expected_revision then
		raise exception 'Corex process Flow publish revision conflict' using errcode = '40001';
	end if;
	if target_flow.lifecycle = 'retired' then
		raise exception 'Retired Corex process Flow cannot publish' using errcode = '55000';
	end if;
	if jsonb_typeof(target_flow.draft_definition -> 'participants') <> 'array'
		or jsonb_typeof(target_flow.draft_definition -> 'scenarios') <> 'array' then
		raise exception 'Corex process Flow definition is invalid' using errcode = '22023';
	end if;

	for participant in
		select value from jsonb_array_elements(target_flow.draft_definition -> 'participants')
	loop
		if participant ->> 'kind' = 'process' then
			begin
				participant_process_id := (participant ->> 'processId')::uuid;
			exception
				when invalid_text_representation then
					raise exception 'Corex process Flow contains an invalid process reference'
						using errcode = '22023';
			end;

			select * into target_process
			from public.corex_processes
			where id = participant_process_id
				and owner_user_id = target_flow.owner_user_id
				and lifecycle = 'published'
				and published_version is not null
			for key share;

			if target_process.id is null then
				raise exception 'Corex process Flow references an unavailable process'
					using errcode = 'P0002';
			end if;

			select * into target_process_version
			from public.corex_process_versions
			where process_id = target_process.id
				and owner_user_id = target_flow.owner_user_id
				and version = target_process.published_version
			for key share;

			if target_process_version.id is null then
				raise exception 'Corex process Flow published process version is unavailable'
					using errcode = 'P0002';
			end if;

			participant := jsonb_set(
				jsonb_set(
					participant,
					'{processVersionId}',
					to_jsonb(target_process_version.id::text),
					true
				),
				'{processVersion}',
				to_jsonb(target_process_version.version),
				true
			);
		end if;

		resolved_participants := resolved_participants || jsonb_build_array(participant);
	end loop;

	resolved_definition := jsonb_set(
		target_flow.draft_definition,
		'{participants}',
		resolved_participants,
		false
	);
	published_sha256 := encode(
		extensions.digest(convert_to(resolved_definition::text, 'UTF8'), 'sha256'),
		'hex'
	);

	if target_flow.published_version is not null then
		select * into published
		from public.corex_process_flow_versions
		where flow_id = target_flow.id
			and version = target_flow.published_version
			and definition_sha256 = published_sha256;

		if published.id is not null then
			return published;
		end if;
	end if;

	select coalesce(max(version), 0) + 1 into next_version
	from public.corex_process_flow_versions
	where flow_id = target_flow.id;

	insert into public.corex_process_flow_versions (
		flow_id,
		owner_user_id,
		version,
		resolved_definition,
		definition_sha256,
		published_by
	) values (
		target_flow.id,
		target_flow.owner_user_id,
		next_version,
		resolved_definition,
		published_sha256,
		p_owner_user_id
	)
	returning * into published;

	update public.corex_process_flows
	set lifecycle = 'published',
		published_version = next_version,
		updated_at = now()
	where id = target_flow.id;

	return published;
end;
$$;

revoke all on function public.corex_publish_process_flow(uuid, uuid, bigint)
	from public, anon, authenticated;
grant execute on function public.corex_publish_process_flow(uuid, uuid, bigint) to service_role;

create or replace function public.corex_start_process_flow_run(
	p_flow_version_id uuid,
	p_owner_user_id uuid,
	p_request_id uuid,
	p_scenario_id text
)
returns public.corex_process_flow_runs
language plpgsql
security invoker
set search_path = ''
as $$
declare
	target_version public.corex_process_flow_versions;
	started public.corex_process_flow_runs;
begin
	select * into target_version
	from public.corex_process_flow_versions
	where id = p_flow_version_id
		and owner_user_id = p_owner_user_id;

	if target_version.id is null then
		raise exception 'Corex process Flow version not found' using errcode = 'P0002';
	end if;
	if not exists (
		select 1
		from jsonb_array_elements(target_version.resolved_definition -> 'scenarios') scenario
		where scenario ->> 'id' = p_scenario_id
	) then
		raise exception 'Corex process Flow scenario not found' using errcode = 'P0002';
	end if;

	insert into public.corex_process_flow_runs (
		flow_version_id,
		flow_id,
		owner_user_id,
		request_id,
		scenario_id
	) values (
		target_version.id,
		target_version.flow_id,
		target_version.owner_user_id,
		p_request_id,
		p_scenario_id
	)
	on conflict (owner_user_id, request_id) do nothing;

	select * into started
	from public.corex_process_flow_runs
	where owner_user_id = p_owner_user_id
		and request_id = p_request_id;

	if started.flow_version_id <> p_flow_version_id or started.scenario_id <> p_scenario_id then
		raise exception 'Corex process Flow run request conflicts' using errcode = '23505';
	end if;

	return started;
end;
$$;

revoke all on function public.corex_start_process_flow_run(uuid, uuid, uuid, text)
	from public, anon, authenticated;
grant execute on function public.corex_start_process_flow_run(uuid, uuid, uuid, text)
	to service_role;

create or replace function public.corex_link_process_flow_run(
	p_flow_run_id uuid,
	p_run_id uuid,
	p_owner_user_id uuid,
	p_participant_id text
)
returns public.corex_process_flow_run_members
language plpgsql
security invoker
set search_path = ''
as $$
declare
	target_flow_run public.corex_process_flow_runs;
	target_flow_version public.corex_process_flow_versions;
	target_run public.corex_runs;
	participant jsonb;
	participant_process_id uuid;
	participant_process_version_id uuid;
	linked public.corex_process_flow_run_members;
begin
	select * into target_flow_run
	from public.corex_process_flow_runs
	where id = p_flow_run_id
		and owner_user_id = p_owner_user_id
	for update;

	if target_flow_run.id is null then
		raise exception 'Corex process Flow run not found' using errcode = 'P0002';
	end if;

	select * into target_flow_version
	from public.corex_process_flow_versions
	where id = target_flow_run.flow_version_id
		and owner_user_id = target_flow_run.owner_user_id;

	select value into participant
	from jsonb_array_elements(target_flow_version.resolved_definition -> 'participants')
	where value ->> 'id' = p_participant_id
		and value ->> 'kind' = 'process';

	if participant is null then
		raise exception 'Corex process Flow participant not found' using errcode = 'P0002';
	end if;

	participant_process_id := (participant ->> 'processId')::uuid;
	participant_process_version_id := (participant ->> 'processVersionId')::uuid;

	select * into target_run
	from public.corex_runs
	where id = p_run_id
		and owner_user_id = target_flow_run.owner_user_id
	for key share;

	if target_run.id is null
		or target_run.process_id <> participant_process_id
		or target_run.process_version_id <> participant_process_version_id then
		raise exception 'Corex process run does not match the Flow participant'
			using errcode = '23503';
	end if;

	insert into public.corex_process_flow_run_members (
		flow_run_id,
		run_id,
		owner_user_id,
		participant_id
	) values (
		target_flow_run.id,
		target_run.id,
		target_flow_run.owner_user_id,
		p_participant_id
	)
	on conflict (flow_run_id, run_id) do nothing
	returning * into linked;

	if linked.flow_run_id is null then
		select * into linked
		from public.corex_process_flow_run_members
		where flow_run_id = target_flow_run.id
			and run_id = target_run.id;

		if linked.participant_id <> p_participant_id then
			raise exception 'Corex process Flow run membership conflicts' using errcode = '23505';
		end if;
	end if;

	return linked;
end;
$$;

revoke all on function public.corex_link_process_flow_run(uuid, uuid, uuid, text)
	from public, anon, authenticated;
grant execute on function public.corex_link_process_flow_run(uuid, uuid, uuid, text)
	to service_role;
