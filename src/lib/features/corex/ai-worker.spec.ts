import { describe, expect, it } from 'vitest';
import {
	cleanReasoningPayload,
	extractJsonFromAiResponse,
	extractProcessDefinitionFromMarkdown,
	resolveAzureChatCompletionsUrl,
	handleAiWorkerRequest,
	type AiWorkerEnv
} from '../../../../worker/src/ai-worker-core';

describe('ai-worker', () => {
	it('resolves Azure chat completions URLs for both host and project endpoints', () => {
		expect(resolveAzureChatCompletionsUrl('rahunok-0252-resource.services.ai.azure.com')).toBe(
			'https://rahunok-0252-resource.services.ai.azure.com/openai/v1/chat/completions'
		);
		expect(
			resolveAzureChatCompletionsUrl('https://rahunok-0252-resource.services.ai.azure.com/api/projects/rahunok-0252')
		).toBe(
			'https://rahunok-0252-resource.services.ai.azure.com/api/projects/rahunok-0252/openai/v1/chat/completions'
		);
		expect(
			resolveAzureChatCompletionsUrl(
				'https://rahunok-0252-resource.services.ai.azure.com/api/projects/rahunok-0252/openai/v1/chat/completions'
			)
		).toBe(
			'https://rahunok-0252-resource.services.ai.azure.com/api/projects/rahunok-0252/openai/v1/chat/completions'
		);
	});
	it('handles CORS OPTIONS preflight', async () => {
		const request = new Request('http://localhost/api/copilot', {
			method: 'OPTIONS'
		});
		const env: AiWorkerEnv = {};
		const response = await handleAiWorkerRequest(request, env);

		expect(response.status).toBe(204);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
	});

	it('returns health and model information on GET /', async () => {
		const request = new Request('http://localhost/health', {
			method: 'GET'
		});
		const env: AiWorkerEnv = {
			MODEL_NAME: 'gpt-5.6-sol',
			AZURE_HOST: 'rahunok-0252-resource.services.ai.azure.com'
		};
		const response = await handleAiWorkerRequest(request, env);

		expect(response.status).toBe(200);
		const body = (await response.json()) as { status: string; model: string };
		expect(body.status).toBe('ok');
		expect(body.model).toBe('gpt-5.6-sol');
	});

	it('cleans reasoning payload by stripping unsupported parameters', () => {
		const raw = {
			messages: [{ role: 'user', content: 'test' }],
			temperature: 0.7,
			top_p: 0.95,
			presence_penalty: 0.5,
			frequency_penalty: 0.5,
			max_tokens: 4096
		};

		const cleaned = cleanReasoningPayload(raw, 'gpt-5.6-sol');
		expect(cleaned.model).toBe('gpt-5.6-sol');
		expect(cleaned.temperature).toBeUndefined();
		expect(cleaned.top_p).toBeUndefined();
		expect(cleaned.max_tokens).toBeUndefined();
		expect(cleaned.presence_penalty).toBeUndefined();
		expect(cleaned.frequency_penalty).toBeUndefined();
	});

	it('extracts JSON from markdown fences', () => {
		const rawMarkdown = '```json\n{"schemaVersion": 1, "id": "test"}\n```';
		const result = extractJsonFromAiResponse(rawMarkdown);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.json).toEqual({ schemaVersion: 1, id: 'test' });
		}
	});

	it('extracts ProcessDefinition from conversational markdown with explanation', () => {
		const rawResponse = `Я додав перевірку суми перед оплатою.
Ось оновлена схема:

\`\`\`json
{
  "schemaVersion": 1,
  "revision": 1,
  "lifecycle": "draft",
  "id": "test-process",
  "name": "Test Process",
  "description": "Test",
  "nodes": [
    { "id": "trigger-1", "name": "start", "type": "trigger-http", "position": { "x": 0, "y": 0 } }
  ],
  "edges": []
}
\`\`\`

Ви можете застосувати ці зміни до полотна.`;

		const result = extractProcessDefinitionFromMarkdown(rawResponse);
		expect(result.ok).toBe(true);
		if (result.ok) {
			const def = result.json as { id: string; nodes: unknown[] };
			expect(def.id).toBe('test-process');
			expect(def.nodes).toHaveLength(1);
		}
	});

	it('returns error when no valid ProcessDefinition JSON is present in conversational response', () => {
		const conversationalResponse = 'Привіт! Цей процес моделює оплату замовлення столу. У ньому є 3 кроки.';
		const result = extractProcessDefinitionFromMarkdown(conversationalResponse);
		expect(result.ok).toBe(false);
	});

	it('returns 401 when Azure credentials are not provided', async () => {
		const request = new Request('http://localhost/api/copilot', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userPrompt: 'Додай знижку 10%'
			})
		});
		const env: AiWorkerEnv = {};
		const response = await handleAiWorkerRequest(request, env);

		expect(response.status).toBe(401);
		const body = (await response.json()) as { error: string };
		expect(body.error).toContain('Missing Azure credentials');
	});
});
