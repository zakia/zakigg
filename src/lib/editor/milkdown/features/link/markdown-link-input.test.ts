import { describe, expect, it } from 'vitest';
import { parseMarkdownLinkInput } from './markdown-link-input';

describe('Markdown link input', () => {
	it('uses the Markdown parser for escaped labels, URLs, and titles', () => {
		expect(parseMarkdownLinkInput('[A \\] label](https://example.com/a_(b) "Example")')).toEqual({
			label: 'A ] label',
			href: 'https://example.com/a_(b)',
			title: 'Example'
		});
	});

	it('leaves incomplete or formatted labels as source text', () => {
		expect(parseMarkdownLinkInput('[Incomplete](https://example.com')).toBeUndefined();
		expect(parseMarkdownLinkInput('[**Formatted**](https://example.com)')).toBeUndefined();
	});
});
