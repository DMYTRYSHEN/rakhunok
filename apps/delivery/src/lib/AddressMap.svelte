<script lang="ts">
	let { address }: { address: string } = $props();
	const src = $derived(`https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key: import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY, q: address, zoom: '11' })}`);
</script>

<iframe title={`Карта: ${address}`} loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" {src}></iframe>

<style>
	iframe { width: 100%; height: 280px; min-height: 250px; border: 0; display: block; border-radius: 8px; background: var(--color-surface); }
</style>