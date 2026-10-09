<script lang="ts">
	import { onMount } from 'svelte';
	import type { Warehouse } from '#lib/server/tracking/np-api.ts';
	import type { Map as LeafletMap, LayerGroup } from 'leaflet';

	let { points, selected, onselect }: {
		points: Warehouse[];
		selected: string;
		onselect: (ref: string) => void;
	} = $props();

	let container: HTMLDivElement;
	let ready = $state(false);
	let error = $state('');
	let leaflet: typeof import('leaflet') | undefined;
	let map: LeafletMap | undefined;
	let markers: LayerGroup | undefined;
	let fittedCoordinates = '';

	function hasCoordinates(point: Warehouse): point is Warehouse & {
		latitude: number;
		longitude: number;
	} {
		return typeof point.latitude === 'number' && Number.isFinite(point.latitude)
			&& typeof point.longitude === 'number' && Number.isFinite(point.longitude)
			&& Math.abs(point.latitude) <= 85 && Math.abs(point.longitude) <= 180
			&& !(point.latitude === 0 && point.longitude === 0);
	}

	function isSelectable(point: Warehouse): boolean {
		return point.status === 'Working'
			&& ['Branch', 'Warehouse', 'Postomat'].includes(point.category);
	}

	let locatedPoints = $derived(points.filter(hasCoordinates));

	onMount(() => {
		let disposed = false;
		let observer: ResizeObserver | undefined;
		const cleanup = () => {
			observer?.disconnect();
			observer = undefined;
			markers?.clearLayers();
			markers = undefined;
			map?.off();
			map?.remove();
			map = undefined;
		};

		void (async () => {
			try {
				const [module] = await Promise.all([
					import('leaflet'),
					import('leaflet/dist/leaflet.css')
				]);
				if (disposed) return;
				leaflet = module;
				map = module.map(container, { scrollWheelZoom: false }).setView([48.5, 31], 6);
				module.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
					maxZoom: 19
				}).addTo(map);
				markers = module.layerGroup().addTo(map);
				observer = new ResizeObserver(() => {
					if (!disposed) map?.invalidateSize({ pan: false });
				});
				observer.observe(container);
				ready = true;
			} catch {
				cleanup();
				if (!disposed) error = 'The map could not be loaded.';
			}
		})();

		return () => {
			disposed = true;
			cleanup();
		};
	});

	$effect(() => {
		if (!ready || !leaflet || !map || !markers) return;
		const activeRef = selected;
		markers.clearLayers();
		for (const point of locatedPoints) {
			const selectable = isSelectable(point);
			const active = point.ref === activeRef;
			const marker = leaflet.circleMarker([point.latitude, point.longitude], {
				radius: active ? 10 : 7,
				color: selectable ? (active ? '#0f766e' : '#1d4ed8') : '#6b7280',
				fillColor: selectable ? (active ? '#14b8a6' : '#60a5fa') : '#9ca3af',
				fillOpacity: 0.85,
				weight: active ? 3 : 2
			}).addTo(markers);

			const tooltip = document.createElement('span');
			tooltip.textContent = point.name;
			marker.bindTooltip(tooltip);
			const popup = document.createElement('div');
			const name = document.createElement('strong');
			name.textContent = point.name;
			const address = document.createElement('p');
			address.textContent = point.address;
			popup.append(name, address);
			if (selectable) {
				const button = document.createElement('button');
				button.type = 'button';
				button.textContent = active ? 'Selected' : 'Select shipping point';
				button.setAttribute('aria-pressed', String(active));
				button.addEventListener('click', () => onselect(point.ref));
				popup.append(button);
				marker.on('click', () => onselect(point.ref));
			} else {
				const unavailable = document.createElement('p');
				unavailable.textContent = 'Unavailable for selection';
				popup.append(unavailable);
			}
			marker.bindPopup(popup);

			const element = marker.getElement();
			if (element) {
				element.setAttribute('aria-label', `${point.name}, ${point.address}`);
				if (selectable) {
					element.setAttribute('tabindex', '0');
					element.setAttribute('role', 'button');
					element.setAttribute('aria-pressed', String(active));
					element.addEventListener('keydown', (event) => {
							if (!(event instanceof KeyboardEvent)) return;
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							event.stopPropagation();
							onselect(point.ref);
						}
					});
				} else {
					element.setAttribute('role', 'img');
				}
			}
		}

		const coordinates = locatedPoints.map(point => `${point.latitude},${point.longitude}`).sort().join(';');
		if (coordinates !== fittedCoordinates) {
			fittedCoordinates = coordinates;
			if (locatedPoints.length > 0) {
				const bounds = leaflet.latLngBounds(locatedPoints.map(point => [point.latitude, point.longitude]));
				map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15, animate: false });
			}
		}
	});
</script>

<section class="shipping-map" aria-label="Shipping points map" aria-busy={!ready && !error}>
	<div class="map" bind:this={container} role="region" aria-label="Interactive shipping points map"></div>
	{#if error}
		<p class="map-state" role="alert">{error}</p>
	{:else if !ready}
		<p class="map-state" role="status">Loading map...</p>
	{:else if locatedPoints.length === 0}
		<p class="map-state" role="status">No shipping points with coordinates.</p>
	{/if}
</section>

<style>
	.shipping-map {
		position: relative;
		width: 100%;
		min-width: 0;
		height: 300px;
		isolation: isolate;
		background: #f3f4f6;
	}

	.map {
		width: 100%;
		height: 100%;
	}

	.map:focus-visible {
		outline: 3px solid #0f766e;
		outline-offset: -3px;
	}

	.map-state {
		position: absolute;
		z-index: 1000;
		inset: auto 12px 12px;
		margin: 0;
		padding: 10px 12px;
		background: #ffffff;
		color: #1f2937;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 14px;
		overflow-wrap: anywhere;
		pointer-events: none;
	}
</style>