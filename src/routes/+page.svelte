<script lang="ts">
	import { onMount } from 'svelte';
	import ThemeControls from '$lib/components/ThemeControls.svelte';
	import ParticleSettings from '$lib/components/ParticleSettings.svelte';
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
	const WALL_BOUNCE_FACTOR = 0.01;
	const DRAG = 0;

	let system: { destroy(): void; triggerResize(): void } | undefined;
	let fps = $state(0);
	let dpr = $state(0);
	let canvas = $state<HTMLCanvasElement>();
	let homepage = $state<HTMLElement>();
	let particleCount = $state(0);
	let defaultCount = $state(0);
	let restitution = $state(0.3);
	let showCollisionMap = $state(false);
	let collisionOverlay: HTMLCanvasElement | undefined;
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
		offCtx.textBaseline = 'alphabetic';

		const fontSize = Math.min(width * 0.09, height * 0.15);
		offCtx.font = `900 ${fontSize}px 'Inter Variable', sans-serif`;
		const metrics = offCtx.measureText('ZAKI.GG');
		const ascent = metrics.actualBoundingBoxAscent;
		const descent = metrics.actualBoundingBoxDescent;
		const y = height / 2 + (ascent - descent) / 2;
		offCtx.fillText('ZAKI.GG', width / 2, y);

		const overlay = document.createElement('canvas');
		overlay.width = width;
		overlay.height = height;
		const overlayCtx = overlay.getContext('2d')!;
		overlayCtx.drawImage(offscreen, 0, 0);
		overlayCtx.globalCompositeOperation = 'source-in';
		overlayCtx.fillStyle = '#ff2db2';
		overlayCtx.fillRect(0, 0, width, height);
		collisionOverlay = overlay;

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
		opacity = 0;
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
			if (DRAG > 0) {
				const speed = Math.sqrt(this.vector.x ** 2 + this.vector.y ** 2);
				if (speed > SPEED * 2) {
					this.vector.x *= 1 - DRAG;
					this.vector.y *= 1 - DRAG;
				}
			}

			if (this.x > this.width - this.radius || this.x < this.radius) this.vector.x *= -restitution;
			if (this.y > this.height - this.radius || this.y < this.radius) this.vector.y *= -restitution;
			this.x = Math.max(this.radius, Math.min(this.width - this.radius, this.x));
			this.y = Math.max(this.radius, Math.min(this.height - this.radius, this.y));

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

			const leadX = nextX + Math.sign(this.vector.x) * this.radius;
			const leadY = nextY + Math.sign(this.vector.y) * this.radius;

			if (isInText(collisionMap, leadX, leadY)) {
				const inX = isInText(collisionMap, leadX, this.y);
				const inY = isInText(collisionMap, this.x, leadY);

				if (inX && inY) {
					this.vector.x *= -restitution;
					this.vector.y *= -restitution;
				} else if (inX) {
					this.vector.x *= -restitution;
				} else if (inY) {
					this.vector.y *= -restitution;
				} else {
					this.vector.x *= -restitution;
					this.vector.y *= -restitution;
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

	let setParticleCount = $state<(count: number) => void>(() => {});

	onMount(() => {
		if (!canvas || !homepage) return;

		let particles: LinkedParticle[] = [];
		let collisionMap: ImageData;
		let currentWidth = 0;
		let currentHeight = 0;
		let prevFrameWidth = 0;
		let prevFrameHeight = 0;
		const mouse = trackMouse(canvas, 150, homepage);

		function updateParticleCount(count: number) {
			const target = Math.max(0, Math.round(count));
			while (particles.length < target) {
				particles.push(new LinkedParticle(currentWidth, currentHeight, collisionMap));
			}
			while (particles.length > target) {
				particles.pop();
			}
			particleCount = particles.length;
		}

		setParticleCount = updateParticleCount;

		document.fonts.ready.then(() => {
			const callbacks: ParticleSystemCallbacks = {
				setup(ctx, width, height) {
					currentWidth = width;
					currentHeight = height;
					prevFrameWidth = width;
					prevFrameHeight = height;
					collisionMap = getTextCollisionMap(ctx, width, height);
					particles = [];
					const count = Math.floor((width * height) / 12000);
					for (let i = 0; i < count; i++) {
						particles.push(new LinkedParticle(width, height, collisionMap));
					}
					defaultCount = count;
					particleCount = particles.length;
				},

				resize(ctx, width, height) {
					currentWidth = width;
					currentHeight = height;
					collisionMap = getTextCollisionMap(ctx, width, height);

					for (const p of particles) {
						p.width = width;
						p.height = height;
						p.x = Math.min(p.x, width - p.radius);
						p.y = Math.min(p.y, height - p.radius);
					}

					defaultCount = Math.floor((width * height) / 12000);
				},

				frame(ctx, width, height) {
					measureFps(performance.now());
					const hue = getHue();

					const dxWall = prevFrameWidth - width;
					const dyWall = prevFrameHeight - height;
					prevFrameWidth = width;
					prevFrameHeight = height;

					if (dxWall !== 0 || dyWall !== 0) {
						for (const p of particles) {
							if (dxWall > 0 && p.x >= width - p.radius - 1) {
								p.vector.x -= dxWall * WALL_BOUNCE_FACTOR;
							}
							if (dyWall > 0 && p.y >= height - p.radius - 1) {
								p.vector.y -= dyWall * WALL_BOUNCE_FACTOR;
							}
						}
					}

					for (const p of particles) {
						p.opacity += (1 - p.opacity) * 0.02;

						for (const other of particles) {
							if (p === other) continue;
							const dist = distance(p.x, p.y, other.x, other.y);
							if (dist < LINK_RADIUS) {
								const linkAlpha =
									0.6 * (1 - dist / LINK_RADIUS) * Math.min(p.opacity, other.opacity);
								ctx.strokeStyle = `oklch(75% 0.18 ${hue} / ${linkAlpha})`;
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
						ctx.fillStyle = `oklch(75% 0.18 ${hue} / ${p.opacity})`;
						ctx.fill();
					}

					const fontSize = Math.min(width * 0.09, height * 0.15);
					ctx.font = `900 ${fontSize}px 'Inter Variable', sans-serif`;
					ctx.textAlign = 'center';
					ctx.textBaseline = 'alphabetic';
					ctx.fillStyle = `oklch(75% 0.18 ${hue})`;
					const metrics = ctx.measureText('ZAKI.GG');
					const ascent = metrics.actualBoundingBoxAscent;
					const descent = metrics.actualBoundingBoxDescent;
					const y = height / 2 + (ascent - descent) / 2;
					ctx.fillText('ZAKI.GG', width / 2, y);

					if (showCollisionMap && collisionOverlay) {
						ctx.save();
						ctx.globalAlpha = 0.65;
						ctx.drawImage(collisionOverlay, 0, 0, width, height);
						ctx.restore();
					}
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

<div bind:this={homepage} class="homepage" class:collision-debug={showCollisionMap}>
	<canvas bind:this={canvas}></canvas>
	<div class="hero-center">
		<h1>ZAKI.GG</h1>
		<div class="playground-controls">
			<ThemeControls />
			<ParticleSettings
				count={particleCount}
				{defaultCount}
				{restitution}
				onCountChange={setParticleCount}
				onRestitutionChange={(value) => (restitution = value)}
			/>
		</div>
	</div>
	<div class="debug-panel">
		<span>{fps} FPS</span>
		<span>{dpr}x DPR</span>
		<button
			class="toggle"
			class:active={showCollisionMap}
			onclick={() => (showCollisionMap = !showCollisionMap)}
		>
			Hitbox
		</button>
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
		animation: fade-in 1.2s;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.hero-center {
		left: 50%;
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
	}

	h1 {
		color: oklch(75% 0.18 var(--hue));
		font-family: 'Inter Variable', sans-serif;
		font-size: min(9vw, 15vh);
		font-weight: 900;
		margin: 0;
		pointer-events: none;
		white-space: nowrap;
	}

	.collision-debug h1 {
		opacity: 0.35;
	}

	.playground-controls {
		align-items: center;
		display: grid;
		gap: var(--s0);
		justify-items: center;
		left: 50%;
		position: absolute;
		top: calc(100% + var(--s-1));
		transform: translateX(-50%);
	}

	.debug-panel {
		position: absolute;
		top: 1rem;
		right: 1rem;
		display: flex;
		align-items: center;
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

		.toggle {
			padding: 0.3rem 0.6rem;
			border-radius: 4px;
			background: var(--base-1);
			color: var(--content);
			border: 1px solid var(--edge);
			cursor: pointer;
			opacity: 0.5;

			&.active {
				opacity: 1;
			}
		}
	}

	@media (max-width: 64rem) {
		.debug-panel {
			display: none;
		}
	}

	@media (max-width: 48rem) {
		.homepage {
			bottom: var(--mobile-nav-height);
			height: auto;
		}
	}
</style>
