import { describe, expect, it } from 'vitest';
import { canPublishProcess, canRunProcess, parseRunInput } from './process-command-state';

describe('Corex process command state', () => {
	it('publishes only a persisted clean valid draft while idle', () => {
		expect(canPublishProcess({ hasGateway: true, hasProcess: true, draftDirty: false, validationValid: true, commandState: 'idle' })).toBe(true);
		expect(canPublishProcess({ hasGateway: true, hasProcess: true, draftDirty: true, validationValid: true, commandState: 'idle' })).toBe(false);
		expect(canPublishProcess({ hasGateway: true, hasProcess: true, draftDirty: false, validationValid: false, commandState: 'idle' })).toBe(false);
		expect(canPublishProcess({ hasGateway: true, hasProcess: false, draftDirty: false, validationValid: true, commandState: 'idle' })).toBe(false);
		expect(canPublishProcess({ hasGateway: true, hasProcess: true, draftDirty: false, validationValid: true, commandState: 'running' })).toBe(false);
	});

	it('runs only a published clean process while idle', () => {
		expect(canRunProcess({ hasGateway: true, hasPublishedVersion: true, draftDirty: false, commandState: 'idle' })).toBe(true);
		expect(canRunProcess({ hasGateway: true, hasPublishedVersion: false, draftDirty: false, commandState: 'idle' })).toBe(false);
		expect(canRunProcess({ hasGateway: true, hasPublishedVersion: true, draftDirty: true, commandState: 'idle' })).toBe(false);
		expect(canRunProcess({ hasGateway: false, hasPublishedVersion: true, draftDirty: false, commandState: 'idle' })).toBe(false);
		expect(canRunProcess({ hasGateway: true, hasPublishedVersion: true, draftDirty: false, commandState: 'publishing' })).toBe(false);
	});

	it('parses valid JSON and rejects invalid input locally', () => {
		expect(parseRunInput('{"paymentId":"pay-42"}')).toEqual({ ok: true, value: { paymentId: 'pay-42' } });
		expect(parseRunInput('{')).toEqual({ ok: false });
	});
});