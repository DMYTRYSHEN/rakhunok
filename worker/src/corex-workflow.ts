import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';

import type { CorexWorkflowParams } from './corex-runtime.ts';
import { runCorexProcessWorkflow } from './corex-workflow-runner.ts';

export class CorexProcessWorkflow extends WorkflowEntrypoint<Cloudflare.Env, CorexWorkflowParams> {
	async run(event: WorkflowEvent<CorexWorkflowParams>, workflow: WorkflowStep): Promise<unknown> {
		return runCorexProcessWorkflow(this.env, event.payload, workflow);
	}
}