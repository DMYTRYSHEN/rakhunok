const fs = require('fs');
let txt = fs.readFileSync('apps/pay/src/lib/state/checkout.svelte.ts', 'utf8');

txt = txt.replace(
    /finally \{\s*if \(ownsAttempt\(\)\) this\.isProcessingPayment = false;\s*\}\s*\}/g,
    `finally {
			if (ownsAttempt()) this.isProcessingPayment = false;
		}
	}

	handleSynchronousPayTransition(): void {
		this.closePaymentSheet();
		this.statusState = 'pending';
		this.isStatusScreenOpen = true;
		if (!this.terminalMode) this.startStatusPolling();
		if (this.prefetchedDeepLink?.fallback_url) {
			const fallback = this.prefetchedDeepLink.fallback_url;
			const redirect = this.prefetchedDeepLink.redirect_url;
			setTimeout(() => {
				if (typeof document !== 'undefined' && (document.hasFocus() || document.visibilityState === 'visible')) {
					if (fallback && fallback !== redirect) {
						window.location.href = fallback;
					}
				}
			}, 3500);
		}
	}`
);
fs.writeFileSync('apps/pay/src/lib/state/checkout.svelte.ts', txt);
