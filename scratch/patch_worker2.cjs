const fs = require('fs');
let txt = fs.readFileSync('worker/src/index.ts', 'utf8');

const regex = /if\s*\(ios_universal\)\s*\{\s*redirectUrl\s*=\s*ios_universal;\s*fallbackUrl\s*=\s*ios_universal;\s*\}\s*else\s*\{[\s\S]*?\}\s*\}\s*\}\s*return\s*\{\s*redirectUrl,\s*fallbackUrl\s*\};/;

const replacement = `const p_ios = bank.priority_ios;
		const p_and = bank.priority_android;

		if (os === 'ios') {
			if (p_ios === 'store' && bank.appstore_url) {
				redirectUrl = bank.appstore_url;
				fallbackUrl = bank.appstore_url;
			} else if (p_ios === 'scheme' && ios_scheme) {
				redirectUrl = ios_scheme;
				fallbackUrl = bank.appstore_url || web_https || fallbackUrl;
			} else if (p_ios === 'universal_link' && ios_universal) {
				redirectUrl = ios_universal;
				fallbackUrl = bank.appstore_url || web_https || fallbackUrl;
			} else {
				if (ios_universal) {
					redirectUrl = ios_universal;
					fallbackUrl = bank.appstore_url || web_https || fallbackUrl;
				} else if (ios_scheme) {
					redirectUrl = ios_scheme;
					fallbackUrl = bank.appstore_url || web_https || fallbackUrl;
				} else {
					fallbackUrl = bank.appstore_url || web_https || fallbackUrl;
				}
			}
		} else if (os === 'android') {
			if (p_and === 'store' && bank.playstore_url) {
				redirectUrl = bank.playstore_url;
				fallbackUrl = bank.playstore_url;
			} else if (p_and === 'scheme' && android_intent) {
				redirectUrl = android_intent;
				fallbackUrl = bank.playstore_url || web_https || fallbackUrl;
			} else if (p_and === 'universal_link' && ios_universal) {
				redirectUrl = ios_universal;
				fallbackUrl = bank.playstore_url || web_https || fallbackUrl;
			} else {
				if (ios_universal) {
					redirectUrl = ios_universal;
					fallbackUrl = bank.playstore_url || web_https || fallbackUrl;
				} else if (android_intent) {
					redirectUrl = android_intent;
					fallbackUrl = bank.playstore_url || web_https || fallbackUrl;
				} else {
					fallbackUrl = bank.playstore_url || web_https || fallbackUrl;
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
		}
	}

	return { redirectUrl, fallbackUrl };`;

if (!regex.test(txt)) {
    console.error("target block not found");
    process.exit(1);
}

txt = txt.replace(regex, replacement);
fs.writeFileSync('worker/src/index.ts', txt);
