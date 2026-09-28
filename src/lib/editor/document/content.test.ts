import { describe, expect, it } from 'vitest';
import { serializePageMarkdown } from './markdown';
import { createPage, getReferencedAssetIds, parseStoredPage, toStoredPage } from '../Page';

describe('Markdown page model', () => {
	it('stores one canonical Markdown source with frontmatter', () => {
		const page = createPage(
			{
				id: 'page_markdown',
				title: 'Canonical',
				mood: 'focused'
			},
			'## Body\n\nHello.'
		);
		const stored = toStoredPage(page);

		expect(stored).toMatchObject({ version: 3, format: 'markdown' });
		expect(stored).not.toHaveProperty('content');
		expect(stored).not.toHaveProperty('editor');
		expect(stored.markdown).toContain('title: Canonical');
		expect(stored.markdown).toContain('mood: focused');
		expect(serializePageMarkdown(page)).toBe(stored.markdown);
	});

	it('hydrates only the current Markdown schema', () => {
		const current = toStoredPage(createPage({ id: 'page_current', title: 'Current' }, 'Body'));
		const obsolete = { ...current, version: 2 };

		expect(parseStoredPage(current)?.markdown).toContain('Body');
		expect(parseStoredPage(obsolete)).toBeNull();
	});

	it('derives an untitled page name from its first level-one heading', () => {
		const page = createPage({}, '# Imported title\n\nBody');

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
