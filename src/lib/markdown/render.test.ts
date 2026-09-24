import { describe, expect, it } from 'vitest';
import { renderMarkdownInlineToHtml } from './render';

describe('renderMarkdownInlineToHtml', () => {
	it('renders inline formatting without a wrapping <p>', () => {
		expect(renderMarkdownInlineToHtml('**bold** and *italic*')).toBe(
			'<strong>bold</strong> and <em>italic</em>'
		);
	});

	it('renders links', () => {
		expect(renderMarkdownInlineToHtml('[Equinox+](https://equinoxplus.com)')).toBe(
			'<a href="https://equinoxplus.com">Equinox+</a>'
		);
	});

	it('returns an empty string for content without a paragraph', () => {
		expect(renderMarkdownInlineToHtml('')).toBe('');
	});
});
