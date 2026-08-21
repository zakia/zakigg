import { describe, expect, it } from 'vitest';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { BLOCK_TURN_TARGETS, createBlockCatalog } from './catalog';

describe('block catalog', () => {
	it('provides one insert palette without internal-only list items', () => {
		const ids = createBlockCatalog()
			.insertable()
			.map((block) => block.id);

		expect(ids).toContain('paragraph');
		expect(ids).toContain('table');
		expect(ids).toContain('image');
		expect(ids).not.toContain('list-item');
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('uses the same definitions for gutter descriptions and turn targets', () => {
		const catalog = createBlockCatalog();
		const heading = {
			type: { name: 'heading' },
			attrs: { level: 2 }
		} as unknown as ProseMirrorNode;

		expect(catalog.describe(heading)).toEqual({
			label: 'Heading 2',
			icon: 'mdi:format-header-2'
		});
		expect(BLOCK_TURN_TARGETS.find((target) => target.id === 'heading-2')).toEqual({
			id: 'heading-2',
			label: 'Heading 2',
			icon: 'mdi:format-header-2'
		});
	});
});
