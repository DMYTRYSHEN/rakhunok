const fs = require('fs');
let txt = fs.readFileSync('apps/pay/src/lib/state/checkout.svelte.ts', 'utf8');

const regexIsProcessing = /isProcessingPayment = \$state<boolean>\(false\);/;
if (regexIsProcessing.test(txt)) {
    txt = txt.replace(
        regexIsProcessing,
        `isProcessingPayment = $state<boolean>(false);\n\tprefetchedDeepLink = $state<{ redirect_url: string; fallback_url: string } | null>(null);\n\tprivate prefetchAbortController: AbortController | null = null;`
    );
} else {
    console.error("isProcessingPayment not found");
}

const regexSelectBank = /selectBank\(index: number\): void \{\s*if \(index >= 0 && index < this\.banks\.length\) \{\s*this\.selectedBankIndex = index;\s*vibrate\(8\);\s*\}\s*\}/;
if (regexSelectBank.test(txt)) {
    txt = txt.replace(
        regexSelectBank,
        `selectBank(index: number): void {
		if (index >= 0 && index < this.banks.length) {
			this.selectedBankIndex = index;
			vibrate(8);
			this.prefetchBankDeepLink();
		}
	}

	private prefetchBankDeepLink(): void {
		this.prefetchedDeepLink = null;
		if (this.prefetchAbortController) {
			this.prefetchAbortController.abort();
		}
		this.prefetchAbortController = new AbortController();

		const orderId = this.order?.id || this.orderId;
		const bankCode = this.selectedBank?.code || 'UNJS';
		const amount = this.payTotalAmount;
		
		if (!orderId) return;

		initiateBankPayment(orderId, bankCode, amount, {
			os: detectOS(),
			signal: this.prefetchAbortController.signal
		})
			.then(result => {
				if (result.success && result.redirect_url) {
					this.prefetchedDeepLink = result;
				}
			})
			.catch(() => { /* ignore */ });
	}`
    );
} else {
    console.error("selectBank not found");
}

const regexExecutePay = /async executePay\(\): Promise<void> \{[\s\S]*?launchDeepLink\(result\.redirect_url, result\.fallback_url\);/;
if (regexExecutePay.test(txt)) {
    txt = txt.replace(
        regexExecutePay,
        `async executePay(): Promise<void> {
		if (this.isProcessingPayment) return;
		const session = this.session;
		const attempt = ++this.paymentAttempt;
		const order = this.order;
		const orderId = this.orderId;
		const amount = this.payTotalAmount;
		const serverAmount = order?.total_amount;
		const serverBaseAmount = order?.base_amount;
		const location = window.location.href;
		const bankCode = this.selectedBank?.code || 'UNJS';
		const ownsAttempt = () => session === this.session && attempt === this.paymentAttempt;
		const unchanged = () =>
			ownsAttempt() &&
			this.order === order &&
			this.orderId === orderId &&
			window.location.href === location &&
			this.payTotalAmount === amount &&
			order?.total_amount === serverAmount &&
			order?.base_amount === serverBaseAmount &&
			(this.selectedBank?.code || 'UNJS') === bankCode &&
			this.isPayable();
		this.isProcessingPayment = true;
		vibrate(15);

		try {
			if (!this.isPayable()) {
				throw new Error('Оплата недоступна, перевірте чи заповнені необхідні параметри');
			}
			this.stopPolling?.();
			const token = await executeTurnstile('pay');
			if (!unchanged()) return;
			if (this.terminalMode) {
				const selection = readTerminalSelection();
				if (!selection || !matchesTerminalOrder(selection, orderId, amount)) {
					throw new Error('Термінальна сесія не збігається. Спробуйте оновити сторінку.');
				}
			}

			// If prefetched and valid, use it
			let result = this.prefetchedDeepLink;
			if (!result) {
				const clientOS = detectOS();
				result = await initiateBankPayment(orderId, bankCode, amount, {
					os: clientOS,
					turnstileToken: token,
					recaptchaToken: token
				});
				if (!unchanged()) return;
				if (result.success !== true || !result.redirect_url)
					throw new Error(result.error || 'Невідома помилка під час ініціалізації');
			}
			
			// We only launch it programmatically if it's NOT handled natively by an <a> tag
			// We can know if it was handled natively if this method was called with a flag
			// But for now, we just assume if it's called normally, we launch it.
			// Actually, wait, if we use an <a> tag, we shouldn't call executePay. We should call a new method.
			launchDeepLink(result.redirect_url, result.fallback_url);`
    );
}

fs.writeFileSync('apps/pay/src/lib/state/checkout.svelte.ts', txt);
