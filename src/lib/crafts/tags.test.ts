import { describe, expect, it } from 'vitest';
import { assignTagColors, readTagRegistry, tagPalette, type TagRegistry } from './tags';

describe('tag color registry', () => {
	it('keeps existing and unused assignments while allocating distinct unused colors', () => {
		const registry: TagRegistry = { old: 'violet', unused: 'blue' };
		const next = assignTagColors(registry, ['new', 'another', 'OLD', 'new']);
		expect(next).toEqual({ old: 'violet', unused: 'blue', another: 'rose', new: 'amber' });
		expect(registry).toEqual({ old: 'violet', unused: 'blue' });
		expect(assignTagColors(next, [])).toEqual(next);
	});
	it('reuses the least-used color only after the palette fills', () => {
		const names = Array.from({ length: 19 }, (_, i) => `tag-${i}`);
		const next = assignTagColors({}, names);
		const counts = Object.keys(tagPalette).map(
			(color) => Object.values(next).filter((value) => value === color).length
		);
		expect(Math.max(...counts) - Math.min(...counts)).toBe(1);
	});
	it('rejects malformed registries instead of silently replacing their assignments', () => {
		for (const source of ['[]', 'null', '{"tag":"unknown"}', '{"Tag":"blue"}']) {
			expect(() => readTagRegistry(source)).toThrow();
		}
	});
	it('accepts tag names that match object prototype keys', () => {
		const next = assignTagColors({}, ['__proto__', 'constructor']);
		expect(Object.keys(next)).toEqual(['__proto__', 'constructor']);
		expect(readTagRegistry(JSON.stringify(next))).toEqual(next);
	});
});
