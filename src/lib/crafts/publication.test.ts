import { describe, expect, it } from 'vitest';
import { createNotePage } from '$lib/editor/document/model';
import {
	createPublishedCraftDocument,
	createPublishedCraftSummary,
	createPublicCraftList,
	countCraftWords,
	rewritePublishedAssetSources
} from './publication';

describe('published craft snapshots', () => {
	it('derives metadata and publishes body Markdown without editor frontmatter', () => {
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
			markdown: 'The body.'
		});

		expect(createPublishedCraftSummary(page)).toMatchObject({
			slug: 'a-useful-note',
			title: 'A Useful Note',
			description: 'A deliberate description.',
			date: '2025-03-16',
			wordCount: 5
		});
		expect(createPublishedCraftDocument(page).markdown).toBe('The body.\n');
	});

	it('counts title and Markdown body words', () => {
		expect(countCraftWords('The **body**.', 'A Useful Note')).toBe(5);
	});

	it('rewrites every local asset reference in Markdown', () => {
		const document = {
			version: 2 as const,
			format: 'markdown' as const,
			markdown:
				'<Carousel images={["local-asset://image_one"]} />\n\n<Video src="local-asset://video_two" />'
		};

		expect(rewritePublishedAssetSources(document).markdown).toBe(
			'<Carousel images={["/media/image_one"]} />\n\n<Video src="/media/video_two" />'
		);
	});

	it('builds one date-ordered public list', () => {
		const published = [
			{
				pageId: 'older',
				slug: 'older',
				title: 'Older',
				description: '',
				tags: [],
				date: '2025-02-01',
				updatedAt: '2025-02-01T12:00:00.000Z'
			},
			{
				pageId: 'newer',
				slug: 'newer',
				title: 'Newer',
				description: '',
				tags: [],
				date: '2025-03-01',
				updatedAt: '2025-03-01T12:00:00.000Z'
			}
		];
		expect(createPublicCraftList(published).map((item) => item.id)).toEqual(['newer', 'older']);
	});
});
