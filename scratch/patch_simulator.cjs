const fs = require('fs');
let txt = fs.readFileSync('apps/conf/src/lib/components/IphoneDuoSimulator.svelte', 'utf8');

const regex = /if\s*\(ios_universal\)\s*\{\s*redirectUrl\s*=\s*ios_universal;[\s\S]*?viewMode\s*=\s*'desktop_qr';\s*\}\s*\}/;

const replacement = `const p_ios = bank.priority_ios;
        const p_and = bank.priority_android;

        if (simulatedOS === 'ios') {
            if (p_ios === 'store' && bank.appstore_url) {
                redirectUrl = bank.appstore_url;
                fallbackUrl = bank.appstore_url;
                steps.push('✅ Пріоритет: Store Links -> App Store');
                viewMode = 'store';
            } else if (p_ios === 'scheme' && ios_scheme) {
                redirectUrl = ios_scheme;
                fallbackUrl = bank.appstore_url || web_https || fallbackUrl;
                steps.push('✅ Пріоритет: OS App Setup -> URL Scheme');
                viewMode = 'safari';
            } else if (p_ios === 'universal_link' && ios_universal) {
                redirectUrl = ios_universal;
                fallbackUrl = bank.appstore_url || web_https || fallbackUrl;
                steps.push('✅ Пріоритет: Universal Link');
                viewMode = 'safari';
            } else {
                if (ios_universal) {
                    redirectUrl = ios_universal;
                    fallbackUrl = bank.appstore_url || web_https || fallbackUrl;
                    steps.push('➡️ Default: Universal Link');
                    viewMode = 'safari';
                } else if (ios_scheme) {
                    redirectUrl = ios_scheme;
                    fallbackUrl = bank.appstore_url || web_https || fallbackUrl;
                    steps.push('➡️ Default: URL Scheme');
                    viewMode = 'safari';
                } else {
                    fallbackUrl = bank.appstore_url || web_https || fallbackUrl;
                    steps.push('➡️ Default: Store Fallback');
                    viewMode = 'store';
                }
            }
        } else if (simulatedOS === 'android') {
            if (p_and === 'store' && bank.playstore_url) {
                redirectUrl = bank.playstore_url;
                fallbackUrl = bank.playstore_url;
                steps.push('✅ Пріоритет: Store Links -> Google Play');
                viewMode = 'duo_android';
            } else if (p_and === 'scheme' && android_intent) {
                redirectUrl = android_intent;
                fallbackUrl = bank.playstore_url || web_https || fallbackUrl;
                steps.push('✅ Пріоритет: OS App Setup -> Intent');
                viewMode = 'duo_android';
            } else if (p_and === 'universal_link' && ios_universal) {
                redirectUrl = ios_universal;
                fallbackUrl = bank.playstore_url || web_https || fallbackUrl;
                steps.push('✅ Пріоритет: Universal Link (App Link)');
                viewMode = 'duo_android';
            } else {
                if (ios_universal) {
                    redirectUrl = ios_universal;
                    fallbackUrl = bank.playstore_url || web_https || fallbackUrl;
                    steps.push('➡️ Default: App Link');
                    viewMode = 'duo_android';
                } else if (android_intent) {
                    redirectUrl = android_intent;
                    fallbackUrl = bank.playstore_url || web_https || fallbackUrl;
                    steps.push('➡️ Default: Intent');
                    viewMode = 'duo_android';
                } else {
                    fallbackUrl = bank.playstore_url || web_https || fallbackUrl;
                    steps.push('➡️ Default: Store Fallback');
                    viewMode = 'duo_android';
                }
            }
        } else {
            if (ios_universal) {
                redirectUrl = ios_universal;
                fallbackUrl = ios_universal;
            } else {
                redirectUrl = web_https || redirectUrl;
                fallbackUrl = web_https || fallbackUrl;
            }
            viewMode = 'desktop_qr';
        }`;

if (!regex.test(txt)) {
    console.error("target block not found");
    process.exit(1);
}

txt = txt.replace(regex, replacement);
fs.writeFileSync('apps/conf/src/lib/components/IphoneDuoSimulator.svelte', txt);
