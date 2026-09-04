<script lang="ts">
	import { onMount } from 'svelte';
	import { createParticleSystem, trackMouse, distance, type MouseState } from '$lib/particles';

	const SPEED = 0.3;
	const RADIUS = 5;
	const RADIUS_DELTA = 3;
	const LINK_RADIUS = 150;

	let canvas = $state<HTMLCanvasElement>();

	class LinkedParticle {
		width: number;
		height: number;
		x: number;
		y: number;
		radius: number;
		vector: { x: number; y: number };

		constructor(width: number, height: number) {
			this.width = width;
			this.height = height;
			this.x = Math.random() * width;
			this.y = Math.random() * height;
			this.radius = RADIUS + Math.random() * RADIUS_DELTA;
			const speed = SPEED + Math.random() * SPEED;
			const angle = Math.random() * Math.PI * 2;
			this.vector = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
		}

		update(mouse: MouseState) {
			if (this.x > this.width || this.x < 0) this.vector.x *= -1;
			if (this.y > this.height || this.y < 0) this.vector.y *= -1;
			this.x = Math.max(0, Math.min(this.width, this.x));
			this.y = Math.max(0, Math.min(this.height, this.y));

			if (mouse.x != null && mouse.y != null) {
				const dist = distance(mouse.x, mouse.y, this.x, this.y);
				if (dist < mouse.radius) {
					const repelForce = (-0.01 * (mouse.radius - dist)) / mouse.radius;
					this.vector.x += ((mouse.x - this.x) / dist) * repelForce;
					this.vector.y += ((mouse.y - this.y) / dist) * repelForce;
				}
			}

			this.x += this.vector.x;
			this.y += this.vector.y;
		}
	}

	onMount(() => {
		if (!canvas) return;

		let particles: LinkedParticle[] = [];
		const mouse = trackMouse(canvas);

		function getHue() {
			return document.documentElement.style.getPropertyValue('--hue') || '145';
		}

		const destroy = createParticleSystem(canvas, {
			setup(_ctx, width, height) {
				particles = [];
				const count = Math.floor((width * height) / 15000);
				for (let i = 0; i < count; i++) {
					particles.push(new LinkedParticle(width, height));
				}
			},

			frame(ctx) {
				const hue = getHue();

				for (const p of particles) {
					for (const other of particles) {
						const dist = distance(p.x, p.y, other.x, other.y);
						if (dist < LINK_RADIUS) {
							ctx.strokeStyle = `oklch(85% 0.18 ${hue} / ${1 - dist / LINK_RADIUS})`;
							ctx.lineWidth = 2;
							ctx.beginPath();
							ctx.moveTo(p.x, p.y);
							ctx.lineTo(other.x, other.y);
							ctx.stroke();
						}
					}
				}

				for (const p of particles) {
					p.update(mouse);
					ctx.beginPath();
					ctx.ellipse(p.x, p.y, p.radius, p.radius, 0, 0, Math.PI * 2);
					ctx.fillStyle = `oklch(85% 0.18 ${hue})`;
					ctx.fill();
				}
			}
		});

		return () => {
			destroy.destroy();
			mouse.destroy();
		};
	});
</script>

<div class="absolute inset-0 h-full w-full overflow-clip">
	<canvas bind:this={canvas}></canvas>
</div>
