import { describe, expect, it } from 'vitest';
import { componentEmbeds } from './index';

describe('component folder discovery', () => {
	it('discovers every typed component definition in the embeds folder', () => {
		expect(componentEmbeds.all.map((entry) => entry.markdownName)).toEqual([
			'Attachment',
			'Callout',
			'ImageCarousel',
			'ChessPuzzles',
			'Columns',
			'Image',
			'QuoteShuffle',
			'RockPaperScissorsGame',
			'StyleGuidePreview',
			'TicTacToeGame',
			'Timer',
			'Video'
		]);
	});

	it('exposes complete authoring metadata for insertable components', () => {
		for (const entry of componentEmbeds.insertable()) {
			expect(entry.label).toBeTruthy();
			expect(entry.description).toBeTruthy();
			expect(Array.isArray(entry.fields)).toBe(true);
			expect(componentEmbeds.createNode(entry.id).ok).toBe(true);
		}
	});
});
