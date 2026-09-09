import { describe, expect, it } from 'vitest';
import { createNotePage } from '$lib/editor/document/model';
import {
	createPublishedCraftDocument,
	createPublishedCraftSummary,
	createPublicCraftList,
	countCraftWords,
	isPublishedCraftOutdated,
	rewritePublishedAssetSources,
	toPublishedCraftSummary
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

		expect(rewritePublishedAssetSources(document, 'demo craft').markdown).toBe(
			'<Carousel images={["/crafts/demo%20craft/assets/image_one"]} />\n\n<Video src="/crafts/demo%20craft/assets/video_two" />'
		);
	});

	it('returns a serializable public summary without storage-only fields', () => {
		const metadata = {
			pageId: 'page_test',
			slug: 'a-useful-note',
			title: 'A Useful Note',
			description: 'A deliberate description.',
			tags: ['notes'],
			date: '2025-03-16',
			updatedAt: '2025-04-04T12:00:00.000Z',
			draft: false,
			fullBleed: false,
			ownerId: 'owner_test',
			assetIds: [],
			bodyHash: 'hash',
			bodyObject: 'published-crafts/page_test/body.json',
			publishedAt: '2025-04-04T12:00:00.000Z'
		};

		expect(toPublishedCraftSummary(metadata)).not.toHaveProperty('ownerId');
		expect(toPublishedCraftSummary(metadata)).toMatchObject({ pageId: 'page_test', draft: false });
	});

	it('detects when a private note is newer than its published snapshot', () => {
		expect(
			isPublishedCraftOutdated(
				{ updatedAt: '2025-04-05T12:00:00.000Z' },
				{ updatedAt: '2025-04-04T12:00:00.000Z' }
			)
		).toBe(true);
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
