const fs = require('fs');
let txt = fs.readFileSync('apps/conf/src/lib/components/BankManager.svelte', 'utf8');

txt = txt.replace('        } finally {\n            isSyncing = false;\n        }\n    }', `        } finally {
            isSyncing = false;
        }
    }

    let isFetchingLogos = $state(false);

    async function autoFetchLogos() {
        if (!confirm('Ви дійсно хочете оновити логотипи для всіх банків з App Store?')) return;
        isFetchingLogos = true;
        syncFailed = false;
        syncMessage = 'Пошук логотипів...';
        let updated = 0;
        let failed = 0;
        for (const bank of bankList) {
            if (!bank.appstore_url) continue;
            const match = bank.appstore_url.match(/\\/id(\\d+)/);
            if (!match) continue;
            const id = match[1];
            syncMessage = \`Оновлення: \${bank.name}...\`;
            try {
                const res = await fetch(\`https://itunes.apple.com/lookup?id=\${id}&country=ua\`);
                if (!res.ok) continue;
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    const logoUrl = data.results[0].artworkUrl512 || data.results[0].artworkUrl100;
                    if (logoUrl && bank.logo !== logoUrl) {
                        bank.logo = logoUrl;
                        await BankLinkStore.save(bank, bank.id);
                        updated++;
                    }
                }
            } catch (e) {
                console.warn(\`Failed to fetch logo for \${bank.code}\`, e);
                failed++;
            }
        }
        syncMessage = \`Оновлено: \${updated} логотипів. \${failed > 0 ? \`Помилок: \${failed}.\` : ''} Оновіть сторінку.\`;
        setTimeout(() => {
            isFetchingLogos = false;
            syncMessage = '';
            loadBanks();
        }, 5000);
    }`);

txt = txt.replace('<button onclick={syncToD1} class="icon-button" title="Синхронізувати з D1" aria-label="Синхронізувати з D1" disabled={isSyncing} aria-busy={isSyncing}>', 
    `<button onclick={autoFetchLogos} class="icon-button" title="Оновити лого з App Store" disabled={isFetchingLogos}><Zap size={16} class={isFetchingLogos ? 'animate-pulse text-yellow-400' : ''} /></button>
                <button onclick={syncToD1} class="icon-button" title="Синхронізувати з D1" aria-label="Синхронізувати з D1" disabled={isSyncing} aria-busy={isSyncing}>`);

fs.writeFileSync('apps/conf/src/lib/components/BankManager.svelte', txt, 'utf8');
console.log('Replaced correctly');
