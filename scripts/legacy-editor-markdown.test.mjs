import { describe, expect, it } from 'vitest';
import { legacyEditorContentToMarkdown } from './legacy-editor-markdown.mjs';

describe('legacy editor Markdown migration', () => {
	it('serializes rich text, lists, tables, assets, and custom components', () => {
		expect(
			legacyEditorContentToMarkdown({
				type: 'doc',
				content: [
					{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Legacy' }] },
					{
						type: 'paragraph',
						content: [
							{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
							{ type: 'text', text: ' link', marks: [{ type: 'link', attrs: { href: '/crafts' } }] }
						]
					},
					{
						type: 'bulletList',
						content: [
							{
								type: 'listItem',
								content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }]
							}
						]
					},
					{ type: 'mediaBlock', attrs: { kind: 'image', assetId: 'asset_one', alt: 'One' } },
					{
						type: 'componentEmbed',
						attrs: { component: 'core.Timer', markdownName: 'Timer', props: { seconds: 30 } }
					},
					{
						type: 'table',
						content: [
							{
								type: 'tableRow',
								content: [
									{
										type: 'tableHeader',
										content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }]
									},
									{
										type: 'tableHeader',
										content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }]
									}
								]
							},
							{
								type: 'tableRow',
								content: [
									{
										type: 'tableCell',
										content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }]
									},
									{
										type: 'tableCell',
										content: [{ type: 'paragraph', content: [{ type: 'text', text: '2' }] }]
									}
								]
							}
						]
					}
				]
			})
		).toBe(
			'## Legacy\n\n**Bold**[ link](/crafts)\n\n- One\n\n![One](local-asset://asset_one)\n\n<Timer seconds={30} />\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n'
		);
	});
});
