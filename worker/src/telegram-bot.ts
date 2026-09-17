export interface TelegramEnv {
	TELEGRAM_BOT_TOKEN?: string;
	SUPABASE_URL?: string;
	SUPABASE_ANON_KEY?: string;
	ORDERS_KV?: KVNamespace;
}

// In-memory verification storage across worker isolate lifecycle
interface PendingVerification {
	token: string;
	expires: number;
}

interface CompletedVerification {
	phone: string;
	telegramId: number;
	telegramUsername?: string;
	avatarUrl?: string;
	verifiedAt: string;
	expires: number;
}

const pendingByChat = new Map<number, PendingVerification>();
const completedByToken = new Map<string, CompletedVerification>();

function getBotToken(env?: TelegramEnv): string {
	return env?.TELEGRAM_BOT_TOKEN || '';
}

export async function handleTelegramAvatarProxy(request: Request, env?: TelegramEnv): Promise<Response> {
	const url = new URL(request.url);
	const userIdStr = url.searchParams.get('user_id');
	const userId = Number(userIdStr);
	const username = (url.searchParams.get('username') || '').replace(/^@/, '').trim();

	const corsHeaders = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': '*'
	};

	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	if (!userId && !username) {
		return new Response('User ID or username required', { status: 400, headers: corsHeaders });
	}

	const botToken = getBotToken(env);

	// 1. If we have userId and botToken, try official getUserProfilePhotos
	if (userId && botToken) {
		try {
			const photosRes = await fetch(
				`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`
			);
			if (photosRes.ok) {
				const photosData = (await photosRes.json()) as any;
				const photos = photosData?.result?.photos;
				if (photos && photos.length > 0 && photos[0]?.length > 0) {
					const photoVariants = photos[0];
					const selectedPhoto = photoVariants[photoVariants.length - 1]; // Highest available resolution
					const fileId = selectedPhoto.file_id;

					const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
					if (fileRes.ok) {
						const fileData = (await fileRes.json()) as any;
						const filePath = fileData?.result?.file_path;
						if (filePath) {
							const imgRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
							if (imgRes.ok) {
								const headers = new Headers(corsHeaders);
								headers.set('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
								headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
								return new Response(imgRes.body, { status: 200, headers });
							}
						}
					}
				}
			}
		} catch (err) {
			console.error('[handleTelegramAvatarProxy] getUserProfilePhotos error:', err);
		}
	}

	// 2. Fallback: If username is provided, fetch public avatar from Telegram CDN
	if (username) {
		try {
			const publicAvatarRes = await fetch(`https://t.me/i/userpic/320/${username}.jpg`);
			if (publicAvatarRes.ok) {
				const headers = new Headers(corsHeaders);
				headers.set('Content-Type', publicAvatarRes.headers.get('content-type') || 'image/jpeg');
				headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
				return new Response(publicAvatarRes.body, { status: 200, headers });
			}
		} catch (err) {
			console.error('[handleTelegramAvatarProxy] publicAvatar error:', err);
		}
	}

	return new Response('Avatar not found', { status: 404, headers: corsHeaders });
}

export async function sendTelegramMessage(
	botToken: string,
	chatId: number,
	text: string,
	replyMarkup?: Record<string, unknown>
): Promise<boolean> {
	try {
		const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				chat_id: chatId,
				text,
				parse_mode: 'HTML',
				reply_markup: replyMarkup
			})
		});
		return res.ok;
	} catch (err) {
		console.error('[TelegramBot] sendMessage error:', err);
		return false;
	}
}

export async function handleTelegramWebhook(request: Request, env?: TelegramEnv): Promise<Response> {
	if (request.method !== 'POST') {
		return new Response('Method Not Allowed', { status: 405 });
	}

	const botToken = getBotToken(env);

	let update: any;
	try {
		update = await request.json();
		if (env?.ORDERS_KV) {
			await env.ORDERS_KV.put('tg:debug:last_update', JSON.stringify(update));
		}
	} catch {
		return new Response('Bad Request', { status: 400 });
	}

	if (update.inline_query) {
		const inlineQuery = update.inline_query;
		const orderId = inlineQuery.query.trim();
		
		if (!orderId) {
			return new Response(JSON.stringify({
				method: 'answerInlineQuery',
				inline_query_id: inlineQuery.id,
				results: []
			}), { headers: { 'Content-Type': 'application/json' } });
		}

		const photoUrl = `https://letsrealtalk.com/api/v1/orders/invoice-image/${orderId}?v=${Date.now()}`;
		const checkoutUrl = `https://letsrealtalk.com/pay/${orderId}`;
		
		const results = [{
			type: 'photo',
			id: orderId,
			photo_url: photoUrl,
			thumb_url: photoUrl,
			caption: `<b>Рахунок RHK-${orderId.slice(0,6)}</b>\nВідкрито для оплати.`,
			parse_mode: 'HTML',
			reply_markup: {
				inline_keyboard: [[{ text: '💳 Оплатити рахунок', url: checkoutUrl }]]
			}
		}];

		return new Response(JSON.stringify({
			method: 'answerInlineQuery',
			inline_query_id: inlineQuery.id,
			results,
			cache_time: 0,
			is_personal: false
		}), { headers: { 'Content-Type': 'application/json' } });
	}

	const message = update?.message;
	if (!message || !message.chat?.id) {
		return new Response('OK', { status: 200 });
	}

	const chatId = message.chat.id;
	const fromId = message.from?.id;
	const username = message.from?.username;
	const text = (message.text || '').trim();

	// 1. Handle /start command (with or without token)
	if (text.startsWith('/start')) {
		const parts = text.split(/\s+/);
		const param = parts[1] || '';
		const token = param.startsWith('verify_')
			? param.replace('verify_', '').trim()
			: `chat_${chatId}`;

		pendingByChat.set(chatId, {
			token,
			expires: Date.now() + 15 * 60 * 1000 // 15 minutes
		});

		if (env?.ORDERS_KV) {
			try {
				await env.ORDERS_KV.put(`tg:pending:${chatId}`, token, { expirationTtl: 1800 });
				if (username) {
					await env.ORDERS_KV.put(`tg:username:${username.toLowerCase()}`, String(chatId), { expirationTtl: 60 * 60 * 24 * 30 });
				}
			} catch {}
		}

		await sendTelegramMessage(
			botToken,
			chatId,
			`👋 <b>Вітаємо в офіційному боті сервісу Rahunok!</b>\n\n` +
				`Для підтвердження вашого профілю продавця та захисту персональної платіжної адреси на <b>rahunok.com</b>, будь ласка, натисніть кнопку нижче:`,
			{
				keyboard: [
					[
						{
							text: '📱 Підтвердити мій номер телефону',
							request_contact: true
						}
					]
				],
				resize_keyboard: true,
				one_time_keyboard: true
			}
		);
		return new Response('OK', { status: 200 });
	}

	// 2. Handle shared Contact (phone number)
	if (message.contact) {
		const contact = message.contact;

		// Security check: ensure user didn't forward someone else's contact
		if (contact.user_id && fromId && contact.user_id !== fromId) {
			await sendTelegramMessage(
				botToken,
				chatId,
				`⚠️ <b>Помилка безпеки:</b> Будь ласка, поділіться саме власним номером телефону за допомогою спеціальної кнопки внизу.`,
				{
					keyboard: [
						[
							{
								text: '📱 Підтвердити мій номер телефону',
								request_contact: true
							}
						]
					],
					resize_keyboard: true,
					one_time_keyboard: true
				}
			);
			return new Response('OK', { status: 200 });
		}

		let rawPhone = (contact.phone_number || '').trim();
		const normalizedPhone = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`;

		let token = pendingByChat.get(chatId)?.token;
		if (!token && env?.ORDERS_KV) {
			try {
				token = (await env.ORDERS_KV.get(`tg:pending:${chatId}`)) || undefined;
			} catch {}
		}
		if (!token) {
			token = `chat_${chatId}`;
		}

		const record = {
			phone: normalizedPhone,
			telegramId: fromId || chatId,
			telegramUsername: username,
			avatarUrl: `/api/v1/telegram/avatar?user_id=${fromId || chatId}${username ? `&username=${username}` : ''}`,
			verifiedAt: new Date().toISOString(),
			expires: Date.now() + 60 * 60 * 1000 // 1 hour retention
		};

		completedByToken.set(token, record);
		completedByToken.set(`chat_${chatId}`, record);

		if (env?.ORDERS_KV) {
			try {
				const json = JSON.stringify(record);
				await env.ORDERS_KV.put(`tg:verify:${token}`, json, { expirationTtl: 3600 });
				await env.ORDERS_KV.put(`tg:verify:chat_${chatId}`, json, { expirationTtl: 3600 });
				await env.ORDERS_KV.put(`tg:verify:latest`, json, { expirationTtl: 300 });
			} catch (kvErr) {
				console.error('[TelegramBot] KV error:', kvErr);
			}
		}

		await sendTelegramMessage(
			botToken,
			chatId,
			`✅ <b>Чудово! Ваш номер телефону успішно підтверджено:</b>\n` +
				`<code>${normalizedPhone}</code>\n\n` +
				`Тепер ви можете повернутися на сторінку налаштувань у браузері — статус оновиться автоматично.`,
			{
				remove_keyboard: true
			}
		);

		return new Response('OK', { status: 200 });
	}

	// Default fallback message
	await sendTelegramMessage(
		botToken,
		chatId,
		`ℹ️ Скористайтеся кнопками в меню або поверніться на сайт <b>rahunok.com</b>.`
	);

	return new Response('OK', { status: 200 });
}

export async function handleVerificationStatus(request: Request, env?: TelegramEnv): Promise<Response> {
	const url = new URL(request.url);
	const token = url.searchParams.get('token') || '';
	const telegramId = url.searchParams.get('telegram_id') || '';

	const corsHeaders = {
		'Content-Type': 'application/json; charset=utf-8',
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': '*'
	};

	if (request.method === 'OPTIONS') {
		return new Response(null, { headers: corsHeaders });
	}

	if (!token && !telegramId) {
		return Response.json(
			{ verified: false, error: 'Token or telegram_id required' },
			{ status: 400, headers: corsHeaders }
		);
	}

	let record: CompletedVerification | null = null;

	// 1. Check in-memory by token
	if (token) {
		record = completedByToken.get(token) || null;
	}

	// 2. Check in-memory by chat_ID
	if (!record && telegramId) {
		record = completedByToken.get(`chat_${telegramId}`) || null;
	}

	// 3. Check KV by token
	if (!record && token && env?.ORDERS_KV) {
		try {
			const kvData = await env.ORDERS_KV.get(`tg:verify:${token}`, 'json');
			if (kvData) record = kvData as CompletedVerification;
		} catch {}
	}

	// 4. Check KV by chat_ID
	if (!record && telegramId && env?.ORDERS_KV) {
		try {
			const kvData = await env.ORDERS_KV.get(`tg:verify:chat_${telegramId}`, 'json');
			if (kvData) record = kvData as CompletedVerification;
		} catch {}
	}

	// 5. Fallback: check latest verification completed within last 5 minutes (server time)
	if (!record && env?.ORDERS_KV) {
		try {
			const latest = (await env.ORDERS_KV.get(`tg:verify:latest`, 'json')) as CompletedVerification | null;
			if (latest && latest.verifiedAt) {
				const ageMs = Date.now() - new Date(latest.verifiedAt).getTime();
				if (ageMs >= 0 && ageMs < 5 * 60 * 1000) {
					record = latest;
					if (token) {
						completedByToken.set(token, record);
						await env.ORDERS_KV.put(`tg:verify:${token}`, JSON.stringify(record), { expirationTtl: 3600 });
					}
				}
			}
		} catch {}
	}

	if (record) {
		return Response.json(
			{
				verified: true,
				phone: record.phone,
				telegramId: record.telegramId,
				telegramUsername: record.telegramUsername,
				avatarUrl:
					record.avatarUrl ||
					`/api/v1/telegram/avatar?user_id=${record.telegramId}${record.telegramUsername ? `&username=${record.telegramUsername}` : ''}`,
				verifiedAt: record.verifiedAt
			},
			{
				status: 200,
				headers: corsHeaders
			}
		);
	}

	return Response.json({ verified: false }, { status: 200, headers: corsHeaders });
}

export async function handleVerificationReset(request: Request, env?: TelegramEnv): Promise<Response> {
	const url = new URL(request.url);
	const telegramId = url.searchParams.get('telegram_id') || '';

	completedByToken.clear();

	if (env?.ORDERS_KV) {
		try {
			await env.ORDERS_KV.delete('tg:verify:latest');
			if (telegramId) {
				await env.ORDERS_KV.delete(`tg:verify:chat_${telegramId}`);
				await env.ORDERS_KV.delete(`tg:pending:${telegramId}`);
			}
		} catch {}
	}

	return Response.json(
		{ ok: true, reset: true },
		{
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
				'Access-Control-Allow-Headers': '*'
			}
		}
	);
}

export async function sendNotificationToTelegramUser(
	chatId: number,
	text: string,
	env?: TelegramEnv
): Promise<boolean> {
	const botToken = getBotToken(env);
	return sendTelegramMessage(botToken, chatId, text);
}

export async function registerTelegramWebhook(webhookUrl: string, env?: TelegramEnv): Promise<{ ok: boolean; description?: string }> {
	const botToken = getBotToken(env);
	try {
		const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
		return await res.json() as { ok: boolean; description?: string };
	} catch (e: any) {
		return { ok: false, description: e?.message || 'Network error' };
	}
}
