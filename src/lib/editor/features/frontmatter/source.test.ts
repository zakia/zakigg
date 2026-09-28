import { describe, expect, it } from 'vitest';
import { createPage, readPage } from '../../Page';
import { frontmatterRange, readFrontmatter, updateFrontmatterValue } from './source';

function apply(source: string, change: { from: number; to: number; insert: string } | null) {
	return change
		? `${source.slice(0, change.from)}${change.insert}${source.slice(change.to)}`
		: source;
}

describe('frontmatter source edits', () => {
	it('keeps the closing fence separate from body whitespace as blank lines are typed', () => {
		const source = '---\ntitle: Untitled\n---\n';
		const initial = frontmatterRange(source);
		const afterEnter = frontmatterRange(`${source}\n`);

		expect(initial?.fenceTo).toBe(source.length - 1);
		expect(initial?.bodyFrom).toBe(source.length);
		expect(afterEnter?.fenceTo).toBe(initial?.fenceTo);
		expect(afterEnter?.bodyFrom).toBe(source.length + 1);
	});

	it('keeps YAML comments and unknown nested fields when a typed value changes', () => {
		const source =
			'---\n# Editorial note\ntitle: Before\ncustom:\n  nested: value\ntags:\n  - old\n---\n\nBody\n';
		const next = apply(source, updateFrontmatterValue(source, 'title', 'After'));
		expect(next).toContain('# Editorial note');
		expect(next).toContain('custom:\n  nested: value');
		expect(next).toContain('title: After');
		expect(next).toContain('---\n\nBody\n');
		expect(readFrontmatter(next).values?.title).toBe('After');
	});

	it('keeps CRLF line endings when editing frontmatter', () => {
		const source = '---\r\ntitle: Before\r\ntags:\r\n  - one\r\n---\r\n\r\nBody\r\n';
		const next = apply(source, updateFrontmatterValue(source, 'title', 'After'));
		expect(next).toContain('title: After\r\ntags:\r\n');
		expect(next.replace(/\r\n/g, '')).not.toContain('\n');
	});

	it('keeps malformed YAML visible and does not replace it from typed controls', () => {
		const source = '---\ntitle: [broken\n---\n\nBody';
		expect(readFrontmatter(source).error).toBeTruthy();
		expect(updateFrontmatterValue(source, 'title', 'New')).toBeNull();
		expect(readPage(source, createPage({ id: 'page_test', title: 'Fallback' })).markdown).toBe(
			source
		);
	});

	it('does not prepend a second frontmatter while a closing fence is missing', () => {
		const source = '---\ntitle: In progress\nBody';
		expect(readFrontmatter(source).error).toContain('Missing closing');
		expect(readPage(source, createPage({ id: 'page_test', title: 'Fallback' })).markdown).toBe(
			source
		);
	});

	it('preserves deliberate removal of frontmatter in an existing draft', () => {
		const initial = createPage({ id: 'page_test', title: 'Before' }, 'Body');
		const draft = readPage('Body without frontmatter', initial);
		expect(draft.markdown).toBe('Body without frontmatter');
		expect(readFrontmatter(draft.markdown).error).toBe('Frontmatter is missing.');
	});

	it('shows a typed-property error without coercing an invalid value', () => {
		const source = '---\ntitle: Note\ntags: [one, 2]\n---\n\nBody';
		expect(readFrontmatter(source).error).toBe('tags must be a list of text values.');
		expect(updateFrontmatterValue(source, 'title', 'Other')).toBeNull();
		expect(readPage(source, createPage({ id: 'page_test', title: 'Fallback' })).markdown).toBe(
			source
		);
	});

	it('uses frontmatter title as the page title and keeps the original source', () => {
		const source = '---\ntitle: Source title # kept\ndate: 2026-09-25\n---\n\nBody  \n';
		const page = readPage(source, createPage({ id: 'page_test', title: 'Stale title' }));
		expect(page.title).toBe('Source title');
		expect(page.markdown).toBe(source);
	});

	it('does not fall back to a stale title while the title field is empty', () => {
		const page = readPage(
			'---\ntitle: ""\n---\n\nBody',
			createPage({ id: 'page_test', title: 'Old title' })
		);
		expect(page.title).toBe('Untitled');
	});

	it('keeps the existing URL slug when the frontmatter title changes', () => {
		const page = readPage(
			'---\ntitle: New title\n---\n\nBody',
			createPage({ id: 'page_test', slug: 'stable-url', title: 'Old title' })
		);
		expect(page.title).toBe('New title');
		expect(page.slug).toBe('stable-url');
	});

	it('retains numeric custom properties as numbers', () => {
		const page = readPage(
			'---\ntitle: Note\nrating: 5\n---\n\nBody',
			createPage({ id: 'page_test' })
		);
		expect(page.properties.find((property) => property.key === 'rating')?.value).toBe(5);
	});

	it('leaves nested YAML in the source without coercing it into a property string', () => {
		const source = '---\ntitle: Note\ncustom:\n  nested: 1\n---\n\nBody';
		const page = readPage(source);
		expect(page.properties.find((property) => property.key === 'custom')).toBeUndefined();
		expect(page.markdown).toBe(source);
	});
});

it('uses published for new documents and preserves legacy visibility when reading', () => {
	expect(createPage().frontmatter?.published).toBe(false);
	for (const [field, published] of [
		['draft: true', false],
		['draft: false', true],
		['published: false', false],
		['published: true', true]
	] as const) {
		const source = `---\nid: page_visibility\n${field}\n---\n\nBody`;
		expect(readPage(source).frontmatter?.published).toBe(published);
		expect(readPage(source).markdown).toBe(source);
	}
});

it('replaces legacy draft when publication is explicitly changed without losing comments or body', () => {
	const source = '---\n# Keep this\nid: page_visibility\ndraft: true\ncustom: hello\n---\n\nBody';
	const next = apply(source, updateFrontmatterValue(source, 'published', true));
	expect(next).toContain('published: true');
	expect(next).not.toContain('draft:');
	expect(next).toContain('# Keep this');
	expect(next).toContain('custom: hello');
	expect(next).toContain('---\n\nBody');
	expect(readFrontmatter('---\npublished: yes\n---').error).toBe(
		'published must be true or false.'
	);
});
