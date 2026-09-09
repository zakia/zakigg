import { describe, expect, it, vi } from 'vitest';
import type { Node as ProseNode, NodeType } from '@milkdown/kit/prose/model';
import {
	createYoutubeEmbedMarkdownNode,
	createYoutubeEmbedSchema,
	readYoutubeEmbedId
} from './youtube-embed';

describe('Milkdown YoutubeEmbed feature', () => {
	it('maps the safe MDX node into the editor schema', () => {
		const markdownNode = createYoutubeEmbedMarkdownNode('aqz-KE-bpKQ');
		const addNode = vi.fn();
		const schema = createYoutubeEmbedSchema();

		expect(readYoutubeEmbedId(markdownNode)).toBe('aqz-KE-bpKQ');
		expect(schema.parseMarkdown.match(markdownNode)).toBe(true);
		schema.parseMarkdown.runner({ addNode } as never, markdownNode, {} as NodeType);
		expect(addNode).toHaveBeenCalledWith(expect.anything(), { id: 'aqz-KE-bpKQ' });
	});

	it('serializes the editor node back to the same readable component syntax', () => {
		const addNode = vi.fn();
		const schema = createYoutubeEmbedSchema();
		const node = {
			type: { name: 'youtubeEmbed' },
			attrs: { id: 'aqz-KE-bpKQ' }
		} as unknown as ProseNode;

		expect(schema.toMarkdown.match(node)).toBe(true);
		schema.toMarkdown.runner({ addNode } as never, node);
		expect(addNode).toHaveBeenCalledWith('mdxJsxFlowElement', [], undefined, {
			name: 'YoutubeEmbed',
			attributes: [{ type: 'mdxJsxAttribute', name: 'id', value: 'aqz-KE-bpKQ' }]
		});
	});

	it('does not claim unknown or unsafe component shapes', () => {
		expect(readYoutubeEmbedId(createYoutubeEmbedMarkdownNode('   '))).toBeNull();
		expect(readYoutubeEmbedId({ type: 'mdxJsxFlowElement', name: 'Timer' })).toBeNull();
		expect(
			readYoutubeEmbedId({
				type: 'mdxJsxFlowElement',
				name: 'YoutubeEmbed',
				attributes: [
					{
						type: 'mdxJsxAttribute',
						name: 'id',
						value: { value: 'window.location' }
					}
				]
			})
		).toBeNull();
	});
});
