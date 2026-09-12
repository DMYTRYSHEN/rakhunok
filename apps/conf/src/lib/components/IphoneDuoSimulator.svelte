<script lang="ts">
    import {
        Smartphone, Globe, Wifi, Battery, ShieldCheck, Check,
        ExternalLink, Play, Copy, Sparkles, ArrowRight, Lock,
        RefreshCw, Layers, Store, QrCode, Zap, CheckCircle2,
        ChevronLeft, Share2, Info
    } from '@lucide/svelte';
    import type { BankEntry, TestFormData, BankUrls } from '../types';

    interface Props {
        bank: BankEntry;
        formData: TestFormData;
        urls: BankUrls;
        encodedPayload: string;
        onTestSuccess?: () => void;
    }

    let { bank, formData, urls, encodedPayload, onTestSuccess }: Props = $props();

    type ViewMode = 'safari' | 'bank_app' | 'store' | 'duo_android';
    let viewMode = $state<ViewMode>('bank_app');
    let isFaceIdActive = $state(false);
    let faceIdSuccess = $state(false);
    let dynamicIslandExpanded = $state(false);
    let copiedToast = $state(false);

    function triggerFaceId() {
        if (isFaceIdActive) return;
        isFaceIdActive = true;
        faceIdSuccess = false;
        dynamicIslandExpanded = true;

        setTimeout(() => {
            faceIdSuccess = true;
            if (onTestSuccess) onTestSuccess();
            setTimeout(() => {
                isFaceIdActive = false;
                setTimeout(() => {
                    dynamicIslandExpanded = false;
                }, 1500);
            }, 1200);
        }, 1000);
    }

    function copyLink(text: string) {
        if (!text) return;
        navigator.clipboard.writeText(text);
        copiedToast = true;
        setTimeout(() => { copiedToast = false; }, 2000);
    }

    let activeLink = $derived.by(() => {
        if (viewMode === 'safari') return urls.ios_universal || urls.web_https || '';
        if (viewMode === 'store') return bank.appstore_url || '';
        if (viewMode === 'duo_android') return urls.android_intent || bank.playstore_url || '';
        return urls.ios_scheme || urls.ios_universal || '';
    });
</script>

<div class="iphone-duo-container">
    <!-- View Switcher Tabs -->
    <div class="duo-modes-bar">
        <button
            class="duo-mode-btn"
            class:active={viewMode === 'bank_app'}
            onclick={() => { viewMode = 'bank_app'; }}
            title="Застосунок банку"
        >
            <Smartphone size={13} />
            <span>Bank App</span>
        </button>
        <button
            class="duo-mode-btn"
            class:active={viewMode === 'safari'}
            onclick={() => { viewMode = 'safari'; }}
            title="Safari Universal Link Prompt"
        >
            <Globe size={13} />
            <span>Safari Handshake</span>
        </button>
        <button
            class="duo-mode-btn"
            class:active={viewMode === 'store'}
            onclick={() => { viewMode = 'store'; }}
            title="App Store Preview"
        >
            <Store size={13} />
            <span>App Store</span>
        </button>
        <button
            class="duo-mode-btn"
            class:active={viewMode === 'duo_android'}
            onclick={() => { viewMode = 'duo_android'; }}
            title="Android Intent Duo"
        >
            <Layers size={13} />
            <span>Android Duo</span>
        </button>
    </div>

    <!-- Phone Hardware Frame Wrapper -->
    <div class="phone-frame-wrapper">
        <!-- Titanium iPhone 16 Pro Frame -->
        <div class="iphone-shell" class:android-shell={viewMode === 'duo_android'}>
            <!-- Physical Hardware Buttons -->
            <div class="hw-button hw-action"></div>
            <div class="hw-button hw-vol-up"></div>
            <div class="hw-button hw-vol-down"></div>
            <div class="hw-button hw-power"></div>

            <!-- Screen Area -->
            <div class="iphone-screen">
                <!-- Status Bar -->
                <div class="ios-status-bar">
                    <span class="ios-time">9:41</span>
                    <!-- Dynamic Island -->
                    <div
                        class="dynamic-island"
                        class:expanded={dynamicIslandExpanded}
                        onclick={() => dynamicIslandExpanded = !dynamicIslandExpanded}
                        role="button"
                        tabindex="0"
                        onkeydown={(e) => { if (e.key === 'Enter') dynamicIslandExpanded = !dynamicIslandExpanded; }}
                    >
                        {#if dynamicIslandExpanded}
                            <div class="island-expanded-content">
                                <div class="island-avatar" style="background-color: {bank.color || '#3b82f6'}">
                                    {#if bank.logo}
                                        <img src={bank.logo} alt="" />
                                    {:else}
                                        <span>{bank.code?.slice(0, 2) || 'BN'}</span>
                                    {/if}
                                </div>
                                <div class="island-info">
                                    <span class="island-title">{bank.name}</span>
                                    <span class="island-subtitle">{formData.amount} ₴ • NBU {bank.nbu_version}</span>
                                </div>
                                <div class="island-status">
                                    {#if faceIdSuccess}
                                        <CheckCircle2 size={16} class="text-emerald-400 animate-bounce" />
                                    {:else}
                                        <span class="island-pulse"></span>
                                    {/if}
                                </div>
                            </div>
                        {:else}
                            <div class="island-compact">
                                <span class="island-camera"></span>
                                <span class="island-sensor"></span>
                            </div>
                        {/if}
                    </div>
                    <div class="ios-icons">
                        <Wifi size={12} />
                        <span class="ios-5g">5G</span>
                        <div class="ios-battery">
                            <span class="battery-level"></span>
                        </div>
                    </div>
                </div>

                <!-- Screen Contents based on selected mode -->
                <div class="screen-body">
                    <!-- MODE 1: NATIVE BANK APP PAYMENT FLOW -->
                    {#if viewMode === 'bank_app'}
                        <div class="bank-app-view" style="--bank-brand: {bank.color || '#3b82f6'};">
                            <!-- App Header -->
                            <div class="bank-app-header">
                                <div class="bank-app-brand">
                                    <div class="bank-app-logo" style="background-color: {bank.color || '#3b82f6'};">
                                        {#if bank.logo}
                                            <img src={bank.logo} alt="" />
                                        {:else}
                                            <span>{bank.code?.slice(0, 4) || 'BANK'}</span>
                                        {/if}
                                    </div>
                                    <div>
                                        <h4>{bank.name}</h4>
                                        <span class="bank-app-badge">СЕП-4 Миттєвий переказ</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Payment Card -->
                            <div class="payment-amount-box">
                                <span class="amount-label">Сума до сплати</span>
                                <div class="amount-val">
                                    {formData.amount || '0.00'} <span class="amount-currency">₴</span>
                                </div>
                                <div class="sep-pill">
                                    <ShieldCheck size={12} />
                                    <span>Безпечний NBU QR-переказ</span>
                                </div>
                            </div>

                            <!-- Details Card -->
                            <div class="payment-details-card">
                                <div class="detail-row">
                                    <span class="d-label">Отримувач</span>
                                    <span class="d-val font-semibold">{formData.recipient || 'ТОВ ТЕСТ-СИСТЕМА'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="d-label">IBAN</span>
                                    <span class="d-val font-mono text-[10px]">{formData.iban || 'UA000000000000000000000000000'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="d-label">ЄДРПОУ</span>
                                    <span class="d-val font-mono">{formData.recipientCode || '12345678'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="d-label">Призначення</span>
                                    <span class="d-val text-[10px] truncate">{formData.purpose || 'Оплата послуг'}</span>
                                </div>
                                <div class="detail-row">
                                    <span class="d-label">Посилання</span>
                                    <span class="d-val font-mono text-[9px] text-blue-400">{bank.routing_mode}</span>
                                </div>
                            </div>

                            <!-- Biometric Action -->
                            <div class="biometric-box">
                                <button
                                    class="faceid-button"
                                    class:success={faceIdSuccess}
                                    onclick={triggerFaceId}
                                    disabled={isFaceIdActive}
                                >
                                    {#if faceIdSuccess}
                                        <Check size={18} />
                                        <span>Оплачено успішно</span>
                                    {:else if isFaceIdActive}
                                        <RefreshCw size={16} class="animate-spin" />
                                        <span>Face ID розпізнавання...</span>
                                    {:else}
                                        <Sparkles size={16} />
                                        <span>Підтвердити Face ID</span>
                                    {/if}
                                </button>
                                <span class="biometric-hint">Подвійний клік на бічній кнопці</span>
                            </div>
                        </div>

                    <!-- MODE 2: SAFARI / UNIVERSAL LINK PROMPT -->
                    {:else if viewMode === 'safari'}
                        <div class="safari-view">
                            <!-- Safari Search Bar -->
                            <div class="safari-bar">
                                <Lock size={11} class="text-stone-400" />
                                <span class="safari-url">bank.gov.ua/qr/{encodedPayload.slice(0, 16)}...</span>
                                <Share2 size={12} class="text-stone-400" />
                            </div>

                            <!-- Web Backdrop -->
                            <div class="safari-page">
                                <div class="qr-central-glow">
                                    <QrCode size={90} class="text-stone-700 dark:text-stone-300 opacity-20" />
                                </div>

                                <!-- Native iOS System Dialog Sheet -->
                                <div class="ios-system-sheet">
                                    <div class="sheet-icon" style="background-color: {bank.color || '#3b82f6'};">
                                        {#if bank.logo}
                                            <img src={bank.logo} alt="" />
                                        {:else}
                                            {bank.code?.slice(0, 4) || 'BNK'}
                                        {/if}
                                    </div>
                                    <h5>Відкрити в «{bank.name}»?</h5>
                                    <p>Платіж NBU BCD на суму <strong>{formData.amount} ₴</strong> для {formData.recipient}</p>
                                    <div class="sheet-actions">
                                        <button class="sheet-btn cancel" onclick={() => viewMode = 'bank_app'}>Скасувати</button>
                                        <button class="sheet-btn open" onclick={triggerFaceId}>Відкрити</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    <!-- MODE 3: APP STORE PRODUCT PAGE -->
                    {:else if viewMode === 'store'}
                        <div class="appstore-view">
                            <div class="appstore-top">
                                <span class="appstore-tag">App Store • Фінанси</span>
                                <div class="appstore-hero">
                                    <div class="appstore-icon" style="background-color: {bank.color || '#3b82f6'};">
                                        {#if bank.logo}
                                            <img src={bank.logo} alt="" />
                                        {:else}
                                            <span>{bank.code || 'BNK'}</span>
                                        {/if}
                                    </div>
                                    <div class="appstore-meta">
                                        <h4>{bank.name}</h4>
                                        <span class="appstore-dev">{bank.name} JSC</span>
                                        <span class="appstore-rating">★★★★★ 4.8 • 120 тис. оцінок</span>
                                    </div>
                                </div>
                                <div class="appstore-actions">
                                    <a
                                        href={bank.appstore_url || '#'}
                                        target="_blank"
                                        rel="noreferrer"
                                        class="appstore-get-btn"
                                    >
                                        ВІДКРИТИ
                                    </a>
                                    <button class="appstore-share-btn" onclick={() => copyLink(bank.appstore_url || '')}>
                                        <Share2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div class="appstore-details">
                                <div class="appstore-stat">
                                    <span class="stat-top">№ 1</span>
                                    <span class="stat-bot">в чартах</span>
                                </div>
                                <div class="appstore-stat">
                                    <span class="stat-top">4.8★</span>
                                    <span class="stat-bot">оцінка</span>
                                </div>
                                <div class="appstore-stat">
                                    <span class="stat-top">4+</span>
                                    <span class="stat-bot">вік</span>
                                </div>
                            </div>

                            <div class="appstore-card">
                                <span class="appstore-card-title">Apple App Store URL</span>
                                <div class="appstore-url-box">
                                    {bank.appstore_url || 'URL не вказано в banklink'}
                                </div>
                            </div>
                        </div>

                    <!-- MODE 4: ANDROID INTENT DUO VIEW -->
                    {:else if viewMode === 'duo_android'}
                        <div class="android-view">
                            <div class="android-intent-header">
                                <div class="android-pill">
                                    <Globe size={12} />
                                    <span>Google Play / Chrome Intent</span>
                                </div>
                            </div>

                            <div class="android-card">
                                <div class="android-app-badge" style="background-color: {bank.color || '#10b981'};">
                                    {#if bank.logo}
                                        <img src={bank.logo} alt="" />
                                    {:else}
                                        <span>{bank.code || 'AND'}</span>
                                    {/if}
                                </div>
                                <h4>{bank.name} (Android)</h4>
                                <span class="android-package-pill font-mono">{bank.android_package || 'com.bank.app'}</span>

                                <div class="android-details-box">
                                    <div class="detail-row">
                                        <span class="d-label">Intent Schema</span>
                                        <span class="d-val font-mono text-[10px]">intent://bank.gov.ua/qr/...</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="d-label">Package Name</span>
                                        <span class="d-val font-mono text-[10px]">{bank.android_package || '—'}</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="d-label">Play Store URL</span>
                                        <span class="d-val truncate text-[10px] text-emerald-400">{bank.playstore_url ? 'Налаштовано' : 'Не вказано'}</span>
                                    </div>
                                </div>

                                <div class="android-actions">
                                    {#if urls.android_intent}
                                        <button
                                            type="button"
                                            class="android-btn launch"
                                            onclick={() => {
                                                if (typeof window !== 'undefined' && urls.android_intent) {
                                                    window.location.href = urls.android_intent;
                                                }
                                            }}
                                        >
                                            <ExternalLink size={14} /> Редірект
                                        </button>
                                        <a
                                            href={urls.android_intent}
                                            class="android-btn"
                                        >
                                            <Play size={14} /> Прямий &lt;a&gt;
                                        </a>
                                    {/if}
                                    {#if bank.playstore_url}
                                        <a href={bank.playstore_url} target="_blank" rel="noreferrer" class="android-btn">
                                            <Play size={14} /> Google Play
                                        </a>
                                    {/if}
                                    <button class="android-btn secondary" onclick={() => copyLink(urls.android_intent || '')}>
                                        <Copy size={14} /> Копіювати Intent
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- iOS Home Indicator -->
                <div class="ios-home-indicator">
                    <span class="home-bar"></span>
                </div>
            </div>
        </div>
    </div>

    <!-- Bottom Quick Link Copier -->
    <div class="iphone-duo-footer">
        <div class="active-link-pill">
            <span class="link-label">{viewMode.toUpperCase()} LINK</span>
            <span class="link-text" title={activeLink}>{activeLink || 'Посилання відсутнє'}</span>
            <button class="link-copy-btn" onclick={() => copyLink(activeLink)} title="Скопіювати">
                {#if copiedToast}
                    <Check size={13} class="text-emerald-400" />
                {:else}
                    <Copy size={13} />
                {/if}
            </button>
        </div>
    </div>
</div>

<style>
    .iphone-duo-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-width: 100%;
        gap: 12px;
        user-select: none;
    }

    /* Mode selector bar */
    .duo-modes-bar {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        background: rgba(0, 0, 0, 0.05);
        border: 1px solid rgba(0, 0, 0, 0.06);
        border-radius: 14px;
        width: 100%;
        overflow-x: auto;
    }

    :global([data-theme="dark"]) .duo-modes-bar {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.08);
    }

    .duo-mode-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 6px 10px;
        border: none;
        border-radius: 10px;
        background: transparent;
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        transition: all 160ms ease;
        white-space: nowrap;
    }

    .duo-mode-btn:hover {
        color: #0f172a;
        background: rgba(0, 0, 0, 0.04);
    }

    :global([data-theme="dark"]) .duo-mode-btn:hover {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.08);
    }

    .duo-mode-btn.active {
        background: #ffffff;
        color: #0284c7;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
    }

    :global([data-theme="dark"]) .duo-mode-btn.active {
        background: #1e293b;
        color: #38bdf8;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    /* Hardware Shell */
    .phone-frame-wrapper {
        display: flex;
        justify-content: center;
        width: 100%;
        padding: 6px 0;
    }

    .iphone-shell {
        position: relative;
        width: 320px;
        height: 620px;
        background: #18181b;
        border-radius: 52px;
        box-shadow:
            0 0 0 4px #27272a,
            0 0 0 5px #3f3f46,
            0 25px 60px -15px rgba(0, 0, 0, 0.5),
            inset 0 0 0 2px rgba(255, 255, 255, 0.12);
        padding: 10px;
        display: flex;
        flex-direction: column;
    }

    .iphone-shell.android-shell {
        border-radius: 44px;
        box-shadow:
            0 0 0 4px #10b981,
            0 0 0 6px #065f46,
            0 25px 60px -15px rgba(0, 0, 0, 0.5);
    }

    /* Hardware buttons */
    .hw-button {
        position: absolute;
        background: #3f3f46;
        border-radius: 2px;
    }

    .hw-action { left: -7px; top: 100px; width: 3px; height: 26px; }
    .hw-vol-up { left: -7px; top: 140px; width: 3px; height: 46px; }
    .hw-vol-down { left: -7px; top: 198px; width: 3px; height: 46px; }
    .hw-power { right: -7px; top: 150px; width: 3px; height: 60px; }

    /* Screen display */
    .iphone-screen {
        width: 100%;
        height: 100%;
        background: #09090b;
        border-radius: 44px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        position: relative;
        color: #f4f4f5;
    }

    /* iOS Status Bar */
    .ios-status-bar {
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 22px;
        z-index: 20;
        position: relative;
    }

    .ios-time {
        font-size: 13px;
        font-weight: 700;
        letter-spacing: -0.2px;
        width: 40px;
    }

    .ios-icons {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        width: 50px;
        justify-content: flex-end;
    }

    .ios-5g {
        font-size: 9px;
        font-weight: 800;
    }

    .ios-battery {
        width: 20px;
        height: 10px;
        border: 1px solid rgba(255, 255, 255, 0.6);
        border-radius: 3px;
        padding: 1px;
        position: relative;
    }

    .ios-battery::after {
        content: '';
        position: absolute;
        right: -3px;
        top: 2px;
        width: 2px;
        height: 4px;
        background: rgba(255, 255, 255, 0.6);
        border-radius: 0 1px 1px 0;
    }

    .battery-level {
        display: block;
        height: 100%;
        width: 85%;
        background: #22c55e;
        border-radius: 1px;
    }

    /* Dynamic Island */
    .dynamic-island {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #000;
        border-radius: 18px;
        height: 28px;
        width: 105px;
        transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 30;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
    }

    .dynamic-island.expanded {
        width: 260px;
        height: 60px;
        border-radius: 26px;
        padding: 8px 12px;
    }

    .island-compact {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 0 12px;
    }

    .island-camera {
        width: 10px;
        height: 10px;
        background: #18181b;
        border-radius: 50%;
        box-shadow: inset 0 0 2px #3b82f6;
    }

    .island-sensor {
        width: 8px;
        height: 8px;
        background: #0f172a;
        border-radius: 50%;
    }

    .island-expanded-content {
        display: flex;
        align-items: center;
        width: 100%;
        gap: 10px;
    }

    .island-avatar {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        overflow: hidden;
        font-weight: 800;
        font-size: 11px;
        color: #fff;
    }

    .island-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .island-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .island-title {
        font-size: 11px;
        font-weight: 700;
        color: #fff;
        truncate: true;
    }

    .island-subtitle {
        font-size: 9px;
        color: #94a3b8;
    }

    .island-pulse {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 8px #22c55e;
        animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.6; }
    }

    /* Screen body */
    .screen-body {
        flex: 1;
        overflow-y: auto;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
    }

    /* Bank App View */
    .bank-app-view {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
    }

    .bank-app-header {
        padding: 6px 0;
    }

    .bank-app-brand {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .bank-app-logo {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: 11px;
        color: #fff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        overflow: hidden;
    }

    .bank-app-logo img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .bank-app-brand h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 800;
    }

    .bank-app-badge {
        font-size: 9px;
        color: #38bdf8;
        font-weight: 600;
    }

    .payment-amount-box {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.02));
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        padding: 16px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .amount-label {
        font-size: 10px;
        color: #94a3b8;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .amount-val {
        font-size: 28px;
        font-weight: 900;
        letter-spacing: -0.5px;
        color: #fff;
    }

    .amount-currency {
        font-size: 20px;
        font-weight: 700;
        color: #38bdf8;
    }

    .sep-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
        border-radius: 20px;
        font-size: 9px;
        font-weight: 700;
        margin-top: 4px;
    }

    .payment-details-card {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 18px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
    }

    .d-label {
        color: #94a3b8;
        font-size: 10px;
    }

    .d-val {
        color: #e2e8f0;
        max-width: 170px;
        text-align: right;
    }

    .biometric-box {
        margin-top: auto;
        padding-bottom: 6px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
    }

    .faceid-button {
        width: 100%;
        height: 46px;
        background: var(--bank-brand, #3b82f6);
        border: none;
        border-radius: 16px;
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        transition: all 200ms ease;
    }

    .faceid-button:hover {
        filter: brightness(1.1);
        transform: translateY(-1px);
    }

    .faceid-button.success {
        background: #22c55e;
    }

    .biometric-hint {
        font-size: 9px;
        color: #64748b;
    }

    /* Safari View */
    .safari-view {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 10px;
    }

    .safari-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        font-size: 10px;
        color: #94a3b8;
    }

    .safari-url {
        flex: 1;
        font-family: monospace;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .safari-page {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .qr-central-glow {
        position: absolute;
        top: 20%;
        opacity: 0.3;
    }

    .ios-system-sheet {
        position: relative;
        z-index: 10;
        background: rgba(28, 28, 30, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 24px;
        padding: 20px 16px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        width: 100%;
    }

    .sheet-icon {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        display: grid;
        place-items: center;
        color: #fff;
        font-weight: 800;
        font-size: 14px;
        overflow: hidden;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
    }

    .sheet-icon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .ios-system-sheet h5 {
        margin: 4px 0 0;
        font-size: 14px;
        font-weight: 750;
    }

    .ios-system-sheet p {
        margin: 0;
        font-size: 11px;
        color: #94a3b8;
        line-height: 1.4;
    }

    .sheet-actions {
        display: flex;
        gap: 8px;
        width: 100%;
        margin-top: 8px;
    }

    .sheet-btn {
        flex: 1;
        height: 38px;
        border-radius: 12px;
        border: none;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
    }

    .sheet-btn.cancel {
        background: rgba(255, 255, 255, 0.08);
        color: #94a3b8;
    }

    .sheet-btn.open {
        background: #0284c7;
        color: #fff;
    }

    /* App Store View */
    .appstore-view {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .appstore-tag {
        font-size: 9px;
        color: #38bdf8;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .appstore-hero {
        display: flex;
        gap: 12px;
        align-items: center;
    }

    .appstore-icon {
        width: 60px;
        height: 60px;
        border-radius: 16px;
        display: grid;
        place-items: center;
        color: #fff;
        font-weight: 800;
        overflow: hidden;
    }

    .appstore-icon img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .appstore-meta h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 800;
    }

    .appstore-dev {
        font-size: 10px;
        color: #94a3b8;
        display: block;
    }

    .appstore-rating {
        font-size: 9px;
        color: #f59e0b;
        display: block;
        margin-top: 2px;
    }

    .appstore-actions {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    .appstore-get-btn {
        flex: 1;
        height: 34px;
        background: #0284c7;
        color: #fff;
        border-radius: 17px;
        display: grid;
        place-items: center;
        font-size: 12px;
        font-weight: 800;
        text-decoration: none;
    }

    .appstore-share-btn {
        width: 34px;
        height: 34px;
        border-radius: 17px;
        background: rgba(255, 255, 255, 0.08);
        border: none;
        color: #94a3b8;
        display: grid;
        place-items: center;
        cursor: pointer;
    }

    .appstore-details {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding: 8px 0;
        text-align: center;
    }

    .stat-top {
        display: block;
        font-size: 13px;
        font-weight: 800;
    }

    .stat-bot {
        font-size: 9px;
        color: #64748b;
    }

    .appstore-card {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 14px;
        padding: 10px 12px;
        font-size: 10px;
    }

    .appstore-card-title {
        font-weight: 700;
        color: #94a3b8;
        display: block;
        margin-bottom: 4px;
    }

    .appstore-url-box {
        font-family: monospace;
        font-size: 9px;
        color: #38bdf8;
        word-break: break-all;
    }

    /* Android View */
    .android-view {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .android-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 700;
    }

    .android-card {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 8px;
    }

    .android-app-badge {
        width: 52px;
        height: 52px;
        border-radius: 16px;
        display: grid;
        place-items: center;
        color: #fff;
        font-weight: 800;
        overflow: hidden;
    }

    .android-app-badge img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .android-package-pill {
        font-size: 9px;
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.06);
        padding: 2px 8px;
        border-radius: 6px;
    }

    .android-details-box {
        width: 100%;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 12px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 4px;
    }

    .android-actions {
        display: flex;
        gap: 8px;
        width: 100%;
        margin-top: 8px;
    }

    .android-btn {
        flex: 1;
        height: 36px;
        border-radius: 12px;
        background: #10b981;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
        text-decoration: none;
        border: none;
        cursor: pointer;
    }

    .android-btn.secondary {
        background: rgba(255, 255, 255, 0.08);
        color: #e2e8f0;
    }

    .android-btn.launch {
        background: #f59e0b;
        color: #fff;
    }

    /* Home indicator */
    .ios-home-indicator {
        height: 20px;
        display: grid;
        place-items: center;
        margin-top: auto;
    }

    .home-bar {
        width: 110px;
        height: 4px;
        background: rgba(255, 255, 255, 0.6);
        border-radius: 2px;
    }

    /* Footer link copy */
    .iphone-duo-footer {
        width: 100%;
    }

    .active-link-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(0, 0, 0, 0.06);
        border-radius: 10px;
        font-size: 11px;
    }

    :global([data-theme="dark"]) .active-link-pill {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.06);
    }

    .link-label {
        font-size: 9px;
        font-weight: 800;
        color: #64748b;
        white-space: nowrap;
    }

    .link-text {
        flex: 1;
        font-family: monospace;
        font-size: 10px;
        color: #0284c7;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    :global([data-theme="dark"]) .link-text {
        color: #38bdf8;
    }

    .link-copy-btn {
        padding: 4px 6px;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: #64748b;
        cursor: pointer;
        display: grid;
        place-items: center;
    }

    .link-copy-btn:hover {
        background: rgba(0, 0, 0, 0.06);
        color: #0f172a;
    }

    :global([data-theme="dark"]) .link-copy-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
    }
</style>
