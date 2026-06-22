import { mergeAttributes, Node, type Editor } from '@tiptap/core';
import type { ComponentEmbedRegistry } from './registry';
import { createComponentEmbedNodeView } from './view';

type ComponentEmbedCommandAttrs = {
	component: string;
	props?: Record<string, unknown>;
	editing?: boolean;
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
			props: {
				default: {}
			},
			editing: {
				default: false,
				rendered: false
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

	renderMarkdown: (node) => {
		const component = String(node.attrs?.component ?? '');
		const props = serializeProps(node.attrs?.props);

		return `::component{component="${escapeMarkdownAttribute(component)}" props="${escapeMarkdownAttribute(props)}"}`;
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
							props: attrs.props ?? {},
							editing: attrs.editing ?? false
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

	const entry = registry.get(componentId);
	const hasFields = Boolean(entry && Object.keys(entry.fields ?? {}).length);

	editor
		.chain()
		.focus()
		.insertContent({
			...result.node,
			attrs: {
				...result.node.attrs,
				editing: hasFields
			}
		})
		.run();

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

function escapeMarkdownAttribute(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
