<script lang="ts">
	import { resolve } from '$app/paths';
	import { Code2 } from '@lucide/svelte';
	let { origin }: { origin: string } = $props();
	const exampleId = '12345678-1234-1234-1234-123456789abc';
	const endpoint = resolve('/api/v1/shipments/[id]/refresh', { id: exampleId });
	const requestExample = $derived(`curl --request POST '${origin}${endpoint}' \\\n  --header 'Origin: ${origin}' \\\n  --header 'Authorization: Bearer YOUR_ACCESS_TOKEN'`);
	const publicEndpoint = resolve('/api/v1/tracking/[ttn]', { ttn: '20450000000000' });
	const publicRequest = $derived(`curl '${origin}${publicEndpoint}?carrier=nova_poshta'`);
	const publicResponse = JSON.stringify({ data: {
		carrier: 'nova_poshta', trackingNumber: '20450000000000',
		trackingState: 'active', deliveryStatus: 'in_transit',
		checkedAt: '2026-10-09T10:00:00.000Z', providerStatusCode: '5'
	} }, null, 2);
	const responseExample = JSON.stringify({ data: {
		id: exampleId, carrier: 'nova_poshta', trackingNumber: '20450000000000',
		trackingState: 'active', deliveryStatus: 'in_transit',
		providerStatusCode: '5', providerStatusLabel: 'Відправлення прямує до міста одержувача',
		lastCheckedAt: '2026-10-09T10:00:00.000Z', lastSuccessAt: '2026-10-09T10:00:00.000Z'
	} }, null, 2);
</script>

<section class="tracking-api-example" aria-labelledby="tracking-api-title">
	<h2 id="tracking-api-title"><Code2 size={20} /> API перевірки відправлення</h2>
	<h3>За ТТН · без авторизації</h3>
	<p>Публічна перевірка не потребує токена чи збереженого відправлення. Повертає лише статус, без імен, телефонів, адрес та історії подій.</p>
	<pre aria-label="Публічний запит curl"><code>{publicRequest}</code></pre>
	<pre aria-label="Публічна JSON-відповідь"><code>{publicResponse}</code></pre>
	<p><code>carrier</code> необов'язковий: <code>nova_poshta</code>, <code>ukrposhta</code> або <code>meest</code>. Без нього 14 цифр визначаються як Нова пошта, інші допустимі номери — як Укрпошта; для Meest вкажіть перевізника явно.</p>
	<p>Успішний результат кешується на 30 секунд. Ліміт — 30 нових звернень до перевізників за хвилину на процес, спільний із публічною сторінкою. HTTP 400 — некоректна ТТН або перевізник; 429 — ліміт, повторіть через 60 секунд; 503 — перевізник або сервіс недоступний. При HTTP 200 перевіряйте <code>trackingState</code>: лише <code>active</code> підтверджує новий статус.</p>
	<h3>За UUID · з авторизацією</h3>
	<p>Ідентифікатор відправлення: <code>data.id</code> із відповіді <code>GET /api/v1/shipments</code> або після додавання через <code>POST /api/v1/shipments</code>. Це UUID запису, а не номер накладної. Перевіряються лише ваші відправлення.</p>
	<h3>Запит</h3>
	<p>Замініть UUID на ідентифікатор свого відправлення, а <code>YOUR_ACCESS_TOKEN</code> на чинний токен входу. Запит виконує перевірку перевізника й оновлює збережений стан. Ключі перевізників налаштовуються в інтеграціях.</p>
	<pre aria-label="Приклад запиту curl"><code>{requestExample}</code></pre>
	<h3>Приклад відповіді · HTTP 200</h3>
	<pre aria-label="Приклад JSON-відповіді"><code>{responseExample}</code></pre>
	<dl>
		<div><dt>trackingState</dt><dd><code>active</code> означає підтверджену перевірку. <code>provider_unavailable</code>, <code>rate_limited</code> або <code>access_denied</code> не підтверджують новий статус доставки.</dd></div>
		<div><dt>deliveryStatus</dt><dd>Нормалізований статус, наприклад <code>in_transit</code>, <code>ready_for_pickup</code> або <code>delivered</code>. При збої перевірки може залишитися попередній підтверджений статус.</dd></div>
		<div><dt>Час перевірки</dt><dd><code>lastCheckedAt</code> — остання спроба; <code>lastSuccessAt</code> — остання успішна перевірка. HTTP 200 сам по собі не означає, що перевізник доступний.</dd></div>
		<div><dt>Помилки HTTP</dt><dd>400 — некоректний UUID; 401 — потрібен вхід; 403 — некоректний Origin; 409 — відправлення недоступне або вже перевіряється; 503 — збій сервісу.</dd></div>
	</dl>
</section>

<style>
	.tracking-api-example { border-top: 1px solid var(--color-border-default); margin-top: 32px; padding-top: 28px; min-width: 0; }
	h2 { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 650; }
	h3 { margin-top: 24px; font-size: 14px; font-weight: 650; }
	p, dd { font-size: 13px; line-height: 1.7; color: var(--color-text-secondary); overflow-wrap: anywhere; }
	p { margin-top: 12px; max-width: 900px; }
	pre { max-width: 100%; overflow-x: auto; padding: 16px; margin-top: 12px; border: 1px solid var(--color-border-default); border-radius: 6px; background: var(--color-brand-50); font-size: 12px; line-height: 1.7; }
	code { font-family: monospace; }
	dl { margin-top: 20px; }
	dl > div { padding: 12px 0; border-bottom: 1px solid var(--color-border-default); }
	dt { font-size: 13px; font-weight: 650; margin-bottom: 6px; }
</style>