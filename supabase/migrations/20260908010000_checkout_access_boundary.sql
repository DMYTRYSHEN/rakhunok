-- LOCAL CANDIDATE: intentionally removes legacy public checkout table access.
-- Requires authoritative checkout + trusted merchant backend before rollout.
begin;
drop policy if exists "Public can view merchant display profile" on public.merchants;
drop policy if exists "Public can view active entities for checkout" on public.business_entities;
drop policy if exists "Public can resolve terminals by code" on public.terminals;
drop policy if exists "Public can view active orders for checkout" on public.orders;
drop policy if exists "Public can view items of active orders" on public.order_items;
drop policy if exists "Public and merchant can view delivery" on public.order_deliveries;
-- Revoke all browser table access, including column grants. Authenticated merchant
-- access must go through a trusted command adapter, never client-supplied owner ID.
do $$ declare t text; c record; begin
  foreach t in array array['projects','merchants','business_entities','terminals','orders','order_items','order_deliveries'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    for c in select column_name from information_schema.columns where table_schema='public' and table_name=t loop
      execute format('revoke select (%I), insert (%I), update (%I), references (%I) on public.%I from public,anon,authenticated',c.column_name,c.column_name,c.column_name,c.column_name,t);
    end loop;
  end loop;
end $$;

create function public.checkout_replace_items(p_owner uuid,p_order uuid,p_revision bigint,p_items jsonb)
returns bigint language plpgsql security definer set search_path='' as $$
declare o public.orders; item jsonb; total numeric:=0; quantity integer; minor bigint; rev bigint;
begin
  perform checkout_private.gate();
  select * into o from public.orders where id=p_order for update;
  if o.id is null or not exists(select 1 from public.merchants where id=o.merchant_id and user_id=p_owner) then
    raise exception 'checkout_owner_required';
  end if;
  if p_revision is null or o.checkout_revision<>p_revision or o.status not in ('draft','preparing','pending','ready') then
    raise exception 'checkout_revision_conflict';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100
    or o.discount_amount<>0 or o.delivery_fee<>0 or o.is_split_payment then raise exception 'checkout_unsupported_items'; end if;
  delete from public.order_items where order_id=p_order;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) is distinct from 'object' or (select count(*) from jsonb_object_keys(item))<>3
      or not item ?& array['name','quantity','unitAmountMinor']
      or jsonb_typeof(item->'name') is distinct from 'string' or length(btrim(item->>'name')) not between 1 and 200
      or jsonb_typeof(item->'quantity') is distinct from 'number' or (item->>'quantity') !~ '^[1-9][0-9]{0,3}$'
      or jsonb_typeof(item->'unitAmountMinor') is distinct from 'number' or (item->>'unitAmountMinor') !~ '^[0-9]{1,10}$'
      then raise exception 'checkout_invalid_item'; end if;
    quantity:=(item->>'quantity')::integer; minor:=(item->>'unitAmountMinor')::bigint;
    total:=total+quantity*minor;
    if total>9999999999 then raise exception 'checkout_amount_overflow'; end if;
    insert into public.order_items(order_id,name,quantity,unit_price,total_price)
      values(p_order,btrim(item->>'name'),quantity,minor/100.0,quantity*minor/100.0);
  end loop;
  update public.orders set base_amount=total/100.0,total_amount=total/100.0 where id=p_order returning checkout_revision into rev;
  return rev;
end $$;
revoke all on function public.checkout_replace_items(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.checkout_replace_items(uuid,uuid,bigint,jsonb) to service_role;
commit;