alter table public.corex_step_attempts
	add column kind text not null default 'forward'
	check (kind in ('forward', 'compensation'));

drop function public.corex_record_step_attempt(
	uuid, uuid, integer, text, integer, text, integer, timestamptz, timestamptz,
	text, jsonb, jsonb, jsonb
);

create function public.corex_record_step_attempt(
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
	p_error jsonb,
	p_kind text default 'forward'
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
		attempt, started_at, finished_at, outcome, retry, output, error, kind
	) values (
		p_run_id, p_owner_user_id, p_execution_generation, p_step_id, p_visit,
		p_durable_step_name, p_attempt, p_started_at, p_finished_at, p_outcome,
		p_retry, p_output, p_error, p_kind
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
		or existing_attempt.error is distinct from p_error
		or existing_attempt.kind <> p_kind then
		raise exception 'Conflicting Corex step attempt' using errcode = 'PT409';
	end if;

	return jsonb_build_object('accepted', true);
end;
$$;

revoke all on function public.corex_record_step_attempt(
	uuid, uuid, integer, text, integer, text, integer, timestamptz, timestamptz,
	text, jsonb, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.corex_record_step_attempt(
	uuid, uuid, integer, text, integer, text, integer, timestamptz, timestamptz,
	text, jsonb, jsonb, jsonb, text
) to service_role;
