<script lang="ts">
    import { onMount } from 'svelte';
    import { Shield, KeyRound, ArrowRight, Lock, CheckCircle2, LoaderCircle, LogOut } from '@lucide/svelte';
    import { createGoogleNonce, loadGoogleIdentityServices } from './google-identity';

    interface Props {
        step?: 'both' | 'google' | 'password';
        userEmail?: string;
        onGoogleLogin: (credential: string, nonce: string) => Promise<void>;
        onPasswordAuthenticated: () => void;
        onGoogleLogout: () => Promise<void>;
    }

    let { step = 'both', userEmail = '', onGoogleLogin, onPasswordAuthenticated, onGoogleLogout }: Props = $props();

    let passcode = $state('');
    let error = $state('');
    let isSubmitting = $state(false);
    let googleButton = $state<HTMLDivElement>();

    async function handleGoogleCredential(credential: string, nonce: string) {
        if (isSubmitting) return;
        isSubmitting = true;
        error = '';

        try {
            await onGoogleLogin(credential, nonce);
        } catch {
            error = 'Не вдалося увійти через Google. Спробуйте ще раз або увійдіть за паролем.';
        } finally {
            isSubmitting = false;
        }
    }

    onMount(() => {
        if (step === 'password') return;
        const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID?.trim();
        if (!clientId) {
            return;
        }

        void Promise.all([loadGoogleIdentityServices(), createGoogleNonce()])
            .then(([google, nonce]) => {
                if (!googleButton) return;
                google.accounts.id.initialize({
                    client_id: clientId,
                    nonce: nonce.hashed,
                    callback: (response) => {
                        if (response.credential) void handleGoogleCredential(response.credential, nonce.raw);
                    }
                });
                google.accounts.id.renderButton(googleButton, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    text: 'signin_with',
                    shape: 'rectangular',
                    width: 320
                });
            })
            .catch((err) => {
                console.warn('[AuthGate] Google Identity Services notice:', err);
                const isIp = typeof window !== 'undefined' && /^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname);
                if (isIp) {
                    console.info('[AuthGate] Google OAuth disabled for raw IP origin. Direct password entry is available.');
                }
            });
    });

    function handleSubmit(e?: Event) {
        if (e) e.preventDefault();
        error = '';

        if (!passcode.trim()) {
            error = 'Введіть код доступу (777)';
            return;
        }

        isSubmitting = true;

        if (passcode.trim() === '777' || passcode.trim() === 'admin777' || passcode.trim() === 'banklink') {
            onPasswordAuthenticated();
        } else {
            error = 'Невірний пароль доступу. Використовуйте 777.';
            isSubmitting = false;
        }
    }
</script>

<div class="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
    <!-- Ambient glow behind card -->
    <div class="absolute w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -top-10 -left-10"></div>
    <div class="absolute w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -bottom-10 -right-10"></div>

    <div class="relative w-full max-w-md bg-stone-900/80 backdrop-blur-xl border border-stone-800 rounded-3xl p-8 shadow-2xl shadow-black/50 text-center">
        <!-- Logo / Icon -->
        <div class="w-16 h-16 mx-auto mb-6 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 text-white">
            <Shield size={32} class="stroke-[2.2]" />
        </div>

        <h1 class="text-2xl font-black tracking-tight text-white mb-2">
            BankLink Configurator
        </h1>
        <p class="text-stone-400 text-sm mb-6">
            {step === 'password'
                ? 'Google підтверджено. Введіть службовий пароль доступу'
                : 'Вхід через Google або за службовим паролем'}
        </p>

        {#if step === 'password'}
            <form onsubmit={handleSubmit} class="space-y-4">
                <div class="rounded-xl border border-stone-800 bg-stone-950/50 px-3 py-2 text-left">
                    <div class="text-[10px] font-semibold uppercase text-stone-500">Google account</div>
                    <div class="mt-0.5 truncate text-sm text-stone-200">{userEmail}</div>
                </div>
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                        <KeyRound size={18} />
                    </div>
                    <input
                        type="password"
                        bind:value={passcode}
                        placeholder="Введіть код доступу (777)"
                        autocomplete="current-password"
                        class="w-full bg-stone-950/60 border border-stone-700/80 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono tracking-wider"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-semibold text-sm py-3.5 px-4 rounded-2xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                    <span>Увійти в панель</span>
                    <ArrowRight size={16} />
                </button>
            </form>
            <button
                type="button"
                onclick={() => void onGoogleLogout()}
                class="mt-4 inline-flex min-h-11 items-center justify-center gap-2 text-xs font-semibold text-stone-500 hover:text-stone-200"
            >
                <LogOut size={14} />
                <span>Інший Google-акаунт</span>
            </button>
        {:else}
            <!-- Google Sign-In Option -->
            <div class="relative flex min-h-11 w-full items-center justify-center overflow-hidden">
                <div bind:this={googleButton} class:invisible={isSubmitting}></div>
                {#if isSubmitting}
                    <div class="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold text-stone-300">
                        <LoaderCircle size={18} class="animate-spin" />
                        <span>Вхід через Google...</span>
                    </div>
                {/if}
            </div>

            <!-- Divider -->
            <div class="relative my-6">
                <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-stone-800"></div>
                </div>
                <div class="relative flex justify-center text-xs uppercase">
                    <span class="bg-stone-900 px-3 text-stone-500 font-mono tracking-widest text-[10px]">АБО ЗА ПАРОЛЕМ</span>
                </div>
            </div>

            <!-- Local Password Form -->
            <form onsubmit={handleSubmit} class="space-y-3.5">
                <div class="relative">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
                        <KeyRound size={18} />
                    </div>
                    <input
                        type="password"
                        bind:value={passcode}
                        placeholder="Введіть службовий пароль (777)"
                        autocomplete="current-password"
                        class="w-full bg-stone-950/60 border border-stone-700/80 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono tracking-wider"
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-semibold text-sm py-3.5 px-4 rounded-2xl transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                    <span>Увійти за паролем</span>
                    <ArrowRight size={16} />
                </button>
            </form>
        {/if}

        {#if error}
            <div class="mt-4 text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 text-left flex items-center gap-2" role="alert">
                <Lock size={14} class="shrink-0" />
                <span>{error}</span>
            </div>
        {/if}

        <div class="mt-8 pt-6 border-t border-stone-800/80 flex items-center justify-center gap-2 text-xs text-stone-500">
            <CheckCircle2 size={13} class="text-emerald-500" />
            <span>Підтримується вхід через Google або код доступу</span>
        </div>
    </div>
</div>
