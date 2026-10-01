const fs = require('fs');
let txt = fs.readFileSync('worker/src/index.ts', 'utf8');

const oldUniversalLogic = `		let ios_universal: string | null = null;
		if (isUniversalLinkValid) {
			if (bank.url_template && bank.url_template.includes('{payload}')) {
				ios_universal = bank.url_template.replace('{payload}', payload);
			} else {
				ios_universal = \`\${bank.universal_link}\${payload}\`;
			}
		}

		let ios_scheme: string | null = null;
		if (bank.ios_scheme) {
			ios_scheme = \`\${bank.ios_scheme}://\${basePath}\${payload}\`;
		}`;

const newUniversalLogic = `		let ios_universal: string | null = null;
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
		}`;

if (txt.includes("if (bank.url_template && bank.url_template.includes('{payload}')) {")) {
    txt = txt.replace(oldUniversalLogic, newUniversalLogic);
    fs.writeFileSync('worker/src/index.ts', txt);
    console.log("Patched worker logic successfully.");
} else {
    console.error("Could not find the target code in worker.");
}
