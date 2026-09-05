export interface AiWorkerEnv {
	AZURE_HOST?: string;
	MODEL_NAME?: string;
	AZURE_AI_KEY?: string;
	AZURE_BEARER_TOKEN?: string;
}

export const DEFAULT_AZURE_HOST = 'rahunok-0252-resource.services.ai.azure.com';
export const DEFAULT_MODEL_NAME = 'gpt-5.6-sol';

export const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key'
};

export const COPILOT_SYSTEM_PROMPT = `Ти експертний AI Copilot та архітектор бізнес-процесів для платформи Corex (поєднання Corezoid State Machine та Cloudflare Workflows).
Ти спілкуєшся з користувачем українською мовою (або мовою користувача).

Твої можливості:
1. Відповідати на запитання, пояснювати архітектуру та логіку поточного процесу, аналізувати вузли, переходи (edges), можливі збої, таймаути та бізнес-правила.
2. Пропонувати оптимізації та рекомендації щодо безпеки і стабільності.
3. Модифікувати існуючий процес або створювати новий бізнес-процес за інструкцією користувача.

ПРАВИЛА ДІАЛОГУ:
- Якщо користувач вітається, ставить запитання чи просить проаналізувати/пояснити процес (наприклад: "Привіт", "Що робить цей процес?", "Де тут обробка помилки?"):
  Відповідай структуровано, доброзичливо та інформативно у форматі Markdown. Посилайся на конкретні ID та назви вузлів. НЕ додавай JSON блок, якщо користувач явно не просив змінити чи створити процес.

- Якщо користувач просить ЗМІНИТИ, ДОДАТИ, ВИДАЛИТИ або СТВОРИТИ процес (наприклад: "додай перевірку суми", "підключи чекбокс", "зроби таймер на 5 хвилин"):
  1. Лаконічно поясни, які саме зміни внесено до схеми.
  2. В кінці свого повідомлення ОБОВ'ЯЗКОВО надай повний, валідний JSON-об'єкт ProcessDefinition у блоці:
\`\`\`json
{ ... }
\`\`\`

Правила структури ProcessDefinition:
1. schemaVersion: 1, revision: 1, lifecycle: "draft", id: string (slug без пробілів), name: string, description: string.
2. Повинен бути рівно 1 початковий тригер (type: "trigger-http" з config: { method: "POST"|"GET", path: string }).
3. Типи вузлів:
   - "trigger-http": { method, path }
   - "http-request": { method, url, timeoutMs, retry: { limit, backoff: "exponential" } }
   - "condition": { path: "$.valid", operator: "equals", value: true } (має 2 вихідні ребра: одне when: true, одне when: false)
   - "switch": { path: "$.route", cases: [{ id: "case_1", value: "..." }] } (має ребра case: "case_1" та case: "default")
   - "wait-event": { eventType, timeoutMs, resultKey }
   - "transform": { mode: "merge", mappings: { result: "$.input" } }
   - "end-success": { outputExpression: "$.result" } (0 вихідних ребер)
   - "end-failure": { code: "ERROR_CODE", message: "Опис помилки" } (0 вихідних ребер)
4. Кожен вузол повинен мати унікальний id, унікальний name (тільки літери, цифри, дефіс, підкреслення), та position: { x, y }.
5. Ребра (edges) зв'язують source та target. Усі вузли мають бути досяжні від тригера, не мати замкнених циклів.`;

export function cleanReasoningPayload(rawJson: Record<string, unknown>, modelName: string): Record<string, unknown> {
	const cleaned = { ...rawJson };
	// Remove parameters not supported by reasoning models
	delete cleaned.temperature;
	delete cleaned.top_p;
	delete cleaned.presence_penalty;
	delete cleaned.frequency_penalty;
	delete cleaned.max_tokens;

	cleaned.model = modelName;
	return cleaned;
}

export function resolveAzureChatCompletionsUrl(hostOrUrl: string): string {
	const clean = hostOrUrl.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
	if (clean.endsWith('/chat/completions')) {
		return `https://${clean}`;
	}
	if (clean.endsWith('/openai/v1')) {
		return `https://${clean}/chat/completions`;
	}
	return `https://${clean}/openai/v1/chat/completions`;
}

export function extractJsonFromAiResponse(rawContent: string): { ok: true; json: unknown } | { ok: false; error: string } {
	try {
		const unquoted = rawContent.replace(/^```(?:json)?\n?|\n?```$/gi, '').trim();
		const parsed = JSON.parse(unquoted);
		return { ok: true, json: parsed };
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

export function extractProcessDefinitionFromMarkdown(rawContent: string): { ok: true; json: unknown } | { ok: false; error: string } {
	try {
		const jsonBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
		const jsonCandidate = jsonBlockMatch ? jsonBlockMatch[1].trim() : rawContent.trim();

		const firstBrace = jsonCandidate.indexOf('{');
		const lastBrace = jsonCandidate.lastIndexOf('}');
		if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
			return { ok: false, error: 'No JSON object found in response' };
		}

		const cleanJsonStr = jsonCandidate.substring(firstBrace, lastBrace + 1);
		const parsed = JSON.parse(cleanJsonStr);

		if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).nodes)) {
			return { ok: true, json: parsed };
		}
		return { ok: false, error: 'JSON does not contain a valid ProcessDefinition (missing nodes array)' };
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

export async function handleAiWorkerRequest(request: Request, env: AiWorkerEnv): Promise<Response> {
	if (request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: CORS_HEADERS
		});
	}

	const url = new URL(request.url);

	if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/v1/models')) {
		return Response.json(
			{
				status: 'ok',
				service: 'corex-ai-copilot-worker',
				model: env.MODEL_NAME || DEFAULT_MODEL_NAME,
				host: env.AZURE_HOST || DEFAULT_AZURE_HOST
			},
			{ headers: CORS_HEADERS }
		);
	}

	if (request.method !== 'POST') {
		return new Response('Method Not Allowed', { status: 405, headers: CORS_HEADERS });
	}

	try {
		const rawBody = (await request.json()) as Record<string, unknown>;
		const azureHost = env.AZURE_HOST || DEFAULT_AZURE_HOST;
		const modelName = env.MODEL_NAME || DEFAULT_MODEL_NAME;

		let azurePayload: Record<string, unknown>;
		const currentDefinition = rawBody.currentDefinition;

		if (Array.isArray(rawBody.chatMessages)) {
			// Conversational chat mode with message history
			const systemInstruction = currentDefinition
				? `${COPILOT_SYSTEM_PROMPT}\n\nПоточна схема процесу на екрані:\n${JSON.stringify(currentDefinition, null, 2)}`
				: COPILOT_SYSTEM_PROMPT;

			const conversationMessages = [
				{ role: 'system', content: systemInstruction },
				...rawBody.chatMessages
			];

			azurePayload = cleanReasoningPayload({ messages: conversationMessages }, modelName);
		} else if (rawBody.userPrompt) {
			const userPrompt = String(rawBody.userPrompt);

			azurePayload = {
				model: modelName,
				messages: [
					{ role: 'system', content: COPILOT_SYSTEM_PROMPT },
					{
						role: 'user',
						content: currentDefinition
							? `Поточний процес:\n${JSON.stringify(currentDefinition, null, 2)}\n\nЗавдання користувача:\n${userPrompt}`
							: `Створити новий процес з нуля:\n${userPrompt}`
					}
				]
			};
		} else if (Array.isArray(rawBody.messages)) {
			azurePayload = cleanReasoningPayload(rawBody, modelName);
		} else {
			return Response.json(
				{ error: 'Invalid request body. Expected chatMessages, userPrompt or messages array.' },
				{ status: 400, headers: CORS_HEADERS }
			);
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		const incomingAuth = request.headers.get('Authorization');
		const incomingApiKey = request.headers.get('x-api-key');

		if (incomingAuth) {
			headers['Authorization'] = incomingAuth;
		} else if (incomingApiKey) {
			headers['api-key'] = incomingApiKey;
		} else if (env.AZURE_AI_KEY) {
			headers['api-key'] = env.AZURE_AI_KEY;
		} else if (env.AZURE_BEARER_TOKEN) {
			headers['Authorization'] = `Bearer ${env.AZURE_BEARER_TOKEN}`;
		} else {
			return Response.json(
				{
					error:
						'Missing Azure credentials. Provide AZURE_AI_KEY secret, AZURE_BEARER_TOKEN, or Authorization header.'
				},
				{ status: 401, headers: CORS_HEADERS }
			);
		}

		const azureTargetUrl = resolveAzureChatCompletionsUrl(azureHost);
		const azureResponse = await fetch(azureTargetUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(azurePayload)
		});

		if (!azureResponse.ok) {
			const errorText = await azureResponse.text();
			return new Response(errorText, {
				status: azureResponse.status,
				headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
			});
		}

		const data = (await azureResponse.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};

		const messageContent = data.choices?.[0]?.message?.content || '';
		const extracted = extractProcessDefinitionFromMarkdown(messageContent);

		return Response.json(
			{
				success: true,
				model: modelName,
				message: messageContent,
				rawContent: messageContent,
				processDefinition: extracted.ok ? extracted.json : null,
				hasProcessUpdate: extracted.ok,
				parseError: extracted.ok ? null : extracted.error
			},
			{ headers: CORS_HEADERS }
		);
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		return Response.json({ error: message }, { status: 500, headers: CORS_HEADERS });
	}
}
