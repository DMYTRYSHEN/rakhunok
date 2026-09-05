-- Require a valid Supabase Auth session for every banklink mutation.
drop policy if exists "allow manage banklink for anon" on public.banklink;
revoke insert, update, delete on public.banklink from anon;

grant select on public.banklink to anon;
grant select, insert, update, delete on public.banklink to authenticated;