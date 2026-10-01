<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { page } from '$app/state';
	import Platform from '../../../apps/platform/src/App.svelte';
	import { readPlatformConfig } from '../../../apps/platform/src/lib/config';

	const config = readPlatformConfig(env);
</script>

<Platform {config} demo={page.url.searchParams.get('demo') === '1'} role={page.url.searchParams.get('role')} />