export interface SpringOptions {
	mass?: number;
	stiffness?: number;
	damping?: number;
	velocity?: number;
	resolution?: number; // sample interval in ms for CSS linear(), defaults to 12ms
}

export interface SpringResult {
	duration: number; // in milliseconds
	easing: (progress: number) => number; // normalized progress [0..1] -> [0..1]
	solver: (timeSeconds: number) => number; // time in seconds -> value
	css: string; // CSS linear(...) easing string
}

/**
 * Generates a CSS linear(...) easing string matching Motion (motion.dev) WAAPI output.
 */
export function generateLinearEasing(
	easing: (progress: number) => number,
	duration: number,
	resolution = 12
): string {
	const numPoints = Math.max(Math.round(duration / resolution), 2);
	const points: number[] = [];

	for (let i = 0; i < numPoints; i++) {
		const progress = i / (numPoints - 1);
		points.push(Math.round(easing(progress) * 10000) / 10000);
	}

	return `linear(${points.join(', ')})`;
}

/**
 * Analytical damped harmonic oscillator matching Motion (motiondivision/motion).
 * Computes exact position x(t) and returns settling duration, normalized easing,
 * and precomputed CSS linear() easing on the fly.
 */
export function springLinear({
	mass = 1,
	stiffness = 240,
	damping = 20,
	velocity = 0,
	resolution = 12
}: SpringOptions = {}): SpringResult {
	const m = Math.max(mass, 0.001);
	const k = Math.max(stiffness, 0.001);
	const c = Math.max(damping, 0);

	const w0 = Math.sqrt(k / m);
	const zeta = c / (2 * Math.sqrt(k * m));
	const decay = zeta * w0;

	let solver: (t: number) => number;
	let velocitySolver: (t: number) => number;

	if (zeta < 1) {
		// Underdamped regime (oscillates with overshoot)
		const wd = w0 * Math.sqrt(1 - zeta * zeta);
		const b = (decay - velocity) / wd;

		solver = (t: number) => 1 - Math.exp(-decay * t) * (Math.cos(wd * t) + b * Math.sin(wd * t));
		velocitySolver = (t: number) => {
			const env = Math.exp(-decay * t);
			const sin = Math.sin(wd * t);
			const cos = Math.cos(wd * t);
			return env * ((decay * b + wd) * sin + (decay - b * wd) * cos);
		};
	} else if (zeta === 1) {
		// Critically damped regime
		const b = -velocity + w0;
		solver = (t: number) => 1 - (1 + b * t) * Math.exp(-w0 * t);
		velocitySolver = (t: number) => Math.exp(-w0 * t) * (w0 * (1 + b * t) - b);
	} else {
		// Overdamped regime (two decaying exponentials)
		const wd = w0 * Math.sqrt(zeta * zeta - 1);
		const r1 = -decay + wd;
		const r2 = -decay - wd;
		const c2 = (velocity - r1) / (r2 - r1);
		const c1 = 1 - c2;

		solver = (t: number) => 1 - (c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t));
		velocitySolver = (t: number) => -(c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t));
	}

	// Calculate settling duration using rest threshold criteria
	let t = 0;
	const dt = 0.005;
	let lastRestTime = 0;
	const maxTime = 4;

	while (t < maxTime) {
		if (Math.abs(1 - solver(t)) > 0.002 || Math.abs(velocitySolver(t)) > 0.01) {
			lastRestTime = t;
		}
		t += dt;
	}

	const duration = Math.min(Math.ceil((lastRestTime + 0.02) * 1000), 4000);
	const easing = (progress: number) => solver((progress * duration) / 1000);
	const css = generateLinearEasing(easing, duration, resolution);

	return {
		duration,
		easing,
		solver,
		css
	};
}

/**
 * Backward-compatible helper returning [duration, easing] for Svelte transitions / FLIP.
 */
export function createSpring(options: SpringOptions): [number, (t: number) => number] {
	const res = springLinear(options);
	return [res.duration, res.easing];
}
