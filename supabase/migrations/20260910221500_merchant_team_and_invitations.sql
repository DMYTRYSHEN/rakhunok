-- Merchant Team Memberships and Invitations Schema with RLS
-- Roles: owner (full), manager (reports, analytics, orders), cashier (orders, terminal POS), kso (self-service checkout)

begin;

-- 1. Create Team Roles Enum
do $$ begin
	if not exists (select 1 from pg_type where typname = 'merchant_member_role') then
		create type public.merchant_member_role as enum ('owner', 'manager', 'cashier', 'kso');
	end if;
end $$;

-- 2. Create Merchant Memberships Table
create table if not exists public.merchant_memberships (
	id uuid primary key default gen_random_uuid(),
	merchant_id uuid not null references public.merchants(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete cascade,
	role public.merchant_member_role not null default 'cashier',
	terminal_id uuid references public.terminals(id) on delete set null,
	status text not null check (status in ('active', 'suspended')) default 'active',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique(merchant_id, user_id)
);

create index if not exists idx_merchant_memberships_merchant on public.merchant_memberships(merchant_id);
create index if not exists idx_merchant_memberships_user on public.merchant_memberships(user_id);
create index if not exists idx_merchant_memberships_terminal on public.merchant_memberships(terminal_id) where terminal_id is not null;

-- 3. Create Merchant Invitations Table
create table if not exists public.merchant_invitations (
	id uuid primary key default gen_random_uuid(),
	merchant_id uuid not null references public.merchants(id) on delete cascade,
	email text not null check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
	role public.merchant_member_role not null default 'cashier',
	terminal_id uuid references public.terminals(id) on delete set null,
	token text not null unique check (length(token) >= 32),
	status text not null check (status in ('pending', 'accepted', 'expired', 'revoked')) default 'pending',
	invited_by uuid not null references auth.users(id) on delete restrict,
	created_at timestamptz not null default now(),
	expires_at timestamptz not null default (now() + interval '7 days'),
	accepted_at timestamptz,
	accepted_by uuid references auth.users(id) on delete set null,
	unique(merchant_id, email, status)
);

create index if not exists idx_merchant_invitations_token on public.merchant_invitations(token) where status = 'pending';
create index if not exists idx_merchant_invitations_merchant on public.merchant_invitations(merchant_id, status);

-- 4. Enable RLS
alter table public.merchant_memberships enable row level security;
alter table public.merchant_invitations enable row level security;

-- Helper security function: Check user's role in merchant
create or replace function public.get_merchant_role(p_merchant_id uuid, p_user_id uuid)
returns public.merchant_member_role
language sql
stable
security invoker
set search_path = ''
as $$
	select case 
		when exists (select 1 from public.merchants where id = p_merchant_id and user_id = p_user_id) then 'owner'::public.merchant_member_role
		else (
			select role from public.merchant_memberships 
			where merchant_id = p_merchant_id and user_id = p_user_id and status = 'active'
			limit 1
		)
	end;
$$;

-- RLS Policies for Memberships
create policy "Owners and managers can view team members"
	on public.merchant_memberships for select to authenticated
	using (
		(select auth.uid()) = user_id
		or public.get_merchant_role(merchant_id, (select auth.uid())) in ('owner', 'manager')
	);

create policy "Owners can manage memberships"
	on public.merchant_memberships for all to authenticated
	using (
		public.get_merchant_role(merchant_id, (select auth.uid())) = 'owner'
	)
	with check (
		public.get_merchant_role(merchant_id, (select auth.uid())) = 'owner'
	);

-- RLS Policies for Invitations
create policy "Owners and managers can view invitations"
	on public.merchant_invitations for select to authenticated
	using (
		public.get_merchant_role(merchant_id, (select auth.uid())) in ('owner', 'manager')
	);

create policy "Owners can create and update invitations"
	on public.merchant_invitations for all to authenticated
	using (
		public.get_merchant_role(merchant_id, (select auth.uid())) = 'owner'
	)
	with check (
		public.get_merchant_role(merchant_id, (select auth.uid())) = 'owner'
	);

-- Function for securely accepting an invitation
create or replace function public.accept_merchant_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_invitation record;
	v_user_id uuid;
	v_existing_membership record;
begin
	v_user_id := auth.uid();
	if v_user_id is null then
		raise exception 'auth_required';
	end if;

	select * into v_invitation
	from public.merchant_invitations
	where token = p_token
	for update;

	if v_invitation.id is null then
		raise exception 'invitation_not_found';
	end if;

	if v_invitation.status <> 'pending' then
		raise exception 'invitation_already_processed';
	end if;

	if v_invitation.expires_at < now() then
		update public.merchant_invitations
		set status = 'expired'
		where id = v_invitation.id;
		raise exception 'invitation_expired';
	end if;

	-- Check if user is already a member
	select * into v_existing_membership
	from public.merchant_memberships
	where merchant_id = v_invitation.merchant_id and user_id = v_user_id;

	if v_existing_membership.id is not null then
		-- Update role if higher or terminal
		update public.merchant_memberships
		set role = v_invitation.role,
		    terminal_id = coalesce(v_invitation.terminal_id, terminal_id),
		    status = 'active',
		    updated_at = now()
		where id = v_existing_membership.id;
	else
		-- Insert new membership
		insert into public.merchant_memberships (
			merchant_id,
			user_id,
			role,
			terminal_id,
			status
		) values (
			v_invitation.merchant_id,
			v_user_id,
			v_invitation.role,
			v_invitation.terminal_id,
			'active'
		);
	end if;

	-- Mark invitation as accepted
	update public.merchant_invitations
	set status = 'accepted',
	    accepted_at = now(),
	    accepted_by = v_user_id
	where id = v_invitation.id;

	return jsonb_build_object(
		'success', true,
		'merchant_id', v_invitation.merchant_id,
		'role', v_invitation.role,
		'terminal_id', v_invitation.terminal_id
	);
end;
$$;

revoke all on function public.accept_merchant_invitation(text) from public, anon;
grant execute on function public.accept_merchant_invitation(text) to authenticated;

commit;
