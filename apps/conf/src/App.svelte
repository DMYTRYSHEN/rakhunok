<script lang="ts">
    import { onMount } from 'svelte';
    import type { User } from '@supabase/supabase-js';
    import AuthGate from './lib/auth/AuthGate.svelte';
    import BankManager from './lib/components/BankManager.svelte';
    import { supabase } from './lib/services/banklink-store';

    type Theme = 'light' | 'dark';

    let googleUser = $state<User | null>(null);
    let isChecking = $state<boolean>(true);
    let theme = $state<Theme>('dark');

    onMount(() => {
        let active = true;
        try {
            const savedTheme = localStorage.getItem('banklink_theme');
            theme = savedTheme === 'light' || savedTheme === 'dark'
                ? savedTheme
                : 'dark';
            document.documentElement.dataset.theme = theme;
        } catch {}

        const restoreSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (!active) return;
            googleUser = data.session?.user ?? null;
            isChecking = false;
        };
        void restoreSession();

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            googleUser = session?.user ?? null;
        });

        return () => {
            active = false;
            data.subscription.unsubscribe();
        };
    });

    async function handleGoogleLogin(credential: string, nonce: string) {
        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: credential,
            nonce
        });
        if (error) throw error;
        googleUser = data.user;
    }

    async function handleLogout() {
        googleUser = null;
        await supabase.auth.signOut();
    }

    function toggleTheme() {
        theme = theme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem('banklink_theme', theme);
        } catch {}
    }
</script>

{#if isChecking}
    <div class="min-h-screen bg-stone-950 flex items-center justify-center text-stone-500 text-xs font-mono">
        Ініціалізація BankLink...
    </div>
{:else if !googleUser}
    <AuthGate
        onGoogleLogin={handleGoogleLogin}
    />
{:else}
    <BankManager {theme} onThemeToggle={toggleTheme} onLogout={() => void handleLogout()} />
{/if}
