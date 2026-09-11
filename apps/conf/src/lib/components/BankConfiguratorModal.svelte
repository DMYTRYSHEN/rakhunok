<script lang="ts">
    import {
        X, Save, Trash2, Copy, AlertCircle, Smartphone, Globe, Shield,
        ImagePlus, Upload, ExternalLink, Store, RotateCcw, Loader2,
        QrCode, Route, Zap, CheckCircle2
    } from '@lucide/svelte';
    import type { BankEntry } from '../types';
    import { BankLinkStore } from '../services/banklink-store';
    import IphoneDuoSimulator from './IphoneDuoSimulator.svelte';
    import { generateTestPayload, buildBankUrls } from '../services/payload-builder';

    interface Props {
        bank: BankEntry;
        onClose: () => void;
        onSaved: (savedBank: BankEntry) => void;
        onDeleted: (deletedId: string) => void;
        embedded?: boolean;
    }

    let { bank, onClose, onSaved, onDeleted, embedded = false }: Props = $props();

    let localBank = $state<BankEntry>({ ...bank });
    let originalId = bank.id;
    let isSaving = $state(false);
    let isDeleting = $state(false);
    let errorMessage = $state('');
    let logoLoadFailed = $state(false);
    let saveToast = $state<{ status: 'idle' | 'success' | 'error'; message?: string }>({ status: 'idle' });
    let showIphoneDuoModal = $state(false);

    const sampleFormData = {
        recipient: 'ТОВ ТЕСТ-СИСТЕМА',
        iban: 'UA123456789012345678901234567',
        amount: '150.00',
        recipientCode: '12345678',
        purpose: 'Оплата за послуги тестування',
        function: 'ICT',
        isoCategory: 'EPAY',
        isoPurpose: 'MP2B',
        reference: 'TEST-REF-001',
        display: '',
        lockFields: 'FFFF',
        validUntil: ''
    };

    let previewPayload = $derived(generateTestPayload(localBank, sampleFormData));
    let previewUrls = $derived(buildBankUrls(localBank, previewPayload.encodedPayload));

    let isDirty = $derived(JSON.stringify(localBank) !== JSON.stringify(bank));

    function handleLogoUpload(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            errorMessage = 'Логотип має бути у форматі PNG, JPG або WebP';
            input.value = '';
            return;
        }

        if (file.size > 512 * 1024) {
            errorMessage = 'Розмір логотипа не може перевищувати 512 KB';
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            localBank.logo = typeof reader.result === 'string' ? reader.result : null;
            logoLoadFailed = false;
            errorMessage = '';
        };
        reader.onerror = () => {
            errorMessage = 'Не вдалося прочитати файл логотипа';
        };
        reader.readAsDataURL(file);
    }

    function clearLogo() {
        localBank.logo = null;
        logoLoadFailed = false;
    }

    function handleReset() {
        localBank = { ...bank };
        errorMessage = '';
        logoLoadFailed = false;
    }

    async function handleSave() {
        isSaving = true;
        errorMessage = '';
        saveToast = { status: 'idle' };
        try {
            const saved = await BankLinkStore.save(localBank, originalId);
            saveToast = { status: 'success', message: 'Збережено' };
            setTimeout(() => { if (saveToast.status === 'success') saveToast = { status: 'idle' }; }, 3000);
            onSaved(saved);
        } catch (e: any) {
            errorMessage = e?.message || 'Помилка при збереженні в базі даних';
            saveToast = { status: 'error', message: errorMessage };
            setTimeout(() => { if (saveToast.status === 'error') saveToast = { status: 'idle' }; }, 3500);
        } finally {
            isSaving = false;
        }
    }

    async function handleDelete() {
        if (!confirm(`Ви дійсно бажаєте видалити банк "${localBank.name}"?`)) return;
        isDeleting = true;
        try {
            await BankLinkStore.deleteBank(localBank.id);
            onDeleted(localBank.id);
        } catch (e: any) {
            errorMessage = e?.message || 'Помилка при видаленні';
            isDeleting = false;
        }
    }

    function handleClone() {
        localBank.id = `${localBank.id}-copy`;
        localBank.code = `${localBank.code}2`.slice(0, 4);
        localBank.name = `${localBank.name} (Копія)`;
        originalId = '';
    }
</script>

<div class={embedded ? 'embedded-editor h-full min-w-0' : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto'}>
    <div class={embedded ? 'h-full min-w-0 bg-white flex flex-col text-slate-700' : 'relative w-full max-w-4xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col text-stone-200'}>

        <!-- Header -->
        <div class="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/90 sticky top-0 z-10">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs uppercase shadow-lg" style="background-color: {localBank.color || '#3b82f6'}; color: #fff;">
                    {#if localBank.logo && !logoLoadFailed}
                        <img src={localBank.logo} alt="" class="w-full h-full object-cover rounded-2xl" onerror={() => logoLoadFailed = true} />
                    {:else}
                        {localBank.code?.slice(0, 2) || 'BN'}
                    {/if}
                </div>
                <div>
                    <h2 class="text-lg font-bold text-white leading-tight">
                        {localBank.name || 'Select a bank'}
                    </h2>
                    {#if localBank.active}
                        <span class="flex items-center text-[10px] font-bold tracking-wider text-emerald-400 uppercase gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Active Configuration
                        </span>
                    {:else}
                        <span class="flex items-center text-[10px] font-bold tracking-wider text-stone-500 uppercase gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-stone-500"></span>
                            Inactive
                        </span>
                    {/if}
                </div>
            </div>

            <div class="flex items-center gap-2">
                {#if saveToast.status !== 'idle'}
                    <div class="text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all {saveToast.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}">
                        {#if saveToast.status === 'success'}<CheckCircle2 size={14} />{:else}<AlertCircle size={14} />{/if}
                        <span>{saveToast.message}</span>
                    </div>
                {/if}
                <button
                    onclick={() => showIphoneDuoModal = true}
                    title="Live iPhone Duo Simulator"
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white transition-all cursor-pointer border border-stone-700/50 shadow-sm"
                >
                    <Smartphone size={14} class="text-blue-400" />
                    <span class="hidden sm:inline">iPhone Duo</span>
                </button>
                <button
                    onclick={handleClone}
                    title="Створити копію"
                    class="p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                    <Copy size={16} />
                </button>
                <button
                    onclick={handleDelete}
                    disabled={isDeleting}
                    class="p-2 text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                    <Trash2 size={16} />
                </button>
                <div class="w-px h-6 bg-stone-700 mx-1"></div>
                <button
                    onclick={handleReset}
                    disabled={!isDirty || isSaving}
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-sm transition-all cursor-pointer {isDirty && !isSaving ? 'text-stone-300 hover:bg-stone-800' : 'text-stone-600 cursor-not-allowed opacity-50'}"
                >
                    <RotateCcw size={14} />
                    <span class="hidden sm:inline text-xs">Reset</span>
                </button>
                <button
                    onclick={handleSave}
                    disabled={!isDirty || isSaving}
                    class="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm cursor-pointer {isDirty && !isSaving ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.97]' : 'bg-stone-800 text-stone-600 cursor-not-allowed'}"
                >
                    {#if isSaving}<Loader2 size={15} class="animate-spin" />{:else}<Save size={15} />{/if}
                    <span class="text-xs">{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
                {#if !embedded}
                    <button
                        onclick={onClose}
                        class="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition-all cursor-pointer ml-1"
                    >
                        <X size={18} />
                    </button>
                {/if}
            </div>
        </div>

        {#if errorMessage && saveToast.status === 'idle'}
            <div class="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
            </div>
        {/if}

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
            <div class="max-w-3xl mx-auto space-y-6 pb-20">

                <!-- ══════ CARD: General ══════ -->
                <div class="conf-card">
                    <div class="conf-card-header">
                        <h3><Globe size={15} /> General</h3>
                    </div>
                    <div class="p-5">
                        <div class="brand-editor-layout">
                            <!-- Logo Block -->
                            <div class="logo-editor">
                                <div class="logo-preview" style="background-color: {localBank.color || '#3b82f6'}">
                                    {#if localBank.logo && !logoLoadFailed}
                                        <img src={localBank.logo} alt="Логотип {localBank.name}" onerror={() => logoLoadFailed = true} />
                                    {:else}
                                        <span>{localBank.code || 'BNK'}</span>
                                    {/if}
                                </div>
                                <label class="logo-upload-button" for="bank-logo-file">
                                    <Upload size={14} />
                                    <span>Обрати файл</span>
                                </label>
                                <input
                                    id="bank-logo-file"
                                    class="sr-only"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onchange={handleLogoUpload}
                                />
                                {#if localBank.logo}
                                    <button type="button" class="logo-remove-button" onclick={clearLogo}>Прибрати</button>
                                {/if}
                            </div>

                            <!-- Fields -->
                            <div class="brand-fields space-y-4">
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="conf-label">System ID (Slug)</label>
                                        <input
                                            type="text"
                                            bind:value={localBank.id}
                                            oninput={(e) => { const el = e.currentTarget; el.value = el.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''); localBank.id = el.value; }}
                                            class="conf-input font-mono"
                                            placeholder="e.g. mono"
                                        />
                                    </div>
                                    <div>
                                        <label class="conf-label">NBU Code</label>
                                        <input
                                            type="text"
                                            maxlength="4"
                                            bind:value={localBank.code}
                                            oninput={(e) => { const el = e.currentTarget; el.value = el.value.toUpperCase(); localBank.code = el.value; }}
                                            class="conf-input font-mono uppercase"
                                            placeholder="MONO"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label class="conf-label">Bank Name</label>
                                    <input
                                        type="text"
                                        bind:value={localBank.name}
                                        class="conf-input font-semibold"
                                    />
                                </div>
                                <div class="flex items-center gap-3">
                                    <label class="conf-label mb-0 w-14">Color</label>
                                    <input
                                        type="color"
                                        bind:value={localBank.color}
                                        class="w-10 h-10 rounded-xl cursor-pointer border-0 p-0 bg-transparent shrink-0"
                                    />
                                    <input
                                        type="text"
                                        bind:value={localBank.color}
                                        class="conf-input w-28 font-mono"
                                    />
                                </div>
                                <div class="sm:col-span-3">
                                    <label class="conf-label" for="bank-logo-url">Logo URL</label>
                                    <div class="logo-url-field">
                                        <ImagePlus size={15} />
                                        <input
                                            id="bank-logo-url"
                                            type="url"
                                            bind:value={localBank.logo}
                                            oninput={() => logoLoadFailed = false}
                                            placeholder="https://example.com/bank-logo.png"
                                            class="conf-input font-mono !pl-9"
                                        />
                                    </div>
                                    <p class="logo-help">PNG, JPG або WebP. Квадратне зображення до 512 KB.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ══════ CARD: NBU BCD Protocol ══════ -->
                <div class="conf-card">
                    <div class="conf-card-header">
                        <h3 class="!text-emerald-400"><QrCode size={15} /> NBU BCD Protocol</h3>
                    </div>
                    <div class="p-5 grid grid-cols-3 gap-4">
                        <div>
                            <label class="conf-label">Version</label>
                            <select bind:value={localBank.nbu_version} class="conf-input">
                                <option value="003">v003 (ISO 20022)</option>
                                <option value="002">v002 (Legacy)</option>
                            </select>
                        </div>
                        <div>
                            <label class="conf-label">Encoding</label>
                            <select bind:value={localBank.encoding} class="conf-input">
                                <option value="1">1 — UTF-8</option>
                                <option value="2">2 — Windows-1251</option>
                            </select>
                        </div>
                        <div>
                            <label class="conf-label">Function</label>
                            <select bind:value={localBank.nbu_function} class="conf-input">
                                <option value="ICT">ICT (Internal)</option>
                                <option value="UCT">UCT (Universal)</option>
                                <option value="XCT">XCT (External)</option>
                            </select>
                        </div>
                        <div class="col-span-3">
                            <label class="conf-label">Domain Prefix</label>
                            <input
                                type="text"
                                bind:value={localBank.domain_prefix}
                                placeholder="https://qr.bank.gov.ua/"
                                class="conf-input font-mono"
                            />
                        </div>
                    </div>
                </div>

                <!-- ══════ CARDS: Platform Setup (2-column grid) ══════ -->
                <div class="grid grid-cols-2 gap-5">
                    <!-- iOS -->
                    <div class="conf-card">
                        <div class="conf-card-header">
                            <h3 class="!text-purple-400"><Smartphone size={15} /> iOS App Setup</h3>
                        </div>
                        <div class="p-5 space-y-4">
                            <div>
                                <label class="conf-label flex items-center justify-between">
                                    URL Scheme
                                    {#if localBank.ios_scheme}
                                        <span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">SET</span>
                                    {/if}
                                </label>
                                <div class="relative">
                                    <input
                                        type="text"
                                        bind:value={localBank.ios_scheme}
                                        placeholder="monobank"
                                        class="conf-input font-mono !pr-10"
                                    />
                                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 font-mono pointer-events-none">://</span>
                                </div>
                            </div>
                            <div>
                                <label class="conf-label flex items-center justify-between">
                                    Universal Link
                                    {#if localBank.universal_link?.startsWith('https://')}
                                        <span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">AASA OK</span>
                                    {/if}
                                </label>
                                <input
                                    type="text"
                                    bind:value={localBank.universal_link}
                                    placeholder="https://mbnk.app/qr/"
                                    class="conf-input font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Android -->
                    <div class="conf-card">
                        <div class="conf-card-header">
                            <h3 class="!text-green-400"><Globe size={15} /> Android App Setup</h3>
                        </div>
                        <div class="p-5 space-y-4">
                            <div>
                                <label class="conf-label flex items-center justify-between">
                                    Package Name
                                    {#if localBank.android_package?.includes('.')}
                                        <span class="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">VALID</span>
                                    {/if}
                                </label>
                                <input
                                    type="text"
                                    bind:value={localBank.android_package}
                                    placeholder="com.ftband.mono"
                                    class="conf-input font-mono"
                                />
                            </div>
                            <div>
                                <label class="conf-label">Intent URI Template</label>
                                <input
                                    type="text"
                                    bind:value={localBank.universal_link2}
                                    placeholder="intent://bank.gov.ua/qr/&#123;payload&#125;#Intent;..."
                                    class="conf-input font-mono text-[11px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ══════ CARD: Routing ══════ -->
                <div class="conf-card">
                    <div class="conf-card-header">
                        <h3 class="!text-amber-400"><Route size={15} /> Routing</h3>
                    </div>
                    <div class="p-5 space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="conf-label">Routing Mode</label>
                                <select bind:value={localBank.routing_mode} class="conf-input">
                                    <option value="universal_link">Universal Link</option>
                                    <option value="scheme">App Scheme</option>
                                    <option value="intent">Android Intent</option>
                                    <option value="redirect">Web Redirect</option>
                                    <option value="store_links">Store Links</option>
                                </select>
                            </div>
                            <div>
                                <label class="conf-label">General Mode</label>
                                <select bind:value={localBank.mode} class="conf-input">
                                    <option value="deeplink">Deeplink</option>
                                    <option value="redirect">Redirect</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label class="conf-label">URL Template <span class="text-stone-600 font-normal">(use &#123;payload&#125;)</span></label>
                            <input
                                type="text"
                                bind:value={localBank.url_template}
                                placeholder="https://mbnk.app/qr/&#123;payload&#125;"
                                class="conf-input font-mono"
                            />
                        </div>
                        <div>
                            <label class="conf-label">Alternative URL</label>
                            <input
                                type="text"
                                bind:value={localBank.alternative_url}
                                placeholder="mono://bank.gov.ua/qr/&#123;payload&#125;"
                                class="conf-input font-mono"
                            />
                        </div>
                        <div>
                            <label class="conf-label">Extra Links <span class="text-stone-600 font-normal">(separated by ;)</span></label>
                            <textarea
                                bind:value={localBank.extra_links}
                                placeholder="https://alt1.bank.com/&#123;payload&#125;;&#10;https://alt2.bank.com/&#123;payload&#125;"
                                rows="2"
                                class="conf-input font-mono resize-none !py-2.5"
                            ></textarea>
                        </div>
                    </div>
                </div>

                <!-- ══════ CARD: Store Links ══════ -->
                <div class="conf-card">
                    <div class="conf-card-header">
                        <h3 class="!text-cyan-400"><Store size={15} /> Store Links</h3>
                    </div>
                    <div class="p-5 space-y-4">
                        <div>
                            <label class="conf-label">App Store</label>
                            <div class="flex gap-2">
                                <input
                                    type="url"
                                    bind:value={localBank.appstore_url}
                                    placeholder="https://apps.apple.com/ua/app/..."
                                    class="conf-input font-mono flex-1"
                                />
                                {#if localBank.appstore_url}
                                    <a
                                        href={localBank.appstore_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        class="conf-link-button"
                                        title="Відкрити в App Store"
                                    >
                                        <ExternalLink size={15} />
                                    </a>
                                {/if}
                            </div>
                        </div>
                        <div>
                            <label class="conf-label">Google Play</label>
                            <div class="flex gap-2">
                                <input
                                    type="url"
                                    bind:value={localBank.playstore_url}
                                    placeholder="https://play.google.com/store/apps/details?id=..."
                                    class="conf-input font-mono flex-1"
                                />
                                {#if localBank.playstore_url}
                                    <a
                                        href={localBank.playstore_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        class="conf-link-button"
                                        title="Відкрити в Google Play"
                                    >
                                        <ExternalLink size={15} />
                                    </a>
                                {/if}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ══════ CARD: Status ══════ -->
                <div class="conf-card">
                    <div class="conf-card-header">
                        <h3 class="!text-amber-400"><Zap size={15} /> Status</h3>
                    </div>
                    <div class="p-5 flex flex-wrap gap-5">
                        <!-- Active toggle -->
                        <label class="conf-toggle-row">
                            <span>Active</span>
                            <div class="conf-toggle" class:on={localBank.active}>
                                <input type="checkbox" bind:checked={localBank.active} class="sr-only" />
                                <div class="conf-toggle-track" class:bg-blue-500={localBank.active}>
                                    <div class="conf-toggle-thumb"></div>
                                </div>
                            </div>
                        </label>
                        <!-- Verified toggle -->
                        <label class="conf-toggle-row">
                            <span>Verified</span>
                            <div class="conf-toggle" class:on={localBank.verified}>
                                <input type="checkbox" bind:checked={localBank.verified} class="sr-only" />
                                <div class="conf-toggle-track" class:bg-emerald-500={localBank.verified}>
                                    <div class="conf-toggle-thumb"></div>
                                </div>
                            </div>
                        </label>
                        <!-- Checked toggle -->
                        <label class="conf-toggle-row">
                            <span>Checked</span>
                            <div class="conf-toggle" class:on={localBank.checked}>
                                <input type="checkbox" bind:checked={localBank.checked} class="sr-only" />
                                <div class="conf-toggle-track" class:bg-purple-500={localBank.checked}>
                                    <div class="conf-toggle-thumb"></div>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

            </div>
        </div>

    </div>
</div>

{#if showIphoneDuoModal}
    <div class="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
        <div class="relative bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl max-h-[94vh] overflow-y-auto max-w-md w-full flex flex-col items-center text-stone-200">
            <div class="w-full flex items-center justify-between pb-3 border-b border-stone-800 mb-3">
                <div class="flex items-center gap-2">
                    <Smartphone size={18} class="text-blue-400" />
                    <h3 class="text-sm font-bold text-white uppercase tracking-wider">iPhone Duo Live Preview</h3>
                </div>
                <button
                    onclick={() => showIphoneDuoModal = false}
                    class="p-1.5 text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-xl transition-all cursor-pointer"
                >
                    <X size={16} />
                </button>
            </div>
            <IphoneDuoSimulator
                bank={localBank}
                formData={sampleFormData}
                urls={previewUrls}
                encodedPayload={previewPayload.encodedPayload}
            />
        </div>
    </div>
{/if}

<style>
    /* ─── Card base ─── */
    .conf-card {
        border: 1px solid rgb(255 255 255 / 0.06);
        border-radius: 1.25rem;
        background: rgb(255 255 255 / 0.04);
        backdrop-filter: blur(24px) saturate(150%);
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.12), 0 4px 16px rgb(0 0 0 / 0.06);
        overflow: hidden;
    }

    .conf-card-header {
        padding: 14px 20px;
        border-bottom: 1px solid rgb(255 255 255 / 0.05);
    }

    .conf-card-header h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        color: rgb(148 163 184);
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
    }

    /* ─── Inputs ─── */
    .conf-label {
        display: block;
        margin-bottom: 5px;
        color: rgb(148 163 184);
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .conf-input {
        width: 100%;
        min-height: 38px;
        padding: 8px 12px;
        border: 1px solid rgb(255 255 255 / 0.07);
        border-radius: 10px;
        background: rgb(0 0 0 / 0.25);
        color: rgb(226 232 240);
        font-size: 13px;
        outline: none;
        transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .conf-input:hover {
        border-color: rgb(255 255 255 / 0.14);
    }

    .conf-input:focus {
        border-color: rgb(96 165 250);
        box-shadow: 0 0 0 3px rgb(96 165 250 / 0.15);
        background: rgb(0 0 0 / 0.35);
    }

    .conf-input::placeholder {
        color: rgb(100 116 139 / 0.6);
    }

    /* ─── External link button ─── */
    .conf-link-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        flex-shrink: 0;
        border: 1px solid rgb(255 255 255 / 0.07);
        border-radius: 10px;
        background: rgb(255 255 255 / 0.04);
        color: rgb(148 163 184);
        transition: all 160ms ease;
    }

    .conf-link-button:hover {
        background: rgb(255 255 255 / 0.10);
        color: rgb(226 232 240);
        border-color: rgb(255 255 255 / 0.18);
    }

    /* ─── Toggle switches ─── */
    .conf-toggle-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        border: 1px solid rgb(255 255 255 / 0.06);
        border-radius: 12px;
        background: rgb(0 0 0 / 0.18);
        cursor: pointer;
        transition: background 160ms ease;
        user-select: none;
    }

    .conf-toggle-row:hover {
        background: rgb(0 0 0 / 0.28);
    }

    .conf-toggle-row > span {
        font-size: 12px;
        font-weight: 650;
        color: rgb(203 213 225);
    }

    .conf-toggle-track {
        position: relative;
        width: 44px;
        height: 24px;
        border-radius: 12px;
        background: rgb(100 116 139 / 0.35);
        transition: background 200ms ease;
    }

    .conf-toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
        transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .conf-toggle.on .conf-toggle-thumb {
        transform: translateX(20px);
    }

    /* ─── Embedded theme overrides (auto light via ios-2027.css) ─── */
    :global(.embedded-editor) .conf-card {
        border-color: var(--ios-line, rgb(0 0 0 / 0.08));
        background: var(--ios-surface-raised, rgb(255 255 255 / 0.92));
        backdrop-filter: blur(24px) saturate(150%);
        box-shadow: var(--ios-shadow-sm, 0 1px 2px rgb(0 0 0 / 0.04));
    }

    :global(.embedded-editor) .conf-card-header {
        border-bottom-color: var(--ios-line, rgb(0 0 0 / 0.08));
    }

    :global(.embedded-editor) .conf-card-header h3 {
        color: var(--ios-secondary, #65656d);
    }

    :global(.embedded-editor) .conf-label {
        color: var(--ios-secondary, #65656d) !important;
    }

    :global(.embedded-editor) .conf-input {
        border-color: var(--ios-line-strong, rgb(0 0 0 / 0.12)) !important;
        background: var(--ios-surface, #fff) !important;
        color: var(--ios-ink, #1c1c1f) !important;
        box-shadow: inset 0 1px 1px rgb(0 0 0 / 0.025);
    }

    :global(.embedded-editor) .conf-input:hover {
        border-color: var(--ios-tertiary, #8a8a93) !important;
    }

    :global(.embedded-editor) .conf-input:focus {
        border-color: var(--ios-blue, #5e6ad2) !important;
        box-shadow: 0 0 0 3px var(--ios-focus, rgb(94 106 210 / 0.18)) !important;
    }

    :global(.embedded-editor) .conf-link-button {
        border-color: var(--ios-line-strong, rgb(0 0 0 / 0.12));
        background: var(--ios-surface-subtle, #f2f2f4);
        color: var(--ios-secondary, #65656d);
    }

    :global(.embedded-editor) .conf-link-button:hover {
        background: var(--ios-surface-hover, #f5f5f6);
        color: var(--ios-ink, #1c1c1f);
    }

    :global(.embedded-editor) .conf-toggle-row {
        border-color: var(--ios-line, rgb(0 0 0 / 0.08));
        background: var(--ios-surface-subtle, #f2f2f4);
    }

    :global(.embedded-editor) .conf-toggle-row:hover {
        background: var(--ios-surface-hover, #f5f5f6);
    }

    :global(.embedded-editor) .conf-toggle-row > span {
        color: var(--ios-ink, #1c1c1f);
    }

    :global(.embedded-editor) .conf-toggle-track {
        background: var(--ios-line-strong, rgb(0 0 0 / 0.14));
    }

    /* ─── Responsive: stack iOS/Android on narrow ─── */
    @media (max-width: 700px) {
        .grid-cols-2 {
            grid-template-columns: 1fr !important;
        }

        .grid-cols-3 {
            grid-template-columns: 1fr !important;
        }
    }
</style>
