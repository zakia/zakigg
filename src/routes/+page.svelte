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
	const WALL_BOUNCE_FACTOR = 0.01;
	const DRAG = 0;
	const RESTITUTION = 0.3;

	let system: { destroy(): void; triggerResize(): void } | undefined;
	let fps = $state(0);
	let dpr = $state(0);
	let canvas = $state<HTMLCanvasElement>();
	let particleCount = $state(0);
	let defaultCount = $state(0);
	let autoResize = $state(true);
	let frameCount = 0;
	let lastFpsUpdate = 0;

	const isModified = $derived(particleCount !== defaultCount);

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

			if (this.x > this.width - this.radius || this.x < this.radius) this.vector.x *= -RESTITUTION;
			if (this.y > this.height - this.radius || this.y < this.radius) this.vector.y *= -RESTITUTION;
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
					this.vector.x *= -RESTITUTION;
					this.vector.y *= -RESTITUTION;
				} else if (inX) {
					this.vector.x *= -RESTITUTION;
				} else if (inY) {
					this.vector.y *= -RESTITUTION;
				} else {
					this.vector.x *= -RESTITUTION;
					this.vector.y *= -RESTITUTION;
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

	let addParticles: (n: number) => void = () => {};
	let removeParticles: (n: number) => void = () => {};
	let resetParticles: () => void = () => {};

	let scrubbing = $state(false);
	let didScrub = false;

	function startScrub(e: PointerEvent) {
		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);
		scrubbing = true;
		didScrub = false;
		const startX = e.clientX;
		const startCount = particleCount;

		function onMove(ev: PointerEvent) {
			const dx = ev.clientX - startX;
			if (Math.abs(dx) > 3) didScrub = true;
			const sign = Math.sign(dx);
			const abs = Math.abs(dx);
			const delta = sign * Math.round(Math.pow(abs / 8, 1.4));
			const target = Math.max(0, startCount + delta);
			const diff = target - particleCount;
			if (diff > 0) addParticles(diff);
			else if (diff < 0) removeParticles(-diff);
		}

		function cleanup() {
			scrubbing = false;
			target.removeEventListener('pointermove', onMove);
			target.removeEventListener('lostpointercapture', cleanup);
		}

		target.addEventListener('pointermove', onMove);
		target.addEventListener('lostpointercapture', cleanup);
	}

	function handleCountClick() {
		if (didScrub) return;
		if (isModified) resetParticles();
	}

	onMount(() => {
		if (!canvas) return;

		let particles: LinkedParticle[] = [];
		let collisionMap: ImageData;
		let currentWidth = 0;
		let currentHeight = 0;
		let prevFrameWidth = 0;
		let prevFrameHeight = 0;
		const mouse = trackMouse(canvas);

		function adjustCount(delta: number) {
			const target = Math.max(0, particles.length + delta);
			while (particles.length < target) {
				particles.push(new LinkedParticle(currentWidth, currentHeight, collisionMap));
			}
			while (particles.length > target) {
				particles.pop();
			}
			particleCount = particles.length;
		}

		addParticles = (n: number) => adjustCount(n);
		removeParticles = (n: number) => adjustCount(-n);
		resetParticles = () => {
			adjustCount(defaultCount - particles.length);
		};

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
					if (autoResize) {
						const targetCount = defaultCount;
						while (particles.length < targetCount) {
							particles.push(new LinkedParticle(width, height, collisionMap));
						}
						while (particles.length > targetCount) {
							particles.pop();
						}
						particleCount = particles.length;
					}
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
								const linkAlpha = 0.6 * (1 - dist / LINK_RADIUS) * Math.min(p.opacity, other.opacity);
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
	<h1>ZAKI.GG</h1>
	<div class="controls">
		<button onclick={() => removeParticles(10)}>«</button>
		<button onclick={() => removeParticles(1)}>‹</button>
		<button
			class="count"
			class:modified={isModified}
			class:scrubbing
			onclick={handleCountClick}
			onpointerdown={startScrub}
		>
			{#if isModified}<span class="dot"></span>{/if}
			{particleCount}
		</button>
		<button onclick={() => addParticles(1)}>›</button>
		<button onclick={() => addParticles(10)}>»</button>
	</div>
	<div class="debug-panel">
		<span>{fps} FPS</span>
		<span>{dpr}x DPR</span>
		<button class="toggle" class:active={autoResize} onclick={() => (autoResize = !autoResize)}>
			Auto
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
		from { opacity: 0; }
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	h1 {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		font-weight: 900;
		font-size: min(9vw, 15vh);
		font-family: 'Inter Variable', sans-serif;
		color: oklch(75% 0.18 var(--hue));
		pointer-events: none;
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

	.controls {
		position: absolute;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.85rem;

		button {
			padding: 0.3rem 0.6rem;
			border-radius: 4px;
			border: 1px solid var(--edge);
			background: var(--base-1);
			color: var(--content);
			cursor: pointer;
			font-size: 1rem;
			line-height: 1;
			transition: background 0.1s;

			&:hover {
				background: var(--base-2);
			}
		}

		.count {
			position: relative;
			min-width: 3ch;
			text-align: center;
			font-size: 0.85rem;
			cursor: ew-resize;
			background: none;
			border: none;
			padding: 0.3rem 0.6rem;

			&:hover {
				background: none;
			}

			&.modified {
				cursor: ew-resize;
			}

			&.scrubbing {
				cursor: ew-resize;
			}
		}

		.dot {
			position: absolute;
			top: -2px;
			left: 50%;
			transform: translateX(-50%);
			width: 5px;
			height: 5px;
			border-radius: 50%;
			background: oklch(65% 0.2 var(--hue));
		}
	}
</style>
