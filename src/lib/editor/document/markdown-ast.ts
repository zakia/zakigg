import type { JSONContent } from '@tiptap/core';
import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown, gfmToMarkdown } from 'mdast-util-gfm';
import { mdxJsxFromMarkdown, mdxJsxToMarkdown } from 'mdast-util-mdx-jsx';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfm } from 'micromark-extension-gfm';
import { mdxJsx } from 'micromark-extension-mdx-jsx';
import { normalizeMediaBlockAttrs } from '$lib/editor/core/media-block/config';

type AstNode = {
	type: string;
	value?: string;
	depth?: number;
	ordered?: boolean;
	start?: number | null;
	lang?: string | null;
	meta?: string | null;
	url?: string;
	title?: string | null;
	alt?: string | null;
	name?: string | null;
	attributes?: AstAttribute[];
	children?: AstNode[];
};

type AstAttribute =
	| { type: 'mdxJsxAttribute'; name: string; value?: string | null | { value?: string } }
	| { type: 'mdxJsxExpressionAttribute'; value?: string };

type Mark = NonNullable<JSONContent['marks']>[number];

const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const EVENT_PROP_RE = /^on[A-Z]/;
const LEGACY_COMPONENT_DIRECTIVE_RE =
	/^[ \t]{0,3}::component\{component="((?:\\.|[^"\\])*)"\s+props="((?:\\.|[^"\\])*)"\}[ \t]*$/gm;

export class MarkdownSyntaxError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'MarkdownSyntaxError';
	}
}

export function parseMarkdownAst(markdown: string): Root {
	try {
		return fromMarkdown(upgradeLegacyComponentDirectives(markdown), {
			extensions: [gfm(), mdxJsx()],
			mdastExtensions: [gfmFromMarkdown(), mdxJsxFromMarkdown()]
		});
	} catch (cause) {
		throw new MarkdownSyntaxError(
			cause instanceof Error ? cause.message : 'The Markdown document could not be parsed.'
		);
	}
}

export function markdownBodyToEditorContent(markdown: string): JSONContent {
	const tree = parseMarkdownAst(markdown) as AstNode;
	const content = convertBlockChildren(tree.children ?? []);

	return {
		type: 'doc',
		content: content.length ? content : [{ type: 'paragraph' }]
	};
}

export function editorContentToMarkdown(
	content: JSONContent,
	options: { assetPaths?: Map<string, string> } = {}
) {
	const markdown = renderBlocks(content.type === 'doc' ? (content.content ?? []) : [content], {
		assetPaths: options.assetPaths ?? new Map()
	}).trim();

	return markdown ? `${markdown}\n` : '';
}

function convertBlockChildren(nodes: AstNode[]): JSONContent[] {
	return nodes.flatMap(convertBlock);
}

function convertBlock(node: AstNode): JSONContent[] {
	switch (node.type) {
		case 'paragraph': {
			if (node.children?.length === 1 && isMdxElement(node.children[0])) {
				return [convertComponent(node.children[0])];
			}

			return [{ type: 'paragraph', content: convertInlineChildren(node.children ?? []) }];
		}
		case 'heading':
			return [
				{
					type: 'heading',
					attrs: { level: clampHeadingLevel(node.depth) },
					content: convertInlineChildren(node.children ?? [])
				}
			];
		case 'blockquote':
			return [convertBlockquote(node)];
		case 'list':
			return [
				{
					type: node.ordered ? 'orderedList' : 'bulletList',
					...(node.ordered ? { attrs: { start: node.start ?? 1 } } : {}),
					content: (node.children ?? []).flatMap(convertBlock)
				}
			];
		case 'listItem': {
			const children = convertBlockChildren(node.children ?? []);
			return [
				{
					type: 'listItem',
					content:
						children[0]?.type === 'paragraph' ? children : [{ type: 'paragraph' }, ...children]
				}
			];
		}
		case 'code':
			return [
				{
					type: 'codeBlock',
					attrs: { language: node.lang ?? '', title: node.meta ?? '' },
					content: node.value ? [{ type: 'text', text: node.value }] : []
				}
			];
		case 'thematicBreak':
			return [{ type: 'horizontalRule' }];
		case 'image':
			return [convertImage(node)];
		case 'table':
			return [
				{
					type: 'table',
					content: (node.children ?? []).map((row, rowIndex) => ({
						type: 'tableRow',
						content: (row.children ?? []).map((cell) => ({
							type: rowIndex === 0 ? 'tableHeader' : 'tableCell',
							content: [{ type: 'paragraph', content: convertInlineChildren(cell.children ?? []) }]
						}))
					}))
				}
			];
		case 'mdxJsxFlowElement':
			return [convertComponent(node)];
		case 'html':
			throw new MarkdownSyntaxError('Raw HTML is not supported. Use an allowed component instead.');
		default:
			return convertBlockChildren(node.children ?? []);
	}
}

function convertInlineChildren(nodes: AstNode[], marks: Mark[] = []): JSONContent[] {
	return nodes.flatMap((node): JSONContent[] => {
		switch (node.type) {
			case 'text':
				return node.value
					? [{ type: 'text', text: node.value, ...(marks.length ? { marks } : {}) }]
					: [];
			case 'strong':
				return convertInlineChildren(node.children ?? [], [...marks, { type: 'bold' }]);
			case 'emphasis':
				return convertInlineChildren(node.children ?? [], [...marks, { type: 'italic' }]);
			case 'delete':
				return convertInlineChildren(node.children ?? [], [...marks, { type: 'strike' }]);
			case 'inlineCode':
				return node.value
					? [{ type: 'text', text: node.value, marks: [...marks, { type: 'code' }] }]
					: [];
			case 'link':
				return convertInlineChildren(node.children ?? [], [
					...marks,
					{ type: 'link', attrs: { href: node.url ?? '', title: node.title ?? null } }
				]);
			case 'break':
				return [{ type: 'hardBreak' }];
			case 'image':
				return [convertImage(node)];
			case 'mdxJsxTextElement':
				throw new MarkdownSyntaxError(
					`<${node.name ?? 'Component'}> must be placed on its own line in the visual editor.`
				);
			case 'html':
				throw new MarkdownSyntaxError(
					'Raw HTML is not supported. Use an allowed component instead.'
				);
			default:
				return convertInlineChildren(node.children ?? [], marks);
		}
	});
}

function convertImage(node: AstNode): JSONContent {
	return {
		type: 'mediaBlock',
		attrs: normalizeMediaBlockAttrs({
			kind: 'image',
			src: node.url ?? '',
			alt: node.alt ?? '',
			title: node.title ?? ''
		})
	};
}

function convertBlockquote(node: AstNode): JSONContent {
	const children = structuredClone(node.children ?? []) as AstNode[];
	const firstText = children[0]?.type === 'paragraph' ? children[0].children?.[0] : undefined;
	const match =
		firstText?.type === 'text'
			? firstText.value?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)]\s*/i)
			: null;

	if (!match) return { type: 'blockquote', content: convertBlockChildren(children) };

	firstText!.value = (firstText!.value ?? '').slice(match[0].length);
	if (!firstText!.value) children[0].children?.shift();
	if (!children[0].children?.length) children.shift();

	return {
		type: 'componentEmbed',
		attrs: {
			component: 'Callout',
			markdownName: 'Callout',
			props: {
				kind: match[1].toLowerCase(),
				markdown: serializeAstChildren(children as Root['children'])
			}
		}
	};
}

function convertComponent(node: AstNode): JSONContent {
	const name = node.name?.trim() ?? '';

	if (!COMPONENT_NAME_RE.test(name)) {
		throw new MarkdownSyntaxError(
			`Invalid component name “${name || '(missing)'}”. Component names must use PascalCase.`
		);
	}

	const props = parseComponentAttributes(name, node.attributes ?? []);
	if (name === 'Image' || name === 'Video') {
		return {
			type: 'mediaBlock',
			attrs: normalizeMediaBlockAttrs({ ...props, kind: name === 'Video' ? 'video' : 'image' })
		};
	}
	if (name === 'Column') {
		throw new MarkdownSyntaxError('<Column> can only be used directly inside <Columns>.');
	}
	if (name === 'Columns') {
		return convertColumns(node, props);
	}

	const childrenMarkdown = node.children?.length
		? serializeAstChildren(node.children as Root['children'])
		: '';

	return {
		type: 'componentEmbed',
		attrs: {
			component: name,
			markdownName: name,
			props,
			...(childrenMarkdown ? { childrenMarkdown } : {})
		}
	};
}

function convertColumns(node: AstNode, props: Record<string, unknown>): JSONContent {
	const columns = (node.children ?? []).map((child) => {
		if (!isMdxElement(child) || child.name !== 'Column') {
			throw new MarkdownSyntaxError('<Columns> may only contain <Column> children.');
		}

		const columnProps = parseComponentAttributes('Column', child.attributes ?? []);
		return {
			markdown: serializeAstChildren((child.children ?? []) as Root['children']),
			...(typeof columnProps.width === 'number' || typeof columnProps.width === 'string'
				? { width: columnProps.width }
				: {})
		};
	});

	if (columns.length < 2) {
		throw new MarkdownSyntaxError('<Columns> requires at least two <Column> children.');
	}

	return {
		type: 'componentEmbed',
		attrs: {
			component: 'Columns',
			markdownName: 'Columns',
			props: { ...props, columns }
		}
	};
}

function parseComponentAttributes(name: string, attributes: AstAttribute[]) {
	const props: Record<string, unknown> = {};

	for (const attribute of attributes) {
		if (attribute.type === 'mdxJsxExpressionAttribute') {
			throw new MarkdownSyntaxError(`Spread attributes are not allowed on <${name}>.`);
		}

		const propName = attribute.name;
		if (EVENT_PROP_RE.test(propName)) {
			throw new MarkdownSyntaxError(`Event handler prop “${propName}” is not allowed.`);
		}

		if (attribute.value == null) {
			props[propName] = true;
		} else if (typeof attribute.value === 'string') {
			props[propName] = attribute.value;
		} else {
			props[propName] = parseLiteralExpression(name, propName, attribute.value.value ?? '');
		}
	}

	return props;
}

function parseLiteralExpression(component: string, prop: string, value: string) {
	try {
		return JSON.parse(value) as unknown;
	} catch {
		throw new MarkdownSyntaxError(
			`Prop “${prop}” on <${component}> must be a JSON literal, not JavaScript.`
		);
	}
}

function serializeAstChildren(children: Root['children']) {
	return toMarkdown(
		{ type: 'root', children },
		{ extensions: [gfmToMarkdown(), mdxJsxToMarkdown({ quote: '"' })] }
	).trim();
}

function renderBlocks(nodes: JSONContent[], context: { assetPaths: Map<string, string> }) {
	return nodes
		.map((node) => renderBlock(node, context))
		.filter((block) => block.trim())
		.join('\n\n');
}

function renderBlock(node: JSONContent, context: { assetPaths: Map<string, string> }): string {
	switch (node.type) {
		case 'paragraph':
			return renderInlineChildren(node, context).trimEnd();
		case 'heading':
			return `${'#'.repeat(clampHeadingLevel(node.attrs?.level))} ${renderInlineChildren(node, context).trimEnd()}`;
		case 'blockquote':
			return prefixLines(renderBlocks(node.content ?? [], context), '> ');
		case 'bulletList':
			return renderList(node, context, false);
		case 'orderedList':
			return renderList(node, context, true);
		case 'listItem':
			return renderBlocks(node.content ?? [], context);
		case 'codeBlock':
			return renderCodeBlock(node);
		case 'mediaBlock':
			return renderMediaBlock(node, context.assetPaths);
		case 'componentEmbed':
			return renderComponent(node);
		case 'table':
			return renderTable(node, context);
		case 'horizontalRule':
			return '---';
		default:
			return renderInlineChildren(node, context) || renderBlocks(node.content ?? [], context);
	}
}

function renderInlineChildren(node: JSONContent, context: { assetPaths: Map<string, string> }) {
	return (node.content ?? []).map((child) => renderInline(child, context)).join('');
}

function renderInline(node: JSONContent, context: { assetPaths: Map<string, string> }): string {
	if (node.type === 'text') {
		const marks = node.marks ?? [];
		const hasCodeMark = marks.some((mark) => mark.type === 'code');
		return applyMarks(hasCodeMark ? (node.text ?? '') : escapeMarkdownText(node.text ?? ''), marks);
	}
	if (node.type === 'hardBreak') return '  \n';
	if (node.type === 'mediaBlock') return renderMediaBlock(node, context.assetPaths);
	return renderInlineChildren(node, context);
}

function applyMarks(text: string, marks: Mark[]) {
	return marks.reduce((value, mark) => {
		switch (mark.type) {
			case 'bold':
				return `**${value}**`;
			case 'italic':
				return `_${value}_`;
			case 'strike':
				return `~~${value}~~`;
			case 'code': {
				const fence = value.includes('`') ? '``' : '`';
				const pad = value.includes('`') ? ' ' : '';
				return `${fence}${pad}${value}${pad}${fence}`;
			}
			case 'link': {
				const href = String(mark.attrs?.href ?? '').trim();
				return href ? `[${value}](${href})` : value;
			}
			default:
				return value;
		}
	}, text);
}

function renderList(
	node: JSONContent,
	context: { assetPaths: Map<string, string> },
	ordered: boolean
) {
	const start = Number(node.attrs?.start ?? 1);
	return (node.content ?? [])
		.map((item, index) => {
			const marker = ordered ? `${start + index}. ` : '- ';
			const rendered = renderBlock(item, context);
			const [firstLine = '', ...rest] = rendered.split('\n');
			const padding = ' '.repeat(marker.length);
			return `${marker}${firstLine}${rest.length ? `\n${rest.map((line) => `${padding}${line}`).join('\n')}` : ''}`;
		})
		.join('\n');
}

function renderCodeBlock(node: JSONContent) {
	const language = String(node.attrs?.language ?? '').trim();
	const title = String(node.attrs?.title ?? '').trim();
	const meta = [language, title].filter(Boolean).join(' ');
	const code = getTextContent(node);
	const fence = code.includes('```') ? '````' : '```';
	return `${fence}${meta}\n${code}\n${fence}`;
}

function renderMediaBlock(node: JSONContent, assetPaths: Map<string, string>) {
	const attrs = normalizeMediaBlockAttrs(node.attrs);
	const src =
		attrs.assetId && assetPaths.has(attrs.assetId)
			? (assetPaths.get(attrs.assetId) ?? '')
			: attrs.src;
	if (!src) return '';

	if (attrs.kind === 'image' && !attrs.caption && attrs.width === 100 && attrs.align === 'center') {
		const title = attrs.title ? ` "${escapeMarkdownTitle(attrs.title)}"` : '';
		return `![${escapeMarkdownLabel(attrs.alt)}](${src}${title})`;
	}

	return renderJsxComponent(attrs.kind === 'video' ? 'Video' : 'Image', {
		...attrs,
		src,
		assetId: attrs.assetId || undefined
	});
}

function renderComponent(node: JSONContent) {
	const attrs = node.attrs ?? {};
	const name = String(attrs.markdownName ?? componentNameFromId(attrs.component)).trim();
	if (!COMPONENT_NAME_RE.test(name)) return '';
	const props =
		attrs.props && typeof attrs.props === 'object' && !Array.isArray(attrs.props)
			? (attrs.props as Record<string, unknown>)
			: {};
	if (name === 'Columns') return renderColumns(props);
	if (name === 'Callout') return renderCallout(props);
	const children = typeof attrs.childrenMarkdown === 'string' ? attrs.childrenMarkdown.trim() : '';
	return renderJsxComponent(name, props, children);
}

function renderCallout(props: Record<string, unknown>) {
	const allowedKinds = new Set(['note', 'tip', 'important', 'warning', 'caution']);
	const requestedKind = String(props.kind ?? 'note').toLowerCase();
	const kind = allowedKinds.has(requestedKind) ? requestedKind : 'note';
	const markdown = String(props.markdown ?? '').trim();
	return prefixLines(`[!${kind.toUpperCase()}]${markdown ? `\n${markdown}` : ''}`, '> ');
}

function renderColumns(props: Record<string, unknown>) {
	const columns = Array.isArray(props.columns) ? props.columns : [];
	const containerProps = { ...props };
	delete containerProps.columns;
	const openingAttributes = Object.entries(containerProps)
		.filter(([, value]) => value !== undefined)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => renderJsxAttribute(key, value))
		.join('');
	const children = columns
		.map((column) => {
			const value =
				column && typeof column === 'object' && !Array.isArray(column)
					? (column as Record<string, unknown>)
					: { markdown: String(column ?? '') };
			const width = value.width === undefined ? '' : renderJsxAttribute('width', value.width);
			return `<Column${width}>\n${String(value.markdown ?? '').trim()}\n</Column>`;
		})
		.join('\n');

	return `<Columns${openingAttributes}>\n${children}\n</Columns>`;
}

function renderJsxComponent(name: string, props: Record<string, unknown>, children = '') {
	const attributes = Object.entries(props)
		.filter(([, value]) => value !== undefined)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => renderJsxAttribute(key, value))
		.join('');
	return children ? `<${name}${attributes}>\n${children}\n</${name}>` : `<${name}${attributes} />`;
}

function renderJsxAttribute(name: string, value: unknown) {
	if (value === true) return ` ${name}`;
	if (typeof value === 'string') return ` ${name}="${escapeJsxString(value)}"`;
	return ` ${name}={${JSON.stringify(value)}}`;
}

function renderTable(node: JSONContent, context: { assetPaths: Map<string, string> }) {
	const rows = node.content ?? [];
	if (!rows.length) return '';
	const cells = rows.map((row) =>
		(row.content ?? []).map((cell) =>
			renderInlineChildren(cell.content?.[0] ?? cell, context).replace(/\|/g, '\\|')
		)
	);
	const width = Math.max(...cells.map((row) => row.length));
	const normalized = cells.map((row) => [
		...row,
		...Array(Math.max(0, width - row.length)).fill('')
	]);
	const [head = [], ...body] = normalized;
	const renderRow = (row: string[]) => `| ${row.join(' | ')} |`;
	return [renderRow(head), renderRow(Array(width).fill('---')), ...body.map(renderRow)].join('\n');
}

function upgradeLegacyComponentDirectives(markdown: string) {
	return markdown.replace(LEGACY_COMPONENT_DIRECTIVE_RE, (_match, encodedId, encodedProps) => {
		const id = unescapeLegacyAttribute(encodedId);
		const name = componentNameFromId(id);
		try {
			const props = JSON.parse(unescapeLegacyAttribute(encodedProps)) as Record<string, unknown>;
			return renderJsxComponent(name, props);
		} catch {
			return _match;
		}
	});
}

function componentNameFromId(value: unknown) {
	const parts = String(value ?? '')
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean);
	const lastIsPascal = parts.at(-1)?.match(/^[A-Z][A-Za-z0-9]*$/)?.[0];
	if (String(value).startsWith('core.') && lastIsPascal) return lastIsPascal;
	return (
		parts.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join('') || 'Component'
	);
}

function isMdxElement(node: AstNode | undefined) {
	return node?.type === 'mdxJsxTextElement' || node?.type === 'mdxJsxFlowElement';
}

function clampHeadingLevel(value: unknown) {
	const level = Number(value);
	return Number.isFinite(level) ? Math.min(Math.max(Math.round(level), 1), 6) : 2;
}

function getTextContent(node: JSONContent): string {
	if (node.text) return node.text;
	return (node.content ?? []).map(getTextContent).join('');
}

function prefixLines(value: string, prefix: string) {
	return value
		.split('\n')
		.map((line) => (line ? `${prefix}${line}` : prefix.trimEnd()))
		.join('\n');
}

function escapeMarkdownText(value: string) {
	return value.replace(/([\\*_~[\]])/g, '\\$1');
}

function escapeMarkdownLabel(value: string) {
	return value.replace(/([\\[\]])/g, '\\$1');
}

function escapeMarkdownTitle(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeJsxString(value: string) {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function unescapeLegacyAttribute(value: string) {
	return value.replace(/\\([\\"])/g, '$1');
}
