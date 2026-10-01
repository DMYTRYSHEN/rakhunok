<script lang="ts">
	import Dac7Workspace from './lib/dac7/Dac7Workspace.svelte';
	import { createDac7Gateway } from './lib/dac7/dac7-gateway';
	import { readDemoRole } from './lib/roles';

	const gateway = createDac7Gateway(null);
	const initialRole = readDemoRole(new URLSearchParams(window.location.search).get('role') ?? 'platform');

	function restartDemo() {
		window.location.assign(import.meta.env.BASE_URL);
	}
</script>

<Dac7Workspace {gateway} demo={true} {initialRole} onSignOut={restartDemo} />