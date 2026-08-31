import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';

import {
	executeCorexWorkflow,
	recordCorexRunEvent,
	type CorexHttpResult,
	type CorexWorkflowParams
} from './corex-runtime.ts';

export class CorexProcessWorkflow extends WorkflowEntrypoint<Cloudflare.Env, CorexWorkflowParams> {
	async run(event: WorkflowEvent<CorexWorkflowParams>, workflow: WorkflowStep): Promise<CorexHttpResult | null> {
		return executeCorexWorkflow(event.payload, workflow, (runEvent) =>
			recordCorexRunEvent(
				{ url: this.env.SUPABASE_URL, serviceRoleKey: this.env.SUPABASE_SERVICE_ROLE_KEY },
				runEvent
			)
		);
	}
}