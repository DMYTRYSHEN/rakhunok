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
	if (!userId) {
		return new Response('User ID required', { status: 400 });
	}

	const botToken = getBotToken(env);
	if (!botToken) {
		return new Response('Bot token not configured', { status: 500 });
	}

	try {
		const photosRes = await fetch(
			`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${userId}&limit=1`
		);
		if (!photosRes.ok) {
			return new Response('Failed to fetch profile photos', { status: 502 });
		}
		const photosData = (await photosRes.json()) as any;
		const photos = photosData?.result?.photos;
		if (!photos || !photos.length || !photos[0]?.length) {
			return new Response('No avatar found', { status: 404 });
		}

		const photoVariants = photos[0];
		const selectedPhoto = photoVariants[Math.min(1, photoVariants.length - 1)];
		const fileId = selectedPhoto.file_id;

		const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
		if (!fileRes.ok) {
			return new Response('Failed to get file info', { status: 502 });
		}
		const fileData = (await fileRes.json()) as any;
		const filePath = fileData?.result?.file_path;
		if (!filePath) {
			return new Response('File path not found', { status: 404 });
		}

		const imgRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
		if (!imgRes.ok) {
			return new Response('Failed to download avatar', { status: 502 });
		}

		const headers = new Headers();
		headers.set('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
		headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
		headers.set('Access-Control-Allow-Origin', '*');

		return new Response(imgRes.body, {
			status: 200,
			headers
		});
	} catch (err: any) {
		return new Response(err?.message || 'Server error', { status: 500 });
	}
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
	} catch {
		return new Response('Bad Request', { status: 400 });
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
			avatarUrl: `/api/v1/telegram/avatar?user_id=${fromId || chatId}`,
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

	if (!token) {
		return Response.json(
			{ verified: false, error: 'Token required' },
			{
				status: 400,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
	}

	let record = completedByToken.get(token);
	if (!record && env?.ORDERS_KV) {
		try {
			const kvData = await env.ORDERS_KV.get(`tg:verify:${token}`, 'json');
			if (kvData) {
				record = kvData as CompletedVerification;
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
				avatarUrl: record.avatarUrl || `/api/v1/telegram/avatar?user_id=${record.telegramId}`,
				verifiedAt: record.verifiedAt
			},
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json; charset=utf-8',
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
	}

	return Response.json(
		{ verified: false },
		{
			status: 200,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Access-Control-Allow-Origin': '*'
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
