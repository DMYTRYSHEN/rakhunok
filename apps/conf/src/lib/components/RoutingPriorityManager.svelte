<script lang="ts">
    import { Smartphone, Info, Store, Link as LinkIcon } from '@lucide/svelte';
    import type { BankEntry } from '../types';

    interface Props {
        bank: BankEntry;
        encodedPayload: string;
    }

    let { bank = $bindable(), encodedPayload }: Props = $props();

    // Derived states to show what URLs would be used
    let iosUniversal = $derived.by(() => {
        if (!bank.universal_link || !bank.universal_link.startsWith('https://')) return null;
        if (bank.url_template && bank.url_template.includes('{payload}')) {
            return bank.url_template.replace('{payload}', encodedPayload);
        }
        return `${bank.universal_link}${encodedPayload}`;
    });

    let iosScheme = $derived.by(() => {
        if (!bank.ios_scheme) return null;
        const base = bank.domain_prefix ? bank.domain_prefix.replace(/^https?:\/\//, '') : 'bank.gov.ua/qr/';
        return `${bank.ios_scheme}://${base}${encodedPayload}`;
    });

    let androidIntent = $derived.by(() => {
        if (!bank.android_package) return null;
        const base = bank.domain_prefix ? bank.domain_prefix.replace(/^https?:\/\//, '') : 'bank.gov.ua/qr/';
        const fallback = bank.playstore_url ? `;S.browser_fallback_url=${encodeURIComponent(bank.playstore_url)}` : '';
        return `intent://${base}${encodedPayload}#Intent;scheme=https;package=${bank.android_package}${fallback};end;`;
    });

    let webHttps = $derived.by(() => {
        return bank.domain_prefix ? `${bank.domain_prefix}${encodedPayload}` : (bank.universal_link ? `${bank.universal_link}${encodedPayload}` : null);
    });
</script>

<div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
    <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3 text-sm text-blue-200 leading-relaxed">
        <Info size={18} class="text-blue-400 shrink-0 mt-0.5" />
        <div>
            Тут ви можете налаштувати, який метод відкриття застосунку буде пріоритетним для кожної платформи. 
            Усі зміни миттєво зберігаються у локальному стані. Щоб відправити їх до бази, натисніть кнопку «Зберегти» у головному вікні після закриття цієї панелі.
        </div>
    </div>

    <!-- iOS Priority -->
    <div class="border border-stone-800 rounded-xl overflow-hidden bg-stone-900/50">
        <div class="px-4 py-3 bg-stone-950 border-b border-stone-800 flex items-center gap-2">
            <Smartphone size={16} class="text-stone-400" />
            <h4 class="font-bold text-white">Apple iOS</h4>
        </div>
        <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-3">
                <label class="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Пріоритетний метод</label>
                
                <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {bank.priority_ios === 'universal_link' || !bank.priority_ios ? 'bg-blue-500/10 border-blue-500/50' : 'border-stone-800 hover:border-stone-700 bg-stone-950'}">
                    <input type="radio" bind:group={bank.priority_ios} value="universal_link" class="mt-1" />
                    <div>
                        <div class="font-medium text-white flex items-center gap-1.5"><LinkIcon size={14} class="text-blue-400"/> Universal Link</div>
                        <div class="text-xs text-stone-400 mt-1">Офіційне універсальне посилання. Найбільш стабільний метод в iOS.</div>
                    </div>
                </label>

                <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {bank.priority_ios === 'scheme' ? 'bg-blue-500/10 border-blue-500/50' : 'border-stone-800 hover:border-stone-700 bg-stone-950'}">
                    <input type="radio" bind:group={bank.priority_ios} value="scheme" class="mt-1" />
                    <div>
                        <div class="font-medium text-white flex items-center gap-1.5"><Smartphone size={14} class="text-blue-400"/> OS App Setup (URL Scheme)</div>
                        <div class="text-xs text-stone-400 mt-1">Відкриття через кастомну схему (напр. privat24://).</div>
                    </div>
                </label>

                <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {bank.priority_ios === 'store' ? 'bg-blue-500/10 border-blue-500/50' : 'border-stone-800 hover:border-stone-700 bg-stone-950'}">
                    <input type="radio" bind:group={bank.priority_ios} value="store" class="mt-1" />
                    <div>
                        <div class="font-medium text-white flex items-center gap-1.5"><Store size={14} class="text-blue-400"/> Store Links (App Store)</div>
                        <div class="text-xs text-stone-400 mt-1">Примусово відправляти в магазин додатків (якщо інтеграція тимчасово не працює).</div>
                    </div>
                </label>
            </div>
            
            <div class="space-y-4">
                <h5 class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Симуляція результату</h5>
                
                <div class="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3 font-mono text-xs">
                    {#if bank.priority_ios === 'store'}
                        <div class="text-blue-400 font-bold">1. Redirect URL (App Store):</div>
                        <div class="break-all text-stone-300">{bank.appstore_url || 'Не налаштовано'}</div>
                    {:else if bank.priority_ios === 'scheme' && iosScheme}
                        <div class="text-blue-400 font-bold">1. Redirect URL (Scheme):</div>
                        <div class="break-all text-stone-300">{iosScheme}</div>
                        <div class="text-stone-500 font-bold mt-3">2. Fallback URL:</div>
                        <div class="break-all text-stone-400">{bank.appstore_url || webHttps || 'Не налаштовано'}</div>
                    {:else if (!bank.priority_ios || bank.priority_ios === 'universal_link') && iosUniversal}
                        <div class="text-blue-400 font-bold">1. Redirect URL (Universal Link):</div>
                        <div class="break-all text-stone-300">{iosUniversal}</div>
                        <div class="text-stone-500 font-bold mt-3">2. Fallback URL:</div>
                        <div class="break-all text-stone-400">{bank.appstore_url || webHttps || 'Не налаштовано'}</div>
                    {:else}
                        <div class="text-yellow-400 font-bold">1. Redirect URL (Default Fallback):</div>
                        <div class="break-all text-stone-300">{iosUniversal || iosScheme || bank.appstore_url || webHttps || 'Помилка налаштувань'}</div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <!-- Android Priority -->
    <div class="border border-stone-800 rounded-xl overflow-hidden bg-stone-900/50">
        <div class="px-4 py-3 bg-stone-950 border-b border-stone-800 flex items-center gap-2">
            <Smartphone size={16} class="text-stone-400" />
            <h4 class="font-bold text-white">Google Android</h4>
        </div>
        <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-3">
                <label class="block text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Пріоритетний метод</label>
                
                <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {bank.priority_android === 'universal_link' || !bank.priority_android ? 'bg-green-500/10 border-green-500/50' : 'border-stone-800 hover:border-stone-700 bg-stone-950'}">
                    <input type="radio" bind:group={bank.priority_android} value="universal_link" class="mt-1" />
                    <div>
                        <div class="font-medium text-white flex items-center gap-1.5"><LinkIcon size={14} class="text-green-400"/> App Link (Універсальне)</div>
                        <div class="text-xs text-stone-400 mt-1">Використання App Links.</div>
                    </div>
                </label>

                <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {bank.priority_android === 'scheme' ? 'bg-green-500/10 border-green-500/50' : 'border-stone-800 hover:border-stone-700 bg-stone-950'}">
                    <input type="radio" bind:group={bank.priority_android} value="scheme" class="mt-1" />
                    <div>
                        <div class="font-medium text-white flex items-center gap-1.5"><Smartphone size={14} class="text-green-400"/> OS App Setup (Intent)</div>
                        <div class="text-xs text-stone-400 mt-1">Використання Android Intent (рекомендовано для Android).</div>
                    </div>
                </label>

                <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors {bank.priority_android === 'store' ? 'bg-green-500/10 border-green-500/50' : 'border-stone-800 hover:border-stone-700 bg-stone-950'}">
                    <input type="radio" bind:group={bank.priority_android} value="store" class="mt-1" />
                    <div>
                        <div class="font-medium text-white flex items-center gap-1.5"><Store size={14} class="text-green-400"/> Store Links (Google Play)</div>
                        <div class="text-xs text-stone-400 mt-1">Примусово відправляти в Play Market.</div>
                    </div>
                </label>
            </div>
            
            <div class="space-y-4">
                <h5 class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Симуляція результату</h5>
                
                <div class="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3 font-mono text-xs">
                    {#if bank.priority_android === 'store'}
                        <div class="text-green-400 font-bold">1. Redirect URL (Google Play):</div>
                        <div class="break-all text-stone-300">{bank.playstore_url || 'Не налаштовано'}</div>
                    {:else if bank.priority_android === 'scheme' && androidIntent}
                        <div class="text-green-400 font-bold">1. Redirect URL (Intent):</div>
                        <div class="break-all text-stone-300">{androidIntent}</div>
                        <div class="text-stone-500 font-bold mt-3">2. Fallback URL:</div>
                        <div class="break-all text-stone-400">{bank.playstore_url || webHttps || 'Не налаштовано'}</div>
                    {:else if (!bank.priority_android || bank.priority_android === 'universal_link') && iosUniversal}
                        <div class="text-green-400 font-bold">1. Redirect URL (App Link):</div>
                        <div class="break-all text-stone-300">{iosUniversal}</div>
                        <div class="text-stone-500 font-bold mt-3">2. Fallback URL:</div>
                        <div class="break-all text-stone-400">{bank.playstore_url || webHttps || 'Не налаштовано'}</div>
                    {:else}
                        <div class="text-yellow-400 font-bold">1. Redirect URL (Default Fallback):</div>
                        <div class="break-all text-stone-300">{iosUniversal || androidIntent || bank.playstore_url || webHttps || 'Помилка налаштувань'}</div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>
<style>
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
</style>
