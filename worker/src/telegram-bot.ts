export interface TelegramEnv {
	TELEGRAM_BOT_TOKEN?: string;
	SUPABASE_URL?: string;
	SUPABASE_ANON_KEY?: string;
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
	verifiedAt: string;
	expires: number;
}

const pendingByChat = new Map<number, PendingVerification>();
const completedByToken = new Map<string, CompletedVerification>();

function getBotToken(env?: TelegramEnv): string {
	return env?.TELEGRAM_BOT_TOKEN || '';
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

	// 1. Handle /start command with verification token
	if (text.startsWith('/start')) {
		const parts = text.split(/\s+/);
		const param = parts[1] || '';

		if (param.startsWith('verify_')) {
			const token = param.replace('verify_', '').trim();
			pendingByChat.set(chatId, {
				token,
				expires: Date.now() + 15 * 60 * 1000 // 15 minutes
			});

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

		// Plain /start without token
		await sendTelegramMessage(
			botToken,
			chatId,
			`👋 <b>Вітаємо!</b> Це офіційний бот <b>Rahunok</b> (@RhnkBot).\n\n` +
				`Він призначений для швидкої, безпечної та безкоштовної верифікації номерів телефонів мерчантів і клієнтів у сервісі Rahunok.\n\n` +
				`Щоб пройти верифікацію, розпочніть процес у своєму кабінеті або під час оплати.`
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

		const pending = pendingByChat.get(chatId);
		if (pending && pending.expires > Date.now()) {
			completedByToken.set(pending.token, {
				phone: normalizedPhone,
				telegramId: fromId || chatId,
				telegramUsername: username,
				verifiedAt: new Date().toISOString(),
				expires: Date.now() + 60 * 60 * 1000 // 1 hour retention
			});
			pendingByChat.delete(chatId);

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
		} else {
			// Contact shared without an active pending token or session expired
			await sendTelegramMessage(
				botToken,
				chatId,
				`✅ Номер <code>${normalizedPhone}</code> отримано. Якщо ви проходите верифікацію на сайті, будь ласка, відкрийте посилання з кабінету знову.`,
				{
					remove_keyboard: true
				}
			);
		}

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

export function handleVerificationStatus(request: Request): Response {
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

	const record = completedByToken.get(token);
	if (record && record.expires > Date.now()) {
		return Response.json(
			{
				verified: true,
				phone: record.phone,
				telegramId: record.telegramId,
				telegramUsername: record.telegramUsername,
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
