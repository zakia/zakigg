import { mergeAttributes, Node, type Editor } from '@tiptap/core';
import type { ComponentEmbedRegistry } from './registry';
import { createComponentEmbedNodeView } from './view';

type ComponentEmbedCommandAttrs = {
	component: string;
	props?: Record<string, unknown>;
};

type ComponentEmbedOptions = {
	registry?: ComponentEmbedRegistry;
};

declare module '@tiptap/core' {
	interface Commands<ReturnType> {
		componentEmbed: {
			insertComponentEmbed: (attrs: ComponentEmbedCommandAttrs) => ReturnType;
		};
	}
}

export const ComponentEmbed = Node.create<ComponentEmbedOptions>({
	name: 'componentEmbed',
	group: 'block',
	atom: true,
	selectable: true,
	draggable: true,

	addOptions() {
		return {
			registry: undefined
		};
	},

	addAttributes() {
		return {
			component: {
				default: ''
			},
			markdownName: {
				default: ''
			},
			props: {
				default: {}
			},
			childrenMarkdown: {
				default: ''
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-component-embed]',
				getAttrs: (element) => {
					if (!(element instanceof HTMLElement)) return false;

					return {
						component: element.dataset.componentEmbed ?? '',
						props: parseJsonAttribute(element.dataset.componentProps)
					};
				}
			}
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		const component = String(node.attrs.component ?? '');
		const props = serializeProps(node.attrs.props);

		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-component-embed': component,
				'data-component-props': props
			}),
			['span', { 'data-component-embed-label': '' }, component || 'Component']
		];
	},

	addCommands() {
		return {
			insertComponentEmbed:
				(attrs) =>
				({ commands }) =>
					commands.insertContent({
						type: this.name,
						attrs: {
							component: attrs.component,
							props: attrs.props ?? {}
						}
					})
		};
	},

	addNodeView() {
		if (!this.options.registry) return null;

		return createComponentEmbedNodeView(this.editor, this.options.registry);
	}
});

export function insertRegisteredComponentEmbed(
	editor: Editor,
	registry: ComponentEmbedRegistry,
	componentId: string,
	inputProps?: unknown
) {
	const result = registry.createNode(componentId, inputProps);

	if (!result.ok) return result;

	editor.chain().focus().insertContent(result.node).run();

	return {
		ok: true as const,
		props: result.props
	};
}

function parseJsonAttribute(value: string | undefined) {
	if (!value) return {};

	try {
		const parsed: unknown = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function serializeProps(value: unknown) {
	return JSON.stringify(value && typeof value === 'object' && !Array.isArray(value) ? value : {});
}
