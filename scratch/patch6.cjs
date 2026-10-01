const fs = require('fs');
let txt = fs.readFileSync('apps/pay/src/lib/state/checkout.svelte.ts', 'utf8');

txt = txt.replace(
    /if \(this\.prefetchedDeepLink\?\.fallback_url\) \{[\s\S]*?\}, 3500\);\s*\}/,
    `// JS fallback is removed here because handleSynchronousPayTransition is only called 
		// for Universal Links (https://), which natively handle their own App Store fallbacks.`
);

fs.writeFileSync('apps/pay/src/lib/state/checkout.svelte.ts', txt);
console.log("Patched fallback out of handleSynchronousPayTransition");
