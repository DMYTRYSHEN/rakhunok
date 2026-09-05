-- Migration: 20260905140000_banklink.sql
-- Create banklink table for NBU 002/003 bank routing, deep links, and test status

create table if not exists public.banklink (
    id text primary key,
    code varchar(10) not null,
    name text not null,
    nbu_version varchar(10) not null default '003',
    encoding varchar(5) not null default '1',
    nbu_function varchar(10) not null default 'ICT',
    domain_prefix text not null default 'https://qr.bank.gov.ua/',
    android_package text,
    android_intent text,
    ios_scheme text,
    universal_link text,
    universal_link2 text,
    url_template text,
    alternative_url text,
    extra_links text,
    routing_mode text not null default 'universal_link',
    logo text,
    color text not null default '#555555',
    active boolean not null default true,
    checked boolean not null default false,
    verified boolean not null default true,
    mode text not null default 'deeplink',
    last_test_result text,
    last_test_at timestamptz,
    appstore_url text,
    playstore_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.banklink enable row level security;

-- Drop any existing policies to avoid duplicates on re-run
drop policy if exists "allow read banklink for all" on public.banklink;
drop policy if exists "allow manage banklink for authenticated" on public.banklink;
drop policy if exists "allow manage banklink for anon" on public.banklink;

-- Policies
create policy "allow read banklink for all"
    on public.banklink for select
    to anon, authenticated
    using (true);

create policy "allow manage banklink for authenticated"
    on public.banklink for all
    to authenticated
    using (true)
    with check (true);

create policy "allow manage banklink for anon"
    on public.banklink for all
    to anon
    using (true)
    with check (true);

grant select, insert, update, delete on public.banklink to anon;
grant select, insert, update, delete on public.banklink to authenticated;
grant all on public.banklink to service_role;

-- Seed banks data
insert into public.banklink (
    id, code, name, nbu_version, encoding, nbu_function, domain_prefix,
    android_package, ios_scheme, universal_link, universal_link2, url_template,
    alternative_url, extra_links, routing_mode, logo, color, active, checked,
    verified, mode, playstore_url
) values
('mono', 'MONO', 'Monobank (Universal Bank)', '003', '2', 'ICT', 'https://bank.gov.ua/qr/', 'com.ftband.mono', 'mono', 'https://mbnk.app/qr/', null, 'https://mbnk.app/qr/{payload}', 'mono://bank.gov.ua/qr/{payload}', null, 'universal_link', null, '#000000', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=com.ftband.mono'),
('izibank', 'TASB', 'izibank (Tascombank)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.izibank.app', 'izibank', 'izibank://bank.gov.ua/qr/', null, null, null, null, 'scheme', null, '#FF6B00', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.izibank.app'),
('pb', 'PBAN', 'Приват24 (PrivatBank)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.privatbank.ap24', 'privat24', 'privat24://bank.gov.ua/qr/', null, null, null, null, 'scheme', null, '#78BE20', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.privatbank.ap24'),
('sensebank', 'SENS', 'Sense Bank', '002', '1', 'UCT', 'https://qr.bank.gov.ua/', 'ua.alfabank.mobile.android', 'alfabank', 'https://app.sensebank.ua/gkR4?code=', null, 'https://app.sensebank.ua/gkR4?code={payload}', null, null, 'universal_link', null, '#E31E24', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.alfabank.mobile.android'),
('abank24', 'ABUA', 'А-Банк (ABank)', '003', '1', 'ICT', 'http://bank.gov.ua/qr/', 'ua.com.abank', 'abank24', 'https://abank24.page.link/qr/', null, 'https://abank24.page.link/qr/{payload}', null, null, 'universal_link', null, '#FF0000', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.com.abank'),
('pumb', 'FUIB', 'ПУМБ (FUIB)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'com.fuib.android.spot.online', 'pumb', 'https://mobile-app.pumb.ua/https://bank.gov.ua/qr/', null, null, null, null, 'universal_link', null, '#EE3124', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=com.fuib.android.spot.online'),
('myraif', 'AVAL', 'Райффайзен Банк (MyRaif)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.raiffeisen.myraif', 'myraif', 'https://my-raif.apps.raiffeisen.ua/qr?payload=', null, 'https://my-raif.apps.raiffeisen.ua/qr?payload={payload}', null, null, 'universal_link', null, '#FFE600', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.raiffeisen.myraif'),
('ukrgasbank', 'UGAS', 'Укргазбанк', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'com.ugb.app', 'ugb', 'ecobank://bank.gov.ua/qr/', null, null, null, null, 'scheme', null, '#00A651', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=com.ugb.app'),
('otpbank', 'OTPV', 'ОТП Банк (OTP Bank)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.otpbank.android', 'otpbank', 'https://pay.otpbank.ua/qr/', null, 'https://pay.otpbank.ua/qr/{payload}', null, null, 'universal_link', null, '#52AE30', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.otpbank.android'),
('ukrsib-online', 'KHAB', 'UKRSIB online / business', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'com.ukrsibbank.uso.android', 'ukrsib-online', 'https://online.ukrsibbank.com/ibank/new-app/qr/', null, null, null, null, 'universal_link', null, '#003DA5', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=com.ukrsibbank.uso.android'),
('creditagricole', 'AGBU', 'Креді Аґріколь (Credit Agricole)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.creditagricole.mobile.app', 'creditagricole', 'https://caplusapp.credit-agricole.ua/fr/pay/', null, null, null, null, 'universal_link', null, '#006A4E', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.creditagricole.mobile.app'),
('creditdnepr', 'CRDE', 'Банк Кредит Дніпро', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'com.creditdnepr.mb', 'creditdnepr', 'https://creditdnepr.com.ua/qr_code/?', null, null, null, null, 'universal_link', null, '#0066CC', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=com.creditdnepr.mb'),
('pivdenny', 'PIVD', 'Банк Південний', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.pivdenny.mybank', 'pivdenny-online', 'https://link.bank.com.ua/qr/', null, null, null, null, 'universal_link', null, '#00539F', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.pivdenny.mybank'),
('vostok', 'VSTB', 'VST bank (Банк Восток)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'com.vostok.bv', 'vostok', 'https://bankvostok.page.link/qr/', null, null, null, null, 'universal_link', null, '#ED1C24', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=com.vostok.bv'),
('globus', 'GLBU', 'Глобус Банк', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'com.t18.bone.personal.globus', 'globus', 'https://gpls.app/qr/', null, null, null, null, 'universal_link', null, '#2E8B57', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=com.t18.bone.personal.globus'),
('rada', 'RDBK', 'РАДАБАНК', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'com.radabank.rb24', 'rb24', 'https://radabank.com.ua/qr_code/', null, null, null, null, 'universal_link', null, '#003366', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=com.radabank.rb24'),
('mtb', 'MTBA', 'МТБ Банк', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'com.ua.mtb.bank', 'mtb360', 'https://web.mtbutils.softesis.com/transfer-to-iban-summ?transferType=QR_UPC&navigationStackModifier=REMOVE_ALL_EXCEPT_CURRENT&code=', null, null, null, null, 'universal_link', null, '#0072CE', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=com.ua.mtb.bank'),
('pravex', 'PRAV', 'ПРАВЕКС БАНК (Pravex)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.com.pravex.online', 'pravex-online', 'https://online.pravex.ua/mobileapp/qr/', null, null, null, null, 'universal_link', null, '#FFD700', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.com.pravex.online'),
('winbank', 'PIRB', 'Winbank Ukraine (Піреус)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.piraeusbank.mobile.app.pbu', 'winbank-ukraine', 'https://winbank.ua/qr/winbank', null, null, null, null, 'universal_link', null, '#F7941D', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.piraeusbank.mobile.app.pbu'),
('grant', 'GRNT', 'Банк Грант', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.grant.smart', 'smart-grant', 'smart://bank.gov.ua/qr/', null, null, null, null, 'scheme', null, '#DC143C', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.grant.smart'),
('altbank', 'ALTB', 'Altbank Private', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'by.st.alt.fiz', 'altbank-private', 'https://alb.ua/qr/', null, null, null, null, 'universal_link', null, '#4B0082', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=by.st.alt.fiz'),
('NovaPay', 'NOVA', 'NovaPay', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.novapay.novapaymobile', 'novapay-mobile', 'novapay-mobile://bank.gov.ua/qr/', null, null, null, null, 'scheme', null, '#ED1C24', true, false, true, 'deeplink', 'https://play.google.com/store/apps/details?id=ua.novapay.novapaymobile'),
('accordbank', 'ACBR', 'Акордбанк (Accordbank)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'online.kapowai.accordbank', 'accordbank', null, null, null, null, null, 'redirect', null, '#333333', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=online.kapowai.accordbank'),
('idea', 'IDEU', 'OBank (Ідея Банк)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.ideabank.obank', 'obank', null, null, null, null, null, 'redirect', null, '#FF6600', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.ideabank.obank'),
('kredo', 'WUCU', 'KredoBank (Кредобанк)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.android.kredobank.prod', 'kredobank', null, null, null, null, null, 'redirect', null, '#005CA9', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.android.kredobank.prod'),
('unex', 'UNEX', 'Юнекс Банк (Unex Bank)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'online.kapowai.unexbank', 'unex-bank', null, null, null, null, null, 'redirect', null, '#0054A6', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=online.kapowai.unexbank'),
('alliance', 'ALLI', 'Alliance Bank (Альянс)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.alliancebank.mobile', 'alliancebank', null, null, null, null, null, 'redirect', null, '#1A73E8', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.alliancebank.mobile'),
('oschad', 'SABR', 'Ощадбанк', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.oschadbank.flumo', 'oschad', null, null, null, null, null, 'redirect', null, '#009639', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.oschadbank.flumo'),
('industrialbank', 'IBBK', 'Індустріалбанк', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.industrialbank.mobile', 'industrialbank', null, null, null, null, null, 'redirect', null, '#B71C1C', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.industrialbank.mobile'),
('mib', 'IIBU', 'МІБ (Міжнар. Інвест. Банк)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.mib.mobile', 'mib-mobile', null, null, null, null, null, 'redirect', null, '#2196F3', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.mib.mobile'),
('bisbank', 'BINV', 'BIS24 (БІЗБАНК)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.bisbank.bis24', 'bis24', null, null, null, null, null, 'redirect', null, '#4CAF50', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.bisbank.bis24'),
('capibank', 'UCAP', 'CAPIbank (Укр. Капітал)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.capibank.mobile', 'capibank', null, null, null, null, null, 'redirect', null, '#673AB7', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.capibank.mobile'),
('cominbank', 'CMIG', 'ComInBank (Комінбанк)', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'ua.cominbank.mobile', 'cominbank', null, null, null, null, null, 'redirect', null, '#FF5722', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.cominbank.mobile'),
('bank34', 'B34U', 'Банк 3/4', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'online.kapowai.bank34online', 'smart-bank-3-4', null, null, null, null, null, 'redirect', null, '#607D8B', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=online.kapowai.bank34online'),
('bvr', 'BVRU', 'Банк Власний Рахунок', '003', '1', 'ICT', 'https://qr.bank.gov.ua/', 'com.bank.vr', 'bvr', null, null, null, null, null, 'redirect', null, '#795548', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=com.bank.vr'),
('crystal', 'CRYS', 'CrystalBank', '003', '1', 'ICT', 'https://newbank.com/qr/', 'ua.android.ibank.crystal', 'crystalbank', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.android.ibank.crystal'),
('kdba', 'KDBA', 'БАНК КД (Кліринговий Дім)', '003', '1', 'ICT', 'https://newbank.com/qr/', 'ua.com.clhs.bankkd', 'bankkd', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.com.clhs.bankkd'),
('task', 'TASK', 'ТАСКОМБАНК TAS2U', '003', '1', 'ICT', 'https://newbank.com/qr/', 'ua.tas2u', 'tas2u', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.tas2u'),
('exim', 'EXIM', 'Укрексімбанк Enter EXIM', '003', '1', 'ICT', 'https://newbank.com/qr/', 'com.eximb.enterexim', 'enterexim', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=com.eximb.enterexim'),
('apsb', 'APSB', 'Агропросперіс Банк', '003', '1', 'ICT', 'https://newbank.com/qr/', 'ua.apbank.mobile', 'apbank', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.apbank.mobile'),
('pltv', 'PLTV', 'Полтава-Банк онлайн', '003', '1', 'ICT', 'https://newbank.com/qr/', 'com.poltavabank.mobile', 'poltavabank', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=com.poltavabank.mobile'),
('lviv', 'LVIV', 'Bank Lviv Online', '003', '1', 'ICT', 'https://newbank.com/qr/', 'com.banklviv.online', 'banklviv', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=com.banklviv.online'),
('skyb', 'SKYB', 'SkyBank', '003', '1', 'ICT', 'https://newbank.com/qr/', 'ua.skybank.mobile', 'skybank', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.skybank.mobile'),
('pcbu', 'PCBU', 'ПроКредит Банк', '003', '1', 'ICT', 'https://newbank.com/qr/', 'ua.procreditbank.mobile', 'procreditbank', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.procreditbank.mobile'),
('pinb', 'PINB', 'PINBANK', '003', '1', 'ICT', 'https://newbank.com/qr/', 'ua.pinbank.online', 'pinbank', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.pinbank.online'),
('asvi', 'ASVI', 'amobank (ASVIO BANK)', '003', '1', 'ICT', 'https://newbank.com/qr/', 'ua.asviobank.amobank', 'amobank', null, null, null, null, null, 'redirect', null, '#555555', true, false, true, 'redirect', 'https://play.google.com/store/apps/details?id=ua.asviobank.amobank')
on conflict (id) do update set
    code = excluded.code,
    name = excluded.name,
    nbu_version = excluded.nbu_version,
    encoding = excluded.encoding,
    nbu_function = excluded.nbu_function,
    domain_prefix = excluded.domain_prefix,
    android_package = excluded.android_package,
    ios_scheme = excluded.ios_scheme,
    universal_link = excluded.universal_link,
    universal_link2 = excluded.universal_link2,
    url_template = excluded.url_template,
    alternative_url = excluded.alternative_url,
    extra_links = excluded.extra_links,
    routing_mode = excluded.routing_mode,
    logo = excluded.logo,
    color = excluded.color,
    mode = excluded.mode,
    playstore_url = excluded.playstore_url,
    updated_at = now();
