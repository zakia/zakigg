<script lang="ts">
	import { onMount } from 'svelte';
	import { Particle, type ParticleConfig } from './particles';

	let canvas = $state<HTMLCanvasElement>();
	let config: ParticleConfig = $state({
		initialCount: 20,
		G: 0.5,
		SOFTENING: 30,
		trail_lifespan: 1000, // milliseconds
		show_trails: true,
		wall_behaviour: 'bounce',
		speed: 1
	});

	onMount(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

		// Configuration
		const particles: Particle[] = [];

		// Resize canvas to window
		function resize() {
			if (!canvas) return;
			canvas.width = window.innerWidth;
			canvas.height = window.innerHeight;
		}
		window.addEventListener('resize', resize);
		resize();

		// Sun (fixed at center)
		const sunMass = 10000;
		const centerX = canvas.width / 2;
		const centerY = canvas.height / 2;

		particles.push(
			new Particle({
				x: centerX,
				y: centerY,
				radius: 30,
				mass: sunMass,
				vx: 0,
				vy: 0,
				config,
				canvas
			})
		);

		// Create orbiting planets with proper orbital velocity
		// v = sqrt(G * M / r) for circular orbit
		for (let i = 0; i < config.initialCount; i++) {
			const orbitRadius = 100 + i * 60; // Spread planets out
			const angle = Math.random() * Math.PI * 2; // Random starting position

			// Position on orbit
			const x = centerX + Math.cos(angle) * orbitRadius;
			const y = centerY + Math.sin(angle) * orbitRadius;

			// Orbital velocity (perpendicular to radius)
			const orbitalSpeed = Math.sqrt((config.G * sunMass) / orbitRadius);
			const vx = -Math.sin(angle) * orbitalSpeed;
			const vy = Math.cos(angle) * orbitalSpeed;

			particles.push(
				new Particle({
					x,
					y,
					radius: 5 + Math.random() * 5,
					vx,
					vy,
					config,
					canvas
				})
			);
		}

		// Helper function to run one physics step
		function runPhysicsStep(now: number) {
			for (let i = 0; i < particles.length; i++) {
				for (let j = 0; j < particles.length; j++) {
					if (i !== j) {
						particles[i].attract(particles[j]);
					}
				}
				particles[i].update(now);
			}
		}

		// Speed control - accumulates fractional speeds across frames
		let speedAccumulator = 0;

		// Keyboard controls for speed
		window.addEventListener('keydown', (e) => {
			if (e.key === 'ArrowLeft') {
				config.speed = Math.max(0.25, config.speed - 0.25);
			} else if (e.key === 'ArrowRight') {
				config.speed += 0.25;
			}
		});

		function loop() {
			if (!canvas) return;

			// 1. Clear screen
			ctx.fillStyle = 'oklch(15% 0 0)';
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			const now = performance.now();

			// 2. Run physics calculations based on speed multiplier
			speedAccumulator += config.speed;
			while (speedAccumulator >= 1) {
				runPhysicsStep(now);
				speedAccumulator -= 1;
			}

			// 3. Draw all particles
			for (let i = 0; i < particles.length; i++) {
				particles[i].draw(now);
			}

			// 4. Draw speed display at top of screen
			ctx.fillStyle = 'white';
			ctx.font = '20px monospace';
			ctx.textAlign = 'center';

			ctx.textBaseline = 'top';
			const speedText = `Speed: ${config.speed.toFixed(2)}x (← → arrows to adjust)`;
			ctx.fillText(speedText, canvas.width / 2, 10);

			requestAnimationFrame(loop);
		}

		loop();
	});

	$inspect(config);
</script>

<canvas bind:this={canvas}></canvas>
<div class="bg-da fixed right-0 flex w-fit flex-col gap-2">
	<button class="btn btn-primary" onclick={() => (config.initialCount -= 10)}
		>Remove 10 Particles</button
	>
	<button class="btn btn-primary" onclick={() => (config.speed += 0.25)}>Increase Speed</button>
	<button class="btn btn-primary" onclick={() => (config.speed -= 0.25)}>Decrease Speed</button>
	<button
		class="btn btn-primary"
		onclick={() => (config.wall_behaviour = config.wall_behaviour === 'bounce' ? 'pass' : 'bounce')}
		>Toggle Wall Behaviour</button
	>
	<button class="btn btn-primary" onclick={() => (config.speed = 1)}>Reset Speed</button>
	<button class="btn btn-primary" onclick={() => (config.initialCount = 40)}>Reset Particles</button
	>
	<!-- toggle trails -->
	<button class="btn btn-primary" onclick={() => (config.show_trails = !config.show_trails)}
		>Toggle Trails</button
	>
	<!-- toggle gravity -->
	<label class="label">
		Gravity: {config.G.toFixed(2)}
		<input type="range" bind:value={config.G} min="0" max="2" step="0.01" />
	</label>
</div>
