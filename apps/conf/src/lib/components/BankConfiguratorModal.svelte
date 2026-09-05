<script lang="ts">
    import { X, Save, Trash2, Copy, AlertCircle, Smartphone, Globe, Shield, ImagePlus, Upload } from '@lucide/svelte';
    import type { BankEntry } from '../types';
    import { BankLinkStore } from '../services/banklink-store';

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

    async function handleSave() {
        isSaving = true;
        errorMessage = '';
        try {
            const saved = await BankLinkStore.save(localBank, originalId);
            onSaved(saved);
        } catch (e: any) {
            errorMessage = e?.message || 'Помилка при збереженні в базі даних';
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
                <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase" style="background-color: {localBank.color || '#3b82f6'}; color: #fff;">
                    {localBank.code || 'BNK'}
                </div>
                <div>
                    <h2 class="text-lg font-bold text-white leading-tight">
                        Редагування банку: {localBank.name}
                    </h2>
                    <p class="text-xs text-stone-400">ID: <span class="font-mono">{localBank.id}</span></p>
                </div>
            </div>

            <div class="flex items-center gap-2">
                <button
                    onclick={handleClone}
                    title="Створити копію"
                    class="p-2 text-stone-400 hover:text-stone-200 bg-stone-800 hover:bg-stone-700 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                    <Copy size={14} />
                    <span class="hidden sm:inline">Клонувати</span>
                </button>
                {#if !embedded}
                    <button
                        onclick={onClose}
                        class="p-2 text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-xl transition-all cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                {/if}
            </div>
        </div>

        {#if errorMessage}
            <div class="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
            </div>
        {/if}

        <!-- Body -->
        <div class="p-6 overflow-y-auto space-y-6 text-sm">
            <!-- Section 1: Basic Info -->
            <div class="brand-section">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-3 flex items-center gap-1.5">
                    <Globe size={14} />
                    <span>Основна інформація</span>
                </h3>
                <div class="brand-editor-layout">
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

                    <div class="brand-fields grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs text-stone-400 mb-1">ID (унікальний ключ)</label>
                        <input
                            type="text"
                            bind:value={localBank.id}
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label class="block text-xs text-stone-400 mb-1">Код банку (4 літери)</label>
                        <input
                            type="text"
                            maxlength="4"
                            bind:value={localBank.code}
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm font-mono uppercase focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label class="block text-xs text-stone-400 mb-1">Колір бренду</label>
                        <div class="flex gap-2 items-center">
                            <input
                                type="color"
                                bind:value={localBank.color}
                                class="w-9 h-9 bg-transparent border-0 rounded-lg cursor-pointer"
                            />
                            <input
                                type="text"
                                bind:value={localBank.color}
                                class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div class="sm:col-span-3">
                        <label class="block text-xs text-stone-400 mb-1">Повна назва банку</label>
                        <input
                            type="text"
                            bind:value={localBank.name}
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div class="sm:col-span-3">
                        <label class="block text-xs text-stone-400 mb-1" for="bank-logo-url">URL логотипа</label>
                        <div class="logo-url-field">
                            <ImagePlus size={15} />
                            <input
                                id="bank-logo-url"
                                type="url"
                                bind:value={localBank.logo}
                                oninput={() => logoLoadFailed = false}
                                placeholder="https://example.com/bank-logo.png"
                                class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                            />
                        </div>
                        <p class="logo-help">PNG, JPG або WebP. Для стабільної роботи рекомендовано квадратне зображення до 512 KB.</p>
                    </div>
                    </div>
                </div>
            </div>

            <!-- Section 2: NBU Protocol Standard -->
            <div class="border-t border-stone-800/80 pt-5">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-1.5">
                    <Shield size={14} />
                    <span>Стандарт протоколу НБУ</span>
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label class="block text-xs text-stone-400 mb-1">Версія стандарту</label>
                        <select
                            bind:value={localBank.nbu_version}
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="003">003 (ISO 20022 - 17 рядків)</option>
                            <option value="002">002 (Класичний - 12 рядків)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-stone-400 mb-1">Кодування символів</label>
                        <select
                            bind:value={localBank.encoding}
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="1">1 (UTF-8)</option>
                            <option value="2">2 (Windows-1251)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-stone-400 mb-1">Функція платежу</label>
                        <select
                            bind:value={localBank.nbu_function}
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="ICT">ICT (Миттєвий переказ СЕП-4)</option>
                            <option value="UCT">UCT (Кредитовий переказ)</option>
                        </select>
                    </div>
                    <div class="sm:col-span-3">
                        <label class="block text-xs text-stone-400 mb-1">Доменний префікс NBU QR</label>
                        <input
                            type="text"
                            bind:value={localBank.domain_prefix}
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            <!-- Section 3: Deep Link Routing -->
            <div class="border-t border-stone-800/80 pt-5">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-purple-400 mb-3 flex items-center gap-1.5">
                    <Smartphone size={14} />
                    <span>Маршрутизація та Deep Links</span>
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs text-stone-400 mb-1">Режим запуску (Routing Mode)</label>
                        <select
                            bind:value={localBank.routing_mode}
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="universal_link">Universal Link (iOS + Android)</option>
                            <option value="scheme">App Scheme URL</option>
                            <option value="intent">Android Intent</option>
                            <option value="redirect">Web Redirect (НБУ шлюз)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs text-stone-400 mb-1">Загальний режим (Mode)</label>
                        <select
                            bind:value={localBank.mode}
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        >
                            <option value="deeplink">Deeplink (Пряме відкриття застосунку)</option>
                            <option value="redirect">Redirect (Шлюз банку / NBU)</option>
                        </select>
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-xs text-stone-400 mb-1">Universal Link (Головне посилання iOS/Android)</label>
                        <input
                            type="text"
                            bind:value={localBank.universal_link}
                            placeholder="https://mbnk.app/qr/"
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label class="block text-xs text-stone-400 mb-1">Схема iOS (ios_scheme)</label>
                        <input
                            type="text"
                            bind:value={localBank.ios_scheme}
                            placeholder="mono"
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div>
                        <label class="block text-xs text-stone-400 mb-1">Пакет Android (android_package)</label>
                        <input
                            type="text"
                            bind:value={localBank.android_package}
                            placeholder="com.ftband.mono"
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-xs text-stone-400 mb-1">Шаблон URL (url_template із &#123;payload&#125;)</label>
                        <input
                            type="text"
                            bind:value={localBank.url_template}
                            placeholder="https://mbnk.app/qr/&#123;payload&#125;"
                            class="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            <!-- Section 4: Status Toggles -->
            <div class="border-t border-stone-800/80 pt-5">
                <h3 class="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-3">
                    Статуси та доступність
                </h3>
                <div class="flex flex-wrap gap-4">
                    <label class="flex items-center gap-2.5 bg-stone-950 border border-stone-800 px-4 py-2.5 rounded-xl cursor-pointer hover:border-stone-700">
                        <input type="checkbox" bind:checked={localBank.active} class="rounded border-stone-700 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer" />
                        <span class="text-xs font-medium">Активний (Active для клієнтів)</span>
                    </label>
                    <label class="flex items-center gap-2.5 bg-stone-950 border border-stone-800 px-4 py-2.5 rounded-xl cursor-pointer hover:border-stone-700">
                        <input type="checkbox" bind:checked={localBank.verified} class="rounded border-stone-700 text-emerald-600 focus:ring-0 w-4 h-4 cursor-pointer" />
                        <span class="text-xs font-medium">Перевірено (Verified)</span>
                    </label>
                    <label class="flex items-center gap-2.5 bg-stone-950 border border-stone-800 px-4 py-2.5 rounded-xl cursor-pointer hover:border-stone-700">
                        <input type="checkbox" bind:checked={localBank.checked} class="rounded border-stone-700 text-purple-600 focus:ring-0 w-4 h-4 cursor-pointer" />
                        <span class="text-xs font-medium">Ручна перевірка (Checked)</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-stone-800 flex items-center justify-between bg-stone-900/90 sticky bottom-0 z-10">
            <button
                onclick={handleDelete}
                disabled={isDeleting}
                class="px-4 py-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
                <Trash2 size={15} />
                <span>Видалити</span>
            </button>

            <div class="flex items-center gap-3">
                {#if !embedded}
                    <button
                        onclick={onClose}
                        class="px-4 py-2.5 text-xs text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-xl transition-all cursor-pointer"
                    >
                        Скасувати
                    </button>
                {/if}
                <button
                    onclick={handleSave}
                    disabled={isSaving}
                    class="px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                    <Save size={15} />
                    <span>{isSaving ? 'Збереження...' : 'Зберегти в banklink'}</span>
                </button>
            </div>
        </div>
    </div>
</div>
