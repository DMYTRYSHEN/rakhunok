import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { initializePwa } from './platform/pwa';
import { initializeTelegram } from './platform/telegram';

const app = mount(App, {
  target: document.getElementById('app')!
});

initializeTelegram();
initializePwa();

export default app;
