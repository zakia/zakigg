import { describe, expect, it } from 'vitest';
import { compareMutationVersions, pageToPayload, payloadToPage } from './protocol';
import { createNotePage } from '../types';

describe('note sync protocol', () => {
	it('orders equal-time mutations deterministically', () => {
		const left = { updatedAt: '2026-08-06T12:00:00.000Z', mutationId: 'mutation_a' };
		const right = { updatedAt: '2026-08-06T12:00:00.000Z', mutationId: 'mutation_b' };

		expect(compareMutationVersions(left, right)).toBeLessThan(0);
		expect(compareMutationVersions(right, left)).toBeGreaterThan(0);
	});

	it('round-trips current ordered note properties', () => {
		const page = createNotePage({
			id: 'page_test',
			title: 'Cloud note',
			properties: [
				{ key: 'date', value: '2026-08-06' },
				{ key: 'mood', value: 'focused' }
			]
		});
		const payload = pageToPayload(page, 'mutation_test');
		const restored = payloadToPage({ ...payload, serverVersion: 'change_test' });

		expect(restored?.properties).toEqual(page.properties);
		expect(restored?.content).toEqual(page.content);
	});
});
