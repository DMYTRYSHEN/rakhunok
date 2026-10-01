const fs = require('fs');
let txt = fs.readFileSync('apps/pay/src/lib/components/BankSheet.svelte', 'utf8');

const replacement = `      <!-- Pay Button -->
      <section class="action-area">
        {#if checkout.prefetchedDeepLink?.redirect_url && checkout.prefetchedDeepLink.redirect_url.startsWith('https://')}
          <a
            href={checkout.prefetchedDeepLink.redirect_url}
            target={isDesktop ? '_blank' : '_self'}
            class="pay-btn"
            class:processing={checkout.isProcessingPayment}
            onclick={() => checkout.handleSynchronousPayTransition()}
            style="text-decoration: none; display: flex;"
          >
            <span class="btn-text">Перейти до оплати в додатку банку</span>
          </a>
        {:else}
          <button
            class="pay-btn"
            class:processing={checkout.isProcessingPayment}
            disabled={checkout.isProcessingPayment}
            onclick={() => checkout.executePay()}
          >
            <span class="btn-text">
              {checkout.isProcessingPayment
                ? \`Підготовка у \${checkout.selectedBank?.name || 'банк'}...\`
                : 'Перейти до оплати в додатку банку'}
            </span>
            <div class="spinner"></div>
          </button>
        {/if}`;

txt = txt.replace(
    /<!-- Pay Button -->\s*<section class="action-area">\s*<button\s*class="pay-btn"[\s\S]*?<div class="spinner"><\/div>\s*<\/button>/,
    replacement
);

fs.writeFileSync('apps/pay/src/lib/components/BankSheet.svelte', txt);
