import { describe, expect, it } from 'vitest';
import {
	createPointerFieldFollower,
	defaultPointerSettings,
	resolvePointerEffect
} from './pointer-interaction';
import {
	appendWallPoint,
	applyRadialField,
	collideWithWalls,
	createWallStroke,
	eraseWallsAt
} from './physics';
import {
	buildPlaygroundControlSections,
	createDefaultPlaygroundGroups,
	toPointerSettings
} from './particle-appearance';

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

	it('supports push/pull modes with positive force values and click core radius', () => {
		const groups = createDefaultPlaygroundGroups(100);
		groups.hover.mode = 'pull';
		groups.hover.mu = 50000;
		groups.click.mode = 'push';
		groups.click.mu = 100000;
		groups.click.growthMuPerSecond = 500000;
		groups.click.coreRadius = 32;
		const settings = toPointerSettings(groups);

		const hover = resolvePointerEffect({ phase: 'hover', x: 0, y: 0 }, settings, 0);
		const press = resolvePointerEffect(
			{ phase: 'press', x: 0, y: 0, startedAt: 0 },
			settings,
			1000
		);
		expect(hover?.mu).toBe(50000);
		expect(press?.mu).toBe(-600000);
		expect(press?.coreRadius).toBe(32);
	});

	it('suppresses force field when click mode is draw and reflects particles off drawn capsule walls', () => {
		const groups = createDefaultPlaygroundGroups(100);
		groups.click.mode = 'draw';
		const settings = toPointerSettings(groups);
		expect(
			resolvePointerEffect({ phase: 'press', x: 0, y: 0, startedAt: 0 }, settings, 1000)
		).toBeNull();

		const particle = { x: 50, y: 8, radius: 4, velocity: { x: 10, y: -20 } };
		const walls = [
			{
				points: [
					{ x: 0, y: 0 },
					{ x: 100, y: 0 }
				],
				strokeWidth: 10,
				opacity: 0.35
			}
		];
		collideWithWalls(particle, walls, 0.5);
		expect(particle.y).toBeCloseTo(9);
		expect(particle.velocity.x).toBeCloseTo(10);
		expect(particle.velocity.y).toBeCloseTo(10);
	});

	it('forwards grouped sections and mode-specific controls to the UI schema', () => {
		const groups = createDefaultPlaygroundGroups(100);
		const nop = () => {};
		const pullSections = buildPlaygroundControlSections(groups, 0, {
			onDotsChange: nop,
			onLinksChange: nop,
			onHoverChange: nop,
			onClickChange: nop,
			onWorldChange: nop,
			onClearWalls: nop
		});
		expect(pullSections.map((s) => s.id)).toEqual(['dots', 'links', 'hover', 'click', 'world']);
		expect(pullSections.find((s) => s.id === 'click')?.controls.map((c) => c.id)).toEqual([
			'click-force',
			'click-force-delta',
			'click-core-radius'
		]);
		expect(pullSections.find((s) => s.id === 'world')?.controls.map((c) => c.id)).toEqual([
			'world-time-scale',
			'world-tick-rate',
			'world-min-accel'
		]);

		groups.click.mode = 'draw';
		const drawSections = buildPlaygroundControlSections(groups, 2, {
			onDotsChange: nop,
			onLinksChange: nop,
			onHoverChange: nop,
			onClickChange: nop,
			onWorldChange: nop,
			onClearWalls: nop
		});
		const clickDraw = drawSections.find((s) => s.id === 'click');
		expect(clickDraw?.controls.map((c) => c.id)).toEqual([
			'click-stroke-width',
			'click-wall-opacity'
		]);
		expect(clickDraw?.action?.label).toBe('Clear walls (2)');

		groups.click.mode = 'erase';
		const eraseSections = buildPlaygroundControlSections(groups, 2, {
			onDotsChange: nop,
			onLinksChange: nop,
			onHoverChange: nop,
			onClickChange: nop,
			onWorldChange: nop,
			onClearWalls: nop
		});
		const clickErase = eraseSections.find((s) => s.id === 'click');
		expect(clickErase?.controls.map((c) => c.id)).toEqual(['click-eraser-radius']);
	});

	it('spot-erases a gap through a wall stroke and stroke-erases when Shift is held', () => {
		const wall = createWallStroke({ x: 0, y: 0 }, 10, 0.35);
		appendWallPoint(wall, { x: 100, y: 0 });
		const untouched = createWallStroke({ x: 0, y: 200 }, 10, 0.35);
		appendWallPoint(untouched, { x: 100, y: 200 });

		// Spot-erase at (50, 0) with eraserRadius 15 (cutRadius = 15 + 5 = 20):
		// splits [0..100] into [0..30] and [70..100].
		const spotResult = eraseWallsAt([wall, untouched], { x: 50, y: 0 }, 15, 'spot');
		expect(spotResult.changed).toBe(true);
		expect(spotResult.walls).toHaveLength(3);
		expect(spotResult.walls[0].points).toEqual([
			{ x: 0, y: 0 },
			{ x: 30, y: 0 }
		]);
		expect(spotResult.walls[1].points).toEqual([
			{ x: 70, y: 0 },
			{ x: 100, y: 0 }
		]);
		expect(spotResult.walls[2]).toBe(untouched);

		// A particle moving through the carved gap at x=50 now passes unimpeded:
		const particleInGap = { x: 50, y: 2, radius: 4, velocity: { x: 0, y: -20 } };
		collideWithWalls(particleInGap, spotResult.walls, 0.5);
		expect(particleInGap.velocity.y).toBe(-20);

		// Stroke-erase (Shift+Erase) removes the entire touched piece at once:
		const strokeResult = eraseWallsAt(spotResult.walls, { x: 15, y: 0 }, 10, 'stroke');
		expect(strokeResult.changed).toBe(true);
		expect(strokeResult.walls).toHaveLength(2);
		expect(strokeResult.walls[0].points[0].x).toBeCloseTo(70);
		expect(strokeResult.walls[1]).toBe(untouched);
	});
});
