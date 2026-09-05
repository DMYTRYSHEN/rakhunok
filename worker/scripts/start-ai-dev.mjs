import { execSync, spawn } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(__dirname, '..');
const devVarsPath = resolve(workerDir, '.dev.vars');

function fetchAzureToken() {
	try {
		console.log('🔑 Отримання свіжого Entra ID токена через Azure CLI (az account get-access-token)...');
		const token = execSync(
			'az account get-access-token --resource https://ai.azure.com --query accessToken -o tsv',
			{ encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
		).trim();
		if (token) {
			console.log('✅ Токен успішно отримано!');
			return token;
		}
	} catch {
		console.warn('⚠️ Не вдалося отримати токен через "az account get-access-token". Перевірте az login або вкажіть ключ у .dev.vars');
	}
	return null;
}

function updateDevVars() {
	const token = fetchAzureToken();
	if (token) {
		const content = [
			`AZURE_BEARER_TOKEN=${token}`,
			`AZURE_HOST=rahunok-0252-resource.services.ai.azure.com`,
			`MODEL_NAME=gpt-5.6-sol`
		].join('\n');
		writeFileSync(devVarsPath, content, 'utf8');
		console.log('📝 Оновлено worker/.dev.vars з актуальним токеном.');
	}
}

// Initial token update
updateDevVars();

// Refresh token every 45 minutes in the background (wrangler auto-reloads .dev.vars)
setInterval(() => {
	updateDevVars();
}, 45 * 60 * 1000);

console.log('🚀 Запуск Wrangler AI Dev Server на порту 8787...');
const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const child = spawn(npxCmd, ['wrangler', 'dev', '-c', 'wrangler.ai.jsonc', '--port', '8787'], {
	cwd: workerDir,
	stdio: 'inherit',
	shell: true
});

child.on('exit', (code) => {
	process.exit(code ?? 0);
});
