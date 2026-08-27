import { describe, expect, it } from 'vitest';
import { readComponentEmbed } from './component-embed';

describe('Milkdown component embeds', () => {
	it('maps author-facing component names to the registered component id', () => {
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
			component: 'core.Timer',
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
});
