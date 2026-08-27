import { mount, unmount } from 'svelte';
import remarkMdx from 'remark-mdx';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { NodeView, NodeViewConstructor } from '@milkdown/kit/prose/view';
import type { NodeSchema } from '@milkdown/kit/transformer';
import { $command, $node, $remark, $view } from '@milkdown/kit/utils';
import YoutubeEmbedView from './YoutubeEmbedView.svelte';
import { readStringAttribute, type MarkdownAstNode } from './mdx';
import { YoutubeEmbedViewState } from './youtube-view-state.svelte';

export const youtubeMdx = $remark('youtubeMdx', () => remarkMdx);

export function readYoutubeEmbedId(node: MarkdownAstNode) {
	if (node.type !== 'mdxJsxFlowElement' || node.name !== 'YoutubeEmbed') return null;

	const id = readStringAttribute(node, 'id');

	return typeof id === 'string' && id.trim() ? id.trim() : null;
}

export function createYoutubeEmbedMarkdownNode(id: string) {
	return {
		type: 'mdxJsxFlowElement',
		name: 'YoutubeEmbed',
		attributes: [{ type: 'mdxJsxAttribute', name: 'id', value: id }],
		children: []
	};
}

export function createYoutubeEmbedSchema(): NodeSchema {
	return {
		group: 'block',
		atom: true,
		isolating: true,
		selectable: true,
		draggable: false,
		attrs: {
			id: { default: '', validate: 'string' }
		},
		parseDOM: [
			{
				tag: '[data-youtube-embed]',
				getAttrs: (dom) => ({
					id: dom instanceof HTMLElement ? (dom.dataset.youtubeEmbed ?? '') : ''
				})
			}
		],
		toDOM: (node) => [
			'div',
			{
				'data-youtube-embed': String(node.attrs.id),
				contenteditable: 'false'
			}
		],
		parseMarkdown: {
			match: (node) => readYoutubeEmbedId(node as MarkdownAstNode) !== null,
			runner: (state, node, type) => {
				const id = readYoutubeEmbedId(node as MarkdownAstNode);
				if (id) state.addNode(type, { id });
			}
		},
		toMarkdown: {
			match: (node) => node.type.name === 'youtubeEmbed',
			runner: (state, node) => {
				const markdownNode = createYoutubeEmbedMarkdownNode(String(node.attrs.id));
				state.addNode(markdownNode.type, markdownNode.children, undefined, {
					name: markdownNode.name,
					attributes: markdownNode.attributes
				});
			}
		}
	};
}

export const youtubeEmbedNode = $node('youtubeEmbed', createYoutubeEmbedSchema);

export const insertYoutubeEmbedCommand = $command<string, 'InsertYoutubeEmbed'>(
	'InsertYoutubeEmbed',
	(ctx) =>
		(id = '') =>
		(state, dispatch) => {
			const normalizedId = id.trim();
			if (!normalizedId) return false;
			if (!dispatch) return true;

			const node = youtubeEmbedNode.type(ctx).create({ id: normalizedId });
			dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
			return true;
		}
);

function createYoutubeNodeView(): NodeViewConstructor {
	return (node: ProseNode): NodeView => {
		const dom = document.createElement('div');
		dom.className = 'milkdown-youtube-node';
		dom.dataset.youtubeEmbed = String(node.attrs.id);
		dom.contentEditable = 'false';

		const viewState = new YoutubeEmbedViewState(String(node.attrs.id));
		const component = mount(YoutubeEmbedView, {
			target: dom,
			props: { state: viewState }
		});

		return {
			dom,
			update: (nextNode: ProseNode) => {
				if (nextNode.type.name !== 'youtubeEmbed') return false;
				viewState.id = String(nextNode.attrs.id);
				dom.dataset.youtubeEmbed = viewState.id;
				return true;
			},
			selectNode: () => dom.classList.add('is-selected'),
			deselectNode: () => dom.classList.remove('is-selected'),
			destroy: () => {
				void unmount(component);
				dom.remove();
			}
		};
	};
}

export const youtubeEmbedView = $view(youtubeEmbedNode, createYoutubeNodeView);

export const youtubeEmbedFeature = [
	...youtubeMdx,
	youtubeEmbedNode,
	insertYoutubeEmbedCommand,
	youtubeEmbedView
];
