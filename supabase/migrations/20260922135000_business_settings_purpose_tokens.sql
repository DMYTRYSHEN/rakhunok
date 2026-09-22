begin;

set local lock_timeout = '2s';
set local statement_timeout = '30s';

create or replace function business_settings_private.valid_seller(v jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  k text;
  prefix_alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя_-';
begin
  if jsonb_typeof(v) is distinct from 'object' then return false; end if;
  if not (v ?& array['vatStatus','prefix','nextNumber','padding','purposeTemplate',
      'providerSellerId','providerCode','contractReference','qrCategory','qrFunction','allowAmountEdit'])
    or (select count(*) from jsonb_object_keys(v)) <> 11 then return false; end if;
  foreach k in array array['vatStatus','prefix','providerSellerId','providerCode',
      'contractReference','qrCategory','qrFunction'] loop
    if not business_settings_private.valid_text(v -> k, 200) then return false; end if;
  end loop;
  if v ->> 'vatStatus' not in ('unknown','vat','no-vat')
    or v ->> 'qrFunction' not in ('UCT','ICT','XCT')
    or jsonb_typeof(v -> 'allowAmountEdit') <> 'boolean'
    or not business_settings_private.valid_text(v -> 'prefix', 20)
    or translate(v ->> 'prefix', prefix_alphabet, '') <> ''
    or v ->> 'qrCategory' !~ '^[A-Z0-9]{4}/[A-Z0-9]{4}$'
    or not business_settings_private.valid_template(v -> 'purposeTemplate', 420,
      'number|date|scenario|amount|customer|contract|tax')
    then return false; end if;
  foreach k in array array['nextNumber','padding'] loop
    if jsonb_typeof(v -> k) <> 'number' then return false; end if;
    if (v ->> k)::numeric <> trunc((v ->> k)::numeric)
      or (v ->> k)::numeric < 1
      or (v ->> k)::numeric > (case k when 'padding' then 12 else 999999999999 end)
      then return false; end if;
  end loop;
  return true;
end
$$;

revoke all on function business_settings_private.valid_seller(jsonb) from public, anon, authenticated;

commit;