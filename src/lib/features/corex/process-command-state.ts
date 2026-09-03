export type CorexCommandState = 'idle' | 'publishing' | 'running' | 'retiring';

export function canPublishProcess(state: {
	hasGateway: boolean;
	hasProcess: boolean;
	isRetired: boolean;
	draftDirty: boolean;
	validationValid: boolean;
	commandState: CorexCommandState;
}): boolean {
	return (
		state.hasGateway &&
		state.hasProcess &&
		!state.isRetired &&
		!state.draftDirty &&
		state.validationValid &&
		state.commandState === 'idle'
	);
}

export function canRunProcess(state: {
	hasGateway: boolean;
	hasPublishedVersion: boolean;
	isRetired: boolean;
	draftDirty: boolean;
	commandState: CorexCommandState;
}): boolean {
	return (
		state.hasGateway &&
		state.hasPublishedVersion &&
		!state.isRetired &&
		!state.draftDirty &&
		state.commandState === 'idle'
	);
}

export function parseRunInput(source: string): { ok: true; value: unknown } | { ok: false } {
	try {
		return { ok: true, value: JSON.parse(source) };
	} catch {
		return { ok: false };
	}
}
