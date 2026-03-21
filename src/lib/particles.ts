// ---------------------------------------------------------------------------
// Shared canvas particle system utilities
// ---------------------------------------------------------------------------

export function distance(x1: number, y1: number, x2: number, y2: number): number {
	const dx = x1 - x2;
	const dy = y1 - y2;
	return Math.sqrt(dx * dx + dy * dy);
}

// --- Mouse tracker ---

export interface MouseState {
	x?: number;
	y?: number;
	radius: number;
}

export function trackMouse(canvas: HTMLCanvasElement, radius = 150): MouseState & { destroy(): void } {
	const state: MouseState & { destroy(): void } = {
		x: undefined,
		y: undefined,
		radius,
		destroy() {
			canvas.removeEventListener('mousemove', onMove);
			canvas.removeEventListener('mouseleave', onLeave);
		}
	};

	function onMove(e: MouseEvent) {
		state.x = e.offsetX;
		state.y = e.offsetY;
	}
	function onLeave() {
		state.x = undefined;
		state.y = undefined;
	}

	canvas.addEventListener('mousemove', onMove);
	canvas.addEventListener('mouseleave', onLeave);

	return state;
}

// --- Canvas particle system lifecycle ---

export interface ParticleSystemCallbacks {
	/** Called on init and every resize. Create / reset your particle array here. */
	setup(ctx: CanvasRenderingContext2D, width: number, height: number): void;
	/** Called every animation frame. Update + draw here. */
	frame(ctx: CanvasRenderingContext2D, width: number, height: number, time: number): void;
	/**
	 * How to clear the canvas each frame:
	 * - `undefined` → ctx.clearRect (transparent)
	 * - a CSS color string → ctx.fillRect with that color
	 * - `false` → don't clear (caller handles it)
	 */
	clear?: false | string;
}

/**
 * Boots a canvas animation: sizes to parent, runs setup, then loops frame via rAF.
 * Re-inits on window resize. Returns a cleanup function for onMount teardown.
 */
export function createParticleSystem(
	canvas: HTMLCanvasElement,
	callbacks: ParticleSystemCallbacks
): () => void {
	const ctx = canvas.getContext('2d')!;
	let animationId: number;

	function resize() {
		const parent = canvas.parentElement;
		canvas.width = parent?.clientWidth ?? window.innerWidth;
		canvas.height = parent?.clientHeight ?? window.innerHeight;
	}

	function init() {
		resize();
		callbacks.setup(ctx, canvas.width, canvas.height);
	}

	function loop() {
		const { width, height } = canvas;

		if (callbacks.clear === false) {
			// no-op
		} else if (typeof callbacks.clear === 'string') {
			ctx.fillStyle = callbacks.clear;
			ctx.fillRect(0, 0, width, height);
		} else {
			ctx.clearRect(0, 0, width, height);
		}

		callbacks.frame(ctx, width, height, performance.now());
		animationId = requestAnimationFrame(loop);
	}

	function onResize() {
		cancelAnimationFrame(animationId);
		init();
		loop();
	}

	init();
	loop();

	window.addEventListener('resize', onResize);

	return () => {
		cancelAnimationFrame(animationId);
		window.removeEventListener('resize', onResize);
	};
}

// ---------------------------------------------------------------------------
// Gravity simulation particle (used by GravitySimulation.svelte)
// ---------------------------------------------------------------------------

export interface GravityConfig {
	initialCount: number;
	G: number;
	SOFTENING: number;
	trail_lifespan: number;
	wall_behaviour: 'bounce' | 'pass';
	speed: number;
	show_trails: boolean;
}

export interface GravityParticleOptions {
	x: number;
	y: number;
	radius: number;
	config: GravityConfig;
	canvas: HTMLCanvasElement;
	mass?: number;
	vx?: number;
	vy?: number;
	fixed?: boolean;
}

export class GravityParticle {
	x: number;
	y: number;
	radius: number;
	config: GravityConfig;
	canvas: HTMLCanvasElement;
	mass: number;
	vx: number;
	vy: number;
	fixed: boolean;
	hue = Math.random() * 360;
	trail: Array<{ x: number; y: number; createdAt: number }> = [];
	ctx: CanvasRenderingContext2D;
	trailColor: string;
	particleColor: string;

	constructor({ x, y, radius, config, canvas, mass, vx, vy, fixed }: GravityParticleOptions) {
		this.x = x;
		this.y = y;
		this.radius = radius;
		this.config = config;
		this.canvas = canvas;
		this.mass = mass ?? radius;
		this.vx = vx ?? (Math.random() - 0.5) * 2;
		this.vy = vy ?? (Math.random() - 0.5) * 2;
		this.fixed = fixed ?? false;
		this.ctx = canvas.getContext('2d')!;
		this.trailColor = `hsl(${this.hue}, 70%, 20%)`;
		this.particleColor = `hsl(${this.hue}, 70%, 60%)`;
	}

	update(now: number) {
		if (this.config.show_trails) {
			this.trail.push({ x: this.x, y: this.y, createdAt: now });
		}

		const expiryCutoff = now - this.config.trail_lifespan;
		while (this.trail.length > 0 && this.trail[0].createdAt < expiryCutoff) {
			this.trail.shift();
		}

		if (this.fixed) return;

		this.x += this.vx;
		this.y += this.vy;

		if (this.config.wall_behaviour === 'bounce') {
			if (this.x < this.radius) {
				this.x = this.radius;
				this.vx *= -1;
			} else if (this.x > this.canvas.width - this.radius) {
				this.x = this.canvas.width - this.radius;
				this.vx *= -1;
			}
			if (this.y < this.radius) {
				this.y = this.radius;
				this.vy *= -1;
			} else if (this.y > this.canvas.height - this.radius) {
				this.y = this.canvas.height - this.radius;
				this.vy *= -1;
			}
		} else if (this.config.wall_behaviour === 'pass') {
			if (this.x < this.radius) this.x = this.canvas.width - this.radius;
			if (this.x > this.canvas.width - this.radius) this.x = this.radius;
			if (this.y < this.radius) this.y = this.canvas.height - this.radius;
			if (this.y > this.canvas.height - this.radius) this.y = this.radius;
		}
	}

	draw(now: number) {
		if (this.trail.length > 1) {
			this.ctx.strokeStyle = this.trailColor;
			this.ctx.lineCap = 'round';
			this.ctx.lineJoin = 'round';
			const lifespan = this.config.trail_lifespan;

			for (let i = 1; i < this.trail.length; i++) {
				const prev = this.trail[i - 1];
				const curr = this.trail[i];
				const t = 1 - (now - curr.createdAt) / lifespan;
				this.ctx.globalAlpha = t * 0.5;
				this.ctx.lineWidth = this.radius * (0.3 + 0.7 * t);
				this.ctx.beginPath();
				this.ctx.moveTo(prev.x, prev.y);
				this.ctx.lineTo(curr.x, curr.y);
				this.ctx.stroke();
			}
			this.ctx.globalAlpha = 1;
		}

		this.ctx.fillStyle = this.particleColor;
		this.ctx.beginPath();
		this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
		this.ctx.fill();
	}

	attract(other: GravityParticle) {
		if (this.fixed) return;

		const dx = other.x - this.x;
		const dy = other.y - this.y;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist > 0) {
			const softenedDistance = Math.max(dist, this.config.SOFTENING);
			const force =
				(this.config.G * this.mass * other.mass) / (softenedDistance * softenedDistance);
			this.vx += (force * (dx / dist)) / this.mass;
			this.vy += (force * (dy / dist)) / this.mass;
		}
	}
}
