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
			props: {
				default: {}
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

	markdownTokenName: 'componentEmbed',

	parseMarkdown: (token, helpers) => {
		const attrs = normalizeComponentDirectiveAttrs(token.attributes);

		if (!attrs.component) return [];

		return helpers.createNode('componentEmbed', attrs);
	},

	markdownTokenizer: {
		name: 'componentEmbed',
		level: 'block',
		start(src: string) {
			const match = /(?:^|\n)[ \t]{0,3}::component\{/.exec(src);

			if (!match) return -1;

			return match.index + (match[0].startsWith('\n') ? 1 : 0);
		},
		tokenize(src) {
			return tokenizeComponentDirective(src);
		}
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

function escapeMarkdownAttribute(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function tokenizeComponentDirective(src: string) {
	const leadingWhitespace = src.match(/^[ \t]{0,3}/)?.[0] ?? '';
	const directiveStart = leadingWhitespace.length;
	const opening = '::component{';

	if (!src.startsWith(opening, directiveStart)) return undefined;

	const attrsStart = directiveStart + opening.length;
	const attrsEnd = findComponentDirectiveEnd(src, attrsStart);

	if (attrsEnd < 0) return undefined;

	let rawEnd = attrsEnd + 1;

	while (src[rawEnd] === ' ' || src[rawEnd] === '\t') rawEnd += 1;

	if (src.slice(rawEnd, rawEnd + 2) === '\r\n') {
		rawEnd += 2;
	} else if (src[rawEnd] === '\n') {
		rawEnd += 1;
	}

	return {
		type: 'componentEmbed',
		raw: src.slice(0, rawEnd),
		attributes: parseComponentDirectiveAttributes(src.slice(attrsStart, attrsEnd))
	};
}

function findComponentDirectiveEnd(src: string, start: number) {
	let escaped = false;
	let quoted = false;

	for (let index = start; index < src.length; index += 1) {
		const char = src[index];

		if (escaped) {
			escaped = false;
			continue;
		}

		if (char === '\\') {
			escaped = true;
			continue;
		}

		if (char === '"') {
			quoted = !quoted;
			continue;
		}

		if (!quoted && char === '}') return index;
		if (!quoted && (char === '\n' || char === '\r')) return -1;
	}

	return -1;
}

function parseComponentDirectiveAttributes(value: string) {
	const attrs: Record<string, string> = {};
	let index = 0;

	while (index < value.length) {
		index = skipWhitespace(value, index);

		const nameMatch = /^[A-Za-z0-9_-]+/.exec(value.slice(index));

		if (!nameMatch) break;

		const name = nameMatch[0];
		index += name.length;
		index = skipWhitespace(value, index);

		if (value[index] !== '=') break;

		index += 1;
		index = skipWhitespace(value, index);

		const parsed = readComponentDirectiveAttributeValue(value, index);

		if (!parsed) break;

		attrs[name] = parsed.value;
		index = parsed.end;
	}

	return normalizeComponentDirectiveAttrs(attrs);
}

function normalizeComponentDirectiveAttrs(value: unknown) {
	const attrs = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	const component = typeof attrs.component === 'string' ? attrs.component.trim() : '';
	const props = typeof attrs.props === 'string' ? parseJsonAttribute(attrs.props) : attrs.props;

	return {
		component,
		props: props && typeof props === 'object' && !Array.isArray(props) ? props : {}
	};
}

function readComponentDirectiveAttributeValue(value: string, start: number) {
	if (value[start] !== '"') return null;

	let index = start + 1;
	let result = '';
	let escaped = false;

	for (; index < value.length; index += 1) {
		const char = value[index];

		if (escaped) {
			result += char;
			escaped = false;
			continue;
		}

		if (char === '\\') {
			escaped = true;
			continue;
		}

		if (char === '"') {
			return {
				value: result,
				end: index + 1
			};
		}

		result += char;
	}

	return null;
}

function skipWhitespace(value: string, index: number) {
	while (value[index] === ' ' || value[index] === '\t') index += 1;

	return index;
}
