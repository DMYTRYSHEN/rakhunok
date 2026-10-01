const fs = require('fs');
let txt = fs.readFileSync('worker/src/index.ts', 'utf8');

txt = txt.replace(
    /let ios_universal: string \| null = null;[\s\S]*?let android_intent:/,
    `let ios_universal: string | null = null;
		if (isUniversalLinkValid) {
			if (bank.universal_link.includes('{payload}')) {
				ios_universal = bank.universal_link.replace('{payload}', payload);
			} else {
				ios_universal = \`\${bank.universal_link}\${payload}\`;
			}
		}

		let ios_scheme: string | null = null;
		if (bank.ios_scheme) {
			if (bank.url_template && bank.url_template.includes('{payload}')) {
				ios_scheme = bank.url_template.replace('{payload}', payload);
			} else {
				ios_scheme = \`\${bank.ios_scheme}://\${basePath}\${payload}\`;
			}
		}

		let android_intent:`
);

fs.writeFileSync('worker/src/index.ts', txt);
console.log("Worker patched successfully");
