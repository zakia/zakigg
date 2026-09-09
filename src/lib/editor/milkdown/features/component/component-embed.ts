import { mount, unmount } from 'svelte';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { mdxJsxToMarkdown } from 'mdast-util-mdx-jsx';
import { toMarkdown } from 'mdast-util-to-markdown';
import type { Root } from 'mdast';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { NodeView, NodeViewConstructor } from '@milkdown/kit/prose/view';
import type { NodeSchema } from '@milkdown/kit/transformer';
import { $command, $ctx, $node, $remark, $view } from '@milkdown/kit/utils';
import type { ComponentEmbedAttrs, ComponentEmbedRegistry } from '$lib/editor/components/registry';
import { parseMarkdownAst } from '$lib/editor/document/markdown-ast';
import ComponentEmbedView from './ComponentEmbedView.svelte';
import { ComponentEmbedViewState } from './component-embed-state.svelte';
import type { MarkdownAstNode, MdxAttribute } from '../../syntax/mdx';

const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const RESERVED_COMPONENTS = new Set(['Columns', 'Column', 'YoutubeEmbed', 'br']);
const CALLOUT_KINDS = new Set(['note', 'tip', 'important', 'warning', 'caution']);
const INTERACTIVE_COMPONENT_TARGETS = [
	'button',
	'input',
	'textarea',
	'select',
	'option',
	'a[href]',
	'video',
	'audio',
	'iframe',
	'[contenteditable="true"]',
	'[role="button"]',
	'[role="checkbox"]',
	'[role="radio"]',
	'[role="slider"]',
	'[role="switch"]',
	'[data-editor-interactive]'
].join(',');

type ComponentEmbedDataset = {
	componentEmbed?: string;
	markdownName?: string;
	componentProps?: string;
	componentChildrenMarkdown?: string;
};

export function createComponentEmbedDomAttributes(attrs: ComponentEmbedAttrs) {
	return {
		'data-component-embed': String(attrs.component),
		'data-markdown-name': String(attrs.markdownName),
		'data-component-props': JSON.stringify(attrs.props ?? {}),
		'data-component-children-markdown': attrs.childrenMarkdown ?? '',
		contenteditable: 'false'
	};
}

export function readComponentEmbedDomAttrs(dataset: ComponentEmbedDataset): ComponentEmbedAttrs {
	let props: Record<string, unknown> = {};
	try {
		const parsed = JSON.parse(dataset.componentProps ?? '{}');
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) props = parsed;
	} catch {
		// Invalid external clipboard HTML remains an inert component that can be
		// repaired in source mode. Internal clipboard data always contains JSON.
	}

	return {
		component: dataset.componentEmbed ?? '',
		markdownName: dataset.markdownName ?? dataset.componentEmbed ?? '',
		props,
		...(dataset.componentChildrenMarkdown
			? { childrenMarkdown: dataset.componentChildrenMarkdown }
			: {})
	};
}

export function createComponentEmbedMarkdownNode(attrs: ComponentEmbedAttrs): MarkdownAstNode & {
	type: 'mdxJsxFlowElement';
	name: string;
	attributes: MdxAttribute[];
	children: MarkdownAstNode[];
} {
	const markdownName = String(attrs.markdownName || attrs.component);
	const children = attrs.childrenMarkdown
		? (parseMarkdownAst(attrs.childrenMarkdown).children as MarkdownAstNode[])
		: [];

	return {
		type: 'mdxJsxFlowElement',
		name: markdownName,
		attributes: createComponentAttributes(attrs.props),
		children
	};
}

export function transformCallouts<T extends MarkdownAstNode>(tree: T): T {
	if (!tree.children) return tree;

	tree.children = tree.children.map((node) => {
		const callout = readCallout(node);
		if (callout) return callout;
		return transformCallouts(node);
	});
	return tree;
}

function calloutPlugin() {
	return (tree: Root) => {
		transformCallouts(tree as MarkdownAstNode);
	};
}

export const calloutSyntax = $remark('calloutSyntax', () => calloutPlugin);

export function readComponentEmbed(node: MarkdownAstNode): ComponentEmbedAttrs | null {
	const markdownName = node.name?.trim() ?? '';
	if (
		node.type !== 'mdxJsxFlowElement' ||
		!COMPONENT_NAME_RE.test(markdownName) ||
		RESERVED_COMPONENTS.has(markdownName)
	)
		return null;

	const props = readComponentProps(markdownName, node.attributes ?? []);
	const childrenMarkdown = node.children?.length
		? toMarkdown({ type: 'root', children: node.children } as Root, {
				extensions: [gfmToMarkdown(), mdxJsxToMarkdown({ quote: '"' })]
			}).trim()
		: '';

	return {
		component: markdownName,
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
				getAttrs: (dom) =>
					dom instanceof HTMLElement
						? readComponentEmbedDomAttrs(dom.dataset)
						: readComponentEmbedDomAttrs({})
			}
		],
		toDOM: (node) => ['div', createComponentEmbedDomAttributes(node.attrs as ComponentEmbedAttrs)],
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
				if (markdownName === 'Callout' && addCalloutMarkdown(state, node.attrs.props)) return;
				const markdownNode = createComponentEmbedMarkdownNode(node.attrs as ComponentEmbedAttrs);
				state.addNode(markdownNode.type, markdownNode.children, undefined, {
					name: markdownNode.name,
					attributes: markdownNode.attributes
				});
			}
		}
	};
}

export const componentEmbedNode = $node('componentEmbed', createComponentEmbedSchema);
export const componentRegistryCtx = $ctx<ComponentEmbedRegistry | null, 'componentRegistry'>(
	null,
	'componentRegistry'
);

export const insertComponentEmbedCommand = $command<string, 'InsertComponentEmbed'>(
	'InsertComponentEmbed',
	(ctx) => (componentId) => (state, dispatch) => {
		if (!componentId) return false;
		const registry = ctx.get(componentRegistryCtx.key);
		if (!registry) return false;
		const result = registry.createNode(componentId);
		if (!result.ok) return false;
		if (!dispatch) return true;

		const node = componentEmbedNode.type(ctx).create(result.attrs);
		dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
		return true;
	}
);

function createComponentEmbedNodeView(registry: ComponentEmbedRegistry): NodeViewConstructor {
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
				registry,
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
			// A component is an opaque document node with its own interactive UI.
			// ProseMirror may select its outer shell, but controls and edit mode own
			// their events completely.
			stopEvent: (event) =>
				viewState.editing ||
				(event.target instanceof Element &&
					Boolean(event.target.closest(INTERACTIVE_COMPONENT_TARGETS))),
			// Svelte and native controls mutate the rendered subtree. None of those
			// DOM mutations represent document edits; props are committed explicitly
			// through setNodeMarkup above.
			ignoreMutation: () => true,
			destroy: () => {
				void unmount(component);
				dom.remove();
			}
		};
	};
}

export const componentEmbedView = $view(componentEmbedNode, (ctx) => {
	const registry = ctx.get(componentRegistryCtx.key);
	if (!registry) throw new Error('Milkdown component registry was not configured.');
	return createComponentEmbedNodeView(registry);
});
export const componentEmbedFeature = [
	...calloutSyntax,
	componentRegistryCtx,
	componentEmbedNode,
	insertComponentEmbedCommand,
	componentEmbedView
];

function readCallout(node: MarkdownAstNode): MarkdownAstNode | null {
	if (node.type !== 'blockquote') return null;
	const children = node.children ?? [];
	const firstParagraph = children[0];
	const firstText = firstParagraph?.type === 'paragraph' ? firstParagraph.children?.[0] : undefined;
	if (firstText?.type !== 'text' || typeof firstText.value !== 'string') return null;

	const match = firstText.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)]\s*/i);
	if (!match) return null;

	const body = structuredClone(children);
	const bodyParagraph = body[0];
	const bodyText = bodyParagraph?.children?.[0];
	if (bodyText) bodyText.value = String(bodyText.value ?? '').slice(match[0].length);
	if (bodyParagraph?.type === 'paragraph' && bodyParagraph.children) {
		while (
			bodyParagraph.children[0]?.type === 'break' ||
			(bodyParagraph.children[0]?.type === 'text' && !bodyParagraph.children[0].value)
		) {
			bodyParagraph.children.shift();
		}
	}
	const markdown = serializeAstChildren(body)
		.replace(/^\\\r?\n/, '')
		.trim();

	return {
		type: 'mdxJsxFlowElement',
		name: 'Callout',
		attributes: createComponentAttributes({
			kind: match[1].toLowerCase(),
			markdown
		}),
		children: []
	};
}

function addCalloutMarkdown(
	state: {
		addNode: (type: string, children?: MarkdownAstNode[], value?: string) => unknown;
	},
	value: unknown
) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const props = value as Record<string, unknown>;
	const kind = typeof props.kind === 'string' ? props.kind.toLowerCase() : '';
	if (!CALLOUT_KINDS.has(kind) || typeof props.markdown !== 'string') return false;

	const marker = `[!${kind.toUpperCase()}]`;
	const source = `${marker}\n${props.markdown}`
		.split('\n')
		.map((line) => `> ${line}`.trimEnd())
		.join('\n');
	// The serializer's HTML node is its raw-output primitive. This value is
	// controlled Markdown, not HTML, and round-trips as native callout syntax.
	state.addNode('html', undefined, source);
	return true;
}

function serializeAstChildren(children: MarkdownAstNode[]) {
	return toMarkdown({ type: 'root', children } as Root, {
		extensions: [gfmToMarkdown(), mdxJsxToMarkdown({ quote: '"' })]
	}).trim();
}

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
