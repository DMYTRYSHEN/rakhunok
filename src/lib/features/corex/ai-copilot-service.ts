import type { ProcessDefinition } from './process-definition';
import { validateProcessDefinition } from './process-definition';

export interface RequestAiCopilotOptions {
	userPrompt: string;
	currentDefinition: ProcessDefinition;
	endpointUrl?: string;
	azureApiKey?: string;
	azureBearerToken?: string;
}

export interface AiCopilotResult {
	ok: boolean;
	processDefinition?: ProcessDefinition;
	rawContent?: string;
	errorMessage?: string;
	validationIssues?: string[];
}

export interface CopilotChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: number;
	proposedDefinition?: ProcessDefinition | null;
	validationIssues?: string[];
}

export interface SendCopilotChatOptions {
	chatMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
	currentDefinition?: ProcessDefinition;
	endpointUrl?: string;
	azureApiKey?: string;
	azureBearerToken?: string;
}

export interface CopilotChatResponse {
	ok: boolean;
	message: string;
	proposedDefinition?: ProcessDefinition | null;
	validationIssues?: string[];
	errorMessage?: string;
}

export const DEFAULT_AI_WORKER_URL =
	typeof window !== 'undefined' &&
	window.location.hostname === 'localhost' &&
	window.location.port !== '8787'
		? 'http://localhost:8787'
		: '';

export async function requestAiProcessModification(
	options: RequestAiCopilotOptions
): Promise<AiCopilotResult> {
	const endpoint = options.endpointUrl || DEFAULT_AI_WORKER_URL;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (options.azureApiKey) {
		headers['x-api-key'] = options.azureApiKey;
	} else if (options.azureBearerToken) {
		headers['Authorization'] = `Bearer ${options.azureBearerToken}`;
	}

	try {
		const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/copilot`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				userPrompt: options.userPrompt,
				currentDefinition: options.currentDefinition
			})
		});

		if (!res.ok) {
			const errorText = await res.text();
			return {
				ok: false,
				errorMessage: `AI Worker HTTP ${res.status}: ${errorText}`
			};
		}

		const data = (await res.json()) as {
			success?: boolean;
			processDefinition?: ProcessDefinition;
			rawContent?: string;
			parseError?: string;
			error?: string;
		};

		if (data.error) {
			return { ok: false, errorMessage: data.error };
		}

		if (!data.processDefinition) {
			return {
				ok: false,
				rawContent: data.rawContent,
				errorMessage: data.parseError || 'Could not parse ProcessDefinition JSON from AI response.'
			};
		}

		const validation = validateProcessDefinition(data.processDefinition);
		if (!validation.valid) {
			return {
				ok: false,
				processDefinition: data.processDefinition,
				rawContent: data.rawContent,
				errorMessage: 'Generated process has validation issues.',
				validationIssues: validation.issues.map((i) => i.message)
			};
		}

		return {
			ok: true,
			processDefinition: data.processDefinition,
			rawContent: data.rawContent
		};
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		return {
			ok: false,
			errorMessage: `Connection failed to AI Worker at ${endpoint}: ${message}`
		};
	}
}

export async function sendCopilotChatMessage(
	options: SendCopilotChatOptions
): Promise<CopilotChatResponse> {
	const endpoint = options.endpointUrl || DEFAULT_AI_WORKER_URL;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};

	if (options.azureApiKey) {
		headers['x-api-key'] = options.azureApiKey;
	} else if (options.azureBearerToken) {
		headers['Authorization'] = `Bearer ${options.azureBearerToken}`;
	}

	try {
		const res = await fetch(`${endpoint.replace(/\/$/, '')}/api/copilot`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				chatMessages: options.chatMessages,
				currentDefinition: options.currentDefinition
			})
		});

		if (!res.ok) {
			const errorText = await res.text();
			return {
				ok: false,
				message: '',
				errorMessage: `AI Worker HTTP ${res.status}: ${errorText}`
			};
		}

		const data = (await res.json()) as {
			success?: boolean;
			message?: string;
			rawContent?: string;
			processDefinition?: ProcessDefinition | null;
			error?: string;
			parseError?: string;
		};

		if (data.error) {
			return { ok: false, message: '', errorMessage: data.error };
		}

		const message = data.message || data.rawContent || '';
		let proposedDefinition: ProcessDefinition | null = data.processDefinition ?? null;
		let validationIssues: string[] | undefined = undefined;

		if (proposedDefinition) {
			const validation = validateProcessDefinition(proposedDefinition);
			if (!validation.valid) {
				validationIssues = validation.issues.map((i) => i.message);
			}
		}

		return {
			ok: true,
			message,
			proposedDefinition,
			validationIssues
		};
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		return {
			ok: false,
			message: '',
			errorMessage: `Connection failed to AI Worker at ${endpoint}: ${message}`
		};
	}
}
