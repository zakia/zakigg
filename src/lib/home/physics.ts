export interface Body {
	x: number;
	y: number;
	velocity: { x: number; y: number };
}

export interface RadialField {
	x: number;
	y: number;
	/** Gravitational parameter in px³/s². Negative values repel, positive values attract. */
	mu: number;
	/** Finite source size, not an interaction range. */
	coreRadius: number;
}

export interface WallPoint {
	x: number;
	y: number;
}

export interface WallStroke {
	points: WallPoint[];
	strokeWidth: number;
	opacity: number;
	minX?: number;
	minY?: number;
	maxX?: number;
	maxY?: number;
	path?: Path2D | null;
}

export function createWallStroke(
	startPoint: WallPoint,
	strokeWidth: number,
	opacity: number
): WallStroke {
	const path = typeof Path2D !== 'undefined' ? new Path2D() : null;
	path?.moveTo(startPoint.x, startPoint.y);
	return {
		points: [{ x: startPoint.x, y: startPoint.y }],
		strokeWidth,
		opacity,
		minX: startPoint.x,
		minY: startPoint.y,
		maxX: startPoint.x,
		maxY: startPoint.y,
		path
	};
}

export function appendWallPoint(wall: WallStroke, point: WallPoint): void {
	wall.points.push({ x: point.x, y: point.y });
	wall.minX = wall.minX === undefined ? point.x : Math.min(wall.minX, point.x);
	wall.minY = wall.minY === undefined ? point.y : Math.min(wall.minY, point.y);
	wall.maxX = wall.maxX === undefined ? point.x : Math.max(wall.maxX, point.x);
	wall.maxY = wall.maxY === undefined ? point.y : Math.max(wall.maxY, point.y);
	wall.path?.lineTo(point.x, point.y);
}

export function rebuildWallStrokeGeometry(wall: WallStroke): WallStroke {
	const pts = wall.points;
	if (pts.length === 0) {
		wall.minX = wall.minY = wall.maxX = wall.maxY = undefined;
		wall.path = null;
		return wall;
	}
	let minX = pts[0].x;
	let minY = pts[0].y;
	let maxX = pts[0].x;
	let maxY = pts[0].y;
	const path = typeof Path2D !== 'undefined' ? new Path2D() : null;
	path?.moveTo(pts[0].x, pts[0].y);
	for (let i = 1; i < pts.length; i++) {
		const p = pts[i];
		if (p.x < minX) minX = p.x;
		if (p.y < minY) minY = p.y;
		if (p.x > maxX) maxX = p.x;
		if (p.y > maxY) maxY = p.y;
		path?.lineTo(p.x, p.y);
	}
	wall.minX = minX;
	wall.minY = minY;
	wall.maxX = maxX;
	wall.maxY = maxY;
	wall.path = path;
	return wall;
}

/** Ignore accelerations below this many px/s². Lower values are more accurate. */
export const DEFAULT_MIN_ACCELERATION = 0.25;
export const DEFAULT_TIME_SCALE = 1;
export const DEFAULT_TICK_RATE = 240;
export const PHYSICS_STEP = 1 / DEFAULT_TICK_RATE;

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

/** Resolves capsule-segment collisions between a circular particle and drawn wall polylines. */
export function collideWithWalls(
	body: Body & { radius: number },
	walls: readonly WallStroke[],
	restitution: number
): void {
	for (let w = 0; w < walls.length; w++) {
		const wall = walls[w];
		const pts = wall.points;
		if (pts.length === 0) continue;
		const minDist = body.radius + wall.strokeWidth * 0.5;
		if (
			wall.minX !== undefined &&
			(body.x < wall.minX - minDist ||
				body.x > wall.maxX! + minDist ||
				body.y < wall.minY! - minDist ||
				body.y > wall.maxY! + minDist)
		) {
			continue;
		}
		const minDistSq = minDist * minDist;

		if (pts.length === 1) {
			resolvePointCollision(body, pts[0].x, pts[0].y, minDist, minDistSq, restitution);
			continue;
		}

		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i];
			const b = pts[i + 1];
			const abx = b.x - a.x;
			const aby = b.y - a.y;
			const abLenSq = abx * abx + aby * aby;
			let cx = a.x;
			let cy = a.y;
			if (abLenSq > 0) {
				const t = Math.max(0, Math.min(1, ((body.x - a.x) * abx + (body.y - a.y) * aby) / abLenSq));
				cx = a.x + t * abx;
				cy = a.y + t * aby;
			}
			resolvePointCollision(body, cx, cy, minDist, minDistSq, restitution);
		}
	}
}

function pointToSegmentDistSq(p: WallPoint, a: WallPoint, b: WallPoint): number {
	const abx = b.x - a.x;
	const aby = b.y - a.y;
	const abLenSq = abx * abx + aby * aby;
	let cx = a.x;
	let cy = a.y;
	if (abLenSq > 0) {
		const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / abLenSq));
		cx = a.x + t * abx;
		cy = a.y + t * aby;
	}
	const dx = p.x - cx;
	const dy = p.y - cy;
	return dx * dx + dy * dy;
}

function strokeTouchesCircle(wall: WallStroke, center: WallPoint, radius: number): boolean {
	const pts = wall.points;
	if (pts.length === 0) return false;
	if (
		wall.minX !== undefined &&
		(center.x < wall.minX - radius ||
			center.x > wall.maxX! + radius ||
			center.y < wall.minY! - radius ||
			center.y > wall.maxY! + radius)
	) {
		return false;
	}
	const rSq = radius * radius;
	if (pts.length === 1) {
		const dx = center.x - pts[0].x;
		const dy = center.y - pts[0].y;
		return dx * dx + dy * dy <= rSq;
	}
	for (let i = 0; i < pts.length - 1; i++) {
		if (pointToSegmentDistSq(center, pts[i], pts[i + 1]) <= rSq) return true;
	}
	return false;
}

/**
 * Erases wall strokes at `center` with `eraserRadius`.
 * - `'stroke'` mode (Shift+Erase): deletes any touched stroke in full.
 * - `'spot'` mode (default): carves a circular gap through touched segments, splitting strokes as needed.
 */
export function eraseWallsAt(
	walls: readonly WallStroke[],
	center: WallPoint,
	eraserRadius: number,
	mode: 'spot' | 'stroke' = 'spot'
): { walls: WallStroke[]; changed: boolean } {
	let changed = false;
	const nextWalls: WallStroke[] = [];

	for (let w = 0; w < walls.length; w++) {
		const wall = walls[w];
		const cutRadius = eraserRadius + wall.strokeWidth * 0.5;

		if (!strokeTouchesCircle(wall, center, cutRadius)) {
			nextWalls.push(wall);
			continue;
		}

		changed = true;
		if (mode === 'stroke' || wall.points.length <= 1) {
			// Whole stroke or single-point dot is removed completely.
			continue;
		}

		// Spot erase: clip each segment [A, B] against the circle (center, cutRadius).
		const pts = wall.points;
		const rSq = cutRadius * cutRadius;
		const chains: WallPoint[][] = [];
		let currentChain: WallPoint[] = [];

		const pushPoint = (pt: WallPoint) => {
			if (currentChain.length === 0) {
				currentChain.push({ x: pt.x, y: pt.y });
				return;
			}
			const last = currentChain[currentChain.length - 1];
			const dx = pt.x - last.x;
			const dy = pt.y - last.y;
			if (dx * dx + dy * dy > 1e-4) {
				currentChain.push({ x: pt.x, y: pt.y });
			}
		};

		const flushChain = () => {
			if (currentChain.length >= 2) {
				const first = currentChain[0];
				const last = currentChain[currentChain.length - 1];
				const spanSq = (last.x - first.x) ** 2 + (last.y - first.y) ** 2;
				if (spanSq >= 1 || currentChain.length > 2) {
					chains.push(currentChain);
				}
			}
			currentChain = [];
		};

		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i];
			const b = pts[i + 1];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const lenSq = dx * dx + dy * dy;
			const fx = a.x - center.x;
			const fy = a.y - center.y;

			if (lenSq < 1e-6) {
				if (fx * fx + fy * fy <= rSq) {
					flushChain();
				} else {
					pushPoint(a);
				}
				continue;
			}

			const halfB = fx * dx + fy * dy;
			const c = fx * fx + fy * fy - rSq;
			const disc = halfB * halfB - lenSq * c;

			if (disc <= 0) {
				// Entire segment is outside the eraser circle.
				pushPoint(a);
				pushPoint(b);
				continue;
			}

			const sqrtDisc = Math.sqrt(disc);
			const tEnter = (-halfB - sqrtDisc) / lenSq;
			const tExit = (-halfB + sqrtDisc) / lenSq;
			const u1 = Math.max(0, tEnter);
			const u2 = Math.min(1, tExit);

			if (u1 >= u2) {
				// Circle intersection falls outside t in [0, 1].
				pushPoint(a);
				pushPoint(b);
				continue;
			}

			// Segment portion [0, u1] is before the eraser circle.
			if (u1 > 1e-4) {
				pushPoint(a);
				pushPoint({ x: a.x + u1 * dx, y: a.y + u1 * dy });
			}
			flushChain();

			// Segment portion [u2, 1] is after the eraser circle.
			if (u2 < 1 - 1e-4) {
				pushPoint({ x: a.x + u2 * dx, y: a.y + u2 * dy });
				pushPoint(b);
			}
		}
		flushChain();

		for (const chain of chains) {
			nextWalls.push(
				rebuildWallStrokeGeometry({
					points: chain,
					strokeWidth: wall.strokeWidth,
					opacity: wall.opacity
				})
			);
		}
	}

	return { walls: nextWalls, changed };
}

function resolvePointCollision(
	body: Body & { radius: number },
	cx: number,
	cy: number,
	minDist: number,
	minDistSq: number,
	restitution: number
): void {
	const nx = body.x - cx;
	const ny = body.y - cy;
	const distSq = nx * nx + ny * ny;
	if (distSq >= minDistSq) return;

	const dist = Math.sqrt(distSq);
	const ux = dist > 1e-6 ? nx / dist : 0;
	const uy = dist > 1e-6 ? ny / dist : -1;

	body.x = cx + ux * minDist;
	body.y = cy + uy * minDist;

	const vn = body.velocity.x * ux + body.velocity.y * uy;
	if (vn < 0) {
		body.velocity.x -= (1 + restitution) * vn * ux;
		body.velocity.y -= (1 + restitution) * vn * uy;
	}
}
