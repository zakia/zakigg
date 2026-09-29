import type { RadialField } from './physics';

export type PointerState =
	| { phase: 'inactive' }
	| { phase: 'hover'; x: number; y: number }
	| { phase: 'press'; x: number; y: number; startedAt: number };

type HoverConfig = { mu: number; coreRadius: number };
type HoldConfig = {
	growthMuPerSecond: number;
	coreRadius: number;
	visualCoreRadius: number;
	visualGrowthPerSecond: number;
};

export type PointerSettings = {
	hover: HoverConfig | null;
	press: HoldConfig | null;
};

export type ActivePointerEffect =
	| (RadialField & { kind: 'repel' })
	| (RadialField & { kind: 'star'; visualCoreRadius: number; heldForSeconds: number });

export const defaultPointerSettings = {
	hover: { mu: 70000, coreRadius: 16 },
	press: {
		growthMuPerSecond: 2000000,
		coreRadius: 16,
		visualCoreRadius: 8,
		visualGrowthPerSecond: 18
	}
} satisfies PointerSettings;

/** A critically damped cursor tether keeps the massive source from teleporting. */
export function createPointerFieldFollower() {
	const responseRate = 25; // s⁻¹
	let x = 0;
	let y = 0;
	let vx = 0;
	let vy = 0;
	let following = false;

	return {
		step(target: ActivePointerEffect | null, dt: number): ActivePointerEffect | null {
			if (target?.kind !== 'star') {
				following = false;
				return target;
			}
			if (!following) {
				x = target.x;
				y = target.y;
				vx = 0;
				vy = 0;
				following = true;
			} else if (dt > 0) {
				vx += (responseRate ** 2 * (target.x - x) - 2 * responseRate * vx) * dt;
				vy += (responseRate ** 2 * (target.y - y) - 2 * responseRate * vy) * dt;
				x += vx * dt;
				y += vy * dt;
			}
			return { ...target, x, y };
		}
	};
}

export function resolvePointerEffect(
	pointer: PointerState,
	settings: PointerSettings,
	time: number
): ActivePointerEffect | null {
	switch (pointer.phase) {
		case 'hover': {
			const config = settings.hover;
			return (
				config && {
					kind: 'repel',
					x: pointer.x,
					y: pointer.y,
					mu: -config.mu,
					coreRadius: config.coreRadius
				}
			);
		}
		case 'press': {
			const config = settings.press;
			if (!config) return null;
			const holdSeconds = Math.max(0, time - pointer.startedAt) / 1000;
			return {
				kind: 'star',
				x: pointer.x,
				y: pointer.y,
				mu: config.growthMuPerSecond * holdSeconds,
				coreRadius: config.coreRadius,
				heldForSeconds: holdSeconds,
				visualCoreRadius: config.visualCoreRadius + config.visualGrowthPerSecond * holdSeconds
			};
		}
		case 'inactive':
			return null;
	}
}

export function trackPlaygroundPointer(canvas: HTMLCanvasElement, target: HTMLElement) {
	let current: PointerState = { phase: 'inactive' };
	let pressedPointerId: number | null = null;
	let pressedAt = 0;

	function position(event: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		return { x: event.clientX - rect.left, y: event.clientY - rect.top };
	}

	function insideCanvas(event: PointerEvent) {
		const { x, y } = position(event);
		return x >= 0 && y >= 0 && x < canvas.clientWidth && y < canvas.clientHeight;
	}

	function canHover(event: PointerEvent) {
		return event.pointerType === 'mouse' || event.pointerType === 'pen';
	}

	function onPointerMove(event: PointerEvent) {
		if (pressedPointerId !== null) {
			if (event.pointerId === pressedPointerId) {
				current = { phase: 'press', ...position(event), startedAt: pressedAt };
			}
			return;
		}

		current =
			canHover(event) && insideCanvas(event)
				? { phase: 'hover', ...position(event) }
				: { phase: 'inactive' };
	}

	function onPointerDown(event: PointerEvent) {
		if (pressedPointerId !== null || event.button !== 0 || !insideCanvas(event)) return;
		const source = event.target;
		if (
			source instanceof Element &&
			source.closest(
				'button, a, input, select, textarea, summary, [role="button"], [contenteditable]'
			)
		)
			return;

		pressedPointerId = event.pointerId;
		pressedAt = performance.now();
		current = { phase: 'press', ...position(event), startedAt: pressedAt };
		target.setPointerCapture(event.pointerId);
	}

	function onPointerUp(event: PointerEvent) {
		if (event.pointerId !== pressedPointerId) return;
		pressedPointerId = null;
		current =
			canHover(event) && insideCanvas(event)
				? { phase: 'hover', ...position(event) }
				: { phase: 'inactive' };
		if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
	}

	function onLostPointerCapture(event: PointerEvent) {
		if (event.pointerId === pressedPointerId) reset();
	}

	function reset() {
		pressedPointerId = null;
		current = { phase: 'inactive' };
	}

	target.addEventListener('pointermove', onPointerMove);
	target.addEventListener('pointerdown', onPointerDown);
	target.addEventListener('pointerup', onPointerUp);
	target.addEventListener('pointercancel', reset);
	target.addEventListener('lostpointercapture', onLostPointerCapture);
	target.addEventListener('pointerleave', onPointerLeave);
	window.addEventListener('blur', reset);

	function onPointerLeave() {
		if (pressedPointerId === null) current = { phase: 'inactive' };
	}

	return {
		get current() {
			return current;
		},
		destroy() {
			target.removeEventListener('pointermove', onPointerMove);
			target.removeEventListener('pointerdown', onPointerDown);
			target.removeEventListener('pointerup', onPointerUp);
			target.removeEventListener('pointercancel', reset);
			target.removeEventListener('lostpointercapture', onLostPointerCapture);
			target.removeEventListener('pointerleave', onPointerLeave);
			window.removeEventListener('blur', reset);
			if (pressedPointerId !== null && target.hasPointerCapture(pressedPointerId)) {
				target.releasePointerCapture(pressedPointerId);
			}
			reset();
		}
	};
}
