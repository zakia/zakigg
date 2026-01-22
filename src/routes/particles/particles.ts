export interface ParticleConfig {
	initialCount: number;
	G: number; // Gravitational constant
	SOFTENING: number; // Minimum distance for force calculation
	trail_lifespan: number; // Trail point lifespan in milliseconds
	wall_behaviour: 'bounce' | 'pass';
	speed: number;
	show_trails: boolean;
}

export interface ParticleOptions {
	x: number;
	y: number;
	radius: number;
	config: ParticleConfig;
	canvas: HTMLCanvasElement;
	mass?: number;
	vx?: number;
	vy?: number;
	fixed?: boolean; // If true, doesn't move (like a sun)
}

export class Particle {
	x: number;
	y: number;
	radius: number;
	config: ParticleConfig;
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

	constructor({ x, y, radius, config, canvas, mass, vx, vy, fixed }: ParticleOptions) {
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
		// Add current position to trail (if enabled)
		if (this.config.show_trails) {
			this.trail.push({ x: this.x, y: this.y, createdAt: now });
		}

		// Clean up expired trail points
		const expiryCutoff = now - this.config.trail_lifespan;
		while (this.trail.length > 0 && this.trail[0].createdAt < expiryCutoff) {
			this.trail.shift();
		}

		// Fixed particles don't move
		if (this.fixed) return;

		// Apply velocity to position
		this.x += this.vx;
		this.y += this.vy;

		// Handle wall collisions
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
		// Draw trail as connected line segments
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

		// Draw particle
		this.ctx.fillStyle = this.particleColor;
		this.ctx.beginPath();
		this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
		this.ctx.fill();
	}

	// Calculate gravitational pull toward another particle
	attract(other: Particle) {
		if (this.fixed) return; // Fixed particles don't get attracted

		const dx = other.x - this.x;
		const dy = other.y - this.y;
		const distance = Math.sqrt(dx * dx + dy * dy);

		if (distance > 0) {
			// Use softened distance to prevent singularity at close range
			const softenedDistance = Math.max(distance, this.config.SOFTENING);
			const force = (this.config.G * this.mass * other.mass) / (softenedDistance * softenedDistance);
			const ax = (force * (dx / distance)) / this.mass;
			const ay = (force * (dy / distance)) / this.mass;
			this.vx += ax;
			this.vy += ay;
		}
	}
}
