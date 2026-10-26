<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import InfoTip from '#lib/components/InfoTip.svelte';
	import CanvasSettings from '#lib/components/CanvasSettings.svelte';
	import ThemeControls from '#lib/components/ThemeControls.svelte';
	import ParticleSettings from '#lib/components/ParticleSettings.svelte';
	import DraggableValue from '#lib/components/DraggableValue.svelte';
	import { createParticleSystem, type ParticleSystemCallbacks } from '#lib/particles.js';
	import {
		createPointerFieldFollower,
		resolvePointerEffect,
		trackPlaygroundPointer
	} from '#lib/home/pointer-interaction.js';
	import { drawPointerFeedback, drawToolCursor } from '#lib/home/pointer-feedback.js';
	import {
		buildPlaygroundControlSections,
		createDefaultPlaygroundGroups,
		toPointerSettings
	} from '#lib/home/particle-appearance.js';
	import {
		appendWallPoint,
		applyRadialField,
		collideWithWalls,
		createWallStroke,
		eraseWallsAt,
		rebuildWallStrokeGeometry,
		type WallStroke
	} from '#lib/home/physics.js';

	const SPEED = 24;
	const RADIUS = 4;
	const RADIUS_DELTA = 3;
	const WALL_BOUNCE_FACTOR = 0.6;
	const MIN_DRAW_SEGMENT_SQ = 16;

	let system: { destroy(): void; triggerResize(): void } | undefined;
	let fps = $state(0);
	let frameInterval = $state(0);
	let dpr = $state(0);
	let canvas = $state<HTMLCanvasElement>();
	let homepage = $state<HTMLElement>();
	let groups = $state(createDefaultPlaygroundGroups(0));
	let walls: WallStroke[] = [];
	let wallCount = $state(0);
	let canvasSize = $state({ width: 0, height: 0 });
	let gameMode = $state(false);
	let pointerPressed = $state(false);
	let shiftPressed = false;
	let frameCount = 0;
	let lastFpsUpdate = 0;
	const formattedDpr = $derived(Number(dpr.toFixed(2)));
	const pointerSettings = $derived(toPointerSettings(groups));

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

	class LinkedParticle {
		width: number;
		height: number;
		x: number;
		y: number;
		radius: number;
		opacity = 0;
		velocity: { x: number; y: number };

		constructor(width: number, height: number) {
			this.width = width;
			this.height = height;
			this.radius = RADIUS + Math.random() * RADIUS_DELTA;
			const speed = SPEED + Math.random() * SPEED;
			const angle = Math.random() * Math.PI * 2;
			this.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };

			this.x = Math.random() * width;
			this.y = Math.random() * height;
		}

		update(dt: number, bounce: number, wallsEnabled: boolean) {
			this.x += this.velocity.x * dt;
			this.y += this.velocity.y * dt;

			if (wallsEnabled) {
				if (this.x > this.width - this.radius || this.x < this.radius) this.velocity.x *= -bounce;
				if (this.y > this.height - this.radius || this.y < this.radius) this.velocity.y *= -bounce;
				this.x = Math.max(this.radius, Math.min(this.width - this.radius, this.x));
				this.y = Math.max(this.radius, Math.min(this.height - this.radius, this.y));
			} else {
				const spanX = this.width + this.radius * 2;
				const spanY = this.height + this.radius * 2;
				if (this.x < -this.radius) this.x += spanX;
				else if (this.x > this.width + this.radius) this.x -= spanX;
				if (this.y < -this.radius) this.y += spanY;
				else if (this.y > this.height + this.radius) this.y -= spanY;
			}
		}
	}

	function getHue() {
		return document.documentElement.style.getPropertyValue('--hue') || '145';
	}

	let setParticleCount = $state<(count: number) => void>(() => {});

	const controlSections = $derived(
		buildPlaygroundControlSections(groups, wallCount, {
			onDotsChange(next) {
				const countChanged = next.count !== groups.dots.count;
				groups.dots = next;
				if (countChanged) setParticleCount(next.count);
			},
			onLinksChange(next) {
				groups.links = next;
			},
			onHoverChange(next) {
				groups.hover = next;
			},
			onClickChange(next) {
				groups.click = next;
			},
			onWorldChange(next) {
				groups.world = next;
			},
			onClearWalls() {
				walls = [];
				wallCount = 0;
			}
		})
	);

	onMount(() => {
		if (!canvas || !homepage) return;

		let particles: LinkedParticle[] = [];
		let currentWidth = 0;
		let currentHeight = 0;
		let prevFrameWidth = 0;
		let prevFrameHeight = 0;

		function handleDrawPoint(point: { x: number; y: number }, isStart: boolean, shiftKey: boolean) {
			shiftPressed = shiftKey;
			if (groups.click.mode === 'erase') {
				const result = eraseWallsAt(
					walls,
					point,
					groups.click.eraserRadius,
					shiftKey ? 'stroke' : 'spot'
				);
				if (result.changed) {
					walls = result.walls;
					wallCount = walls.length;
				}
				return;
			}
			if (groups.click.mode !== 'draw') return;
			if (isStart || walls.length === 0) {
				walls.push(createWallStroke(point, groups.click.strokeWidth, groups.click.wallOpacity));
				wallCount = walls.length;
				return;
			}
			const activeWall = walls[walls.length - 1];
			const lastPoint = activeWall.points[activeWall.points.length - 1];
			const dx = point.x - lastPoint.x;
			const dy = point.y - lastPoint.y;
			if (dx * dx + dy * dy >= MIN_DRAW_SEGMENT_SQ) {
				appendWallPoint(activeWall, point);
			}
		}

		function handleKeyEvent(event: KeyboardEvent) {
			shiftPressed = event.shiftKey;
		}
		function handleWindowBlur() {
			shiftPressed = false;
		}
		window.addEventListener('keydown', handleKeyEvent);
		window.addEventListener('keyup', handleKeyEvent);
		window.addEventListener('blur', handleWindowBlur);

		const pointer = trackPlaygroundPointer(canvas, homepage, handleDrawPoint);
		const fieldFollower = createPointerFieldFollower();
		let previousTime = 0;
		let physicsAccumulator = 0;

		function updateParticleCount(count: number) {
			const target = Math.max(0, Math.round(count));
			while (particles.length < target) {
				particles.push(new LinkedParticle(currentWidth, currentHeight));
			}
			while (particles.length > target) {
				particles.pop();
			}
			groups.dots.count = particles.length;
		}

		setParticleCount = updateParticleCount;

		const callbacks: ParticleSystemCallbacks = {
			setup(_ctx, width, height) {
				canvasSize = { width: canvas!.width, height: canvas!.height };
				currentWidth = width;
				currentHeight = height;
				prevFrameWidth = width;
				prevFrameHeight = height;
				particles = [];
				const count = Math.floor((width * height) / 12000);
				for (let i = 0; i < count; i++) {
					particles.push(new LinkedParticle(width, height));
				}
				groups.dots.defaultCount = count;
				groups.dots.count = particles.length;
			},

			resize(_ctx, width, height, oldWidth, oldHeight) {
				canvasSize = { width: canvas!.width, height: canvas!.height };
				currentWidth = width;
				currentHeight = height;

				for (const p of particles) {
					p.width = width;
					p.height = height;
					p.x = Math.max(p.radius, Math.min((p.x / oldWidth) * width, width - p.radius));
					p.y = Math.max(p.radius, Math.min((p.y / oldHeight) * height, height - p.radius));
				}

				if (oldWidth > 0 && oldHeight > 0) {
					for (const wall of walls) {
						for (const pt of wall.points) {
							pt.x = (pt.x / oldWidth) * width;
							pt.y = (pt.y / oldHeight) * height;
						}
						rebuildWallStrokeGeometry(wall);
					}
				}
			},

			frame(ctx, width, height, time) {
				measureFps(time);
				const hue = getHue();
				const timeScale = Math.max(0, groups.world.timeScale);
				const physicsStep = 1 / Math.max(30, groups.world.tickRate);
				if (previousTime === 0) previousTime = time;
				physicsAccumulator += Math.min((time - previousTime) / 1000, 0.1) * timeScale;
				previousTime = time;

				const dxWall = prevFrameWidth - width;
				const dyWall = prevFrameHeight - height;
				prevFrameWidth = width;
				prevFrameHeight = height;

				const wallsEnabled = groups.world.walls;
				if (wallsEnabled && (dxWall !== 0 || dyWall !== 0)) {
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
				const minAccel = groups.world.minAcceleration;
				const bounce = groups.dots.bounce;

				while (physicsAccumulator >= physicsStep) {
					pointerEffect = fieldFollower.step(targetEffect, physicsStep);
					for (const p of particles) {
						if (pointerEffect) applyRadialField(p, pointerEffect, physicsStep, minAccel);
						p.update(physicsStep, bounce, wallsEnabled);
						if (walls.length > 0) collideWithWalls(p, walls, bounce);
					}
					physicsAccumulator -= physicsStep;
				}

				for (const p of particles) p.opacity += (1 - p.opacity) * 0.02;

				for (const wall of walls) {
					if (wall.points.length === 0) continue;
					ctx.strokeStyle = `oklch(75% 0.18 ${hue} / ${wall.opacity})`;
					ctx.fillStyle = `oklch(75% 0.18 ${hue} / ${wall.opacity})`;
					ctx.lineWidth = wall.strokeWidth;
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					if (wall.points.length === 1) {
						ctx.beginPath();
						ctx.arc(wall.points[0].x, wall.points[0].y, wall.strokeWidth * 0.5, 0, Math.PI * 2);
						ctx.fill();
					} else if (wall.path) {
						ctx.stroke(wall.path);
					} else {
						ctx.beginPath();
						ctx.moveTo(wall.points[0].x, wall.points[0].y);
						for (let i = 1; i < wall.points.length; i++) {
							ctx.lineTo(wall.points[i].x, wall.points[i].y);
						}
						ctx.stroke();
					}
				}

				const {
					enabled: linksEnabled,
					radius: linkRadius,
					opacity: linkOpacity,
					dropoff
				} = groups.links;
				if (linksEnabled && linkRadius > 0 && linkOpacity > 0) {
					const linkRadiusSquared = linkRadius * linkRadius;
					for (let i = 0; i < particles.length; i++) {
						const p = particles[i];
						for (let j = i + 1; j < particles.length; j++) {
							const other = particles[j];
							const dx = p.x - other.x;
							const dy = p.y - other.y;
							const distanceSquared = dx * dx + dy * dy;
							if (distanceSquared >= linkRadiusSquared) continue;
							const distRatio = Math.sqrt(distanceSquared) / linkRadius;
							const falloff = dropoff === 0 ? 1 : Math.pow(1 - distRatio, dropoff);
							const linkAlpha = linkOpacity * falloff * Math.min(p.opacity, other.opacity);
							ctx.strokeStyle = `oklch(75% 0.18 ${hue} / ${linkAlpha})`;
							ctx.lineWidth = 1.5;
							ctx.beginPath();
							ctx.moveTo(p.x, p.y);
							ctx.lineTo(other.x, other.y);
							ctx.stroke();
						}
					}
				}

				const dotOpacity = groups.dots.opacity;
				for (const p of particles) {
					ctx.beginPath();
					ctx.ellipse(p.x, p.y, p.radius, p.radius, 0, 0, Math.PI * 2);
					ctx.fillStyle = `oklch(75% 0.18 ${hue} / ${dotOpacity * p.opacity})`;
					ctx.fill();
				}

				drawPointerFeedback(ctx, pointerEffect, hue);
				drawToolCursor(
					ctx,
					pointerState,
					groups.click.mode,
					groups.click.strokeWidth,
					groups.click.eraserRadius,
					hue,
					shiftPressed
				);
			}
		};
		system = createParticleSystem(canvas, callbacks);

		return () => {
			window.removeEventListener('keydown', handleKeyEvent);
			window.removeEventListener('keyup', handleKeyEvent);
			window.removeEventListener('blur', handleWindowBlur);
			system?.destroy();
			pointer.destroy();
		};
	});
</script>

<div
	bind:this={homepage}
	class="homepage"
	class:game-mode={gameMode}
	class:is-pressing={pointerPressed &&
		(groups.click.mode === 'pull' || groups.click.mode === 'push')}
	class:is-drawing={groups.click.mode === 'draw' || groups.click.mode === 'erase'}
>
	<canvas bind:this={canvas}></canvas>
	<div class="hero-scrim" aria-hidden="true"></div>
	<a
		href={resolve('/')}
		class="site-brand"
		aria-label="Back to Zaki.gg intro"
		inert={!gameMode}
		onclick={(event) => {
			event.preventDefault();
			gameMode = false;
		}}>ZAKI.GG</a
	>
	<div class="intro" inert={gameMode}>
		<h1 class="intro-title">Hi, I’m Zaki.</h1>
		<p class="intro-description">
			<i>Crafting interfaces.</i> Building polished software and web experiences. Experimenting with magical
			details in user interfaces.
		</p>
		<p class="intro-description">
			I'm fascinated by the idea of simple rules coming together to form
			<a href={resolve('crafts/particle-playground')}>complex systems</a>
			. I built this particle system to explore that idea.
		</p>
		<div class="dot-line">
			Currently drawing
			<DraggableValue
				label="Dots"
				showLabel={false}
				value={groups.dots.count}
				defaultValue={groups.dots.defaultCount}
				min={0}
				step={1}
				pixelsPerStep={6}
				onChange={setParticleCount}
			/>
			dots.
		</div>

		<button type="button" class="explore-button" onclick={() => (gameMode = true)}>
			Explore the canvas
			<span aria-hidden="true">↗</span>
		</button>
	</div>
	<div class="playground-controls">
		<div class="theme-controls-bar">
			<ThemeControls />
		</div>
		<div class="simulation-controls" inert={!gameMode}>
			<ParticleSettings
				count={groups.dots.count}
				defaultCount={groups.dots.defaultCount}
				restitution={groups.dots.bounce}
				clickMode={groups.click.mode}
				onCountChange={setParticleCount}
				onRestitutionChange={(bounce) => (groups.dots.bounce = bounce)}
				onClickModeChange={(mode) => (groups.click.mode = mode)}
			/>
			<CanvasSettings sections={controlSections} />
		</div>
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
		user-select: none;
		-webkit-user-select: none;
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

	.homepage.is-pressing {
		cursor: none !important;
	}

	.homepage.is-drawing canvas {
		cursor: crosshair;
	}

	.hero-scrim {
		/* background: linear-gradient(
			90deg,
			var(--base) 0%,
			color-mix(in oklch, var(--base) 94%, transparent) 24%,
			color-mix(in oklch, var(--base) 70%, transparent) 46%,
			transparent 72%
		); */
		inset: 0;
		pointer-events: none;
		position: absolute;
		transition: opacity 450ms ease;
	}

	.game-mode .hero-scrim {
		opacity: 0;
	}

	.site-brand {
		color: var(--brand);
		font-family: 'Inter Variable', sans-serif;
		font-size: 1.55rem;
		font-weight: 850;
		left: clamp(1.5rem, 6vw, 6rem);
		letter-spacing: -0.055em;
		line-height: 1;
		opacity: 0;
		pointer-events: none;
		position: absolute;
		text-decoration: none;
		top: 2rem;
		translate: 0 -0.5rem;
		transition:
			opacity 320ms ease,
			translate 650ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s 320ms;
		user-select: none;
		visibility: hidden;
		white-space: nowrap;
	}

	.game-mode .site-brand {
		opacity: 1;
		pointer-events: auto;
		translate: 0 0;
		transition:
			opacity 360ms ease 120ms,
			translate 650ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s;
		visibility: visible;
	}

	.site-brand:hover {
		color: color-mix(in oklch, var(--brand) 78%, var(--content));
	}

	.site-brand:focus-visible {
		border-radius: 0.2rem;
		outline: 2px solid var(--brand);
		outline-offset: 5px;
	}

	.playground-controls {
		display: grid;
		justify-items: center;
		gap: var(--s-2);
		left: 0;
		margin-inline: auto;
		pointer-events: none;
		position: absolute;
		right: 0;
		top: 1rem;
		transition: top 650ms cubic-bezier(0.22, 1, 0.36, 1);
		user-select: none;
		width: max-content;
	}

	.theme-controls-bar {
		display: flex;
		justify-content: center;
		pointer-events: auto;
	}

	.intro {
		box-sizing: border-box;
		left: clamp(1.5rem, 6vw, 6rem);
		opacity: 1;
		position: absolute;
		text-align: left;
		top: 50%;
		transform: translateY(-50%);
		translate: 0 0;
		transition:
			opacity 360ms ease 80ms,
			translate 650ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s;
		visibility: visible;
		width: min(35rem, calc(100% - 3rem));
	}

	.game-mode .intro {
		opacity: 0;
		pointer-events: none;
		translate: 0 -0.75rem;
		transition:
			opacity 280ms ease,
			translate 650ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s 280ms;
		visibility: hidden;
	}

	.intro-title {
		color: var(--content);
		font-size: clamp(2.8rem, 5vw, 4.1rem);
		font-weight: 750;
		letter-spacing: -0.055em;
		line-height: 1.08;
		margin: 0;
	}

	.intro-description {
		color: var(--content-1);
		font-size: 1rem;
		line-height: 1.65;
		margin: 1.1rem 0 0;
		max-width: 30rem;
	}

	.intro-description a {
		color: var(--brand);
		text-decoration-color: color-mix(in oklch, var(--brand) 50%, transparent);
		text-underline-offset: 0.16em;
	}

	.intro-description a:hover {
		text-decoration-color: var(--brand);
	}

	.intro-description a:focus-visible {
		border-radius: 0.15rem;
		outline: 2px solid var(--brand);
		outline-offset: 3px;
	}

	.dot-line {
		align-items: baseline;
		color: var(--content-1);
		display: flex;
		font-size: 1rem;
		gap: 0.3rem;
		margin-top: 1.5rem;
		white-space: nowrap;
	}

	.dot-line :global(.draggable-value) {
		display: inline-flex;
		vertical-align: baseline;
	}

	.dot-line :global(.draggable-value button) {
		background: color-mix(in oklch, var(--brand) 12%, var(--base));
		border: 1px solid color-mix(in oklch, var(--brand) 28%, var(--base));
		border-radius: 0.4rem;
		padding: 0 0.35rem;
	}

	.dot-line :global(.draggable-value output) {
		color: var(--brand);
	}

	.explore-button {
		align-items: center;
		background: var(--brand);
		border: 1px solid var(--brand);
		border-radius: 999px;
		color: var(--brand-content);
		display: inline-flex;
		font-size: 0.83rem;
		font-weight: 600;
		gap: 0.7rem;
		margin-top: 1.5rem;
		padding: 0.65rem 1rem;
		transition:
			transform 160ms ease,
			box-shadow 160ms ease;
	}

	.explore-button:hover {
		box-shadow: 0 8px 24px color-mix(in oklch, var(--brand) 25%, transparent);
		transform: translateY(-2px);
	}

	.explore-button:focus-visible {
		outline: 2px solid var(--brand);
		outline-offset: 3px;
	}

	.simulation-controls {
		align-items: center;
		display: flex;
		gap: var(--s-2);
		opacity: 0;
		pointer-events: none;
		translate: 0 -0.5rem;
		transition:
			opacity 260ms ease,
			translate 550ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s 260ms;
		visibility: hidden;
	}

	.game-mode .simulation-controls {
		opacity: 1;
		pointer-events: auto;
		translate: 0 0;
		transition:
			opacity 360ms ease 140ms,
			translate 650ms cubic-bezier(0.22, 1, 0.36, 1),
			visibility 0s;
		visibility: visible;
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

	@media (max-width: 48rem) {
		.homepage {
			bottom: var(--mobile-nav-height);
			height: auto;
		}

		.hero-scrim {
			background: linear-gradient(
				90deg,
				color-mix(in oklch, var(--base) 96%, transparent),
				color-mix(in oklch, var(--base) 65%, transparent)
			);
		}

		.site-brand {
			font-size: 1.35rem;
			left: 1.25rem;
			top: 1.35rem;
		}

		.intro {
			left: 1.25rem;
			top: 51%;
			width: calc(100% - 2.5rem);
		}

		.intro-title {
			font-size: clamp(2.5rem, 9vw, 3.3rem);
		}

		.intro-description {
			font-size: 0.93rem;
			margin-top: 0.85rem;
		}

		.dot-line {
			font-size: 0.93rem;
			margin-top: 1rem;
		}

		.explore-button {
			margin-top: 1rem;
		}

		.game-mode .playground-controls {
			top: 4rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-scrim,
		.site-brand,
		.intro,
		.playground-controls,
		.simulation-controls {
			transition: none;
		}
	}
</style>
