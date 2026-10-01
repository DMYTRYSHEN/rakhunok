const fs = require('fs');
let txt = fs.readFileSync('apps/pay/src/lib/state/checkout.svelte.ts', 'utf8');

txt = txt.replace(
	/handleSynchronousPayTransition\(\): void \{\s*this\.closePaymentSheet\(\);\s*this\.statusState = 'pending';\s*this\.isStatusScreenOpen = true;\s*if \(\!this\.terminalMode\) this\.startStatusPolling\(\);/g,
	`handleSynchronousPayTransition(): void {
		setTimeout(() => {
			this.closePaymentSheet();
			this.statusState = 'pending';
			this.isStatusScreenOpen = true;
			if (!this.terminalMode) this.startStatusPolling();
		}, 50);`
);

fs.writeFileSync('apps/pay/src/lib/state/checkout.svelte.ts', txt);

let svelteTxt = fs.readFileSync('apps/pay/src/lib/components/BankSheet.svelte', 'utf8');
svelteTxt = svelteTxt.replace(
	/target=\{isDesktop \? '_blank' : '_self'\}/g,
	`target={isDesktop ? '_blank' : '_self'}
            rel="external"
            data-sveltekit-reload`
);
fs.writeFileSync('apps/pay/src/lib/components/BankSheet.svelte', svelteTxt);
