import { describe, expect, it } from 'vitest';
import { renderCraftMarkdown } from '$lib/editor/document/markdown-renderer';

describe('public Markdown renderer', () => {
	it('renders the canonical Markdown body without exposing YAML frontmatter', () => {
		const [block] = renderCraftMarkdown(`---
title: Style Guide
tags:
  - web
---

# Visible heading
`);

		expect(block).toMatchObject({ kind: 'html' });
		if (block?.kind !== 'html') throw new Error('Expected an HTML block');
		expect(block.html).toContain('<h1>Visible heading</h1>');
		expect(block.html).not.toContain('Style Guide');
		expect(block.html).not.toContain('tags:');
	});

	it('renders standard Markdown and Obsidian wiki links', () => {
		const [block] = renderCraftMarkdown('## Notes\n\nRead [[Project Roadmap|the roadmap]].');

		expect(block).toMatchObject({ kind: 'html' });
		if (block?.kind !== 'html') throw new Error('Expected an HTML block');
		expect(block.html).toContain('<h2>Notes</h2>');
		expect(block.html).toContain('href="/crafts/project-roadmap"');
	});

	it('keeps code and registered components as typed render blocks', () => {
		const blocks = renderCraftMarkdown(`\`\`\`ts Example
const ready = true;
\`\`\`

<Timer endIsoTimestamp="2026-09-01T12:00:00.000Z" />
`);

		expect(blocks).toMatchObject([
			{ kind: 'code', language: 'ts', title: 'Example', code: 'const ready = true;' },
			{
				kind: 'component',
				attrs: {
					component: 'Timer',
					props: { endIsoTimestamp: '2026-09-01T12:00:00.000Z' }
				}
			}
		]);
	});

	it('maps nested columns and Obsidian callouts into component props', () => {
		const blocks = renderCraftMarkdown(`<Columns gap="large">
<Column width={2}>
Main
</Column>
<Column>
Side
</Column>
</Columns>

> [!WARNING]
> Back up first.
`);

		expect(blocks[0]).toMatchObject({
			kind: 'component',
			attrs: {
				component: 'Columns',
				props: {
					gap: 'large',
					columns: [{ markdown: 'Main', width: 2 }, { markdown: 'Side' }]
				}
			}
		});
		expect(blocks[1]).toMatchObject({
			kind: 'component',
			attrs: { component: 'Callout', props: { kind: 'warning', markdown: 'Back up first.' } }
		});
	});

	it('renders GFM tables', () => {
		const [block] = renderCraftMarkdown('| A | B |\n| - | - |\n| 1 | 2 |');

		expect(block).toMatchObject({ kind: 'html' });
		if (block?.kind !== 'html') throw new Error('Expected an HTML block');
		expect(block.html).toContain('<table>');
		expect(block.html).toContain('<td>1</td>');
	});

	it('escapes raw HTML like the previous markdown-it html:false behaviour', () => {
		const [block] = renderCraftMarkdown('before <div>raw</div> after');

		expect(block).toMatchObject({ kind: 'html' });
		if (block?.kind !== 'html') throw new Error('Expected an HTML block');
		expect(block.html).not.toContain('<div>');
		expect(block.html).toMatch(/&(lt|#x3C);div/);
	});

	it('renders media by the URL file type', () => {
		const [image] = renderCraftMarkdown('![alt](/media/asset_a.png)');
		expect(image).toMatchObject({ kind: 'html' });
		if (image?.kind !== 'html') throw new Error('Expected an HTML block');
		expect(image.html).toMatch(/<img src="\/media\/asset_a\.png"[^>]*alt="alt"/);

		const [video] = renderCraftMarkdown('![alt](/media/asset_b.mp4)');
		expect(video).toMatchObject({ kind: 'html' });
		if (video?.kind !== 'html') throw new Error('Expected an HTML block');
		expect(video.html).toMatch(/<video src="\/media\/asset_b\.mp4"[^>]*controls/);

		const [audio] = renderCraftMarkdown('![alt](/media/asset_c.mp3)');
		expect(audio).toMatchObject({ kind: 'html' });
		if (audio?.kind !== 'html') throw new Error('Expected an HTML block');
		expect(audio.html).toMatch(/<audio src="\/media\/asset_c\.mp3"[^>]*controls/);

		const [file] = renderCraftMarkdown('![Report](/media/asset_d.pdf)');
		expect(file).toMatchObject({ kind: 'html' });
		if (file?.kind !== 'html') throw new Error('Expected an HTML block');
		expect(file.html).toMatch(/<a href="\/media\/asset_d\.pdf"[^>]*download/);
	});
});
