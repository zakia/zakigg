import { describe, expect, it } from 'vitest';
import { serializeNotePageMarkdown } from './markdown';
import { createNotePage, parseStoredPage } from './types';

describe('page content boundaries', () => {
	it('lifts an imported leading title out of the editor body without losing it', () => {
		const page = createNotePage({
			content: {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 1 },
						content: [{ type: 'text', text: 'Imported title' }]
					},
					{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }
				]
			}
		});

		expect(page.title).toBe('Imported title');
		expect(page.content.content).toMatchObject([
			{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }
		]);
		expect(page.content.content?.[0].attrs?.blockId).toEqual(expect.any(String));
		expect(serializeNotePageMarkdown(page)).toContain('title: Imported title');
		expect(serializeNotePageMarkdown(page)).toContain('\nBody\n');
	});

	it('does not let a body heading rename an existing page', () => {
		const page = createNotePage({
			title: 'Page title',
			content: {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 1 },
						content: [{ type: 'text', text: 'Body section' }]
					}
				]
			}
		});

		expect(page.title).toBe('Page title');
		expect(page.content.content?.[0]).toMatchObject({
			type: 'heading',
			content: [{ type: 'text', text: 'Body section' }]
		});
	});

	it('removes a legacy presentation description only with its matching title', () => {
		const page = createNotePage({
			title: 'Page title',
			properties: [{ key: 'description', value: 'Page description' }],
			content: {
				type: 'doc',
				content: [
					{
						type: 'heading',
						attrs: { level: 1 },
						content: [{ type: 'text', text: 'Page title' }]
					},
					{
						type: 'heading',
						attrs: { level: 4 },
						content: [{ type: 'text', text: 'Page description' }]
					},
					{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }
				]
			}
		});

		expect(page.content.content).toMatchObject([
			{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }
		]);
		expect(page.content.content?.[0].attrs?.blockId).toEqual(expect.any(String));
	});

	it('assigns deterministic IDs when reading the same legacy page repeatedly', () => {
		const legacyPage = {
			version: 1,
			editor: 'tiptap',
			id: 'page_legacy',
			slug: 'legacy',
			title: 'Legacy',
			tags: [],
			properties: [],
			content: {
				type: 'doc',
				content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }]
			},
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z'
		};

		expect(parseStoredPage(legacyPage)?.content).toEqual(parseStoredPage(legacyPage)?.content);
		expect(parseStoredPage(legacyPage)?.content.content?.[0].attrs?.blockId).toBe(
			'block_migrated_page_legacy_1'
		);
	});
});
