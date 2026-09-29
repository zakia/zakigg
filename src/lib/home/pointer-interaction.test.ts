import { describe, expect, it } from 'vitest';
import {
	createPointerFieldFollower,
	defaultPointerSettings,
	resolvePointerEffect
} from './pointer-interaction';
import { applyRadialField } from './physics';

describe('homepage pointer physics', () => {
	it('uses the same inverse-square law for hover repulsion and held attraction', () => {
		const hover = resolvePointerEffect({ phase: 'hover', x: 0, y: 0 }, defaultPointerSettings, 0);
		const hold = resolvePointerEffect(
			{ phase: 'press', x: 0, y: 0, startedAt: 0 },
			defaultPointerSettings,
			1000
		);
		if (!hover || !hold) throw new Error('Expected active pointer fields');

		const repelled = { x: 100, y: 0, velocity: { x: 0, y: 0 } };
		const attracted = { x: 100, y: 0, velocity: { x: 0, y: 0 } };
		applyRadialField(repelled, hover, 1, 0);
		applyRadialField(attracted, hold, 1, 0);
		expect(repelled.velocity.x).toBeCloseTo(7);
		expect(attracted.velocity.x).toBeCloseTo(-200);
	});

	it('keeps increasing held strength without a maximum', () => {
		const pointer = { phase: 'press' as const, x: 0, y: 0, startedAt: 100 };
		const initial = resolvePointerEffect(pointer, defaultPointerSettings, 100);
		const later = resolvePointerEffect(pointer, defaultPointerSettings, 3100);
		const muchLater = resolvePointerEffect(pointer, defaultPointerSettings, 300100);
		if (initial?.kind !== 'star' || later?.kind !== 'star' || muchLater?.kind !== 'star')
			throw new Error('Expected a star field while pressed');

		expect(initial.mu).toBeLessThan(later.mu);
		expect(later.mu).toBeLessThan(muchLater.mu);
		expect(initial.visualCoreRadius).toBeLessThan(later.visualCoreRadius);
		expect(later.visualCoreRadius).toBeLessThan(muchLater.visualCoreRadius);
	});

	it('grows pull and visible size by a constant amount each second', () => {
		const pointer = { phase: 'press' as const, x: 0, y: 0, startedAt: 0 };
		const start = resolvePointerEffect(pointer, defaultPointerSettings, 0);
		const second = resolvePointerEffect(pointer, defaultPointerSettings, 1000);
		const third = resolvePointerEffect(pointer, defaultPointerSettings, 2000);
		if (start?.kind !== 'star' || second?.kind !== 'star' || third?.kind !== 'star')
			throw new Error('Expected star fields');
		expect(second.mu - start.mu).toBe(third.mu - second.mu);
		expect(start.mu).toBe(0);
		expect(second.visualCoreRadius - start.visualCoreRadius).toBe(
			third.visualCoreRadius - second.visualCoreRadius
		);
	});

	it('moves a held source toward the cursor without teleporting it', () => {
		const follower = createPointerFieldFollower();
		const source = resolvePointerEffect(
			{ phase: 'press', x: 0, y: 0, startedAt: 0 },
			defaultPointerSettings,
			1000
		);
		if (source?.kind !== 'star') throw new Error('Expected a star field');
		follower.step(source, 0);
		const target = { ...source, x: 200 };
		const firstStep = follower.step(target, 1 / 240);
		if (firstStep?.kind !== 'star') throw new Error('Expected a moving source');
		expect(firstStep.x).toBeGreaterThan(0);
		expect(firstStep.x).toBeLessThan(200);

		for (let i = 0; i < 240; i++) follower.step(target, 1 / 240);
		expect(follower.step(target, 0)?.x).toBeCloseTo(200, 2);
		expect(follower.step(null, 0)).toBeNull();
		expect(follower.step({ ...target, x: 50 }, 0)?.x).toBe(50);
	});

	it('uses minimum acceleration only to omit imperceptible forces', () => {
		const field = { x: 0, y: 0, mu: 100, coreRadius: 10 };
		const skipped = { x: 100, y: 0, velocity: { x: 0, y: 0 } };
		const included = { x: 100, y: 0, velocity: { x: 0, y: 0 } };
		applyRadialField(skipped, field, 1, 0.25);
		applyRadialField(included, field, 1, 0);
		expect(skipped.velocity.x).toBe(0);
		expect(included.velocity.x).toBeCloseTo(-0.01);
	});

	it('supports an orbit and keeps its tangential velocity on release', () => {
		const field = { x: 0, y: 0, mu: 100000, coreRadius: 16 };
		const body = { x: 100, y: 0, velocity: { x: 0, y: Math.sqrt(field.mu / 100) } };
		const dt = 1 / 240;
		for (let step = 0; step < 1200; step++) {
			applyRadialField(body, field, dt, 0);
			body.x += body.velocity.x * dt;
			body.y += body.velocity.y * dt;
		}
		expect(Math.hypot(body.x, body.y)).toBeCloseTo(100, 0);

		const velocityAtRelease = { ...body.velocity };
		body.x += body.velocity.x * 0.5;
		body.y += body.velocity.y * 0.5;
		expect(body.velocity).toEqual(velocityAtRelease);
		expect(Math.hypot(body.x, body.y)).toBeGreaterThan(100);
	});
});
