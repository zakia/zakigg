import { describe, expect, it } from 'vitest';
import { componentEmbeds } from '$lib/embeds';
import { editorContentToMarkdown, markdownBodyToEditorContent } from './markdown-ast';
import { parseEditorMarkdown } from './markdown';

describe('Markdown document adapter', () => {
	it('parses GFM and safe JSX-shaped components without Tiptap', () => {
		const content = markdownBodyToEditorContent(`## Demo

| Name | Done |
| --- | --- |
| Parser | yes |

<Timer endIsoTimestamp="2026-09-01T12:00:00.000Z" />
`);

		expect(content.content).toMatchObject([
			{ type: 'heading', attrs: { level: 2 } },
			{ type: 'table' },
			{
				type: 'componentEmbed',
				attrs: {
					component: 'Timer',
					props: { endIsoTimestamp: '2026-09-01T12:00:00.000Z' }
				}
			}
		]);
		expect(() =>
			parseEditorMarkdown(editorContentToMarkdown(content), componentEmbeds)
		).not.toThrow();
	});

	it('round-trips literal component props and nested Markdown children', () => {
		const source = `<Columns gap="large">
<Column width={2}>
## Main column

- one
- two
</Column>
<Column>
Side column
</Column>
</Columns>
`;
		const first = markdownBodyToEditorContent(source);
		const serialized = editorContentToMarkdown(first);
		const second = markdownBodyToEditorContent(serialized);

		expect(second).toEqual(first);
		expect(() => parseEditorMarkdown(serialized, componentEmbeds)).not.toThrow();
		expect(serialized).toContain('<Columns gap="large">');
		expect(serialized).toContain('<Column width={2}>');
		expect(serialized).toContain('## Main column');
	});

	it('rejects executable props, spread props, raw HTML, and unknown registered components', () => {
		expect(() => markdownBodyToEditorContent('<Timer value={run()} />')).toThrow(
			'must be a JSON literal'
		);
		expect(() => markdownBodyToEditorContent('<Timer {...props} />')).toThrow(
			'Spread attributes are not allowed'
		);
		expect(() => markdownBodyToEditorContent('<script>alert(1)</script>')).toThrow(
			'Raw HTML is not supported'
		);
		expect(() => parseEditorMarkdown('<NotRegistered />', componentEmbeds)).toThrow(
			'Unknown component embed'
		);
	});

	it('upgrades the legacy component directive to readable component syntax', () => {
		const content = markdownBodyToEditorContent(
			'::component{component="core.Timer" props="{\\"endIsoTimestamp\\":\\"2026-09-01T12:00:00.000Z\\"}"}'
		);

		expect(editorContentToMarkdown(content)).toContain(
			'<Timer endIsoTimestamp="2026-09-01T12:00:00.000Z" />'
		);
	});

	it('turns GitHub alerts into editable callouts and keeps their Markdown syntax', () => {
		const source = `> [!WARNING]
> **Back up** your data first.
`;
		const content = markdownBodyToEditorContent(source);

		expect(content.content?.[0]).toMatchObject({
			type: 'componentEmbed',
			attrs: {
				component: 'Callout',
				props: { kind: 'warning', markdown: '**Back up** your data first.' }
			}
		});
		expect(editorContentToMarkdown(content)).toBe(source);
	});
});
