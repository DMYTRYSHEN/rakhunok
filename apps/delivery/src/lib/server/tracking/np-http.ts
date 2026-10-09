import { novaPoshtaPdf } from './np-print.ts';
import { requireRef } from './np-api.ts';

export async function documentPdf(request: Request, id: string, format: string, dependencies: {
	authenticate(request: Request): Promise<{ id: string }>;
	key(owner: string): Promise<string | undefined>;
	printable(owner: string, id: string, key: string): Promise<string | null>;
	transport?: typeof fetch;
}) {
	const headers = { 'Cache-Control': 'no-store' };
	try {
		const owner = await dependencies.authenticate(request);
		requireRef(id);
		if (!['waybill', 'a4', 'zebra'].includes(format)) return new Response(null, { status: 404, headers });
		const key = await dependencies.key(owner.id);
		const ref = key ? await dependencies.printable(owner.id, id, key) : null;
		if (!ref || !key) return new Response(null, { status: 404, headers });
		return novaPoshtaPdf(ref, key, format, dependencies.transport);
	} catch { return Response.json({ error: 'Document unavailable' }, { status: 403, headers }); }
}

export async function shipmentForm(request: Request, url: URL): Promise<Record<string, unknown>> {
	if (request.headers.get('origin') !== url.origin) throw new Error('Invalid origin');
	const type = request.headers.get('content-type') ?? '';
	if (!/^(application\/x-www-form-urlencoded|multipart\/form-data)(;|$)/i.test(type)) throw new Error('Invalid form');
	const reader = request.body?.getReader();
	if (!reader) throw new Error('Missing form');
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Form timeout')), 5000); });
	try {
		const chunks: Uint8Array[] = [];
		let size = 0;
		while (true) {
			const chunk = await Promise.race([reader.read(), deadline]);
			if (chunk.done) break;
			size += chunk.value.byteLength;
			if (size > 32768) throw new Error('Form too large');
			chunks.push(chunk.value);
		}
		const form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { 'Content-Type': type } }).formData();
		const input: Record<string, unknown> = {};
		for (const [name, value] of form) {
			if (Object.hasOwn(input, name) || typeof value !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(name)) throw new Error('Invalid form field');
			input[name] = value;
		}
		return input;
	} finally { clearTimeout(timer); void reader.cancel().catch(() => {}); }
}