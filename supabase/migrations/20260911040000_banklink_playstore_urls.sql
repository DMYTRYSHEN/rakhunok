-- Migration: 20260911040000_banklink_playstore_urls.sql
-- Update playstore_url and android_package for Ukrainian banks in public.banklink
-- Ensures 100% verified, live, canonical Google Play links (HTTP 200)

UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=ua.monvel.bankalliance', android_package = 'ua.monvel.bankalliance' WHERE id = 'alliance';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=ua.agroprosperis.android', android_package = 'ua.agroprosperis.android' WHERE id = 'apsb';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=ua.bank.amo.app', android_package = 'ua.bank.amo.app' WHERE id = 'asvi';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=ua.com.cs.ifobs.mobile.android.bis', android_package = 'ua.com.cs.ifobs.mobile.android.bis' WHERE id = 'bisbank';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=ua.com.ukrcapital.capi', android_package = 'ua.com.ukrcapital.capi' WHERE id = 'capibank';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=ua.cominbank.android.cominbank', android_package = 'ua.cominbank.android.cominbank' WHERE id = 'cominbank';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=com.eximb.enter', android_package = 'com.eximb.enter' WHERE id = 'exim';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=ua.industrialbank.android', android_package = 'ua.industrialbank.android' WHERE id = 'industrialbank';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=com.bank.kd', android_package = 'com.bank.kd' WHERE id = 'kdba';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=ua.com.cs.ifobs.mobile.lviv', android_package = 'ua.com.cs.ifobs.mobile.lviv' WHERE id = 'lviv';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=ua.android.ibank.mib', android_package = 'ua.android.ibank.mib' WHERE id = 'mib';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=com.quipugmbh.mba.ukraine', android_package = 'com.quipugmbh.mba.ukraine' WHERE id = 'pcbu';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=ua.com.cs.ifobs.mobile.pinp', android_package = 'ua.com.cs.ifobs.mobile.pinp' WHERE id = 'pinb';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=com.bank.pivdenny', android_package = 'com.bank.pivdenny' WHERE id = 'pivdenny';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=online.kapowai.online.kapowai.poltavabank', android_package = 'online.kapowai.online.kapowai.poltavabank' WHERE id = 'pltv';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=bank.sky.app', android_package = 'bank.sky.app' WHERE id = 'skyb';
UPDATE public.banklink SET playstore_url = 'https://play.google.com/store/apps/details?id=com.tas.tas2u', android_package = 'com.tas.tas2u' WHERE id = 'task';
