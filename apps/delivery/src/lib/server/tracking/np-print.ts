import { requireRef } from './np-api.ts';
import { requireNovaPoshtaKey } from './credential-vault.ts';

export async function novaPoshtaPdf(ref: string, key: string, format: string, transport: typeof fetch = fetch): Promise<Response> {
	try {
		requireRef(ref);
		requireNovaPoshtaKey(key);
		const formats: Record<string, [string, string, string]> = {
			waybill: ['printDocument', 'pdf', ''],
			a4: ['printMarking85x85', 'pdf8', ''],
			zebra: ['printMarking100x100', 'pdf', '/zebra']
		};
		if (!Object.hasOwn(formats, format)) throw new Error('Invalid format');
		const [method, type, suffix] = formats[format];
		const controller = new AbortController();
		let timer: ReturnType<typeof setTimeout> | undefined;
		const deadline = new Promise<never>((_resolve, reject) => {
			timer = setTimeout(() => { controller.abort(); reject(new Error('Print timeout')); }, 15000);
		});
		let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
		try {
			const response = await Promise.race([transport(`https://my.novaposhta.ua/orders/${method}/orders[]/${ref}/type/${type}/apiKey/${key}${suffix}`, {
				redirect: 'error', signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/pdf' }
			}), deadline]);
			reader = response.body?.getReader();
			if (!response.ok || response.redirected || !reader || response.headers.get('content-type')?.split(';')[0].trim() !== 'application/pdf') throw new Error('Invalid print response');
			const chunks: Uint8Array[] = [];
			let size = 0;
			while (true) {
				const chunk = await Promise.race([reader.read(), deadline]);
				if (chunk.done) break;
				size += chunk.value.byteLength;
				if (size > 10 * 1024 * 1024) throw new Error('Print too large');
				chunks.push(chunk.value);
			}
			const bytes = Buffer.concat(chunks);
			if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Not PDF');
			return new Response(new Uint8Array(bytes), { headers: {
				'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="nova-poshta-${format}.pdf"`,
				'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
			} });
		} finally { clearTimeout(timer); void reader?.cancel().catch(() => {}); }
	} catch { return Response.json({ error: 'Print unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}