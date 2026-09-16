import { defineConfig } from '@playwright/test';

export default defineConfig({
	testMatch: 'apps/pay/**/*.e2e.ts',
	use: {
		baseURL: 'http://127.0.0.1:5198',
		viewport: { width: 390, height: 844 }
	},
	webServer: {
		command: 'npm --prefix apps/pay run dev -- --host 127.0.0.1 --port 5198',
		url: 'http://127.0.0.1:5198/pay/?demo=fuel_station',
		reuseExistingServer: false,
		timeout: 120_000
	},
	workers: 1
});
