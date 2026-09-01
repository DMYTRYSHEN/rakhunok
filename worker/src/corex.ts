import { createSupabaseCorexControlPlane } from './corex-control-plane.ts';
import { drainCorexOutbox } from './corex-outbox.ts';
import { reconcileQueuedCorexRuns } from './corex-run-reconciliation.ts';
import { routeCorexRequest } from './corex-router.ts';

export { CorexProcessWorkflow } from './corex-workflow.ts';

export default {
	async fetch(request, env): Promise<Response> {
		const controlPlane = createSupabaseCorexControlPlane({
			url: env.SUPABASE_URL,
			publishableKey: env.SUPABASE_PUBLISHABLE_KEY,
			serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
			workflow: env.COREX_PROCESS_WORKFLOW
		});
		return routeCorexRequest(request, env, controlPlane);
	},
	async scheduled(_controller, env): Promise<void> {
		await Promise.all([
			drainCorexOutbox({
				url: env.SUPABASE_URL,
				serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
				workflow: env.COREX_PROCESS_WORKFLOW
			}),
			reconcileQueuedCorexRuns({
				url: env.SUPABASE_URL,
				serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
				workflow: env.COREX_PROCESS_WORKFLOW
			})
		]);
	}
} satisfies ExportedHandler<Env>;