import { describe, expect, it } from 'vitest';
import { classifySetFit, type SetFitHead } from './setfit';
import { parseClassificationInput } from './local-ai-contract';
import { confidenceLevel } from './confidence';
import head from './setfit-head.json';

const input = parseClassificationInput({
	fallback: 'Uncategorized',
	categories: [
		{ id: 'a', name: 'Renamed dining', purpose: '' },
		{ id: 'b', name: 'Transport', purpose: '' },
		{ name: 'Uncategorized', purpose: '' }
	],
	transactions: []
});
const tiny: SetFitHead = {
	dimension: 2,
	labels: [
		{ categoryId: 'a', name: 'Dining' },
		{ categoryId: 'b', name: 'Transport' }
	],
	weights: [
		[4, 0],
		[0, 4]
	],
	intercepts: [0, 0]
};
describe('SetFit classifier head', () => {
	it('maps a learned decision to stable IDs after names change', () => {
		const result = classifySetFit([1, 0], tiny, input);
		expect(result.c).toBe('Renamed dining');
		expect(result.confidence.method).toBe('classifier');
		expect(result.confidence.score).toBeCloseTo(0.982014, 5);
		expect(confidenceLevel(result.confidence)).toBe('high');
	});
	it('abstains on uncertain or unavailable categories instead of choosing another category', () => {
		expect(classifySetFit([0.5, 0.5], tiny, input).c).toBe('Uncategorized');
		expect(
			classifySetFit([1, 0], tiny, {
				...input,
				categories: input.categories.filter((c) => c.id !== 'a')
			}).c
		).toBe('Uncategorized');
		expect(() => classifySetFit([1], tiny, input)).toThrow('do not match');
		expect(() => classifySetFit([NaN, 0], tiny, input)).toThrow();
	});
	it('offers weaker distinct candidates without treating them as ready for approval', () => {
		const weak = {
			...tiny,
			weights: [
				[1, 0],
				[0, 1]
			]
		};
		const result = classifySetFit([0.5, 0], weak, input);
		expect(result.c).toBe('Renamed dining');
		expect(confidenceLevel(result.confidence)).toBe('low');
	});
	it('ships a finite eight-root head with a pinned public encoder and matching dimensions', () => {
		expect(head.labels).toHaveLength(8);
		expect(new Set(head.labels.map((l) => l.categoryId)).size).toBe(8);
		expect(head.dimension).toBe(384);
		expect(head.source.revision).toMatch(/^[a-f0-9]{40}$/);
		expect(head.encoderSha256).toMatch(/^[a-f0-9]{64}$/);
		expect(head.weights.every((w) => w.length === 384 && w.every(Number.isFinite))).toBe(true);
	});
});
