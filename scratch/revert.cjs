const fs = require('fs');
let f = fs.readFileSync('apps/merchant-app/src/App.svelte', 'utf8');
f = f.replace(/mode: "redirect"/g, 'mode: import.meta.env.PUBLIC_TELEGRAM_AUTH_MODE');
fs.writeFileSync('apps/merchant-app/src/App.svelte', f);
console.log("Reverted!");
