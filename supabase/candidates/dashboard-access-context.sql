-- LOCAL ONLY / UNAPPLIED candidate for narrowly approved DASH-AUTH-001.
-- Not a migration or runtime integration. No existing table, policy, grant,
-- onboarding flow, helper, or enum is changed. CREATE (not OR REPLACE) is deliberate.
-- Schema sources: core/db/schema.sql and
-- supabase/migrations/20260910221500_merchant_team_and_invitations.sql.
-- merchants.business_name supplies merchant_name; terminals have user_id, NOT
-- merchant_id. Their tenant boundary is terminals.user_id = merchants.user_id.
--
-- Future installation MUST use a privileged trusted migration owner with SELECT
-- on these tables and BYPASSRLS (or superuser), including under FORCE ROW LEVEL
-- SECURITY. Keep function ownership privileged and unavailable to client roles.
-- SECURITY DEFINER bypasses baseline RLS deliberately: the existing membership
-- policies call the SECURITY INVOKER get_merchant_role(), which reads memberships
-- again. This function NEVER calls that helper/policy chain. row_security=off is
-- a fail-closed guard if the definer loses bypass; it does NOT itself bypass RLS.
-- Changing definer role attributes can leave warmed backend plans stale; recycle
-- sessions/replan when changing that trust assumption. Tests force a fresh plan
-- for this failure case, not a claim of immediate pooled-role revocation.
-- auth.uid() must be the trusted, gateway-verified JWT actor (not client SQL/GUC).
-- No actor/owner/merchant parameters and no dynamic SQL or fallback on SQL errors.
--
-- Contexts are discovery, NOT permission to execute financial/admin operations.
-- actor_user_id is the caller; owner_user_id is canonical merchants.user_id.
-- They coincide for ownership and differ for membership (never impersonate owner).
-- Owned merchants suppress ALL memberships, even when onboarding is incomplete
-- or merchant is_active is false: no new owner login/onboarding eligibility gate.
-- Return every context ordered by merchant UUID / membership UUID, never LIMIT 1
-- and never implicitly select one. Zero rows is valid discovery, not a command
-- to change the existing onboarding or ready-shell behavior.
--
-- terminal_ids is always an explicit, sorted, non-null UUID array of currently
-- active owner-bound terminals. Empty means NO terminal access, never wildcard.
-- Owner and unassigned manager/viewer enumerate that owner's active terminals.
-- Cashier requires one non-null valid active assignment. Assigned manager/viewer
-- retain exactly that validated terminal; invalid assignments EXCLUDE context.
-- Future consumers must retain this scope for nonterminal operations too and must
-- NOT infer merchant-wide command permission from role alone. Assignment deletion
-- uses existing ON DELETE SET NULL: cashier then loses context; manager/viewer
-- become indistinguishable from intentionally unassigned roles in this schema.
-- Historical assignment/revocation semantics require a separately approved model.
-- Only status='active' and role::text IN ('manager','cashier','viewer') qualify;
-- viewer is future compatible without altering the current enum. Membership
-- 'owner', 'kso', unknown/null roles and nonactive/null statuses grant nothing.
--
-- STABLE uses the calling statement's MVCC snapshot; later statements at READ
-- COMMITTED see committed suspensions/deletions/role revocation/transfers afresh.
-- No cache, writes, row locks, or exception swallowing. Not commit-time revocation,
-- not cross-request authorization, and not a concurrency/production certification.
BEGIN;

CREATE FUNCTION public.dashboard_access_contexts()
RETURNS TABLE (
  actor_user_id uuid,
  owner_user_id uuid,
  merchant_id uuid,
  merchant_name text,
  access_source text,
  role text,
  membership_id uuid,
  terminal_ids uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH owned AS MATERIALIZED (
    SELECT m.id, m.user_id, m.business_name
    FROM public.merchants AS m
    WHERE m.user_id = v_actor
  ), contexts AS (
    SELECT v_actor AS actor_user_id, o.user_id AS owner_user_id,
      o.id AS merchant_id, o.business_name::text AS merchant_name,
      'ownership'::text AS access_source, 'owner'::text AS role,
      NULL::uuid AS membership_id,
      ARRAY(
        SELECT t.id FROM public.terminals AS t
        WHERE t.user_id = o.user_id AND t.is_active IS TRUE ORDER BY t.id
      ) AS terminal_ids
    FROM owned AS o
    UNION ALL
    SELECT v_actor, m.user_id, m.id, m.business_name::text,
      'membership'::text, mm.role::text, mm.id,
      ARRAY(
        SELECT t.id FROM public.terminals AS t
        WHERE t.user_id = m.user_id AND t.is_active IS TRUE
          AND (mm.terminal_id IS NULL OR t.id = mm.terminal_id)
        ORDER BY t.id
      )
    FROM public.merchant_memberships AS mm
    JOIN public.merchants AS m ON m.id = mm.merchant_id
    WHERE NOT EXISTS (SELECT 1 FROM owned)
      AND mm.user_id = v_actor
      AND m.user_id IS NOT NULL
      AND mm.status = 'active'
      AND mm.role::text IN ('manager', 'cashier', 'viewer')
      AND (
        (mm.terminal_id IS NULL AND mm.role::text IN ('manager', 'viewer'))
        OR (
          mm.terminal_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.terminals AS t
            WHERE t.id = mm.terminal_id AND t.user_id = m.user_id
              AND t.is_active IS TRUE
          )
        )
      )
  )
  SELECT c.actor_user_id, c.owner_user_id, c.merchant_id, c.merchant_name,
    c.access_source, c.role, c.membership_id, c.terminal_ids
  FROM contexts AS c
  ORDER BY c.merchant_id, c.membership_id NULLS FIRST;
END;
$$;

REVOKE ALL ON FUNCTION public.dashboard_access_contexts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_access_contexts() TO authenticated;

COMMIT;