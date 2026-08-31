import { createSupabaseCorexControlPlane } from './corex-control-plane.ts';
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
	}
} satisfies ExportedHandler<Env>;