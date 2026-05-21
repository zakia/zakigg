<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createParticleSystem,
		trackMouse,
		distance,
		type MouseState,
		type ParticleSystemCallbacks
	} from '$lib/particles';

	const SPEED = 0.4;
	const RADIUS = 4;
	const RADIUS_DELTA = 3;
	const LINK_RADIUS = 130;

	let system: { destroy(): void; triggerResize(): void } | undefined;
	let fps = $state(0);
	let dpr = $state(0);
	let canvas = $state<HTMLCanvasElement>();
	let frameCount = 0;
	let lastFpsUpdate = 0;

	function measureFps(time: number) {
		frameCount++;
		if (time - lastFpsUpdate >= 1000) {
			fps = frameCount;
			frameCount = 0;
			lastFpsUpdate = time;
			dpr = window.devicePixelRatio;
		}
	}

	function getTextCollisionMap(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number
	): ImageData {
		const offscreen = document.createElement('canvas');
		offscreen.width = width;
		offscreen.height = height;
		const offCtx = offscreen.getContext('2d')!;

		offCtx.fillStyle = 'white';
		offCtx.textAlign = 'center';
		offCtx.textBaseline = 'middle';

		const fontSize = Math.min(width * 0.09, height * 0.15);
		offCtx.font = `900 ${fontSize}px 'Inter Variable', sans-serif`;
		offCtx.fillText('ZAKI.GG', width / 2, height / 2);

		return offCtx.getImageData(0, 0, width, height);
	}

	function isInText(collisionMap: ImageData, x: number, y: number): boolean {
		const px = Math.floor(x);
		const py = Math.floor(y);
		if (px < 0 || py < 0 || px >= collisionMap.width || py >= collisionMap.height) return false;
		const idx = (py * collisionMap.width + px) * 4;
		return collisionMap.data[idx + 3] > 128;
	}

	class LinkedParticle {
		width: number;
		height: number;
		x: number;
		y: number;
		radius: number;
		vector: { x: number; y: number };

		constructor(width: number, height: number, collisionMap: ImageData) {
			this.width = width;
			this.height = height;
			this.radius = RADIUS + Math.random() * RADIUS_DELTA;
			const speed = SPEED + Math.random() * SPEED;
			const angle = Math.random() * Math.PI * 2;
			this.vector = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };

			do {
				this.x = Math.random() * width;
				this.y = Math.random() * height;
			} while (isInText(collisionMap, this.x, this.y));
		}

		update(mouse: MouseState, collisionMap: ImageData) {
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

			const nextX = this.x + this.vector.x;
			const nextY = this.y + this.vector.y;

			if (isInText(collisionMap, nextX, nextY)) {
				const inX = isInText(collisionMap, nextX, this.y);
				const inY = isInText(collisionMap, this.x, nextY);

				if (inX && inY) {
					this.vector.x *= -1;
					this.vector.y *= -1;
				} else if (inX) {
					this.vector.x *= -1;
				} else if (inY) {
					this.vector.y *= -1;
				} else {
					this.vector.x *= -1;
					this.vector.y *= -1;
				}
			} else {
				this.x = nextX;
				this.y = nextY;
			}
		}
	}

	function getHue() {
		return document.documentElement.style.getPropertyValue('--hue') || '145';
	}

	onMount(() => {
		if (!canvas) return;

		let particles: LinkedParticle[] = [];
		let collisionMap: ImageData;
		const mouse = trackMouse(canvas);

		document.fonts.ready.then(() => {
			const callbacks: ParticleSystemCallbacks = {
				setup(ctx, width, height) {
					collisionMap = getTextCollisionMap(ctx, width, height);
					particles = [];
					const count = Math.floor((width * height) / 12000);
					for (let i = 0; i < count; i++) {
						particles.push(new LinkedParticle(width, height, collisionMap));
					}
				},

				resize(ctx, width, height, oldW, oldH) {
					collisionMap = getTextCollisionMap(ctx, width, height);
					for (const p of particles) {
						p.x = (p.x / oldW) * width;
						p.y = (p.y / oldH) * height;
						p.width = width;
						p.height = height;
					}
					const targetCount = Math.floor((width * height) / 12000);
					while (particles.length < targetCount) {
						particles.push(new LinkedParticle(width, height, collisionMap));
					}
					while (particles.length > targetCount) {
						particles.pop();
					}
				},

				frame(ctx, width, height) {
					measureFps(performance.now());
					const hue = getHue();

					for (const p of particles) {
						for (const other of particles) {
							if (p === other) continue;
							const dist = distance(p.x, p.y, other.x, other.y);
							if (dist < LINK_RADIUS) {
								ctx.strokeStyle = `oklch(75% 0.18 ${hue} / ${0.6 * (1 - dist / LINK_RADIUS)})`;
								ctx.lineWidth = 1.5;
								ctx.beginPath();
								ctx.moveTo(p.x, p.y);
								ctx.lineTo(other.x, other.y);
								ctx.stroke();
							}
						}
					}

					for (const p of particles) {
						p.update(mouse, collisionMap);
						ctx.beginPath();
						ctx.ellipse(p.x, p.y, p.radius, p.radius, 0, 0, Math.PI * 2);
						ctx.fillStyle = `oklch(75% 0.18 ${hue})`;
						ctx.fill();
					}

					const fontSize = Math.min(width * 0.09, height * 0.15);
					ctx.font = `900 ${fontSize}px 'Inter Variable', sans-serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'middle';
					ctx.fillStyle = `oklch(75% 0.18 ${hue})`;
					ctx.fillText('ZAKI.GG', width / 2, height / 2);
				}
			};
			system = createParticleSystem(canvas!, callbacks);
		});

		return () => {
			system?.destroy();
			mouse.destroy();
		};
	});
</script>

<div class="homepage">
	<canvas bind:this={canvas}></canvas>
	<div class="debug-panel">
		<span>{fps} FPS</span>
		<span>{dpr}x DPR</span>
	</div>
</div>

<style>
	.homepage {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--base);
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.debug-panel {
		position: absolute;
		top: 1rem;
		right: 1rem;
		display: flex;
		gap: 0.5rem;
		font-size: 0.75rem;
		font-family: var(--font-mono);
		opacity: 0.5;

		span {
			padding: 0.3rem 0.6rem;
			border-radius: 4px;
			background: var(--base-1);
			color: var(--content);
			border: 1px solid var(--edge);
		}
	}
</style>
