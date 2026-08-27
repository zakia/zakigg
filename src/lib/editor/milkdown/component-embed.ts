import { mount, unmount } from 'svelte';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { mdxJsxToMarkdown } from 'mdast-util-mdx-jsx';
import { toMarkdown } from 'mdast-util-to-markdown';
import type { Root } from 'mdast';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { NodeView, NodeViewConstructor } from '@milkdown/kit/prose/view';
import type { NodeSchema } from '@milkdown/kit/transformer';
import { $command, $node, $view } from '@milkdown/kit/utils';
import { componentEmbeds } from '$lib/embeds';
import type { ComponentEmbedAttrs } from '$lib/editor/components/registry';
import ComponentEmbedView from './ComponentEmbedView.svelte';
import { ComponentEmbedViewState } from './component-embed-state.svelte';
import type { MarkdownAstNode, MdxAttribute } from '../spike/milkdown/mdx';

const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const RESERVED_COMPONENTS = new Set(['Columns', 'Column', 'YoutubeEmbed', 'br']);

export function readComponentEmbed(node: MarkdownAstNode): ComponentEmbedAttrs | null {
	const markdownName = node.name?.trim() ?? '';
	if (
		node.type !== 'mdxJsxFlowElement' ||
		!COMPONENT_NAME_RE.test(markdownName) ||
		RESERVED_COMPONENTS.has(markdownName)
	)
		return null;

	const props = readComponentProps(markdownName, node.attributes ?? []);
	const entry = componentEmbeds.getByMarkdownName(markdownName);
	const childrenMarkdown = node.children?.length
		? toMarkdown({ type: 'root', children: node.children } as Root, {
				extensions: [gfmToMarkdown(), mdxJsxToMarkdown({ quote: '"' })]
			}).trim()
		: '';

	return {
		component: entry?.id ?? markdownName,
		markdownName,
		props,
		...(childrenMarkdown ? { childrenMarkdown } : {})
	};
}

export function createComponentEmbedSchema(): NodeSchema {
	return {
		group: 'block',
		atom: true,
		isolating: true,
		selectable: true,
		attrs: {
			component: { default: '', validate: 'string' },
			markdownName: { default: '', validate: 'string' },
			props: { default: {} },
			childrenMarkdown: { default: '', validate: 'string' }
		},
		parseDOM: [
			{
				tag: '[data-component-embed]',
				getAttrs: (dom) => ({
					component: dom instanceof HTMLElement ? (dom.dataset.componentEmbed ?? '') : '',
					markdownName: dom instanceof HTMLElement ? (dom.dataset.markdownName ?? '') : '',
					props: {}
				})
			}
		],
		toDOM: (node) => [
			'div',
			{
				'data-component-embed': String(node.attrs.component),
				'data-markdown-name': String(node.attrs.markdownName),
				contenteditable: 'false'
			}
		],
		parseMarkdown: {
			match: (node) => readComponentEmbed(node as MarkdownAstNode) !== null,
			runner: (state, node, type) => {
				const attrs = readComponentEmbed(node as MarkdownAstNode);
				if (attrs) state.addNode(type, attrs);
			}
		},
		toMarkdown: {
			match: (node) => node.type.name === 'componentEmbed',
			runner: (state, node) => {
				const markdownName = String(node.attrs.markdownName || node.attrs.component);
				const attributes = createComponentAttributes(node.attrs.props);
				state.addNode('mdxJsxFlowElement', [], undefined, { name: markdownName, attributes });
			}
		}
	};
}

export const componentEmbedNode = $node('componentEmbed', createComponentEmbedSchema);

export const insertComponentEmbedCommand = $command<string, 'InsertComponentEmbed'>(
	'InsertComponentEmbed',
	(ctx) => (componentId) => (state, dispatch) => {
		if (!componentId) return false;
		const result = componentEmbeds.createNode(componentId);
		if (!result.ok) return false;
		if (!dispatch) return true;

		const attrs = result.node.attrs as ComponentEmbedAttrs;
		const node = componentEmbedNode.type(ctx).create(attrs);
		dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
		return true;
	}
);

function createComponentEmbedNodeView(): NodeViewConstructor {
	return (node: ProseNode, editorView, getPos): NodeView => {
		const dom = document.createElement('div');
		dom.className = 'milkdown-component-embed component-embed-node';
		dom.dataset.componentEmbed = String(node.attrs.component);
		dom.dataset.markdownName = String(node.attrs.markdownName);
		dom.contentEditable = 'false';
		const viewState = new ComponentEmbedViewState(node.attrs as ComponentEmbedAttrs);
		const component = mount(ComponentEmbedView, {
			target: dom,
			props: {
				viewState,
				registry: componentEmbeds,
				onUpdateProps: (props: Record<string, unknown>) => {
					const position = getPos();
					if (typeof position !== 'number') return;
					const current = editorView.state.doc.nodeAt(position);
					if (!current || current.type.name !== 'componentEmbed') return;
					editorView.dispatch(
						editorView.state.tr.setNodeMarkup(position, undefined, { ...current.attrs, props })
					);
				}
			}
		});

		return {
			dom,
			update: (nextNode: ProseNode) => {
				if (nextNode.type.name !== 'componentEmbed') return false;
				viewState.attrs = nextNode.attrs as ComponentEmbedAttrs;
				dom.dataset.componentEmbed = String(nextNode.attrs.component);
				dom.dataset.markdownName = String(nextNode.attrs.markdownName);
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

export const componentEmbedView = $view(componentEmbedNode, createComponentEmbedNodeView);
export const componentEmbedFeature = [
	componentEmbedNode,
	insertComponentEmbedCommand,
	componentEmbedView
];

function readComponentProps(component: string, attributes: MdxAttribute[]) {
	const props: Record<string, unknown> = {};
	for (const attribute of attributes) {
		if (attribute.type === 'mdxJsxExpressionAttribute') {
			throw new Error(`Spread attributes are not allowed on <${component}>.`);
		}
		const name = attribute.name ?? '';
		if (!name || /^on[A-Z]/.test(name)) throw new Error(`Invalid prop on <${component}>.`);
		if (attribute.value == null) props[name] = true;
		else if (typeof attribute.value === 'string') props[name] = attribute.value;
		else {
			try {
				props[name] = JSON.parse(attribute.value.value ?? '');
			} catch {
				throw new Error(`Prop “${name}” on <${component}> must be a JSON literal.`);
			}
		}
	}
	return props;
}

function createComponentAttributes(value: unknown): MdxAttribute[] {
	const props =
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	return Object.entries(props)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([name, prop]) => {
			if (prop === true) return { type: 'mdxJsxAttribute', name, value: null };
			if (typeof prop === 'string') return { type: 'mdxJsxAttribute', name, value: prop };
			return {
				type: 'mdxJsxAttribute',
				name,
				value: { type: 'mdxJsxAttributeValueExpression', value: JSON.stringify(prop) }
			};
		});
}
