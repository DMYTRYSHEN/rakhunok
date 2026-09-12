export interface BankEntry {
    id: string;
    code: string;
    name: string;
    nbu_version: string; // '002' | '003'
    encoding: string; // '1' = UTF-8, '2' = Win-1251
    nbu_function: string; // 'ICT' | 'UCT'
    domain_prefix: string;
    android_package: string | null;
    android_intent?: string | null;
    ios_scheme: string | null;
    universal_link: string | null;
    universal_link2: string | null;
    url_template: string | null;
    alternative_url: string | null;
    extra_links: string | null;
    routing_mode: 'universal_link' | 'scheme' | 'intent' | 'redirect' | 'store_links';
    logo: string | null;
    color: string;
    active: boolean;
    checked: boolean;
    verified: boolean;
    mode: 'deeplink' | 'redirect';
    last_test_result?: 'success' | 'fail' | null;
    last_test_at?: string | null;
    appstore_url?: string | null;
    playstore_url?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface TestFormData {
    recipient: string;
    iban: string;
    amount: string;
    recipientCode: string;
    purpose: string;
    function: string;
    isoCategory: string;
    isoPurpose: string;
    reference: string;
    display: string;
    lockFields: string;
    validUntil: string;
}

export interface MockScenario {
    id: string;
    label: string;
    sublabel: string;
    badge: string;
    color: string;
    version: '002' | '003';
    data: TestFormData;
}

export interface PayloadResult {
    fields: string[];
    payloadStr: string;
    encodedPayload: string;
    rawSize: number;
    encodedSize: number;
}

export interface BankUrls {
    ios_universal: string | null;
    ios_scheme: string | null;
    android_intent: string | null;
    android_scheme: string | null;
    android_app_link: string | null;
    web_https: string | null;
}
