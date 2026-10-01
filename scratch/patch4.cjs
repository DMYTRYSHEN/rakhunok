const fs = require('fs');
let txt = fs.readFileSync('apps/pay/src/lib/components/BankSheet.svelte', 'utf8');

const regexOldA = /<a[\s\S]*?<span class="btn-text">Перейти до оплати в додатку банку<\/span>\s*<\/a>/;
const newA = `<a
            href={checkout.prefetchedDeepLink.redirect_url}
            target="_blank"
            rel="external noopener noreferrer"
            data-sveltekit-reload
            class="pay-btn"
            class:processing={checkout.isProcessingPayment}
            onclick={(e) => {
                if (!checkout.isPayable()) {
                    e.preventDefault();
                    checkout.executePay(); // This will throw the correct 'Expired' error UI
                    return;
                }
                checkout.handleSynchronousPayTransition();
            }}
            style="text-decoration: none; display: flex;"
          >
            <span class="btn-text">Перейти до оплати в додатку банку</span>
          </a>`;

if (regexOldA.test(txt)) {
    txt = txt.replace(regexOldA, newA);
    fs.writeFileSync('apps/pay/src/lib/components/BankSheet.svelte', txt);
    console.log("Patched BankSheet.svelte successfully.");
} else {
    console.error("Could not find the <a> tag in BankSheet.svelte");
}
