import { createSupabaseCorexControlPlane } from './corex-control-plane.ts';
import {
	readCorexHttpRouteAdapterBinding,
	reconcileCorexHttpRoutes
} from './corex-http-route-reconciliation.ts';
import { drainCorexOutbox } from './corex-outbox.ts';
import { processCorexOperations } from './corex-operations.ts';
import { reconcileQueuedCorexRuns } from './corex-run-reconciliation.ts';
import { purgeRetainedCorexRuns } from './corex-run-retention.ts';
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
		const routeAdapter = readCorexHttpRouteAdapterBinding(env);
		const jobs: Promise<unknown>[] = [
			processCorexOperations({
				url: env.SUPABASE_URL,
				serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
				workflow: env.COREX_PROCESS_WORKFLOW,
				outputBucket: env.COREX_OUTPUTS
			}),
			drainCorexOutbox({
				url: env.SUPABASE_URL,
				serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
				workflow: env.COREX_PROCESS_WORKFLOW
			}),
			reconcileQueuedCorexRuns({
				url: env.SUPABASE_URL,
				serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
				workflow: env.COREX_PROCESS_WORKFLOW
			}),
			purgeRetainedCorexRuns({
				url: env.SUPABASE_URL,
				serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
				outputBucket: env.COREX_OUTPUTS
			})
		];
		if (routeAdapter) {
			jobs.push(
				reconcileCorexHttpRoutes({
					url: env.SUPABASE_URL,
					serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
					adapter: routeAdapter
				})
			);
		}
		await Promise.all(jobs);
	}
} satisfies ExportedHandler<Env>;
