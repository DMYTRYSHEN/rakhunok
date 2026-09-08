import { mount } from 'svelte';
import './app.css';
const harnessBuild = import.meta.env.DEV && import.meta.env.VITE_CHECKOUT_SYNTHETIC === '1';
const requestedLocal = harnessBuild || location.hash.startsWith('#local=') || (location.hostname === '127.0.0.1' && location.port === '8792');
if (requestedLocal && (!harnessBuild || location.origin !== 'http://127.0.0.1:8792')) {
  throw new Error('Local checkout is unavailable here');
}
const { default: App } = harnessBuild
  ? location.pathname === '/diagnostics'
    ? await import('./LocalCheckout.svelte')
    : await import('./FixedInvoiceCheckout.svelte')
  : await import('./App.svelte');
const app = mount(App, {
  target: document.getElementById('app')!
});

export default app;
