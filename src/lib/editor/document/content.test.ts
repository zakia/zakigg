import { describe, expect, it } from 'vitest';
import { serializeNotePageMarkdown } from './markdown';
import { createNotePage, getReferencedAssetIds, parseStoredPage, toStoredNotePage } from './model';

describe('Markdown page model', () => {
	it('stores one canonical Markdown source with frontmatter', () => {
		const page = createNotePage({
			id: 'page_markdown',
			title: 'Canonical',
			properties: [{ key: 'mood', value: 'focused' }],
			markdown: '## Body\n\nHello.'
		});
		const stored = toStoredNotePage(page);

		expect(stored).toMatchObject({ version: 3, format: 'markdown' });
		expect(stored).not.toHaveProperty('content');
		expect(stored).not.toHaveProperty('editor');
		expect(stored.markdown).toContain('title: Canonical');
		expect(stored.markdown).toContain('mood: focused');
		expect(serializeNotePageMarkdown(page)).toBe(stored.markdown);
	});

	it('hydrates only the current Markdown schema', () => {
		const current = toStoredNotePage(
			createNotePage({ id: 'page_current', title: 'Current', markdown: 'Body' })
		);
		const obsolete = { ...current, version: 2 };

		expect(parseStoredPage(current)?.markdown).toContain('Body');
		expect(parseStoredPage(obsolete)).toBeNull();
	});

	it('derives an untitled page name from its first level-one heading', () => {
		const page = createNotePage({ markdown: '# Imported title\n\nBody' });

		expect(page.title).toBe('Imported title');
	});

	it('finds local assets directly in Markdown component props', () => {
		expect(
			getReferencedAssetIds(
				'<Carousel images={["local-asset://one","local-asset://two"]} />\n\n![x](local-asset://one)'
			)
		).toEqual(['one', 'two']);
	});
});
