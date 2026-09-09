import { describe, expect, it } from 'vitest';
import { restoreWikiLinkSyntax, transformWikiLinks } from './wiki-links';

describe('Obsidian wiki-link syntax', () => {
	it('parses targets, headings, labels, and surrounding text', () => {
		const tree = {
			type: 'root',
			children: [
				{ type: 'paragraph', children: [{ type: 'text', value: 'See [[Roadmap#Q4|the plan]].' }] }
			]
		};

		expect(transformWikiLinks(tree).children[0]?.children).toEqual([
			{ type: 'text', value: 'See ' },
			{
				type: 'link',
				url: 'wikilink:Roadmap%23Q4',
				children: [{ type: 'text', value: 'the plan' }]
			},
			{ type: 'text', value: '.' }
		]);
	});

	it('serializes editor links back to wiki-link syntax', () => {
		const tree = {
			type: 'root',
			children: [
				{
					type: 'paragraph',
					children: [
						{
							type: 'link',
							url: 'wikilink:Daily%20notes',
							children: [{ type: 'text', value: 'Daily notes' }]
						}
					]
				}
			]
		};

		expect(transformWikiLinks(tree).children[0]?.children).toEqual([
			{ type: 'text', value: '[[Daily notes]]' }
		]);
	});

	it('normalizes the serializer link form back to Obsidian syntax', () => {
		expect(
			restoreWikiLinkSyntax(
				'Read [Roadmap](wikilink:Roadmap) and [the plan](wikilink:Project%20Plan).'
			)
		).toBe('Read [[Roadmap]] and [[Project Plan|the plan]].');
	});

	it('leaves code and escaped brackets alone', () => {
		const tree = {
			type: 'root',
			children: [
				{ type: 'paragraph', children: [{ type: 'text', value: String.raw`\[[literal]]` }] },
				{ type: 'code', value: '[[code]]' }
			]
		};

		expect(transformWikiLinks(tree)).toEqual(tree);
	});
});
