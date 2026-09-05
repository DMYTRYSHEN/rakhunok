-- Remove privileges inherited from the historical grant-all statement.
revoke all privileges on public.banklink from anon;
grant select on public.banklink to anon;