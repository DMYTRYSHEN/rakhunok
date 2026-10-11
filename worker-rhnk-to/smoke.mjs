import { request } from 'node:https';

let fetchUrl = fetch;
if (process.argv.includes('--public-dns')) {
	const dnsResponse = await fetch('https://cloudflare-dns.com/dns-query?name=rhnk.to&type=A', {
		headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(15000)
	});
	const dns = await dnsResponse.json();
	const address = dns.Answer?.find(answer => answer.type === 1)?.data;
	if (!address) throw new Error('Public DNS has no apex IPv4 answer');
	fetchUrl = async (url, options) => {
		if (new URL(url).hostname !== 'rhnk.to') return fetch(url, options);
		return new Promise((resolve, reject) => {
			const connection = request(url, {
				signal: options.signal,
				lookup: (hostname, settings, callback) => callback(null,
					settings.all ? [{ address, family: 4 }] : address, 4)
			}, async incoming => {
				try {
					const chunks = [];
					for await (const chunk of incoming) chunks.push(chunk);
					if ([301, 302, 303, 307, 308].includes(incoming.statusCode) && incoming.headers.location) {
						resolve(await fetchUrl(new URL(incoming.headers.location, url).href, options));
						return;
					}
					const response = new Response(Buffer.concat(chunks), {
						status: incoming.statusCode, headers: incoming.headers
					});
					Object.defineProperty(response, 'url', { value: String(url) });
					resolve(response);
				} catch (error) { reject(error); }
			});
			connection.on('error', reject);
			connection.end();
		});
	};
}

const urls = ['https://rhnk.to/', 'https://rhnk.to/dashboard', 'https://rhnk.to/app',
	'https://rhnk.to/conf/', 'https://rhnk.to/pay', 'https://rhnk.to/pay/', 'https://rhnk.to/corex',
	'https://rhnk.to/platform/', 'https://rhnk.to/qr/', 'https://snapshot.rhnk.to/dac7/',
	'https://legacy.rhnk.to/checkout/', 'https://qr.rhnk.to/v1/create-qr-code/?data=https%3A%2F%2Frhnk.to&format=svg'];
let failures = 0;
await Promise.all(urls.map(async url => {
	try {
		const response = await fetchUrl(url, { signal: AbortSignal.timeout(15000) });
		const body = await response.text();
		const type = response.headers.get('content-type') || '';
		console.log(JSON.stringify({ url, status: response.status, type, bytes: body.length }));
		if (!response.ok || !body.length) failures++;
		if (response.ok && type.includes('text/html')) {
			const references = [...body.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)].slice(0, 3);
			for (const reference of references) {
				const asset = new URL(reference[1], response.url);
				const result = await fetchUrl(asset.href, { signal: AbortSignal.timeout(15000) });
				const assetType = result.headers.get('content-type') || '';
				console.log(JSON.stringify({ asset: asset.href, status: result.status, type: assetType }));
				if (!result.ok || assetType.includes('text/html')) failures++;
			}
		}
	} catch (error) {
		failures++;
		console.log(JSON.stringify({ url, error: error.message, cause: error.cause?.code }));
	}
}));
console.log(`Smoke failures: ${failures}`);
process.exitCode = failures ? 1 : 0;