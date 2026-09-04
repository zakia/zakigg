<script lang="ts">
	import { onMount } from 'svelte';
	import { createParticleSystem, GravityParticle, type GravityConfig } from '$lib/particles';

	let canvas = $state<HTMLCanvasElement>();
	let config: GravityConfig = $state({
		initialCount: 20,
		G: 0.5,
		SOFTENING: 30,
		trail_lifespan: 1000,
		show_trails: true,
		wall_behaviour: 'bounce',
		speed: 1
	});

	onMount(() => {
		if (!canvas) return;

		let particles: GravityParticle[] = [];
		let speedAccumulator = 0;

		const destroy = createParticleSystem(canvas, {
			clear: 'oklch(15% 0 0)',

			setup(_ctx, width, height) {
				particles = [];
				speedAccumulator = 0;

				const sunMass = 10000;
				const cx = width / 2;
				const cy = height / 2;

				particles.push(
					new GravityParticle({
						x: cx,
						y: cy,
						radius: 30,
						mass: sunMass,
						vx: 0,
						vy: 0,
						config,
						canvas: canvas!
					})
				);

				for (let i = 0; i < config.initialCount; i++) {
					const orbitRadius = 100 + i * 60;
					const angle = Math.random() * Math.PI * 2;
					const orbitalSpeed = Math.sqrt((config.G * sunMass) / orbitRadius);

					particles.push(
						new GravityParticle({
							x: cx + Math.cos(angle) * orbitRadius,
							y: cy + Math.sin(angle) * orbitRadius,
							radius: 5 + Math.random() * 5,
							vx: -Math.sin(angle) * orbitalSpeed,
							vy: Math.cos(angle) * orbitalSpeed,
							config,
							canvas: canvas!
						})
					);
				}
			},

			frame(ctx, width, _height, now) {
				speedAccumulator += config.speed;
				while (speedAccumulator >= 1) {
					for (let i = 0; i < particles.length; i++) {
						for (let j = 0; j < particles.length; j++) {
							if (i !== j) particles[i].attract(particles[j]);
						}
						particles[i].update(now);
					}
					speedAccumulator -= 1;
				}

				for (const p of particles) p.draw(now);

				ctx.fillStyle = 'white';
				ctx.font = '14px monospace';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'top';
				ctx.fillText(`Speed: ${config.speed.toFixed(2)}x (← → arrows)`, width / 2, 10);
			}
		});

		function onKeydown(e: KeyboardEvent) {
			if (e.key === 'ArrowLeft') config.speed = Math.max(0.25, config.speed - 0.25);
			else if (e.key === 'ArrowRight') config.speed += 0.25;
		}

		window.addEventListener('keydown', onKeydown);

		return () => {
			destroy.destroy();
			window.removeEventListener('keydown', onKeydown);
		};
	});
</script>

<div class="relative h-full w-full">
	<canvas bind:this={canvas} class="h-full w-full"></canvas>
	<div class="absolute top-4 right-4 flex flex-col gap-2">
		<button class="btn variant-ghost" onclick={() => (config.speed += 0.25)}>Speed +</button>
		<button class="btn variant-ghost" onclick={() => (config.speed -= 0.25)}>Speed −</button>
		<button class="btn variant-ghost" onclick={() => (config.speed = 1)}>Reset Speed</button>
		<button
			class="btn variant-ghost"
			onclick={() =>
				(config.wall_behaviour = config.wall_behaviour === 'bounce' ? 'pass' : 'bounce')}
		>
			Walls: {config.wall_behaviour}
		</button>
		<button class="btn variant-ghost" onclick={() => (config.show_trails = !config.show_trails)}>
			Trails: {config.show_trails ? 'on' : 'off'}
		</button>
		<label class="text-s-2 text-content-1 flex flex-col gap-1">
			G: {config.G.toFixed(2)}
			<input type="range" bind:value={config.G} min="0" max="2" step="0.01" />
		</label>
	</div>
</div>
