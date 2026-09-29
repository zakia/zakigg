<script lang="ts">
	import { onMount, tick } from 'svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import CanvasSettings from '$lib/components/CanvasSettings.svelte';
	import ThemeControls from '$lib/components/ThemeControls.svelte';
	import ParticleSettings from '$lib/components/ParticleSettings.svelte';
	import { createParticleSystem, type ParticleSystemCallbacks } from '$lib/particles';
	import {
		createPointerFieldFollower,
		defaultPointerSettings,
		resolvePointerEffect,
		trackPlaygroundPointer
	} from '$lib/home/pointer-interaction';
	import { drawPointerFeedback } from '$lib/home/pointer-feedback';
	import { defaultParticleAppearance } from '$lib/home/particle-appearance';
	import { applyRadialField, DEFAULT_MIN_ACCELERATION, PHYSICS_STEP } from '$lib/home/physics';

	const SPEED = 24;
	const RADIUS = 4;
	const RADIUS_DELTA = 3;
	const WALL_BOUNCE_FACTOR = 0.6;

	let system: { destroy(): void; triggerResize(): void } | undefined;
	let fps = $state(0);
	let frameInterval = $state(0);
	let dpr = $state(0);
	let canvas = $state<HTMLCanvasElement>();
	let homepage = $state<HTMLElement>();
	let heading = $state<HTMLHeadingElement>();
	let particleCount = $state(0);
	let defaultCount = $state(0);
	let restitution = $state(0.3);
	let pointerSettings = $state({
		hover: { ...defaultPointerSettings.hover },
		press: { ...defaultPointerSettings.press }
	});
	let appearance = $state({ ...defaultParticleAppearance });
	let minAcceleration = $state(DEFAULT_MIN_ACCELERATION);
	let canvasSize = $state({ width: 0, height: 0 });
	let gameMode = $state(false);
	let pointerPressed = $state(false);
	let titleTransitioning = $state(false);
	let refreshTextCollisionMap: (() => void) | undefined;
	let frameCount = 0;
	let lastFpsUpdate = 0;
	const formattedDpr = $derived(Number(dpr.toFixed(2)));

	function measureFps(time: number) {
		frameCount++;
		const elapsed = time - lastFpsUpdate;
		if (elapsed >= 1000) {
			frameInterval = elapsed / frameCount;
			fps = Math.round(1000 / frameInterval);
			frameCount = 0;
			lastFpsUpdate = time;
			dpr = window.devicePixelRatio;
		}
	}

	function getTextCollisionMap(width: number, height: number): ImageData {
		const offscreen = document.createElement('canvas');
		offscreen.width = width;
		offscreen.height = height;
		const offCtx = offscreen.getContext('2d')!;

		offCtx.fillStyle = 'white';
		offCtx.textAlign = 'center';
		offCtx.textBaseline = 'alphabetic';

		if (!heading || !homepage || gameMode || titleTransitioning)
			return offCtx.getImageData(0, 0, width, height);
		const headingStyle = getComputedStyle(heading);
		const headingRect = heading.getBoundingClientRect();
		const homeRect = homepage.getBoundingClientRect();
		offCtx.font = `${headingStyle.fontWeight} ${headingStyle.fontSize} ${headingStyle.fontFamily}`;
		const metrics = offCtx.measureText('ZAKI.GG');
		const ascent = metrics.actualBoundingBoxAscent;
		const descent = metrics.actualBoundingBoxDescent;
		const x = headingRect.left - homeRect.left + headingRect.width / 2;
		const y = headingRect.top - homeRect.top + (headingRect.height + ascent - descent) / 2;
		offCtx.fillText('ZAKI.GG', x, y);

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
		velocity: { x: number; y: number };

		constructor(width: number, height: number, collisionMap: ImageData) {
			this.width = width;
			this.height = height;
			this.radius = RADIUS + Math.random() * RADIUS_DELTA;
			const speed = SPEED + Math.random() * SPEED;
			const angle = Math.random() * Math.PI * 2;
			this.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };

			do {
				this.x = Math.random() * width;
				this.y = Math.random() * height;
			} while (isInText(collisionMap, this.x, this.y));
		}

		update(collisionMap: ImageData, dt: number) {
			if (this.x > this.width - this.radius || this.x < this.radius)
				this.velocity.x *= -restitution;
			if (this.y > this.height - this.radius || this.y < this.radius)
				this.velocity.y *= -restitution;
			this.x = Math.max(this.radius, Math.min(this.width - this.radius, this.x));
			this.y = Math.max(this.radius, Math.min(this.height - this.radius, this.y));

			const nextX = this.x + this.velocity.x * dt;
			const nextY = this.y + this.velocity.y * dt;

			const leadX = nextX + Math.sign(this.velocity.x) * this.radius;
			const leadY = nextY + Math.sign(this.velocity.y) * this.radius;

			if (isInText(collisionMap, leadX, leadY)) {
				const inX = isInText(collisionMap, leadX, this.y);
				const inY = isInText(collisionMap, this.x, leadY);

				if (inX && inY) {
					this.velocity.x *= -restitution;
					this.velocity.y *= -restitution;
				} else if (inX) {
					this.velocity.x *= -restitution;
				} else if (inY) {
					this.velocity.y *= -restitution;
				} else {
					this.velocity.x *= -restitution;
					this.velocity.y *= -restitution;
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

	async function toggleGameMode() {
		titleTransitioning = true;
		gameMode = !gameMode;
		refreshTextCollisionMap?.();
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			await tick();
			titleTransitioning = false;
			refreshTextCollisionMap?.();
		}
	}

	function onTitleTransitionEnd(event: TransitionEvent) {
		if (event.target !== event.currentTarget || event.propertyName !== 'top') return;
		titleTransitioning = false;
		refreshTextCollisionMap?.();
	}

	onMount(() => {
		if (!canvas || !homepage) return;

		let particles: LinkedParticle[] = [];
		let collisionMap: ImageData;
		let currentWidth = 0;
		let currentHeight = 0;
		let prevFrameWidth = 0;
		let prevFrameHeight = 0;
		const pointer = trackPlaygroundPointer(canvas, homepage);
		const fieldFollower = createPointerFieldFollower();
		let previousTime = 0;
		let physicsAccumulator = 0;
		refreshTextCollisionMap = () => {
			if (currentWidth && currentHeight) {
				collisionMap = getTextCollisionMap(currentWidth, currentHeight);
			}
		};

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
				setup(_ctx, width, height) {
					canvasSize = { width: canvas!.width, height: canvas!.height };
					currentWidth = width;
					currentHeight = height;
					prevFrameWidth = width;
					prevFrameHeight = height;
					collisionMap = getTextCollisionMap(width, height);
					particles = [];
					const count = Math.floor((width * height) / 12000);
					for (let i = 0; i < count; i++) {
						particles.push(new LinkedParticle(width, height, collisionMap));
					}
					defaultCount = count;
					particleCount = particles.length;
				},

				resize(_ctx, width, height, oldWidth, oldHeight) {
					canvasSize = { width: canvas!.width, height: canvas!.height };
					currentWidth = width;
					currentHeight = height;
					collisionMap = getTextCollisionMap(width, height);

					for (const p of particles) {
						p.width = width;
						p.height = height;
						p.x = Math.max(p.radius, Math.min((p.x / oldWidth) * width, width - p.radius));
						p.y = Math.max(p.radius, Math.min((p.y / oldHeight) * height, height - p.radius));
					}
				},

				frame(ctx, width, height, time) {
					measureFps(time);
					const hue = getHue();
					if (previousTime === 0) previousTime = time;
					physicsAccumulator += Math.min((time - previousTime) / 1000, 0.1);
					previousTime = time;

					const dxWall = prevFrameWidth - width;
					const dyWall = prevFrameHeight - height;
					prevFrameWidth = width;
					prevFrameHeight = height;

					if (dxWall !== 0 || dyWall !== 0) {
						for (const p of particles) {
							if (dxWall > 0 && p.x >= width - p.radius - 1) {
								p.velocity.x -= dxWall * WALL_BOUNCE_FACTOR;
							}
							if (dyWall > 0 && p.y >= height - p.radius - 1) {
								p.velocity.y -= dyWall * WALL_BOUNCE_FACTOR;
							}
						}
					}

					const pointerState = pointer.current;
					const pressed = pointerState.phase === 'press';
					if (pressed !== pointerPressed) pointerPressed = pressed;
					const targetEffect = resolvePointerEffect(pointerState, pointerSettings, time);
					let pointerEffect = fieldFollower.step(targetEffect, 0);
					while (physicsAccumulator >= PHYSICS_STEP) {
						pointerEffect = fieldFollower.step(targetEffect, PHYSICS_STEP);
						for (const p of particles) {
							if (pointerEffect) applyRadialField(p, pointerEffect, PHYSICS_STEP, minAcceleration);
							p.update(collisionMap, PHYSICS_STEP);
						}
						physicsAccumulator -= PHYSICS_STEP;
					}

					for (const p of particles) p.opacity += (1 - p.opacity) * 0.02;

					const linkRadius = appearance.linkRadius;
					if (linkRadius > 0 && appearance.linkOpacity > 0) {
						const linkRadiusSquared = linkRadius * linkRadius;
						for (let i = 0; i < particles.length; i++) {
							const p = particles[i];
							for (let j = i + 1; j < particles.length; j++) {
								const other = particles[j];
								const dx = p.x - other.x;
								const dy = p.y - other.y;
								const distanceSquared = dx * dx + dy * dy;
								if (distanceSquared >= linkRadiusSquared) continue;
								const linkAlpha =
									appearance.linkOpacity *
									(1 - Math.sqrt(distanceSquared) / linkRadius) *
									Math.min(p.opacity, other.opacity);
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
						ctx.beginPath();
						ctx.ellipse(p.x, p.y, p.radius, p.radius, 0, 0, Math.PI * 2);
						ctx.fillStyle = `oklch(75% 0.18 ${hue} / ${appearance.dotOpacity * p.opacity})`;
						ctx.fill();
					}

					drawPointerFeedback(ctx, pointerEffect, hue);
				}
			};
			system = createParticleSystem(canvas!, callbacks);
		});

		return () => {
			system?.destroy();
			pointer.destroy();
			refreshTextCollisionMap = undefined;
		};
	});
</script>

<div
	bind:this={homepage}
	class="homepage"
	class:game-mode={gameMode}
	class:is-pressing={pointerPressed}
>
	<canvas bind:this={canvas}></canvas>
	<div class="hero-title" ontransitionend={onTitleTransitionEnd}>
		<h1 bind:this={heading}>ZAKI.GG</h1>
	</div>
	<div class="playground-controls">
		<ThemeControls />
		<div class="simulation-controls">
			<ParticleSettings
				count={particleCount}
				{defaultCount}
				{restitution}
				onCountChange={setParticleCount}
				onRestitutionChange={(value) => (restitution = value)}
			/>
			<CanvasSettings
				settings={pointerSettings}
				{appearance}
				{minAcceleration}
				onSettingsChange={(settings) => (pointerSettings = settings)}
				onAppearanceChange={(next) => (appearance = next)}
				onMinAccelerationChange={(value) => (minAcceleration = value)}
			/>
		</div>
		<button type="button" class="game-mode-toggle" aria-pressed={gameMode} onclick={toggleGameMode}>
			{gameMode ? 'Back to title' : 'Explore canvas'}
			<span aria-hidden="true">{gameMode ? '↑' : '↓'}</span>
		</button>
	</div>
	{#if fps > 0}
		<details class="performance-readout">
			<summary>
				{fps} FPS
				<span class="readout-chevron" aria-hidden="true"></span>
			</summary>
			<div class="diagnostics">
				<dl>
					<div>
						<dt>
							DPR
							<InfoTip
								label="What is DPR?"
								text="Device pixel ratio: display pixels per CSS pixel. Higher values make the canvas sharper but increase the number of pixels to draw."
							/>
						</dt>
						<dd>{formattedDpr}×</dd>
					</div>
					<div>
						<dt>
							Frame interval
							<InfoTip
								label="What is frame interval?"
								text="Average time between animation frames over the past second. A smaller interval means more frequent updates."
							/>
						</dt>
						<dd>~{frameInterval.toFixed(1)} ms</dd>
					</div>
					<div>
						<dt>
							Canvas size
							<InfoTip
								label="What is canvas size?"
								text="The canvas bitmap size in device pixels. It can be larger than the visible CSS size when DPR is above 1."
							/>
						</dt>
						<dd>{canvasSize.width} × {canvasSize.height} px</dd>
					</div>
				</dl>
			</div>
		</details>
	{/if}
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
		touch-action: none;
	}

	.homepage.is-pressing,
	.homepage.is-pressing :global(*) {
		cursor: none !important;
	}

	.hero-title {
		left: 50%;
		pointer-events: none;
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		transition:
			left 650ms cubic-bezier(0.22, 1, 0.36, 1),
			top 650ms cubic-bezier(0.22, 1, 0.36, 1),
			transform 650ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	h1 {
		color: var(--brand);
		font-family: 'Inter Variable', sans-serif;
		font-size: min(9vw, 15vh);
		font-weight: 900;
		line-height: 1.12;
		margin: 0;
		pointer-events: none;
		transition: font-size 650ms cubic-bezier(0.22, 1, 0.36, 1);
		user-select: none;
		white-space: nowrap;
	}

	.playground-controls {
		display: grid;
		justify-items: center;
		gap: var(--s-2);
		left: 0;
		margin-inline: auto;
		pointer-events: auto;
		position: absolute;
		right: 0;
		top: calc(50% + min(9vw, 15vh) * 0.56 + var(--s0));
		transition: top 650ms cubic-bezier(0.22, 1, 0.36, 1);
		user-select: none;
		width: max-content;
	}

	.game-mode .hero-title {
		left: 1.25rem;
		top: 1rem;
		transform: translate(0, 0);
	}

	.game-mode h1 {
		font-size: clamp(1.75rem, 3vw, 2.5rem);
	}

	.game-mode .playground-controls {
		top: 1rem;
	}

	.game-mode-toggle {
		align-items: center;
		background: transparent;
		border: 0;
		border-radius: 999px;
		color: var(--content-1);
		cursor: pointer;
		display: inline-flex;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		gap: 0.5rem;
		padding: 0.35rem 0.55rem;
	}

	.game-mode-toggle:hover {
		color: var(--brand);
	}

	.game-mode-toggle:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.simulation-controls {
		align-items: center;
		display: flex;
		gap: var(--s-2);
	}

	.performance-readout {
		color: var(--content-1);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-variant-numeric: tabular-nums;
		position: absolute;
		top: 1rem;
		right: 1rem;
		user-select: none;
	}

	.performance-readout summary {
		align-items: center;
		background: color-mix(in oklch, var(--base-1) 85%, transparent);
		border: 1px solid var(--edge);
		border-radius: 999px;
		cursor: pointer;
		display: flex;
		gap: 0.55rem;
		list-style: none;
		padding: 0.3rem 0.65rem;
	}

	.performance-readout summary::-webkit-details-marker {
		display: none;
	}

	.performance-readout summary:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 2px;
	}

	.readout-chevron {
		border-bottom: 1.5px solid currentColor;
		border-right: 1.5px solid currentColor;
		height: 0.35rem;
		transform: rotate(45deg) translateY(-2px);
		width: 0.35rem;
	}

	.performance-readout[open] .readout-chevron {
		transform: rotate(225deg) translateY(-2px);
	}

	.diagnostics {
		background: color-mix(in oklch, var(--base-1) 96%, transparent);
		border: 1px solid var(--edge);
		border-radius: var(--radius-lg);
		box-shadow: 0 12px 30px rgb(0 0 0 / 0.08);
		padding: var(--s-1);
		position: absolute;
		right: 0;
		top: calc(100% + var(--s-2));
		width: 15rem;
	}

	.diagnostics dl {
		display: grid;
		gap: var(--s-2);
		margin: 0;
	}

	.diagnostics dl > div {
		align-items: center;
		display: flex;
		gap: var(--s-1);
		justify-content: space-between;
	}

	.diagnostics dt {
		align-items: center;
		display: inline-flex;
		gap: 0.15rem;
	}

	.diagnostics dd {
		color: var(--content);
		margin: 0;
		white-space: nowrap;
	}

	@media (max-width: 64rem) {
		.performance-readout {
			display: none;
		}
	}

	@media (max-width: 48rem) {
		.homepage {
			bottom: var(--mobile-nav-height);
			height: auto;
		}

		.game-mode .hero-title {
			left: 1rem;
			top: 0.75rem;
		}

		.game-mode .playground-controls {
			top: 4rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-title,
		h1,
		.playground-controls {
			transition: none;
		}
	}
</style>
