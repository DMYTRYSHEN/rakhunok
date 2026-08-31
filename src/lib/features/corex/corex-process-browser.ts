import { getSupabaseBrowserClient } from '$lib/features/dashboard/api/supabase-browser';
import { createCorexCommandGateway, type CorexCommandGateway } from './corex-command-gateway';
import { createCorexProcessGateway, type CorexProcessGateway } from './corex-process-gateway';

let gateway: CorexProcessGateway | null = null;
let commandGateway: CorexCommandGateway | null = null;

export function getCorexProcessGateway(): CorexProcessGateway | null {
	if (gateway) return gateway;

	const client = getSupabaseBrowserClient();
	if (!client) return null;

	gateway = createCorexProcessGateway(client);
	return gateway;
}

export function getCorexCommandGateway(): CorexCommandGateway | null {
	if (commandGateway) return commandGateway;

	const client = getSupabaseBrowserClient();
	if (!client) return null;

	commandGateway = createCorexCommandGateway(client);
	return commandGateway;
}