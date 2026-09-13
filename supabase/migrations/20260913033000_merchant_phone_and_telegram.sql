alter table public.merchants
	add column if not exists phone text,
	add column if not exists phone_verified boolean default false,
	add column if not exists telegram_id bigint,
	add column if not exists telegram_username text;

comment on column public.merchants.phone is 'Verified contact phone number (E.164)';
comment on column public.merchants.phone_verified is 'Whether the phone has been verified via Telegram/SMS';
comment on column public.merchants.telegram_id is 'Telegram Chat/User ID for merchant notifications';
comment on column public.merchants.telegram_username is 'Telegram username without @ symbol';
