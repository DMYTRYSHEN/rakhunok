create or replace function public.corex_configure_domain_target(
  p_owner_user_id uuid,
  p_environment_key text,
  p_route_namespace text,
  p_hostname text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_environment public.corex_environments;
  target_namespace public.corex_route_namespaces;
  target_domain public.corex_domain_targets;
  domain_selection public.corex_environment_domain_targets;
begin
  target_environment := public.corex_ensure_environment(
    p_owner_user_id,
    p_environment_key
  );
  target_namespace := public.corex_ensure_route_namespace(
    target_environment.id,
    p_owner_user_id,
    p_route_namespace
  );
  target_domain := public.corex_register_domain_target(
    p_owner_user_id,
    p_hostname
  );
  domain_selection := public.corex_select_environment_domain(
    target_environment.id,
    target_domain.id,
    p_owner_user_id
  );

  return jsonb_build_object(
    'environmentId', target_environment.id,
    'environmentKey', target_environment.environment_key,
    'routeNamespace', target_namespace.route_namespace,
    'domainTargetId', domain_selection.domain_target_id,
    'hostname', target_domain.hostname,
    'verificationStatus', target_domain.verification_status
  );
end;
$$;

revoke all on function public.corex_configure_domain_target(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.corex_configure_domain_target(uuid, text, text, text)
  to service_role;