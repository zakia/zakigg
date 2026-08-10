import { describe, expect, it } from 'vitest';
import { createNotePage } from '$lib/notes/types';
import {
	createPublishedCraftDocument,
	createPublishedCraftSummary,
	rewritePublishedAssetSources
} from './publication';

describe('published craft snapshots', () => {
	it('derives metadata and removes the editor title from the rendered body', () => {
		const page = createNotePage({
			id: 'page_test',
			title: 'A Useful Note',
			slug: 'a-useful-note',
			createdAt: '2025-04-03T12:00:00.000Z',
			updatedAt: '2025-04-04T12:00:00.000Z',
			properties: [
				{ key: 'description', value: 'A deliberate description.' },
				{ key: 'date', value: '2025-03-16' }
			],
			content: {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 1 },
						content: [{ type: 'text', text: 'A Useful Note' }]
					},
					{ type: 'paragraph', content: [{ type: 'text', text: 'The body.' }] }
				]
			}
		});

		expect(createPublishedCraftSummary(page)).toMatchObject({
			slug: 'a-useful-note',
			title: 'A Useful Note',
			description: 'A deliberate description.',
			date: '2025-03-16'
		});
		expect(createPublishedCraftDocument(page).content.content?.[0]?.type).toBe('paragraph');
	});

	it('rewrites local assets anywhere in document attributes', () => {
		const document = {
			version: 1 as const,
			editor: 'tiptap' as const,
			content: {
				type: 'doc',
				content: [
					{
						type: 'componentEmbed',
						attrs: { props: { images: ['local-asset://image_one'] } }
					},
					{ type: 'mediaBlock', attrs: { src: 'local-asset://video_two' } }
				]
			}
		};

		const result = rewritePublishedAssetSources(document, 'demo craft');
		expect(result.content.content?.[0]?.attrs?.props.images).toEqual([
			'/crafts/demo%20craft/assets/image_one'
		]);
		expect(result.content.content?.[1]?.attrs?.src).toBe('/crafts/demo%20craft/assets/video_two');
	});
});
