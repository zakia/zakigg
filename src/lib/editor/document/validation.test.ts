import { describe, expect, it } from 'vitest';
import { componentEmbeds } from '#lib/embeds/index.js';
import { validateMarkdown } from './validation';

describe('Markdown validation', () => {
	it('rejects misplaced Column through the same interpretation used for reading', () => {
		const source = '---\ntitle: Note\n---\n\n<Column>\nstray\n</Column>';
		expect(validateMarkdown(source, componentEmbeds)[0]).toMatchObject({
			message: expect.stringContaining('directly inside'),
			from: source.indexOf('<Column>')
		});
	});
});

it('reports invalid configured props, preserves unknown YAML, and accepts open fences', () => {
	expect(
		validateMarkdown(
			'---\npublished: later\ncustom: {nested: true}\n---\n\n```ts\nconst x = 1',
			componentEmbeds
		)
	).toEqual([]);
	expect(
		validateMarkdown(
			'<Columns gap="bogus">\n<Column>\nA\n</Column>\n<Column>\nB\n</Column>\n</Columns>',
			componentEmbeds
		)[0]?.message
	).toBeTruthy();
});
