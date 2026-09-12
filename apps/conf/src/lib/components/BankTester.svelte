<script lang="ts">
    import { onMount } from 'svelte';
    import QRCode from 'qrcode';
    import {
        X, Play, Copy, Check, QrCode, Terminal, FileCode2, History,
        Smartphone, Globe, ArrowUpRight, RotateCcw, ThumbsUp, ThumbsDown,
        RefreshCw, Clock3, ChevronDown, ChevronUp
    } from '@lucide/svelte';
    import type { BankEntry, TestFormData, PayloadResult, BankUrls } from '../types';
    import { MOCK_SCENARIOS } from '../services/mock-scenarios';
    import { generateTestPayload, buildBankUrls } from '../services/payload-builder';
    import { BankLinkStore } from '../services/banklink-store';
    import IphoneDuoSimulator from './IphoneDuoSimulator.svelte';

    interface Props {
        bank: BankEntry;
        onClose: () => void;
        onTestRecorded?: (id: string, result: 'success' | 'fail') => void;
        embedded?: boolean;
    }

    let { bank, onClose, onTestRecorded, embedded = false }: Props = $props();

    let activeTab = $state<'IPHONE' | 'DEBUG' | 'PAYLOAD' | 'QR' | 'HISTORY'>('IPHONE');
    let isToolbarCollapsed = $state(false);
    const defaultScenario = MOCK_SCENARIOS.find((scenario) => scenario.id === 'rozetka')!;
    let selectedScenarioId = $state<string>(defaultScenario.id);

    let formData = $state<TestFormData>({ ...defaultScenario.data });

    let overrides = $state<Record<number, string>>({});
    let copiedKey = $state<string | null>(null);
    let qrCanvas = $state<HTMLCanvasElement | null>(null);
    let isRecording = $state(false);
    let testFeedback = $state<string | null>(null);
    let generationKey = $state(0);
    let generatedAt = $state(new Date());
    let redirectState = $state<'idle' | 'redirecting' | 'redirected'>('idle');
    let showRedirectModal = $state(false);
    let launchLog = $state<string[]>([]);

    function triggerDirectRedirect(url: string | null) {
        if (!url || typeof window === 'undefined') return;
        redirectState = 'redirecting';
        try {
            window.location.href = url;
        } catch (err) {
            console.error('Direct redirect error:', err);
        }
        setTimeout(() => {
            redirectState = 'redirected';
            setTimeout(() => {
                redirectState = 'idle';
            }, 3000);
        }, 1200);
    }

    /**
     * Cascading Android app launch strategy:
     * 1. Custom URL scheme (alliancebank://bank.gov.ua/qr/...) — most apps register this
     * 2. intent:// with custom scheme — explicit package + scheme fallback
     * 3. intent:// with https scheme — for banks with verified domain links
     * 4. Play Store — if nothing else works
     */
    function launchAndroidApp() {
        if (typeof window === 'undefined') return;
        redirectState = 'redirecting';
        launchLog = [];

        const strategies: { label: string; url: string }[] = [];

        // Strategy 1: Direct custom scheme URL (highest success rate)
        if (urls.android_scheme) {
            strategies.push({ label: `Кастомна схема: ${bank.ios_scheme}://`, url: urls.android_scheme });
        }

        // Strategy 2: intent:// with custom scheme (has S.browser_fallback_url)
        if (urls.android_intent && bank.ios_scheme && urls.android_intent.includes(`scheme=${bank.ios_scheme}`)) {
            strategies.push({ label: `Intent (scheme=${bank.ios_scheme})`, url: urls.android_intent });
        }

        // Strategy 3: intent:// with https scheme
        if (bank.android_package) {
            const fallback = bank.playstore_url ? `;S.browser_fallback_url=${encodeURIComponent(bank.playstore_url)}` : '';
            const httpsIntent = `intent://bank.gov.ua/qr/${payload.encodedPayload}#Intent;scheme=https;package=${bank.android_package}${fallback};end;`;
            if (httpsIntent !== urls.android_intent) {
                strategies.push({ label: 'Intent (scheme=https)', url: httpsIntent });
            }
        }

        // Strategy 4: Web HTTPS URL (universal link that may trigger app association)
        if (urls.web_https) {
            strategies.push({ label: 'Web HTTPS URL', url: urls.web_https });
        }

        if (strategies.length === 0) {
            launchLog = ['❌ Немає жодної стратегії для запуску'];
            redirectState = 'redirected';
            return;
        }

        // Execute first strategy immediately
        const first = strategies[0];
        launchLog = [`▶ Спроба: ${first.label}`];

        try {
            window.location.href = first.url;
        } catch (err) {
            launchLog = [...launchLog, `❌ Помилка: ${err}`];
        }

        // After a delay, show all strategies for manual retry
        setTimeout(() => {
            launchLog = [
                ...launchLog,
                `✅ Редірект відправлено`,
                `---`,
                `Якщо додаток не відкрився, спробуйте інші стратегії нижче:`
            ];
            redirectState = 'redirected';
            setTimeout(() => {
                redirectState = 'idle';
            }, 5000);
        }, 1500);
    }

    function generateHtmlButtonSnippet(intentUrl: string | null, bankName: string, color: string | null): string {
        if (!intentUrl) return '';
        const btnColor = color || '#007bff';
        return `<a href="${intentUrl}" style="display: inline-block; padding: 10px 20px; background-color: ${btnColor}; color: white; text-decoration: none; border-radius: 5px;">💳 intent ${bankName}</a>`;
    }

    // Derived payload & URLs
    let payload = $derived.by<PayloadResult>(() => {
        generationKey;
        return generateTestPayload(bank, formData, overrides);
    });
    let urls = $derived<BankUrls>(buildBankUrls(bank, payload.encodedPayload));
    let selectedScenario = $derived(MOCK_SCENARIOS.find((scenario) => scenario.id === selectedScenarioId));

    // Render QR Code whenever payload changes or tab switches to QR
    $effect(() => {
        if (activeTab === 'QR' && qrCanvas && payload.encodedPayload) {
            const qrText = urls.web_https || `${bank.domain_prefix || 'https://qr.bank.gov.ua/'}${payload.encodedPayload}`;
            QRCode.toCanvas(qrCanvas, qrText, {
                width: 280,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            }).catch(err => console.error('QR render error:', err));
        }
    });

    function applyScenario(scenarioId: string) {
        selectedScenarioId = scenarioId;
        const target = MOCK_SCENARIOS.find(s => s.id === scenarioId);
        if (target) {
            formData = { ...target.data };
            overrides = {};
        }
    }

    function generatePayload() {
        generationKey += 1;
        generatedAt = new Date();
        testFeedback = 'Payload оновлено';
        setTimeout(() => {
            if (testFeedback === 'Payload оновлено') testFeedback = null;
        }, 1800);
    }

    async function copyToClipboard(text: string, key: string) {
        try {
            await navigator.clipboard.writeText(text);
            copiedKey = key;
            setTimeout(() => {
                if (copiedKey === key) copiedKey = null;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    async function recordTestResult(result: 'success' | 'fail') {
        isRecording = true;
        testFeedback = null;
        try {
            await BankLinkStore.recordTest(bank.id, result);
            bank.last_test_result = result;
            bank.last_test_at = new Date().toISOString();
            testFeedback = result === 'success' ? 'Успіх зафіксовано в banklink!' : 'Помилку зафіксовано в banklink!';
            if (onTestRecorded) onTestRecorded(bank.id, result);
        } catch (e: any) {
            testFeedback = 'Помилка збереження статусу';
        } finally {
            isRecording = false;
        }
    }

    function downloadQrPng() {
        if (!qrCanvas) return;
        const link = document.createElement('a');
        link.download = `qr-${bank.id}-${formData.reference || 'payment'}.png`;
        link.href = qrCanvas.toDataURL('image/png');
        link.click();
    }

    const FIELD_LABELS: string[] = [
        'Службовий ідентифікатор (BCD)',
        'Версія формату (002 / 003)',
        'Кодування (1: UTF-8, 2: Win-1251)',
        'Функція платежу (ICT / UCT)',
        'Резервне поле 5',
        'Найменування отримувача',
        'Рахунок IBAN',
        'Сума з валютою (UAH)',
        'ЄДРПОУ / РНОКПП отримувача',
        'ISO категорія / Призначення',
        'Референс замовлення / Рахунку',
        'Призначення платежу',
        'Додаткові теги інструкції (display)',
        'Блокування полів (lockFields)',
        'Діє до (Valid Until)',
        'Створено (Created At)',
        'Резервне поле RFU'
    ];
</script>

<div class={embedded ? 'embedded-tester h-full min-w-0' : 'fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto'}>
    <div class={embedded ? 'h-full min-w-0 bg-white flex flex-col text-slate-700' : 'relative w-full max-w-5xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col text-stone-200'}>
        <!-- Modal Header -->
        <div class={embedded ? 'hidden' : 'px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/90 sticky top-0 z-10'}>
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm uppercase shadow-md" style="background-color: {bank.color || '#3b82f6'}; color: #fff;">
                    {bank.code || 'BNK'}
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h2 class="text-base sm:text-lg font-bold text-white leading-tight">
                            {bank.name}
                        </h2>
                        <span class="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase rounded-md bg-stone-800 text-stone-300">
                            {bank.mode}
                        </span>
                        {#if bank.last_test_result === 'success'}
                            <span class="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Працює
                            </span>
                        {:else if bank.last_test_result === 'fail'}
                            <span class="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                Збій
                            </span>
                        {/if}
                    </div>
                    <p class="text-xs text-stone-400">
                        NBU {bank.nbu_version} • {bank.encoding === '2' ? 'Win-1251' : 'UTF-8'} • {bank.nbu_function} • {bank.routing_mode}
                    </p>
                </div>
            </div>

            <button
                onclick={onClose}
                class="p-2 text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-xl transition-all cursor-pointer"
            >
                <X size={18} />
            </button>
        </div>

        <!-- Test Payload Controls -->
        <div class="test-payload-toolbar" class:collapsed={isToolbarCollapsed}>
            <div class="test-toolbar-heading">
                <button
                    type="button"
                    class="test-toolbar-heading-main text-left cursor-pointer bg-transparent border-0 p-0"
                    onclick={() => isToolbarCollapsed = !isToolbarCollapsed}
                >
                    <div class="flex items-center gap-2">
                        <span>Test Payload</span>
                        {#if isToolbarCollapsed}
                            <span class="collapsed-summary">{formData.amount || 0} UAH · {selectedScenario?.badge || ''}</span>
                        {/if}
                    </div>
                    <small>{selectedScenario?.sublabel || 'Платіжні реквізити'}</small>
                </button>
                <div class="test-toolbar-heading-actions">
                    {#if testFeedback === 'Payload оновлено'}
                        <b>Оновлено</b>
                    {/if}
                    <button
                        type="button"
                        onclick={() => isToolbarCollapsed = !isToolbarCollapsed}
                        class="toolbar-toggle-circle"
                        title={isToolbarCollapsed ? 'Розгорнути параметри тесту' : 'Згорнути параметри тесту'}
                        aria-label={isToolbarCollapsed ? 'Розгорнути параметри тесту' : 'Згорнути параметри тесту'}
                    >
                        {#if isToolbarCollapsed}
                            <ChevronDown size={15} />
                        {:else}
                            <ChevronUp size={15} />
                        {/if}
                    </button>
                </div>
            </div>

            {#if !isToolbarCollapsed}
                <div class="test-toolbar-grid">
                    <label class="test-field test-field-preset">
                        <span>Preset</span>
                        <select value={selectedScenarioId} onchange={(event) => applyScenario(event.currentTarget.value)}>
                            {#each MOCK_SCENARIOS as scenario (scenario.id)}
                                <option value={scenario.id}>{scenario.badge} — {scenario.label}</option>
                            {/each}
                        </select>
                    </label>

                    <button type="button" class="generate-button" onclick={generatePayload}>
                        <RefreshCw size={14} />
                        <span>Generate</span>
                    </button>

                    <label class="test-field test-field-amount">
                        <span>Amount</span>
                        <input type="number" min="0" step="0.01" bind:value={formData.amount} />
                    </label>

                    <label class="test-field test-field-currency">
                        <span>Currency</span>
                        <select aria-label="Currency" disabled>
                            <option>UAH</option>
                        </select>
                    </label>

                    <label class="test-field test-field-reference">
                        <span>Reference</span>
                        <input type="text" bind:value={formData.reference} placeholder="Payment reference" />
                    </label>
                </div>

                <div class="protocol-badges" aria-label="Payload protocol summary">
                    <span>{bank.nbu_version}</span>
                    <span>{bank.encoding === '2' ? 'Windows-1251' : 'UTF-8'}</span>
                    <span>{formData.function || bank.nbu_function}</span>
                    <span>{formData.isoCategory}/{formData.isoPurpose}</span>
                    <span>{formData.lockFields || '—'}</span>
                    <span class="protocol-time"><Clock3 size={11} />{generatedAt.toLocaleTimeString('uk-UA')}</span>
                </div>
            {/if}
        </div>

        <!-- Tabs Navigation -->
        <div class={embedded ? 'px-2 border-b border-slate-200 grid grid-cols-5 bg-slate-50 text-xs font-medium' : 'px-6 border-b border-stone-800 flex items-center gap-2 bg-stone-900 text-xs font-medium'}>
            <button
                onclick={() => activeTab = 'IPHONE'}
                class="py-3 px-2 border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer {activeTab === 'IPHONE' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-stone-400 hover:text-stone-200'}"
            >
                <Smartphone size={15} />
                <span>{embedded ? 'DUO' : 'iPhone Duo'}</span>
            </button>
            <button
                onclick={() => activeTab = 'DEBUG'}
                class="py-3 px-2 border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer {activeTab === 'DEBUG' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-stone-400 hover:text-stone-200'}"
            >
                <Terminal size={15} />
                <span>{embedded ? 'DEBUG' : 'Deep Links'}</span>
            </button>
            <button
                onclick={() => activeTab = 'PAYLOAD'}
                class="py-3 px-2 border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer {activeTab === 'PAYLOAD' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-stone-400 hover:text-stone-200'}"
            >
                <FileCode2 size={15} />
                <span>{embedded ? 'PAYLOAD' : `Payload (${payload.fields.length})`}</span>
            </button>
            <button
                onclick={() => activeTab = 'QR'}
                class="py-3 px-2 border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer {activeTab === 'QR' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-stone-400 hover:text-stone-200'}"
            >
                <QrCode size={15} />
                <span>QR</span>
            </button>
            <button
                onclick={() => activeTab = 'HISTORY'}
                class="py-3 px-2 border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer {activeTab === 'HISTORY' ? 'border-blue-500 text-blue-400 font-bold' : 'border-transparent text-stone-400 hover:text-stone-200'}"
            >
                <History size={15} />
                <span>{embedded ? 'INFO' : 'Специфікація'}</span>
            </button>
        </div>

        <!-- Body Tabs Content -->
        <div class={embedded ? 'p-4 overflow-y-auto space-y-5 flex-1 text-sm' : 'p-6 overflow-y-auto space-y-6 flex-1 text-sm'}>
            <!-- TAB 0: IPHONE DUO SIMULATOR -->
            {#if activeTab === 'IPHONE'}
                <div class="space-y-4">
                    <IphoneDuoSimulator
                        bank={bank}
                        formData={formData}
                        urls={urls}
                        encodedPayload={payload.encodedPayload}
                        onTestSuccess={() => recordTestResult('success')}
                    />
                </div>
            {/if}

            <!-- TAB 1: DEBUG / SIMULATOR -->
            {#if activeTab === 'DEBUG'}
                <div class="space-y-6">
                    <!-- Compact editable parameters summary -->
                    <div class="bg-stone-950/60 border border-stone-800 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                            <span class="text-stone-500 block mb-0.5">Отримувач</span>
                            <span class="font-semibold text-stone-200">{formData.recipient}</span>
                        </div>
                        <div>
                            <span class="text-stone-500 block mb-0.5">IBAN</span>
                            <span class="font-mono text-stone-300">{formData.iban.slice(0, 14)}...</span>
                        </div>
                        <div>
                            <span class="text-stone-500 block mb-0.5">Сума</span>
                            <span class="font-bold text-emerald-400">{formData.amount} ₴</span>
                        </div>
                        <div>
                            <span class="text-stone-500 block mb-0.5">Призначення</span>
                            <span class="text-stone-300 truncate block" title={formData.purpose}>{formData.purpose}</span>
                        </div>
                    </div>

                    <!-- Generated Links for Device Testing -->
                    <div class="space-y-3">
                        <h3 class="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                            <Smartphone size={14} />
                            <span>Глибокі посилання для відкриття застосунку</span>
                        </h3>

                        <!-- 1. Universal Link (iOS / Android) -->
                        <div class="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-2">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full {urls.ios_universal ? 'bg-emerald-400' : 'bg-stone-600'}"></span>
                                    <span class="text-xs font-bold text-stone-200">1. Universal Link (iOS / Android)</span>
                                </div>
                                {#if urls.ios_universal}
                                    <span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Рекомендовано</span>
                                {:else}
                                    <span class="text-[10px] text-stone-500">Не налаштовано</span>
                                {/if}
                            </div>

                            {#if urls.ios_universal}
                                <div class="p-2.5 bg-stone-900 rounded-xl font-mono text-xs text-stone-300 break-all select-all">
                                    {urls.ios_universal}
                                </div>
                                <div class="flex items-center gap-2 pt-1">
                                    <a
                                        href={urls.ios_universal}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                                    >
                                        <Play size={12} />
                                        <span>Відкрити (Launch)</span>
                                        <ArrowUpRight size={12} />
                                    </a>
                                    <button
                                        onclick={() => copyToClipboard(urls.ios_universal!, 'universal')}
                                        class="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                                    >
                                        {#if copiedKey === 'universal'}
                                            <Check size={12} class="text-emerald-400" />
                                            <span class="text-emerald-400">Скопійовано!</span>
                                        {:else}
                                            <Copy size={12} />
                                            <span>Скопіювати</span>
                                        {/if}
                                    </button>
                                </div>
                            {:else}
                                <p class="text-xs text-stone-500">У цього банку відсутній universal_link. Використовуйте scheme або redirect.</p>
                            {/if}
                        </div>

                        <!-- 2. iOS App Scheme -->
                        <div class="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-2">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full {urls.ios_scheme ? 'bg-blue-400' : 'bg-stone-600'}"></span>
                                    <span class="text-xs font-bold text-stone-200">2. iOS App Scheme ({bank.ios_scheme || 'немає'})</span>
                                </div>
                            </div>

                            {#if urls.ios_scheme}
                                <div class="p-2.5 bg-stone-900 rounded-xl font-mono text-xs text-stone-300 break-all select-all">
                                    {urls.ios_scheme}
                                </div>
                                <div class="flex items-center gap-2 pt-1">
                                    <a
                                        href={urls.ios_scheme}
                                        class="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                                    >
                                        <Play size={12} />
                                        <span>Відкрити в iOS додатку</span>
                                    </a>
                                    <button
                                        onclick={() => copyToClipboard(urls.ios_scheme!, 'scheme')}
                                        class="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                                    >
                                        {#if copiedKey === 'scheme'}
                                            <Check size={12} class="text-emerald-400" />
                                            <span class="text-emerald-400">Скопійовано!</span>
                                        {:else}
                                            <Copy size={12} />
                                            <span>Скопіювати</span>
                                        {/if}
                                    </button>
                                </div>
                            {:else}
                                <p class="text-xs text-stone-500">Схема для iOS не вказана.</p>
                            {/if}
                        </div>

                        <!-- 3. Android Intent -->
                        <div class="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-2">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full {urls.android_intent ? 'bg-amber-400' : 'bg-stone-600'}"></span>
                                    <span class="text-xs font-bold text-stone-200">3. Android Intent ({bank.android_package || 'пакет не вказано'})</span>
                                </div>
                            </div>

                            {#if urls.android_intent}
                                <div class="p-2.5 bg-stone-900 rounded-xl font-mono text-xs text-stone-300 break-all select-all mb-2">
                                    {urls.android_app_link || urls.android_intent}
                                </div>

                                <div class="flex flex-wrap items-center gap-2 pt-1">
                                    <!-- Головна кнопка: Відкрити (Launch) нативний <a> лінк, що працює як Web Button -->
                                    <a
                                        href={urls.android_app_link || urls.android_intent}
                                        class="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-600/30 active:scale-95"
                                    >
                                        <Play size={13} fill="currentColor" />
                                        <span>Відкрити в Android додатку</span>
                                        <ArrowUpRight size={13} />
                                    </a>

                                    <!-- Кнопка копіювання -->
                                    <button
                                        onclick={() => copyToClipboard((urls.android_app_link || urls.android_intent)!, 'intent')}
                                        class="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                                    >
                                        {#if copiedKey === 'intent'}
                                            <Check size={12} class="text-emerald-400" />
                                            <span class="text-emerald-400">Скопійовано!</span>
                                        {:else}
                                            <Copy size={12} />
                                            <span>Скопіювати Intent</span>
                                        {/if}
                                    </button>
                                </div>

                                <div class="flex flex-wrap items-center gap-2 pt-2">
                                    <a
                                        href={urls.android_intent}
                                        class="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-amber-600/30 active:scale-95"
                                    >
                                        <span>💳 intent {bank.name}</span>
                                    </a>

                                    <button
                                        type="button"
                                        onclick={() => copyToClipboard(generateHtmlButtonSnippet(urls.android_intent, bank.name, bank.color), 'html-button')}
                                        class="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                                    >
                                        {#if copiedKey === 'html-button'}
                                            <Check size={12} class="text-emerald-400" />
                                            <span class="text-emerald-400">Скопійовано!</span>
                                        {:else}
                                            <Copy size={12} />
                                            <span>Скопіювати HTML</span>
                                        {/if}
                                    </button>
                                </div>
                            {:else}
                                <p class="text-xs text-stone-500">Android Intent не налаштовано.</p>
                            {/if}
                        </div>

                        <!-- 4. Web Gateway HTTPS -->
                        <div class="bg-stone-950 border border-stone-800 rounded-2xl p-4 space-y-2">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                                    <span class="text-xs font-bold text-stone-200">4. Шлюз Web HTTPS ({bank.domain_prefix})</span>
                                </div>
                            </div>

                            <div class="p-2.5 bg-stone-900 rounded-xl font-mono text-xs text-stone-300 break-all select-all">
                                {urls.web_https}
                            </div>
                            <div class="flex items-center gap-2 pt-1">
                                <a
                                    href={urls.web_https}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
                                >
                                    <Globe size={12} />
                                    <span>Відкрити в браузері</span>
                                    <ArrowUpRight size={12} />
                                </a>
                                <button
                                    onclick={() => copyToClipboard(urls.web_https!, 'web')}
                                    class="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer"
                                >
                                    {#if copiedKey === 'web'}
                                        <Check size={12} class="text-emerald-400" />
                                        <span class="text-emerald-400">Скопійовано!</span>
                                    {:else}
                                        <Copy size={12} />
                                        <span>Скопіювати</span>
                                    {/if}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Test Outcome Assessment Bar -->
                    <div class="p-4 bg-stone-950 border border-stone-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div>
                            <span class="text-xs font-semibold text-stone-200 block">Фіксація результату тестування</span>
                            <span class="text-[11px] text-stone-400">Зберігає статус у колонку last_test_result таблиці banklink</span>
                        </div>

                        <div class="flex items-center gap-2">
                            {#if testFeedback}
                                <span class="text-xs text-emerald-400 font-medium mr-2">{testFeedback}</span>
                            {/if}
                            <button
                                onclick={() => recordTestResult('success')}
                                disabled={isRecording}
                                class="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                            >
                                <ThumbsUp size={14} />
                                <span>Працює (Success)</span>
                            </button>
                            <button
                                onclick={() => recordTestResult('fail')}
                                disabled={isRecording}
                                class="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-400 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                            >
                                <ThumbsDown size={14} />
                                <span>Помилка (Fail)</span>
                            </button>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- TAB 2: PAYLOAD INSPECTOR -->
            {#if activeTab === 'PAYLOAD'}
                <div class="space-y-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                                Розбивка рядків NBU {bank.nbu_version} ({payload.fields.length} полів)
                            </h3>
                            <p class="text-xs text-stone-400">Кодування: {bank.encoding === '2' ? 'Windows-1251' : 'UTF-8'} • Розмір: {payload.rawSize} байт (payload: {payload.encodedSize} символів)</p>
                        </div>

                        <button
                            onclick={() => overrides = {}}
                            class="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            <RotateCcw size={13} />
                            <span>Скинути підміни полів</span>
                        </button>
                    </div>

                    <!-- Breakdown Table -->
                    <div class="border border-stone-800 rounded-2xl overflow-hidden bg-stone-950">
                        <table class="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr class="border-b border-stone-800 bg-stone-900/60 text-stone-400 font-mono">
                                    <th class="p-3 w-12 text-center">#</th>
                                    <th class="p-3 w-64">Опис поля NBU</th>
                                    <th class="p-3">Значення поля (можна редагувати)</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-stone-800/60 font-mono">
                                {#each payload.fields as fieldVal, idx}
                                    <tr class="hover:bg-stone-900/40">
                                        <td class="p-3 text-center text-stone-500 font-bold">{idx + 1}</td>
                                        <td class="p-3 text-stone-400 font-sans">{FIELD_LABELS[idx] || `Поле ${idx + 1}`}</td>
                                        <td class="p-2">
                                            <input
                                                type="text"
                                                value={fieldVal}
                                                oninput={(e) => {
                                                    overrides[idx] = (e.target as HTMLInputElement).value;
                                                }}
                                                class="w-full bg-stone-900 border {overrides[idx] !== undefined ? 'border-amber-500 text-amber-300' : 'border-stone-800 text-stone-200'} rounded-lg px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                                            />
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>

                    <!-- Base64URL & Raw String -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-semibold text-stone-300">Строка ініціалізації NBU (\\n)</span>
                                <button
                                    onclick={() => copyToClipboard(payload.payloadStr, 'raw')}
                                    class="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                                >
                                    {#if copiedKey === 'raw'}<Check size={12} />{:else}<Copy size={12} />{/if}
                                    <span>Копіювати</span>
                                </button>
                            </div>
                            <pre class="p-3 bg-stone-950 border border-stone-800 rounded-xl font-mono text-[11px] text-stone-400 h-44 overflow-y-auto whitespace-pre-wrap">{payload.payloadStr}</pre>
                        </div>

                        <div class="space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-semibold text-stone-300">Base64URL Payload для банку</span>
                                <button
                                    onclick={() => copyToClipboard(payload.encodedPayload, 'b64')}
                                    class="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                                >
                                    {#if copiedKey === 'b64'}<Check size={12} />{:else}<Copy size={12} />{/if}
                                    <span>Копіювати</span>
                                </button>
                            </div>
                            <textarea
                                readonly
                                class="w-full p-3 bg-stone-950 border border-stone-800 rounded-xl font-mono text-[11px] text-emerald-400 h-44 overflow-y-auto select-all focus:outline-none"
                            >{payload.encodedPayload}</textarea>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- TAB 3: LIVE QR CODE -->
            {#if activeTab === 'QR'}
                <div class="flex flex-col items-center justify-center py-6 space-y-6 text-center">
                    <div>
                        <h3 class="text-lg font-bold text-white mb-1">
                            QR-код для оплати через {bank.name}
                        </h3>
                        <p class="text-xs text-stone-400 max-w-md">
                            Наведіть камеру смартфона або сканер у додатку банку, щоб перевірити миттєве зчитування реквізитів
                        </p>
                    </div>

                    <!-- QR Canvas container -->
                    <div class="p-4 bg-white rounded-3xl shadow-2xl shadow-black/60 inline-block">
                        <canvas bind:this={qrCanvas} class="rounded-xl"></canvas>
                    </div>

                    <div class="flex items-center gap-3">
                        <button
                            onclick={downloadQrPng}
                            class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
                        >
                            <span>Завантажити QR (PNG)</span>
                        </button>
                        <button
                            onclick={() => copyToClipboard(urls.web_https || '', 'qr-link')}
                            class="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                            {#if copiedKey === 'qr-link'}
                                <Check size={14} class="text-emerald-400" />
                                <span class="text-emerald-400">Посилання скопійовано!</span>
                            {:else}
                                <Copy size={14} />
                                <span>Скопіювати лінк QR</span>
                            {/if}
                        </button>
                    </div>

                    <div class="max-w-md bg-stone-950 border border-stone-800 rounded-2xl p-4 text-left text-xs space-y-1.5 text-stone-400">
                        <span class="font-bold text-stone-200 block mb-1">Зміст QR-коду:</span>
                        <p class="font-mono text-[11px] text-blue-400 break-all select-all">
                            {urls.web_https || `${bank.domain_prefix}${payload.encodedPayload}`}
                        </p>
                    </div>
                </div>
            {/if}

            <!-- TAB 4: SPECIFICATION & JSON -->
            {#if activeTab === 'HISTORY'}
                <div class="space-y-4">
                    <h3 class="text-xs font-semibold uppercase tracking-wider text-stone-400">
                        Повний JSON конфігурації банку
                    </h3>
                    <pre class="p-4 bg-stone-950 border border-stone-800 rounded-2xl font-mono text-xs text-stone-300 overflow-x-auto select-all">{JSON.stringify(bank, null, 2)}</pre>
                </div>
            {/if}
        </div>
    </div>
</div>

{#if showRedirectModal}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div class="bg-stone-900 border border-stone-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-center relative">
            <button
                onclick={() => { showRedirectModal = false; }}
                class="absolute top-4 right-4 p-2 text-stone-400 hover:text-white rounded-full hover:bg-stone-800 transition-all cursor-pointer"
                aria-label="Закрити"
            >
                <X size={16} />
            </button>

            <div class="flex flex-col items-center gap-3 pt-2">
                <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg" style="background-color: {bank.color || '#3b82f6'}">
                    {#if bank.logo}
                        <img src={bank.logo} alt={bank.name} class="w-10 h-10 object-contain" />
                    {:else}
                        {bank.code.substring(0, 2)}
                    {/if}
                </div>
                <div>
                    <h4 class="text-base font-bold text-white">{bank.name}</h4>
                    <p class="text-xs text-amber-400 flex items-center justify-center gap-1.5 mt-1 font-mono">
                        <RefreshCw size={12} class="animate-spin" />
                        Виконується редірект у додаток...
                    </p>
                </div>
            </div>

            <div class="p-3 bg-stone-950/80 rounded-2xl border border-stone-800 text-xs text-stone-300 text-left space-y-1.5 font-mono">
                <div class="text-[10px] text-stone-500 uppercase tracking-wider">Android Intent Target</div>
                <div class="text-[11px] text-amber-300/90 break-all select-all">{urls.android_intent}</div>
            </div>

            <div class="space-y-2 pt-2">
                <button
                    type="button"
                    onclick={() => triggerDirectRedirect(urls.android_intent)}
                    class="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-amber-600/30 active:scale-98 transition-all cursor-pointer"
                >
                    <ArrowUpRight size={16} />
                    <span>Відкрити додаток банку</span>
                </button>

                {#if bank.playstore_url}
                    <a
                        href={bank.playstore_url}
                        target="_blank"
                        rel="noreferrer"
                        class="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                        <Play size={14} />
                        <span>Відкрити в Google Play</span>
                    </a>
                {/if}

                <button
                    type="button"
                    onclick={() => { showRedirectModal = false; }}
                    class="w-full py-2 text-stone-400 hover:text-stone-200 text-xs transition-colors cursor-pointer"
                >
                    Скасувати / Назад
                </button>
            </div>
        </div>
    </div>
{/if}
