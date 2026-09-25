<script lang="ts">
	import { onMount } from 'svelte';

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let ready = $state(false);

	onMount(() => {
		let disposed = false;
		let cleanup = () => {};
		const motion = matchMedia('(prefers-reduced-motion: reduce)');

		async function setup() {
			const THREE = await import('three');
			const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
			if (disposed) return;
			const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
			renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			const scene = new THREE.Scene();
			const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
			const environment = new RoomEnvironment();
			const generator = new THREE.PMREMGenerator(renderer);
			const texture = generator.fromScene(environment, 0.04);
			scene.environment = texture.texture;
			environment.dispose();
			generator.dispose();

			const coin = new THREE.Group();
			const bodyGeometry = new THREE.CylinderGeometry(1.45, 1.45, 0.2, 96);
			const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c4c9, metalness: 1, roughness: 0.2 });
			const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
			body.rotation.x = Math.PI / 2;
			coin.add(body);
			const rimGeometry = new THREE.TorusGeometry(1.33, 0.045, 12, 96);
			const rimMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f4f2, metalness: 0.9, roughness: 0.16 });
			const glyphCanvas = document.createElement('canvas');
			glyphCanvas.width = 512;
			glyphCanvas.height = 512;
			const context = glyphCanvas.getContext('2d');
			if (!context) throw new Error('Canvas 2D unavailable');
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.fillStyle = '#f2f8f5';
			context.shadowColor = '#193c38';
			context.shadowBlur = 12;
			context.shadowOffsetY = 7;
			context.font = 'bold 310px Georgia, serif';
			context.fillText('₴', 256, 270);
			const glyphTexture = new THREE.CanvasTexture(glyphCanvas);
			const glyphGeometry = new THREE.PlaneGeometry(2.2, 2.2);
			const glyphMaterial = new THREE.MeshStandardMaterial({ map: glyphTexture, transparent: true, side: THREE.DoubleSide, metalness: 0.2, roughness: 0.3, depthWrite: false });
			for (const side of [-1, 1]) {
				const rim = new THREE.Mesh(rimGeometry, rimMaterial);
				rim.position.z = side * 0.105;
				coin.add(rim);
				const glyph = new THREE.Mesh(glyphGeometry, glyphMaterial);
				glyph.position.z = side * 0.107;
				if (side < 0) glyph.rotation.y = Math.PI;
				coin.add(glyph);
			}
			scene.add(coin);
			const light = new THREE.DirectionalLight(0xffffff, 3);
			light.position.set(2, 4, 5);
			scene.add(light);

			const resize = () => {
				const { width, height } = host.getBoundingClientRect();
				renderer.setSize(width, height);
				camera.aspect = width / Math.max(height, 1);
				camera.position.z = camera.aspect < 1 ? 9 : 7;
				camera.updateProjectionMatrix();
			};
			const observer = new ResizeObserver(resize);
			observer.observe(host);
			resize();
			let visible = true;
			const visibility = new IntersectionObserver(([entry]) => {
				visible = entry.isIntersecting;
			});
			visibility.observe(host);
			let progress = 0;
			let previous = 0;
			renderer.setAnimationLoop((time) => {
				const elapsed = Math.min((time - previous) / 1000, 0.05);
				previous = time;
				if (!visible || document.hidden) return;
				if (!motion.matches) progress += elapsed;
				coin.rotation.set(-0.16, Math.sin(progress * 0.8) * 0.65, -0.12);
				renderer.render(scene, camera);
			});
			ready = true;
			cleanup = () => {
				renderer.setAnimationLoop(null);
				observer.disconnect();
				visibility.disconnect();
				bodyGeometry.dispose();
				rimGeometry.dispose();
				glyphGeometry.dispose();
				bodyMaterial.dispose();
				rimMaterial.dispose();
				glyphMaterial.dispose();
				glyphTexture.dispose();
				texture.dispose();
				renderer.dispose();
			};
		}
		void setup().catch(() => { ready = false; });
		return () => { disposed = true; cleanup(); };
	});
</script>

<div class="coin-scene" role="img" aria-label="Сталева монета зі знаком гривні">
	<span class:ready class="coin-fallback" aria-hidden="true">₴</span>
	<div class="coin-canvas" bind:this={host}><canvas bind:this={canvas} aria-hidden="true"></canvas></div>
</div>

<style>
	.coin-scene { position: relative; width: 100%; height: 100%; }
	.coin-canvas { position: absolute; inset: 0; }
	.coin-canvas :global(canvas) { display: block; width: 100%; height: 100%; }
	.coin-fallback { position: absolute; inset: 0; display: grid; place-items: center; color: #e3f0eb; font: 700 112px Georgia, serif; text-shadow: 4px 6px 0 #506e6a, 12px 18px 25px #092e2d80; }
	.coin-fallback.ready { opacity: 0; }
</style>