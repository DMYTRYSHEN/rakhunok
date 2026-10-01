import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { readPlatformConfig } from './lib/config';

const target = document.getElementById('app');
if (!target) throw new Error('Platform mount target is missing.');

mount(App, {
	target,
	props: {
		config: readPlatformConfig(import.meta.env),
		demo: new URLSearchParams(window.location.search).get('demo') === '1',
		role: new URLSearchParams(window.location.search).get('role')
	}
});