create table public.corex_step_attempts (
	run_id uuid not null references public.corex_runs(id) on delete cascade,
	owner_user_id uuid not null references auth.users(id) on delete cascade,
	execution_generation integer not null check (execution_generation > 0),
	step_id text not null check (step_id <> ''),
	visit integer not null check (visit >= 0),
	durable_step_name text not null check (durable_step_name <> ''),
	attempt integer not null check (attempt > 0),
	started_at timestamptz not null,
	finished_at timestamptz not null check (finished_at >= started_at),
	outcome text not null check (outcome in ('complete', 'failed')),
	retry jsonb not null,
	output jsonb,
	error jsonb,
	created_at timestamptz not null default now(),
	primary key (run_id, execution_generation, step_id, visit, attempt),
	check ((outcome = 'complete' and output is not null and error is null)
		or (outcome = 'failed' and output is null and error is not null))
);

create index corex_step_attempts_owner_run_started_idx
	on public.corex_step_attempts (owner_user_id, run_id, started_at);

alter table public.corex_step_attempts enable row level security;

create policy "owners read Corex step attempts"
	on public.corex_step_attempts for select to authenticated
	using (owner_user_id = (select auth.uid()));

revoke all on public.corex_step_attempts from public, anon, authenticated;
grant select on public.corex_step_attempts to authenticated;
grant select, insert on public.corex_step_attempts to service_role;

create or replace function public.corex_record_step_attempt(
	p_run_id uuid,
	p_owner_user_id uuid,
	p_execution_generation integer,
	p_step_id text,
	p_visit integer,
	p_durable_step_name text,
	p_attempt integer,
	p_started_at timestamptz,
	p_finished_at timestamptz,
	p_outcome text,
	p_retry jsonb,
	p_output jsonb,
	p_error jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
	existing_attempt public.corex_step_attempts;
begin
	if not exists (
		select 1 from public.corex_runs
		where id = p_run_id
			and owner_user_id = p_owner_user_id
			and execution_generation = p_execution_generation
	) then
		raise exception 'Corex run is missing' using errcode = 'PT404';
	end if;

	insert into public.corex_step_attempts (
		run_id, owner_user_id, execution_generation, step_id, visit, durable_step_name,
		attempt, started_at, finished_at, outcome, retry, output, error
	) values (
		p_run_id, p_owner_user_id, p_execution_generation, p_step_id, p_visit,
		p_durable_step_name, p_attempt, p_started_at, p_finished_at, p_outcome,
		p_retry, p_output, p_error
	)
	on conflict (run_id, execution_generation, step_id, visit, attempt) do nothing;

	select * into existing_attempt
	from public.corex_step_attempts
	where run_id = p_run_id
		and execution_generation = p_execution_generation
		and step_id = p_step_id
		and visit = p_visit
		and attempt = p_attempt;

	if existing_attempt.owner_user_id <> p_owner_user_id
		or existing_attempt.durable_step_name <> p_durable_step_name
		or existing_attempt.started_at <> p_started_at
		or existing_attempt.finished_at <> p_finished_at
		or existing_attempt.outcome <> p_outcome
		or existing_attempt.retry <> p_retry
		or existing_attempt.output is distinct from p_output
		or existing_attempt.error is distinct from p_error then
		raise exception 'Conflicting Corex step attempt' using errcode = 'PT409';
	end if;

	return jsonb_build_object('accepted', true);
end;
$$;

revoke all on function public.corex_record_step_attempt(
	uuid, uuid, integer, text, integer, text, integer, timestamptz, timestamptz,
	text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.corex_record_step_attempt(
	uuid, uuid, integer, text, integer, text, integer, timestamptz, timestamptz,
	text, jsonb, jsonb, jsonb
) to service_role;
