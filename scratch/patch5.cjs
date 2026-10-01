const fs = require('fs');
let txt = fs.readFileSync('apps/pay/src/lib/state/checkout.svelte.ts', 'utf8');

txt = txt.replace(
    /order\.id === this\.orderId &&/g,
    `(order.id === this.orderId || order.short_id === this.orderId) &&`
);

fs.writeFileSync('apps/pay/src/lib/state/checkout.svelte.ts', txt);
console.log("Patched orderId check in checkout.svelte.ts");
