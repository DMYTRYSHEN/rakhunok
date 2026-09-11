import { createClient } from '@supabase/supabase-js';
import type { BankEntry } from '../types';
import { withBankLogo } from './bank-logos.ts';

const SUPABASE_URL = (import.meta as any).env?.PUBLIC_SUPABASE_URL || 'https://mwaeazabpvbxqfrceogr.supabase.co';
const SUPABASE_KEY = (import.meta as any).env?.PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_BOyIBn3I0As0hP_0NutVtg_9ddFdyDk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

export const DEFAULT_BANKS: BankEntry[] = ([
    { id: 'mono', code: 'MONO', name: 'Monobank (Universal Bank)', nbu_version: '003', encoding: '2', nbu_function: 'ICT', domain_prefix: 'https://bank.gov.ua/qr/', android_package: 'com.ftband.mono', ios_scheme: 'mono', universal_link: 'https://mbnk.app/qr/', universal_link2: null, url_template: 'https://mbnk.app/qr/{payload}', alternative_url: 'mono://bank.gov.ua/qr/{payload}', extra_links: null, routing_mode: 'universal_link', logo: null, color: '#000000', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/monobank-digital-mobile-bank/id1287005205', playstore_url: 'https://play.google.com/store/apps/details?id=com.ftband.mono' },
    { id: 'izibank', code: 'TASB', name: 'izibank (Tascombank)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.izibank.app', ios_scheme: 'izibank', universal_link: 'izibank://bank.gov.ua/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'scheme', logo: null, color: '#FF6B00', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/izibank-%D0%BB%D0%B5%D0%B3%D0%BA%D0%B8%D0%B9-%D0%BC%D0%BE%D0%B1%D1%96%D0%BB%D1%8C%D0%BD%D0%B8%D0%B9-%D0%B1%D0%B0%D0%BD%D0%BA/id1539286439', playstore_url: 'https://play.google.com/store/apps/details?id=ua.izibank.app' },
    { id: 'pb', code: 'PBAN', name: 'Приват24 (PrivatBank)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.privatbank.ap24', ios_scheme: 'privat24', universal_link: 'privat24://bank.gov.ua/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'scheme', logo: null, color: '#78BE20', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/privat24-mobile-bank/id1333984846', playstore_url: 'https://play.google.com/store/apps/details?id=ua.privatbank.ap24' },
    { id: 'sensebank', code: 'SENS', name: 'Sense Bank', nbu_version: '002', encoding: '1', nbu_function: 'UCT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.alfabank.mobile.android', ios_scheme: 'alfabank', universal_link: 'https://app.sensebank.ua/gkR4?code=', universal_link2: null, url_template: 'https://app.sensebank.ua/gkR4?code={payload}', alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#E31E24', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/sense-superapp-online-bank-ua/id1494135206', playstore_url: 'https://play.google.com/store/apps/details?id=ua.alfabank.mobile.android' },
    { id: 'abank24', code: 'ABUA', name: 'А-Банк (ABank)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'http://bank.gov.ua/qr/', android_package: 'ua.com.abank', ios_scheme: 'abank24', universal_link: 'https://abank24.page.link/qr/', universal_link2: null, url_template: 'https://abank24.page.link/qr/{payload}', alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#FF0000', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/%C3%A0bank24-%D1%86%D1%96%D0%BD%D1%83%D1%94%D0%BC%D0%BE-%D1%81%D1%82%D0%BE%D1%81%D1%83%D0%BD%D0%BA%D0%B8/id1261267716', playstore_url: 'https://play.google.com/store/apps/details?id=ua.com.abank' },
    { id: 'pumb', code: 'FUIB', name: 'ПУМБ (FUIB)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'com.fuib.android.spot.online', ios_scheme: 'pumb', universal_link: 'https://mobile-app.pumb.ua/https://bank.gov.ua/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#EE3124', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/pumb-online-bank-24-7-credit/id1373626840', playstore_url: 'https://play.google.com/store/apps/details?id=com.fuib.android.spot.online' },
    { id: 'myraif', code: 'AVAL', name: 'Райффайзен Банк (MyRaif)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.raiffeisen.myraif', ios_scheme: 'myraif', universal_link: 'https://my-raif.apps.raiffeisen.ua/qr?payload=', universal_link2: null, url_template: 'https://my-raif.apps.raiffeisen.ua/qr?payload={payload}', alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#FFE600', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/myraif-mobile-bank/id1582978231', playstore_url: 'https://play.google.com/store/apps/details?id=ua.raiffeisen.myraif' },
    { id: 'ukrgasbank', code: 'UGAS', name: 'Укргазбанк', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'com.ugb.app', ios_scheme: 'ugb', universal_link: 'ecobank://bank.gov.ua/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'scheme', logo: null, color: '#00A651', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/%D0%B5%D0%BA%D0%BE-%D0%B1%D0%B0%D0%BD%D0%BA/id1356084307', playstore_url: 'https://play.google.com/store/apps/details?id=com.ugb.app' },
    { id: 'otpbank', code: 'OTPV', name: 'ОТП Банк (OTP Bank)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.otpbank.android', ios_scheme: 'otpbank', universal_link: 'https://pay.otpbank.ua/qr/', universal_link2: null, url_template: 'https://pay.otpbank.ua/qr/{payload}', alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#52AE30', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/otp-bank-ua-%D0%BB%D0%B0%D0%B3%D1%96%D0%B4%D0%BD%D0%B8%D0%B9-%D0%B1%D0%B0%D0%BD%D0%BA%D1%96%D0%BD%D0%B3/id1537460130', playstore_url: 'https://play.google.com/store/apps/details?id=ua.otpbank.android' },
    { id: 'ukrsib-online', code: 'KHAB', name: 'UKRSIB online / business', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'com.ukrsibbank.uso.android', ios_scheme: 'ukrsib-online', universal_link: 'https://online.ukrsibbank.com/ibank/new-app/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#003DA5', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/ukrsib-online/id6447691686', playstore_url: 'https://play.google.com/store/apps/details?id=com.ukrsibbank.uso.android' },
    { id: 'creditagricole', code: 'AGBU', name: 'Креді Аґріколь (Credit Agricole)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.creditagricole.mobile.app', ios_scheme: 'creditagricole', universal_link: 'https://caplusapp.credit-agricole.ua/fr/pay/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#006A4E', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/ca-digital-bank/id1490851662', playstore_url: 'https://play.google.com/store/apps/details?id=ua.creditagricole.mobile.app' },
    { id: 'creditdnepr', code: 'CRDE', name: 'Банк Кредит Дніпро', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'com.creditdnepr.mb', ios_scheme: 'creditdnepr', universal_link: 'https://creditdnepr.com.ua/qr_code/?', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#0066CC', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/freebank-%D0%B1%D0%B0%D0%BD%D0%BA-%D0%BA%D1%80%D0%B5%D0%B4%D0%B8%D1%82-%D0%B4%D0%BD%D1%96%D0%BF%D1%80%D0%BE/id1160810289', playstore_url: 'https://play.google.com/store/apps/details?id=com.creditdnepr.mb' },
    { id: 'pivdenny', code: 'PIVD', name: 'Банк Південний', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.pivdenny.mybank', ios_scheme: 'pivdenny-online', universal_link: 'https://link.bank.com.ua/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#00539F', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/pivdenny-online-mobile-bank/id1550250615', playstore_url: 'https://play.google.com/store/apps/details?id=ua.pivdenny.mybank' },
    { id: 'vostok', code: 'VSTB', name: 'VST bank (Банк Восток)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'com.vostok.bv', ios_scheme: 'vostok', universal_link: 'https://bankvostok.page.link/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#ED1C24', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/vst-bank-online-banking/id1564426981', playstore_url: 'https://play.google.com/store/apps/details?id=com.vostok.bv' },
    { id: 'globus', code: 'GLBU', name: 'Глобус Банк', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'com.t18.bone.personal.globus', ios_scheme: 'globus', universal_link: 'https://gpls.app/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#2E8B57', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/globusplus-mobile-bank-online/id1511896208', playstore_url: 'https://play.google.com/store/apps/details?id=com.t18.bone.personal.globus' },
    { id: 'rada', code: 'RDBK', name: 'РАДАБАНК', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'com.radabank.rb24', ios_scheme: 'rb24', universal_link: 'https://radabank.com.ua/qr_code/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#003366', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/rb24/id1270253548', playstore_url: 'https://play.google.com/store/apps/details?id=com.radabank.rb24' },
    { id: 'mtb', code: 'MTBA', name: 'МТБ Банк', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'com.ua.mtb.bank', ios_scheme: 'mtb360', universal_link: 'https://web.mtbutils.softesis.com/transfer-to-iban-summ?transferType=QR_UPC&navigationStackModifier=REMOVE_ALL_EXCEPT_CURRENT&code=', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#0072CE', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/mtb360-mobile-bank/id1563752241', playstore_url: 'https://play.google.com/store/apps/details?id=com.ua.mtb.bank' },
    { id: 'pravex', code: 'PRAV', name: 'ПРАВЕКС БАНК (Pravex)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.com.pravex.online', ios_scheme: 'pravex-online', universal_link: 'https://online.pravex.ua/mobileapp/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#FFD700', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/pravex-online/id1481205400', playstore_url: 'https://play.google.com/store/apps/details?id=ua.com.pravex.online' },
    { id: 'winbank', code: 'PIRB', name: 'Winbank Ukraine (Піреус)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.piraeusbank.mobile.app.pbu', ios_scheme: 'winbank-ukraine', universal_link: 'https://winbank.ua/qr/winbank', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#F7941D', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/winbank-ukraine/id6444044783', playstore_url: 'https://play.google.com/store/apps/details?id=ua.piraeusbank.mobile.app.pbu' },
    { id: 'grant', code: 'GRNT', name: 'Банк Грант', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.grant.smart', ios_scheme: 'smart-grant', universal_link: 'smart://bank.gov.ua/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'scheme', logo: null, color: '#DC143C', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/%D1%81%D0%BC%D0%B0%D1%80%D1%82-%D0%B3%D1%80%D0%B0%D0%BD%D1%82/id1293703155', playstore_url: 'https://play.google.com/store/apps/details?id=ua.grant.smart' },
    { id: 'altbank', code: 'ALTB', name: 'Altbank Private', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'by.st.alt.fiz', ios_scheme: 'altbank-private', universal_link: 'https://alb.ua/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'universal_link', logo: null, color: '#4B0082', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/altbank-private/id1240093860', playstore_url: 'https://play.google.com/store/apps/details?id=by.st.alt.fiz' },
    { id: 'NovaPay', code: 'NOVA', name: 'NovaPay', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.novapay.novapaymobile', ios_scheme: 'novapay-mobile', universal_link: 'novapay-mobile://bank.gov.ua/qr/', universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'scheme', logo: null, color: '#ED1C24', active: true, checked: false, verified: true, mode: 'deeplink', appstore_url: 'https://apps.apple.com/ua/app/novapay-payment-systems/id6449020548', playstore_url: 'https://play.google.com/store/apps/details?id=ua.novapay.novapaymobile' },
    { id: 'accordbank', code: 'ACBR', name: 'Акордбанк (Accordbank)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'online.kapowai.accordbank', ios_scheme: 'accordbank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#333333', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/accordbank/id1444357307', playstore_url: 'https://play.google.com/store/apps/details?id=online.kapowai.accordbank' },
    { id: 'idea', code: 'IDEU', name: 'OBank (Ідея Банк)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.ideabank.obank', ios_scheme: 'obank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#FF6600', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/o-bank-ua-bank-online-24-7/id1585185939', playstore_url: 'https://play.google.com/store/apps/details?id=ua.ideabank.obank' },
    { id: 'kredo', code: 'WUCU', name: 'KredoBank (Кредобанк)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.android.kredobank.prod', ios_scheme: 'kredobank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#005CA9', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/kredobank-%D0%B2%D0%B0%D1%88-%D0%BC%D0%BE%D0%B1%D1%96%D0%BB%D1%8C%D0%BD%D0%B8%D0%B9-%D0%B1%D0%B0%D0%BD%D0%BA/id1481318984', playstore_url: 'https://play.google.com/store/apps/details?id=ua.android.kredobank.prod' },
    { id: 'unex', code: 'UNEX', name: 'Юнекс Банк (Unex Bank)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'online.kapowai.unexbank', ios_scheme: 'unex-bank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#0054A6', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/unex-bank/id1466961779', playstore_url: 'https://play.google.com/store/apps/details?id=online.kapowai.unexbank' },
    { id: 'alliance', code: 'ALLI', name: 'Alliance Bank (Альянс)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.alliancebank.mobile', ios_scheme: 'alliancebank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#1A73E8', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/alliance-%D0%BC%D0%BE%D0%B1%D1%96%D0%BB%D1%8C%D0%BD%D0%B8%D0%B9-%D0%B1%D0%B0%D0%BD%D0%BA/id1556455360', playstore_url: 'https://play.google.com/store/apps/details?id=ua.alliancebank.mobile' },
    { id: 'oschad', code: 'SABR', name: 'Ощадбанк', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.oschadbank.flumo', ios_scheme: 'oschad', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#009639', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/%D0%BE%D1%89%D0%B0%D0%B4/id1571479928', playstore_url: 'https://play.google.com/store/apps/details?id=ua.oschadbank.flumo' },
    { id: 'industrialbank', code: 'IBBK', name: 'Індустріалбанк', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.industrialbank.mobile', ios_scheme: 'industrialbank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#B71C1C', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/industrial24/id1321433452', playstore_url: 'https://play.google.com/store/apps/details?id=ua.industrialbank.mobile' },
    { id: 'mib', code: 'IIBU', name: 'МІБ (Міжнар. Інвест. Банк)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.mib.mobile', ios_scheme: 'mib-mobile', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#2196F3', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/mibank/id6474019083', playstore_url: 'https://play.google.com/store/apps/details?id=ua.mib.mobile' },
    { id: 'bisbank', code: 'BINV', name: 'BIS24 (БІЗБАНК)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.bisbank.bis24', ios_scheme: 'bis24', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#4CAF50', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/bis24-new/id6670791255', playstore_url: 'https://play.google.com/store/apps/details?id=ua.bisbank.bis24' },
    { id: 'capibank', code: 'UCAP', name: 'CAPIbank (Укр. Капітал)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.capibank.mobile', ios_scheme: 'capibank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#673AB7', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/capibank/id1567532308', playstore_url: 'https://play.google.com/store/apps/details?id=ua.capibank.mobile' },
    { id: 'cominbank', code: 'CMIG', name: 'ComInBank (Комінбанк)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'ua.cominbank.mobile', ios_scheme: 'cominbank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#FF5722', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/cominban%D0%BA/id1413210102', playstore_url: 'https://play.google.com/store/apps/details?id=ua.cominbank.mobile' },
    { id: 'bank34', code: 'B34U', name: 'Банк 3/4', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'online.kapowai.bank34online', ios_scheme: 'smart-bank-3-4', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#607D8B', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/smart-bank-3-4/id1489624693', playstore_url: 'https://play.google.com/store/apps/details?id=online.kapowai.bank34online' },
    { id: 'bvr', code: 'BVRU', name: 'Банк Власний Рахунок', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://qr.bank.gov.ua/', android_package: 'com.bank.vr', ios_scheme: 'bvr', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#795548', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/%D0%B1%D0%B0%D0%BD%D0%BA-%D0%B2%D0%BB%D0%B0%D1%81%D0%BD%D0%B8%D0%B9-%D1%80%D0%B0%D1%85%D1%83%D0%BD%D0%BE%D0%BA-%D0%BE%D0%BD%D0%BB%D0%B0%D0%B9%D0%BD/id1499995681', playstore_url: 'https://play.google.com/store/apps/details?id=com.bank.vr' },
    { id: 'crystal', code: 'CRYS', name: 'CrystalBank', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'ua.android.ibank.crystal', ios_scheme: 'crystalbank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/crystalbank-new/id6759290296', playstore_url: 'https://play.google.com/store/apps/details?id=ua.android.ibank.crystal' },
    { id: 'kdba', code: 'KDBA', name: 'БАНК КД (Кліринговий Дім)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'ua.com.clhs.bankkd', ios_scheme: 'bankkd', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/bank-kd-%D1%83%D0%BD%D1%96%D0%B2%D0%B5%D1%80%D1%81%D0%B0%D0%BB%D1%8C%D0%BD%D0%B8%D0%B9-%D0%B1%D0%B0%D0%BD%D0%BA%D1%96%D0%BD%D0%B3/id6743709304', playstore_url: 'https://play.google.com/store/apps/details?id=ua.com.clhs.bankkd' },
    { id: 'task', code: 'TASK', name: 'ТАСКОМБАНК TAS2U', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'ua.tas2u', ios_scheme: 'tas2u', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/tas2u-new/id6788421803', playstore_url: 'https://play.google.com/store/apps/details?id=ua.tas2u' },
    { id: 'exim', code: 'EXIM', name: 'Укрексімбанк Enter EXIM', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'com.eximb.enterexim', ios_scheme: 'enterexim', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/enter-exim/id1476420012', playstore_url: 'https://play.google.com/store/apps/details?id=com.eximb.enterexim' },
    { id: 'apsb', code: 'APSB', name: 'Агропросперіс Банк', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'ua.apbank.mobile', ios_scheme: 'apbank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/agroprosperis-bank/id1496604539', playstore_url: 'https://play.google.com/store/apps/details?id=ua.apbank.mobile' },
    { id: 'pltv', code: 'PLTV', name: 'Полтава-Банк онлайн', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'com.poltavabank.mobile', ios_scheme: 'poltavabank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/poltava-bank-online/id1542995453', playstore_url: 'https://play.google.com/store/apps/details?id=com.poltavabank.mobile' },
    { id: 'lviv', code: 'LVIV', name: 'Bank Lviv Online', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'com.banklviv.online', ios_scheme: 'banklviv', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/bank-lviv-online/id1531874486', playstore_url: 'https://play.google.com/store/apps/details?id=com.banklviv.online' },
    { id: 'skyb', code: 'SKYB', name: 'SkyBank', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'ua.skybank.mobile', ios_scheme: 'skybank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/skybank-%D1%96%D0%BD%D1%82%D0%B5%D1%80%D0%BD%D0%B5%D1%82-%D0%B1%D0%B0%D0%BD%D0%BA%D1%96%D0%BD%D0%B3/id1580483126', playstore_url: 'https://play.google.com/store/apps/details?id=ua.skybank.mobile' },
    { id: 'pcbu', code: 'PCBU', name: 'ПроКредит Банк', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'ua.procreditbank.mobile', ios_scheme: 'procreditbank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/procredit-bank-ukraine/id6738097748', playstore_url: 'https://play.google.com/store/apps/details?id=ua.procreditbank.mobile' },
    { id: 'pinb', code: 'PINB', name: 'PINBANK', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'ua.pinbank.online', ios_scheme: 'pinbank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/pinbank-online/id1581853924', playstore_url: 'https://play.google.com/store/apps/details?id=ua.pinbank.online' },
    { id: 'asvi', code: 'ASVI', name: 'amobank (ASVIO BANK)', nbu_version: '003', encoding: '1', nbu_function: 'ICT', domain_prefix: 'https://newbank.com/qr/', android_package: 'ua.asviobank.amobank', ios_scheme: 'amobank', universal_link: null, universal_link2: null, url_template: null, alternative_url: null, extra_links: null, routing_mode: 'redirect', logo: null, color: '#555555', active: true, checked: false, verified: true, mode: 'redirect', appstore_url: 'https://apps.apple.com/ua/app/amobank-%D1%82%D0%B2%D1%96%D0%B9-%D0%BC%D0%BE%D0%B1%D1%96%D0%BB%D1%8C%D0%BD%D0%B8%D0%B9-%D0%B1%D0%B0%D0%BD%D0%BA/id6745878256', playstore_url: 'https://play.google.com/store/apps/details?id=ua.asviobank.amobank' }
] satisfies BankEntry[]).map(withBankLogo);

const LOCAL_STORAGE_KEY = 'banklink_local_cache';

export const BankLinkStore = {
    getAll: async (): Promise<BankEntry[]> => {
        try {
            const { data, error } = await supabase
                .from('banklink')
                .select('*')
                .order('name');

            if (!error && data && data.length > 0) {
                const list = (data as BankEntry[]).map(withBankLogo);
                if (typeof window !== 'undefined') {
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
                }
                return list;
            }
        } catch (e) {
            console.warn('[BankLinkStore] fetch failed, using fallback:', e);
        }

        // Try local storage cache
        if (typeof window !== 'undefined') {
            try {
                const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (cached) return (JSON.parse(cached) as BankEntry[]).map(withBankLogo);
            } catch {}
        }

        return DEFAULT_BANKS;
    },

    save: async (bank: Partial<BankEntry>, oldId?: string): Promise<BankEntry> => {
        const allowedKeys = [
            'id', 'code', 'name', 'nbu_version', 'encoding', 'nbu_function',
            'domain_prefix', 'android_package', 'android_intent', 'ios_scheme',
            'universal_link', 'universal_link2', 'url_template', 'alternative_url',
            'extra_links', 'routing_mode', 'logo', 'color', 'active', 'checked',
            'verified', 'mode', 'last_test_result', 'last_test_at', 'appstore_url',
            'playstore_url'
        ];

        const cleanData: any = { updated_at: new Date().toISOString() };
        for (const k of allowedKeys) {
            if ((bank as any)[k] !== undefined) {
                cleanData[k] = (bank as any)[k];
            }
        }

        if (oldId && oldId !== bank.id) {
            const { data, error } = await supabase
                .from('banklink')
                .update(cleanData)
                .eq('id', oldId)
                .select();
            if (error) throw error;
            return data[0] as BankEntry;
        }

        const { data, error } = await supabase
            .from('banklink')
            .upsert([cleanData], { onConflict: 'id' })
            .select();

        if (error) throw error;
        return data[0] as BankEntry;
    },

    deleteBank: async (id: string): Promise<void> => {
        const { error } = await supabase
            .from('banklink')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    toggleActive: async (id: string, currentActive: boolean): Promise<boolean> => {
        const newActive = !currentActive;
        const { error } = await supabase
            .from('banklink')
            .update({ active: newActive, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
        return newActive;
    },

    toggleMode: async (id: string, currentMode: 'deeplink' | 'redirect'): Promise<'deeplink' | 'redirect'> => {
        const newMode = currentMode === 'deeplink' ? 'redirect' : 'deeplink';
        const { error } = await supabase
            .from('banklink')
            .update({ mode: newMode, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
        return newMode;
    },

    recordTest: async (id: string, result: 'success' | 'fail'): Promise<void> => {
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('banklink')
            .update({
                last_test_result: result,
                last_test_at: now,
                updated_at: now
            })
            .eq('id', id);
        if (error) throw error;
    },

    resetToDefaults: async (): Promise<BankEntry[]> => {
        const { data, error } = await supabase
            .from('banklink')
            .upsert(DEFAULT_BANKS, { onConflict: 'id' })
            .select();
        if (error) throw error;
        return data as BankEntry[];
    }
};
