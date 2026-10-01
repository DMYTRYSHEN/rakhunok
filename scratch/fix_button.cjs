const fs = require('fs');
let txt = fs.readFileSync('apps/conf/src/lib/components/BankManager.svelte', 'utf8');
txt = txt.replace(/<button onclick=\{autoFetchLogos\}[^>]*><Zap[^>]*><\/button>/g, '');
fs.writeFileSync('apps/conf/src/lib/components/BankManager.svelte', txt);
