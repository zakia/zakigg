import { describe, expect, it } from 'vitest';
import { parseMarkdownAst } from '$lib/editor/document/markdown-ast';
import {
	createComponentEmbedDomAttributes,
	createComponentEmbedMarkdownNode,
	readComponentEmbed,
	readComponentEmbedDomAttrs,
	transformCallouts
} from './component-embed';

describe('Milkdown component embeds', () => {
	it('keeps the author-facing name as the portable document identity', () => {
		expect(
			readComponentEmbed({
				type: 'mdxJsxFlowElement',
				name: 'Timer',
				attributes: [
					{
						type: 'mdxJsxAttribute',
						name: 'endIsoTimestamp',
						value: '2026-09-01T12:00:00.000Z'
					}
				]
			})
		).toEqual({
			component: 'Timer',
			markdownName: 'Timer',
			props: { endIsoTimestamp: '2026-09-01T12:00:00.000Z' }
		});
	});

	it('preserves unknown safe components as inert document nodes', () => {
		expect(
			readComponentEmbed({
				type: 'mdxJsxFlowElement',
				name: 'FutureComponent',
				attributes: [
					{ type: 'mdxJsxAttribute', name: 'enabled', value: null },
					{
						type: 'mdxJsxAttribute',
						name: 'config',
						value: { type: 'mdxJsxAttributeValueExpression', value: '{"size":2}' }
					}
				]
			})
		).toEqual({
			component: 'FutureComponent',
			markdownName: 'FutureComponent',
			props: { enabled: true, config: { size: 2 } }
		});
	});

	it('preserves component props and children through cut and paste', () => {
		const attributes = createComponentEmbedDomAttributes({
			component: 'Timer',
			markdownName: 'Timer',
			props: {
				endIsoTimestamp: '2026-09-01T12:00:00.000Z',
				options: { compact: true }
			},
			childrenMarkdown: '**Keep this body.**'
		});

		expect(
			readComponentEmbedDomAttrs({
				componentEmbed: attributes['data-component-embed'],
				markdownName: attributes['data-markdown-name'],
				componentProps: attributes['data-component-props'],
				componentChildrenMarkdown: attributes['data-component-children-markdown']
			})
		).toEqual({
			component: 'Timer',
			markdownName: 'Timer',
			props: {
				endIsoTimestamp: '2026-09-01T12:00:00.000Z',
				options: { compact: true }
			},
			childrenMarkdown: '**Keep this body.**'
		});
	});

	it('restores component body Markdown when serializing the document', () => {
		expect(
			createComponentEmbedMarkdownNode({
				component: 'Panel',
				markdownName: 'Panel',
				props: { tone: 'info' },
				childrenMarkdown: '**Keep this body.**'
			})
		).toMatchObject({
			type: 'mdxJsxFlowElement',
			name: 'Panel',
			attributes: [{ name: 'tone', value: 'info' }],
			children: [
				{
					type: 'paragraph',
					children: [{ type: 'strong', children: [{ type: 'text', value: 'Keep this body.' }] }]
				}
			]
		});
	});

	it('rejects executable and spread attributes', () => {
		expect(() =>
			readComponentEmbed({
				type: 'mdxJsxFlowElement',
				name: 'Timer',
				attributes: [{ type: 'mdxJsxExpressionAttribute', value: '...props' }]
			})
		).toThrow('Spread attributes are not allowed');
		expect(() =>
			readComponentEmbed({
				type: 'mdxJsxFlowElement',
				name: 'Timer',
				attributes: [
					{
						type: 'mdxJsxAttribute',
						name: 'value',
						value: { type: 'mdxJsxAttributeValueExpression', value: 'run()' }
					}
				]
			})
		).toThrow('must be a JSON literal');
	});

	it('maps Obsidian callouts into the registered Callout component', () => {
		const tree = transformCallouts(
			parseMarkdownAst('> [!WARNING]\n> Back up first.') as Parameters<typeof transformCallouts>[0]
		);

		expect(tree.children?.[0]).toMatchObject({
			type: 'mdxJsxFlowElement',
			name: 'Callout',
			attributes: [
				{ name: 'kind', value: 'warning' },
				{ name: 'markdown', value: 'Back up first.' }
			]
		});
	});
});
