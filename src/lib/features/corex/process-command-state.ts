export type CorexCommandState = 'idle' | 'publishing' | 'running';

export function canPublishProcess(state: {
	hasGateway: boolean;
	hasProcess: boolean;
	draftDirty: boolean;
	validationValid: boolean;
	commandState: CorexCommandState;
}): boolean {
	return state.hasGateway
		&& state.hasProcess
		&& !state.draftDirty
		&& state.validationValid
		&& state.commandState === 'idle';
}

export function canRunProcess(state: {
	hasGateway: boolean;
	hasPublishedVersion: boolean;
	draftDirty: boolean;
	commandState: CorexCommandState;
}): boolean {
	return state.hasGateway
		&& state.hasPublishedVersion
		&& !state.draftDirty
		&& state.commandState === 'idle';
}

export function parseRunInput(source: string): { ok: true; value: unknown } | { ok: false } {
	try {
		return { ok: true, value: JSON.parse(source) };
	} catch {
		return { ok: false };
	}
}