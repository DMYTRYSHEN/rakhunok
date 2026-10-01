<script lang="ts">
    import { onMount } from 'svelte';
    import { Building2, CheckCircle2, CheckSquare, DatabaseBackup, FlaskConical, LogOut, Moon, Plus, RefreshCw, Search, SlidersHorizontal, Sun, Zap } from '@lucide/svelte';
    import type { BankEntry } from '../types';
    import { BankLinkStore, DEFAULT_BANKS, supabase } from '../services/banklink-store';
    import BankConfiguratorModal from './BankConfiguratorModal.svelte';
    import BankTester from './BankTester.svelte';

    interface Props {
        theme: 'light' | 'dark';
        onThemeToggle: () => void;
        onLogout: () => void;
    }

    let { theme, onThemeToggle, onLogout }: Props = $props();
    let bankList = $state<BankEntry[]>([]);
    let selectedBank = $state<BankEntry | null>(null);
    let isLoading = $state(true);
    let isSyncing = $state(false);
    let syncMessage = $state('');
    let syncFailed = $state(false);
    let search = $state('');
    let filterActive = $state(false);
    let filterChecked = $state(false);
    let toastMessage = $state<string | null>(null);
    let failedLogos = $state<Record<string, boolean>>({});
    let mobileView = $state<'banks' | 'config' | 'test'>('banks');

    onMount(loadBanks);

    async function syncToD1() {
        if (isSyncing) return;
        isSyncing = true;
        syncFailed = false;
        syncMessage = 'Синхронізація з D1…';
        const errors: Record<string, string> = {
            sync_not_configured: 'D1 ще не налаштовано на сервері.',
            authentication_required: 'Сесія недійсна. Увійдіть повторно.',
            sync_forbidden: 'Для цього облікового запису синхронізацію не дозволено.',
            origin_not_allowed: 'Адресу запиту синхронізації не дозволено.',
            auth_unavailable: 'Не вдалося перевірити сесію. Спробуйте пізніше.',
            source_unavailable: 'Не вдалося прочитати banklink або перевищено ліміт 1,5 МБ.',
            source_incomplete_or_empty: 'Джерело порожнє, неповне або містить понад 500 банків.',
            source_invalid: 'У banklink є некоректні або дубльовані записи.',
            snapshot_storage_unavailable: 'Не вдалося зберегти знімок у D1.'
        };
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error || !data.session?.access_token) throw new Error(errors.authentication_required);
            const response = await fetch('/conf/api/banks/sync', {
                method: 'POST',
                headers: { Authorization: `Bearer ${data.session.access_token}` },
                cache: 'no-store',
                redirect: 'error',
                signal: AbortSignal.timeout(45_000)
            });
            if (!response.headers.get('Content-Type')?.includes('application/json')) {
                throw new Error('Сервер синхронізації недоступний.');
            }
            const result = await response.json();
            if (!response.ok) throw new Error(errors[result?.error] ?? 'Синхронізацію не виконано.');
            if (!['imported', 'unchanged'].includes(result?.status) ||
                !Number.isInteger(result?.snapshot?.bank_count) || result.snapshot.bank_count < 1 ||
                typeof result.snapshot.content_hash !== 'string' || !/^[a-f0-9]{64}$/.test(result.snapshot.content_hash)) {
                throw new Error('Сервер повернув некоректний результат синхронізації.');
            }
            syncMessage = `${result.status === 'imported' ? 'Збережено в D1' : 'D1: без змін'}: ${result.snapshot.bank_count} банків. Знімок ${result.snapshot.content_hash.slice(0, 12)}.`;
        } catch (error) {
            syncFailed = true;
            syncMessage = error instanceof Error && !['AbortError', 'TimeoutError', 'TypeError'].includes(error.name)
                ? error.message : 'Зв’язок перервано. Результат невідомий; повторіть синхронізацію.';
        } finally {
            isSyncing = false;
        }
    }

    async function loadBanks() {
        isLoading = true;
        try {
            bankList = await BankLinkStore.getAll();
        } catch (error) {
            console.error('Failed to load banks:', error);
            bankList = [...DEFAULT_BANKS];
        } finally {
            selectedBank = bankList.find((bank) => bank.id === selectedBank?.id) ?? bankList[0] ?? null;
            isLoading = false;
        }
    }

    function showToast(message: string) {
        toastMessage = message;
        setTimeout(() => {
            if (toastMessage === message) toastMessage = null;
        }, 2500);
    }

    function createBank() {
        selectedBank = {
            id: `bank-${Date.now()}`,
            code: 'NEWB',
            name: 'Новий Банк',
            nbu_version: '003',
            encoding: '1',
            nbu_function: 'ICT',
            domain_prefix: 'https://qr.bank.gov.ua/',
            android_package: null,
            ios_scheme: null,
            universal_link: null,
            universal_link2: null,
            url_template: null,
            alternative_url: null,
            extra_links: null,
            routing_mode: 'universal_link',
            logo: null,
            color: '#3b82f6',
            active: true,
            checked: false,
            verified: false,
            mode: 'deeplink'
        };
        mobileView = 'config';
    }

    function selectBank(bank: BankEntry) {
        selectedBank = bank;
        mobileView = 'config';
    }

    function saveBank(saved: BankEntry) {
        const originalIndex = bankList.findIndex((bank) => bank.id === selectedBank?.id);
        if (originalIndex >= 0) bankList[originalIndex] = saved;
        else bankList = [saved, ...bankList];
        selectedBank = saved;
        showToast(`Банк ${saved.name} збережено`);
    }

    function deleteBank(deletedId: string) {
        bankList = bankList.filter((bank) => bank.id !== deletedId);
        selectedBank = bankList[0] ?? null;
        showToast('Банк видалено');
    }

    let filteredBanks = $derived(bankList.filter((bank) => {
        const query = search.trim().toLowerCase();
        const matchesSearch = !query || bank.name.toLowerCase().includes(query) ||
            bank.code.toLowerCase().includes(query) || bank.id.toLowerCase().includes(query);
        return matchesSearch && (!filterActive || bank.active) && (!filterChecked || bank.checked);
    }));

    let activeCount = $derived(bankList.filter((bank) => bank.active).length);
</script>

<div class="conf-workbench">
    <aside class="bank-sidebar" class:mobile-active={mobileView === 'banks'}>
        <div class="sidebar-heading">
            <button class="sidebar-tab">Banks</button>
            <div class="heading-actions">
                <button
                    onclick={onThemeToggle}
                    class="icon-button"
                    title={theme === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
                    aria-label={theme === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
                >
                    {#if theme === 'dark'}<Sun size={16} />{:else}<Moon size={16} />{/if}
                </button>
                <button onclick={loadBanks} class="icon-button" title="Оновити з banklink">
                    <RefreshCw size={16} class={isLoading ? 'animate-spin' : ''} />
                </button>
                <button onclick={syncToD1} class="icon-button" title="Синхронізувати з D1" aria-label="Синхронізувати з D1" disabled={isSyncing} aria-busy={isSyncing}>
                    <DatabaseBackup size={16} class={isSyncing ? 'animate-pulse' : ''} />
                </button>
                <button onclick={onLogout} class="icon-button" title="Вийти">
                    <LogOut size={16} />
                </button>
            </div>
        </div>

        <div class="sync-status" class:failed={syncFailed} role="status" aria-live="polite" hidden={!syncMessage}>{syncMessage}</div>

        <div class="sidebar-search">
            <div class="search-field">
                <Search size={15} />
                <input bind:value={search} placeholder="Search banks..." />
            </div>
            <div class="filter-buttons">
                <button class:active={filterActive} onclick={() => filterActive = !filterActive} title="Тільки активні"><Zap size={14} /></button>
                <button class:active={filterChecked} onclick={() => filterChecked = !filterChecked} title="Тільки перевірені"><CheckSquare size={14} /></button>
            </div>
        </div>

        <div class="bank-list">
            {#each filteredBanks as bank (bank.id)}
                <button class="bank-row" class:selected={selectedBank?.id === bank.id} onclick={() => selectBank(bank)}>
                    <span class="bank-mark" style="background-color: {bank.color || '#334155'}">
                        {#if bank.logo && !failedLogos[bank.id]}
                            <img src={bank.logo} alt="" onerror={() => failedLogos[bank.id] = true} />
                        {:else}
                            {bank.code.slice(0, 4)}
                        {/if}
                    </span>
                    <span class="bank-copy">
                        <strong>{bank.name}</strong>
                        <span><b>{bank.code}</b>{bank.domain_prefix?.replace('https://', '').replace('/qr/', '') || 'No domain'}</span>
                    </span>
                    {#if bank.active}<span class="status-dot" title="Активний"></span>{/if}
                </button>
            {/each}
            {#if !isLoading && filteredBanks.length === 0}
                <p class="empty-list">Банків не знайдено</p>
            {/if}
        </div>

        <div class="sidebar-footer">
            <button class="add-bank" onclick={createBank}><Plus size={16} /> Add New Bank</button>
            <div class="bank-totals"><span>Total: {bankList.length}</span><span><i></i> Active: {activeCount}</span></div>
        </div>
    </aside>

    {#if selectedBank}
        <main class="editor-panel" class:mobile-active={mobileView === 'config'}>
            {#key selectedBank.id}
                <BankConfiguratorModal bank={selectedBank} embedded onClose={onLogout} onSaved={saveBank} onDeleted={deleteBank} />
            {/key}
        </main>
        <aside class="tools-panel" class:mobile-active={mobileView === 'test'}>
            {#key selectedBank.id}
                <BankTester
                    bank={selectedBank}
                    embedded
                    onClose={() => undefined}
                    onTestRecorded={(id, result) => {
                        const bank = bankList.find((item) => item.id === id);
                        if (bank) {
                            bank.last_test_result = result;
                            bank.last_test_at = new Date().toISOString();
                        }
                    }}
                />
            {/key}
        </aside>
    {:else}
        <main class="empty-workbench">Оберіть банк або створіть новий.</main>
    {/if}

    {#if toastMessage}
        <div class="conf-toast"><CheckCircle2 size={15} />{toastMessage}</div>
    {/if}

    <nav class="mobile-navigation" aria-label="Основна навігація">
        <button class:active={mobileView === 'banks'} onclick={() => mobileView = 'banks'}>
            <Building2 size={19} />
            <span>Банки</span>
        </button>
        <button class:active={mobileView === 'config'} onclick={() => mobileView = 'config'} disabled={!selectedBank}>
            <SlidersHorizontal size={19} />
            <span>Налаштування</span>
        </button>
        <button class:active={mobileView === 'test'} onclick={() => mobileView = 'test'} disabled={!selectedBank}>
            <FlaskConical size={19} />
            <span>Тест</span>
        </button>
    </nav>
</div>

<style>
    .sync-status { padding: 10px 14px; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; border-bottom: 1px solid var(--ios-line, #d1d5db); }
    .sync-status.failed { border-left: 3px solid #dc2626; }
    button:disabled { opacity: 0.5; cursor: wait; }
</style>
