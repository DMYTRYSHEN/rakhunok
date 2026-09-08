-- LOCAL REVIEW CANDIDATE. Never apply to the shared/production database implicitly.
-- Prerequisite: canonical merchants/entities/terminals/orders/items/deliveries schema.
begin;
create schema checkout_private;
revoke all on schema checkout_private from public, anon, authenticated;

-- A transaction-scoped serialization gate also covers legacy direct DML. Acquired
-- BEFORE STATEMENT (before row locks), not from an AFTER ROW trigger. Deliberately
-- coarse for this local reference adapter; benchmark before any deployment.
create function checkout_private.gate() returns void
language plpgsql security definer set search_path = '' as $$
begin
	-- Legacy callers may already hold a row lock. Never wait on the gate while
	-- holding that row: abort the WHOLE transaction and retry outside it.
	if not pg_catalog.pg_try_advisory_xact_lock(742901, 1) then
		raise exception using errcode='55P03', message='checkout_busy';
	end if;
end;
$$;
create function checkout_private.lock_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
	perform checkout_private.gate();
	if tg_op = 'TRUNCATE' then raise exception 'checkout_truncate_forbidden'; end if;
	return null;
end;
$$;

alter table public.orders add column checkout_revision bigint not null default 1
	check (checkout_revision between 1 and 9007199254740991);
alter table public.orders add column checkout_dependency_nonce uuid;

create table checkout_private.resources (
	kind text not null check (kind in ('invoice','terminal')),
	id uuid not null,
	revision bigint not null check (revision between 1 and 9007199254740991),
	current_order_id uuid,
	deleted boolean not null default false,
	primary key (kind,id)
);
-- No FK on history/outbox: deletion must leave a revisioned tombstone.
create table checkout_private.outbox (
	id uuid primary key default gen_random_uuid(),
	kind text not null,
	resource_id uuid not null,
	revision bigint not null,
	aliases text[] not null default '{}',
	deleted boolean not null default false,
	created_at timestamptz not null default clock_timestamp(),
	available_at timestamptz not null default clock_timestamp(),
	attempts integer not null default 0,
	claim_token uuid,
	lease_until timestamptz,
	delivered_at timestamptz,
	dead_at timestamptz,
	unique(kind,resource_id,revision)
);
create index checkout_outbox_pending on checkout_private.outbox(available_at,created_at)
	where delivered_at is null and dead_at is null;
create table checkout_private.capabilities (
	token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
	kind text not null,
	resource_id uuid not null,
	expires_at timestamptz not null,
	revoked_at timestamptz,
	foreign key(kind,resource_id) references checkout_private.resources(kind,id)
);
create table checkout_private.attempts (
	id uuid primary key default gen_random_uuid(),
	token_hash text not null references checkout_private.capabilities(token_hash),
	idempotency_key text not null check (length(idempotency_key) between 8 and 128),
	request jsonb not null,
	quote jsonb not null,
	created_at timestamptz not null default clock_timestamp(),
	unique(token_hash,idempotency_key)
);
-- Revocation and authorization are serialized with quote creation, not merely
-- observed through an unrelated MVCC snapshot.
create trigger checkout_capability_gate before insert or update or delete or truncate
on checkout_private.capabilities for each statement execute function checkout_private.lock_write();
create index checkout_capabilities_resource on checkout_private.capabilities(kind,resource_id);
create index checkout_orders_terminal on public.orders(terminal_id,created_at desc,id);
create index checkout_orders_entity on public.orders(entity_id);
create index checkout_orders_expiry on public.orders(expires_at)
	where status in ('pending','ready','preparing','draft');

create function checkout_private.emit(p_kind text,p_id uuid,p_revision bigint,p_aliases text[],p_deleted boolean)
returns void language sql security definer set search_path = '' as $$
	insert into checkout_private.outbox(kind,resource_id,revision,aliases,deleted)
	values(p_kind,p_id,p_revision,p_aliases,p_deleted);
$$;

create function checkout_private.order_revision() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
	if tg_op = 'INSERT' then
		if exists(select 1 from checkout_private.resources where kind='invoice' and id=new.id) then
			raise exception 'checkout_identity_reuse';
		end if;
		new.checkout_revision := 1;
	else
		if new.id <> old.id then raise exception 'checkout_identity_immutable'; end if;
		new.checkout_revision := old.checkout_revision;
		-- Stored generated values are unavailable in BEFORE triggers.
		if (to_jsonb(new)-array['checkout_revision','updated_at','share_url']) is distinct from
			 (to_jsonb(old)-array['checkout_revision','updated_at','share_url']) then
			new.checkout_revision := old.checkout_revision+1;
		end if;
	end if;
	-- Reject mismatched ownership instead of silently paying another entity.
	if new.entity_id is not null and not exists (
		select 1 from public.business_entities e join public.merchants m on m.id=new.merchant_id
		where e.id=new.entity_id and e.user_id=m.user_id
	) then raise exception 'checkout_entity_ownership'; end if;
	if new.terminal_id is not null and not exists (
		select 1 from public.terminals t join public.merchants m on m.id=new.merchant_id
		where t.id=new.terminal_id and t.user_id=m.user_id and t.entity_id=new.entity_id
	) then raise exception 'checkout_terminal_ownership'; end if;
	return new;
end;
$$;

create function checkout_private.refresh_terminal(p_id uuid,p_force boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.terminals; r checkout_private.resources; next_id uuid; rev bigint;
begin
	if p_id is null then return; end if;
	select * into t from public.terminals where id=p_id;
	if not found then return; end if;
	select * into r from checkout_private.resources where kind='terminal' and id=p_id;
	-- Persist one deterministic pointer. Paid/cancelled/expired orders no longer own it.
	if t.is_active then
		select o.id into next_id from public.orders o join public.merchants m on m.id=o.merchant_id
		where o.terminal_id=p_id and o.entity_id=t.entity_id and m.user_id=t.user_id
			and o.status in ('pending','preparing','ready','draft')
		order by o.created_at desc,o.id desc limit 1;
	end if;
	if r.id is null or p_force or r.current_order_id is distinct from next_id then
		rev := coalesce(r.revision,0)+1;
		insert into checkout_private.resources(kind,id,revision,current_order_id)
		values('terminal',p_id,rev,next_id)
		on conflict(kind,id) do update set revision=excluded.revision,current_order_id=excluded.current_order_id;
		perform checkout_private.emit('terminal',p_id,rev,array[t.code],false);
	end if;
end;
$$;

create function checkout_private.order_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o public.orders; rev bigint; old_terminal uuid; force_terminal boolean;
begin
	if tg_op='UPDATE' and new.checkout_revision=old.checkout_revision then return null; end if;
	if tg_op='DELETE' then o:=old; rev:=old.checkout_revision+1;
	else o:=new; rev:=new.checkout_revision; end if;
	insert into checkout_private.resources(kind,id,revision,deleted)
	values('invoice',o.id,rev,tg_op='DELETE')
	on conflict(kind,id) do update set revision=excluded.revision,deleted=excluded.deleted;
	perform checkout_private.emit('invoice',o.id,rev,
		array_remove(array[o.id::text,o.order_number,to_jsonb(o)->>'short_id',
			case when tg_op='UPDATE' then old.order_number end,
			case when tg_op='UPDATE' then to_jsonb(old)->>'short_id' end],null),tg_op='DELETE');
	if tg_op <> 'INSERT' then old_terminal:=old.terminal_id; end if;
	if old_terminal is distinct from o.terminal_id then
		perform checkout_private.refresh_terminal(old_terminal,true);
	end if;
	select current_order_id=o.id into force_terminal from checkout_private.resources
		where kind='terminal' and id=o.terminal_id;
	perform checkout_private.refresh_terminal(o.terminal_id,coalesce(force_terminal,false));
	return null;
end;
$$;

create function checkout_private.terminal_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rev bigint;
begin
	if tg_op='INSERT' and exists(select 1 from checkout_private.resources where kind='terminal' and id=new.id) then
		raise exception 'checkout_identity_reuse';
	end if;
	if tg_op='UPDATE' then
		if new.id<>old.id then raise exception 'checkout_identity_immutable'; end if;
		if (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return null; end if;
		-- Recipient/owner reassignment with attached orders requires an explicit migration.
		if (new.entity_id,new.user_id) is distinct from (old.entity_id,old.user_id)
			 and exists(select 1 from public.orders where terminal_id=old.id) then
			raise exception 'checkout_terminal_reassignment_requires_detach';
		end if;
	end if;
	if tg_op='DELETE' then
		update checkout_private.resources set revision=revision+1,deleted=true,current_order_id=null
		where kind='terminal' and id=old.id returning revision into rev;
		perform checkout_private.emit('terminal',old.id,rev,array[old.code],true);
	else
		perform checkout_private.refresh_terminal(new.id,true);
		if tg_op='UPDATE' and new.code<>old.code then
			update checkout_private.outbox set aliases=array_append(aliases,old.code)
			where kind='terminal' and resource_id=new.id and revision=(
				select revision from checkout_private.resources where kind='terminal' and id=new.id);
		end if;
	end if;
	return null;
end;
$$;

create function checkout_private.child_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
	if tg_op='UPDATE' and to_jsonb(new)=to_jsonb(old) then return null; end if;
	if tg_op <> 'INSERT' then
		update public.orders set checkout_dependency_nonce=gen_random_uuid() where id=old.order_id;
	end if;
	if tg_op='INSERT' or (tg_op='UPDATE' and new.order_id<>old.order_id) then
		update public.orders set checkout_dependency_nonce=gen_random_uuid() where id=new.order_id;
	end if;
	return null;
end;
$$;
create function checkout_private.recipient_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
	if (to_jsonb(new)-'updated_at')=(to_jsonb(old)-'updated_at') then return null; end if;
	if tg_table_name='merchants' then
		update public.orders set checkout_dependency_nonce=gen_random_uuid() where merchant_id=new.id;
	else
		update public.orders set checkout_dependency_nonce=gen_random_uuid() where entity_id=new.id;
	end if;
	return null;
end;
$$;

do $$ declare t text; begin
	foreach t in array array['orders','terminals','merchants','business_entities','order_items','order_deliveries'] loop
		execute format('create trigger checkout_gate before insert or update or delete or truncate on public.%I for each statement execute function checkout_private.lock_write()',t);
	end loop;
	foreach t in array array['order_items','order_deliveries'] loop
		execute format('create trigger checkout_child after insert or update or delete on public.%I for each row execute function checkout_private.child_changed()',t);
	end loop;
	foreach t in array array['merchants','business_entities'] loop
		execute format('create trigger checkout_recipient after update on public.%I for each row execute function checkout_private.recipient_changed()',t);
	end loop;
end $$;
create trigger checkout_revision before insert or update on public.orders
for each row execute function checkout_private.order_revision();
create trigger checkout_order after insert or update or delete on public.orders
for each row execute function checkout_private.order_changed();
create trigger checkout_terminal after insert or update or delete on public.terminals
for each row execute function checkout_private.terminal_changed();

-- Do not silently switch an entity invoice to the merchant account via SET NULL.
create function checkout_private.protect_recipient_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
	if exists(select 1 from public.orders where entity_id=old.id) then
		raise exception 'checkout_recipient_in_use';
	end if;
	return old;
end;
$$;
create trigger checkout_protect_recipient before delete on public.business_entities
for each row execute function checkout_private.protect_recipient_delete();

create function checkout_private.immutable_attempt() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
	raise exception 'checkout_attempt_immutable';
end;
$$;
create trigger checkout_attempt_immutable before update or delete or truncate on checkout_private.attempts
for each statement execute function checkout_private.immutable_attempt();

create function checkout_private.recipient(p_order public.orders) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; iban text;
begin
	if p_order.entity_id is not null then
		select jsonb_build_object('iban',e.iban,'name',btrim(e.business_name),'taxId',e.tax_id) into result
		from public.business_entities e join public.merchants m on m.id=p_order.merchant_id
		where e.id=p_order.entity_id and e.user_id=m.user_id and e.is_active and m.is_active;
	else
		select jsonb_build_object('iban',m.iban,'name',btrim(m.business_name),'taxId',m.tax_id) into result
		from public.merchants m where m.id=p_order.merchant_id and m.is_active;
	end if;
	iban:=result->>'iban';
	if result is null or coalesce(iban,'') !~ '^UA[0-9]{27}$'
		or coalesce(result->>'name','')='' or coalesce(result->>'taxId','') !~ '^([0-9]{8}|[0-9]{10})$' then
		return null;
	end if;
	-- UA -> 30 10; numeric avoids floating-point checksum arithmetic.
	if mod((substr(iban,5)||'3010'||substr(iban,3,2))::numeric,97)<>1 then return null; end if;
	return result;
end;
$$;

insert into checkout_private.resources(kind,id,revision) select 'invoice',id,checkout_revision from public.orders;
select checkout_private.emit('invoice',id,checkout_revision,array[id::text,order_number,to_jsonb(orders)->>'short_id'],false) from public.orders;
select checkout_private.refresh_terminal(id,true) from public.terminals;

create function checkout_private.expire_orders() returns void
language sql security definer set search_path = '' as $$
	update public.orders set status='expired'
	where status in ('pending','ready','preparing','draft') and expires_at<=clock_timestamp();
$$;
create function checkout_private.authorize(p_kind text,p_id uuid,p_hash text) returns boolean
language sql security definer set search_path = '' as $$
	select exists(select 1 from checkout_private.capabilities
		where token_hash=p_hash and kind=p_kind and resource_id=p_id
			and revoked_at is null and expires_at>clock_timestamp());
$$;

create function checkout_private.snapshot(p_kind text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r checkout_private.resources; o public.orders; state text; allowed boolean:=false;
begin
	select * into r from checkout_private.resources where kind=p_kind and id=p_id and not deleted;
	if not found then return null; end if;
	select * into o from public.orders where id=case when p_kind='invoice' then p_id else r.current_order_id end;
	if o.id is null then state:='idle';
	elsif o.status='paid' then state:='paid';
	elsif o.status='cancelled' then state:='cancelled';
	elsif o.status='expired' then state:='expired';
	elsif o.status in ('pending','ready') and o.total_amount>0 then state:='payable';
	elsif o.status in ('draft','preparing','pending','ready') then state:='preparing';
	else state:='failed'; end if;
	if o.id is not null and (o.currency<>'UAH' or o.total_amount<0 or o.total_amount*100>9007199254740991) then
		raise exception 'checkout_unsupported_money';
	end if;
	-- Use the same fail-closed beneficiary validation as initiation.
	allowed:=state='payable' and o.type in ('fixed','table','delivery') and not o.is_split_payment
		and checkout_private.recipient(o) is not null;
	return jsonb_build_object('documentType','snapshot','schemaVersion',1,
		'resource',jsonb_build_object('kind',p_kind,'id',p_id),'revision',r.revision,
		'source','authoritative','observedAt',clock_timestamp(),'state',state,
		'order',case when o.id is null then null else jsonb_build_object('id',o.id,'revision',o.checkout_revision,
			'amountMinor',(o.total_amount*100)::bigint,'currency',o.currency,'expiresAt',o.expires_at) end,
		'canInitiate',coalesce(allowed,false));
end;
$$;

create function public.checkout_read(p_kind text,p_id uuid,p_token_hash text,p_minimum_revision bigint default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s jsonb;
begin
	perform checkout_private.gate();
	if p_kind is null or p_kind not in ('invoice','terminal') or p_id is null
		or p_minimum_revision is null or p_minimum_revision not between 0 and 9007199254740991 then
		raise exception 'checkout_invalid_request';
	end if;
	if not checkout_private.authorize(p_kind,p_id,p_token_hash) then return jsonb_build_object('kind','inaccessible'); end if;
	perform checkout_private.expire_orders();
	s:=checkout_private.snapshot(p_kind,p_id);
	if s is null then return jsonb_build_object('kind','inaccessible'); end if;
	if (s->>'revision')::bigint<p_minimum_revision then return jsonb_build_object('kind','lag'); end if;
	return jsonb_build_object('kind','snapshot','value',s);
end;
$$;

create function public.checkout_initiate(p_kind text,p_id uuid,p_token_hash text,p_order_id uuid,
	p_order_revision bigint,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s jsonb; o public.orders; recipient jsonb; a checkout_private.attempts; req jsonb; deadline timestamptz;
begin
	perform checkout_private.gate();
	if p_kind is null or p_kind not in ('invoice','terminal') or p_id is null or p_order_id is null
		or p_order_revision is null or p_order_revision not between 1 and 9007199254740991
		or p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{8,128}$' then
		raise exception 'checkout_invalid_request';
	end if;
	if not checkout_private.authorize(p_kind,p_id,p_token_hash) then return jsonb_build_object('kind','inaccessible'); end if;
	req:=jsonb_build_object('kind',p_kind,'resourceId',p_id,'orderId',p_order_id,'orderRevision',p_order_revision);
	select * into a from checkout_private.attempts where token_hash=p_token_hash and idempotency_key=p_idempotency_key;
	if found then
		if a.request<>req then return jsonb_build_object('kind','conflict'); end if;
		-- Receipt replay is NOT permission for a new debit or regenerated bank handoff.
		return jsonb_build_object('kind','accepted','attemptId',a.id,'quote',a.quote,'replayed',true);
	end if;
	perform checkout_private.expire_orders();
	s:=checkout_private.snapshot(p_kind,p_id);
	if s is null then return jsonb_build_object('kind','inaccessible'); end if;
	if (s#>>'{order,id}')::uuid is distinct from p_order_id
		or (s#>>'{order,revision}')::bigint is distinct from p_order_revision then
		return jsonb_build_object('kind','conflict');
	end if;
	if not (s->>'canInitiate')::boolean then return jsonb_build_object('kind','not-payable'); end if;
	select * into o from public.orders where id=p_order_id for update;
	recipient:=checkout_private.recipient(o);
	if recipient is null then
		return jsonb_build_object('kind','invalid-recipient');
	end if;
	deadline:=least(coalesce(o.expires_at,clock_timestamp()+interval '5 minutes'),clock_timestamp()+interval '5 minutes');
	if deadline<=clock_timestamp() then
		perform checkout_private.expire_orders();
		return jsonb_build_object('kind','not-payable');
	end if;
	insert into checkout_private.attempts(token_hash,idempotency_key,request,quote)
	values(p_token_hash,p_idempotency_key,req,jsonb_build_object('orderId',o.id,'orderRevision',o.checkout_revision,
		'amountMinor',(o.total_amount*100)::bigint,'currency',o.currency,'recipient',recipient,
		'purpose',coalesce(nullif(o.description,''),o.title),'expiresAt',deadline)) returning * into a;
	return jsonb_build_object('kind','accepted','attemptId',a.id,'quote',a.quote,'replayed',false);
end;
$$;

create function public.checkout_claim_outbox(p_limit integer default 25) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
	if p_limit is null or p_limit not between 1 and 100 then raise exception 'checkout_invalid_limit'; end if;
	update checkout_private.outbox set dead_at=clock_timestamp()
		where attempts>=8 and delivered_at is null and dead_at is null
			and (lease_until is null or lease_until<=clock_timestamp());
	with candidates as (
		select id from checkout_private.outbox where delivered_at is null and dead_at is null and attempts<8
			and available_at<=clock_timestamp() and (lease_until is null or lease_until<=clock_timestamp())
		order by available_at,created_at limit p_limit for update skip locked
	), claimed as (
		update checkout_private.outbox o set attempts=o.attempts+1,claim_token=gen_random_uuid(),
			lease_until=clock_timestamp()+interval '60 seconds'
		from candidates c where o.id=c.id returning o.*
	) select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'resourceId',resource_id,
			'revision',revision,'aliases',aliases,'deleted',deleted,'claimToken',claim_token)), '[]'::jsonb)
		into result from claimed;
	return result;
end;
$$;
create function public.checkout_finish_outbox(p_id uuid,p_claim_token uuid,p_success boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
	if p_success is null or p_id is null or p_claim_token is null then
		raise exception 'checkout_invalid_ack';
	end if;
	update checkout_private.outbox set
		delivered_at=case when p_success then clock_timestamp() end,
		dead_at=case when not p_success and attempts>=8 then clock_timestamp() end,
		available_at=clock_timestamp()+make_interval(secs=>least(300,power(2,attempts)::integer)),
		lease_until=null,claim_token=null
	where id=p_id and claim_token=p_claim_token and lease_until>clock_timestamp() and delivered_at is null and dead_at is null;
	get diagnostics affected=row_count;
	return affected=1;
end;
$$;

-- Private storage and trigger helpers are never browser-accessible.
do $$ declare t text; begin
	foreach t in array array['resources','outbox','capabilities','attempts'] loop
		execute format('alter table checkout_private.%I enable row level security',t);
	end loop;
end $$;
revoke all on all tables in schema checkout_private from public,anon,authenticated;
revoke all on all functions in schema checkout_private from public,anon,authenticated;
revoke all on function public.checkout_read(text,uuid,text,bigint) from public,anon,authenticated;
revoke all on function public.checkout_initiate(text,uuid,text,uuid,bigint,text) from public,anon,authenticated;
revoke all on function public.checkout_claim_outbox(integer) from public,anon,authenticated;
revoke all on function public.checkout_finish_outbox(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.checkout_read(text,uuid,text,bigint) to service_role;
grant execute on function public.checkout_initiate(text,uuid,text,uuid,bigint,text) to service_role;
grant execute on function public.checkout_claim_outbox(integer) to service_role;
grant execute on function public.checkout_finish_outbox(uuid,uuid,boolean) to service_role;
commit;
