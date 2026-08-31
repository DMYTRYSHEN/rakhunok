import type { CorexRunEvent } from './corex-process-gateway';

export type RunEventSummary = {
	completedSteps: number;
	activeStep: string | null;
};

export function summarizeRunEvents(events: CorexRunEvent[]): RunEventSummary {
	const completedSteps = events.filter((event) => event.eventType === 'step_completed').length;
	const latestStepEvent = events.findLast((event) => event.eventType === 'step_started' || event.eventType === 'step_completed');
	return {
		completedSteps,
		activeStep: latestStepEvent?.eventType === 'step_started' ? latestStepEvent.stepName : null
	};
}

export function formatRunDetail(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'object' && Object.keys(value).length === 0) return null;
	return JSON.stringify(value, null, 2);
}