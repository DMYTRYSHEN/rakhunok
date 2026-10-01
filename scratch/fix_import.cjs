const fs = require('fs');
let txt = fs.readFileSync('apps/conf/src/lib/components/BankConfiguratorModal.svelte', 'utf8');

txt = txt.replace(
    "import IphoneDuoSimulator from './IphoneDuoSimulator.svelte';",
    "import RoutingPriorityManager from './RoutingPriorityManager.svelte';"
);

txt = txt.replace(
    /<IphoneDuoSimulator[\s\S]*?\/>/,
    `<RoutingPriorityManager
                bind:bank={localBank}
                encodedPayload={payload.encodedPayload}
            />`
);

fs.writeFileSync('apps/conf/src/lib/components/BankConfiguratorModal.svelte', txt);
