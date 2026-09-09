import { describe, expect, it } from 'vitest';
import { componentEmbeds } from '$lib/embeds';
import { getFirstMarkdownHeading, getMarkdownText, parseMarkdownAst } from './markdown-ast';
import { parseEditorMarkdown } from './markdown';

describe('Markdown syntax boundary', () => {
	it('parses GFM and MDX components into one Markdown AST', () => {
		const tree = parseMarkdownAst(`## Demo

| Name | Done |
| --- | --- |
| Parser | yes |

<Timer endIsoTimestamp="2026-09-01T12:00:00.000Z" />
`);

		expect(tree.children.map((node) => node.type)).toEqual([
			'heading',
			'table',
			'mdxJsxFlowElement'
		]);
		expect(() =>
			parseEditorMarkdown(
				String.raw`<Timer endIsoTimestamp="2026-09-01T12:00:00.000Z" />`,
				componentEmbeds
			)
		).not.toThrow();
	});

	it('extracts document text and the first level-one heading', () => {
		const source = '# A title\n\nWords with **weight** and `code`.\n\n![Diagram](image.png)';
		expect(getFirstMarkdownHeading(source)).toBe('A title');
		expect(getMarkdownText(source)).toBe('A title Words with weight and code. Diagram');
	});

	it('rejects executable props, spread props, raw HTML, and unknown components', () => {
		expect(() => parseEditorMarkdown('<Timer value={run()} />', componentEmbeds)).toThrow(
			'must be a JSON literal'
		);
		expect(() => parseEditorMarkdown('<Timer {...props} />', componentEmbeds)).toThrow(
			'Spread attributes are not allowed'
		);
		expect(() => parseEditorMarkdown('<script>alert(1)</script>', componentEmbeds)).toThrow(
			'Raw HTML is not supported'
		);
		expect(() => parseEditorMarkdown('<NotRegistered />', componentEmbeds)).toThrow(
			'Unknown component embed'
		);
	});

	it('does not interpret the removed component directive syntax', () => {
		const tree = parseMarkdownAst(
			'::component{component="core.Timer" props="{\\"endIsoTimestamp\\":\\"soon\\"}"}'
		);
		expect(tree.children[0]?.type).toBe('paragraph');
	});
});
