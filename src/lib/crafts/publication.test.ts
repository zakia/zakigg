import { describe, expect, it } from 'vitest';
import { createNotePage } from '$lib/notes/types';
import {
	createPublishedCraftDocument,
	createPublishedCraftSummary,
	countCraftWords,
	isPublishedCraftOutdated,
	rewritePublishedAssetSources,
	toPublishedCraftSummary
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
			date: '2025-03-16',
			wordCount: 5
		});
		expect(createPublishedCraftDocument(page).content.content?.[0]?.type).toBe('paragraph');
	});

	it('can restore a word count after the published body has had its title removed', () => {
		expect(
			countCraftWords(
				{
					type: 'doc',
					content: [{ type: 'paragraph', content: [{ type: 'text', text: 'The body.' }] }]
				},
				'A Useful Note'
			)
		).toBe(5);
	});

	it('removes a legacy description heading with the page title', () => {
		const page = createNotePage({
			title: 'A Useful Note',
			properties: [{ key: 'description', value: 'A deliberate description.' }],
			content: {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 1 },
						content: [{ type: 'text', text: 'A Useful Note' }]
					},
					{
						type: 'heading',
						attrs: { level: 4 },
						content: [{ type: 'text', text: 'A deliberate description.' }]
					},
					{ type: 'paragraph', content: [{ type: 'text', text: 'The body.' }] }
				]
			}
		});

		const published = createPublishedCraftDocument(page);

		expect(published.content.content).toEqual([
			{ type: 'paragraph', content: [{ type: 'text', text: 'The body.' }] }
		]);
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

	it('returns a serializable public summary without Firestore-only fields', () => {
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

		expect(toPublishedCraftSummary(metadata)).toEqual({
			pageId: 'page_test',
			slug: 'a-useful-note',
			title: 'A Useful Note',
			description: 'A deliberate description.',
			tags: ['notes'],
			date: '2025-03-16',
			updatedAt: '2025-04-04T12:00:00.000Z',
			draft: false,
			fullBleed: false
		});
	});

	it('detects when a private note is newer than its published snapshot', () => {
		expect(
			isPublishedCraftOutdated(
				{ updatedAt: '2025-04-05T12:00:00.000Z' },
				{ updatedAt: '2025-04-04T12:00:00.000Z' }
			)
		).toBe(true);
		expect(
			isPublishedCraftOutdated(
				{ updatedAt: '2025-04-04T12:00:00.000Z' },
				{ updatedAt: '2025-04-04T12:00:00.000Z' }
			)
		).toBe(false);
	});
});
