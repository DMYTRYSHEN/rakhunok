<script lang="ts">
    import { onMount } from 'svelte';
    import { Shield, Lock, CheckCircle2, LoaderCircle } from '@lucide/svelte';
    import { createGoogleNonce, loadGoogleIdentityServices } from './google-identity';

    interface Props {
        onGoogleLogin: (credential: string, nonce: string) => Promise<void>;
    }

    let { onGoogleLogin }: Props = $props();

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
            error = 'Не вдалося увійти через Google. Спробуйте ще раз.';
        } finally {
            isSubmitting = false;
        }
    }

    onMount(() => {
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
            });
    });

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
        <p class="text-stone-400 text-sm mb-6">Увійдіть через Google, щоб продовжити</p>
        <div class="relative flex min-h-11 w-full items-center justify-center overflow-hidden">
            <div bind:this={googleButton} class:invisible={isSubmitting}></div>
            {#if isSubmitting}
                <div class="absolute inset-0 flex items-center justify-center gap-2 text-sm font-semibold text-stone-300">
                    <LoaderCircle size={18} class="animate-spin" />
                    <span>Вхід через Google...</span>
                </div>
            {/if}
        </div>

        {#if error}
            <div class="mt-4 text-xs text-rose-400 font-medium bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 text-left flex items-center gap-2" role="alert">
                <Lock size={14} class="shrink-0" />
                <span>{error}</span>
            </div>
        {/if}

        <div class="mt-8 pt-6 border-t border-stone-800/80 flex items-center justify-center gap-2 text-xs text-stone-500">
            <CheckCircle2 size={13} class="text-emerald-500" />
            <span>Google Auth</span>
        </div>
    </div>
</div>
