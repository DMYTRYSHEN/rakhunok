const fs = require('fs');
let txt = fs.readFileSync('apps/conf/src/App.svelte', 'utf8');
const start = txt.indexOf('font-mono">') + 11;
const end = txt.indexOf('</div>', start);
txt = txt.substring(0, start) + '\n        Ініціалізація BankLink...\n    ' + txt.substring(end);
fs.writeFileSync('apps/conf/src/App.svelte', txt);
