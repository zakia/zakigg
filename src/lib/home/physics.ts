export interface Body {
	x: number;
	y: number;
	velocity: { x: number; y: number };
}

export interface RadialField {
	x: number;
	y: number;
	/** Gravitational parameter in px³/s². Negative values repel. */
	mu: number;
	/** Finite source size, not an interaction range. */
	coreRadius: number;
}

/** Ignore accelerations below this many px/s². Lower values are more accurate. */
export const DEFAULT_MIN_ACCELERATION = 0.25;
export const PHYSICS_STEP = 1 / 240;

/** Newton's inverse-square field outside the core; a uniform sphere inside it. */
export function applyRadialField(
	body: Body,
	field: RadialField,
	dt: number,
	minAcceleration = DEFAULT_MIN_ACCELERATION
): void {
	const dx = field.x - body.x;
	const dy = field.y - body.y;
	const distanceSquared = dx * dx + dy * dy;
	const coreSquared = field.coreRadius * field.coreRadius;

	// Compare squared acceleration first, before taking a square root or changing velocity.
	if (distanceSquared >= coreSquared) {
		if (field.mu * field.mu < minAcceleration * minAcceleration * distanceSquared * distanceSquared)
			return;
		const acceleration = field.mu / (distanceSquared * Math.sqrt(distanceSquared));
		body.velocity.x += dx * acceleration * dt;
		body.velocity.y += dy * acceleration * dt;
		return;
	}

	const coreCubed = coreSquared * field.coreRadius;
	if (
		field.mu * field.mu * distanceSquared <
		minAcceleration * minAcceleration * coreCubed * coreCubed
	)
		return;
	const acceleration = field.mu / coreCubed;
	body.velocity.x += dx * acceleration * dt;
	body.velocity.y += dy * acceleration * dt;
}
