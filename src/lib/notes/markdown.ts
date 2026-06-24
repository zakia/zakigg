import type { Editor, JSONContent } from '@tiptap/core';
import { normalizeMediaBlockAttrs } from '$lib/editor/media-block/config';

type MarkdownEditor = Editor & {
	getMarkdown: () => string;
	markdown?: {
		parse: (markdown: string) => JSONContent;
	};
};

const MARKDOWN_FILE_RE = /\.(md|markdown|mdown|mkdn)$/i;
const MARKDOWN_MIME_TYPES = new Set(['text/markdown', 'text/x-markdown']);
const MARKDOWN_BLOCK_RE =
	/^[ \t]{0,3}(?:#{1,6}\s+\S|[-+*]\s+\S|\d+[.)]\s+\S|>\s+\S|`{3,}|~{3,}|-{3,}\s*$|\*{3,}\s*$|_{3,}\s*$|\|.+\||::component\{)/m;
const MARKDOWN_INLINE_RE = /(?:!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/;

export function getEditorMarkdown(editor?: Editor) {
	return editor ? (editor as MarkdownEditor).getMarkdown() : '';
}

export function insertEditorMarkdown(editor: Editor | undefined, markdown: string) {
	if (!editor || !markdown.trim()) return false;

	const content = (editor as MarkdownEditor).markdown?.parse(markdown)?.content;

	if (!content?.length) return false;

	return editor.chain().focus().insertContent(normalizeMarkdownContent(content)).run();
}

export function looksLikeMarkdown(value: string) {
	const text = value.trim();

	if (!text) return false;
	if (text.includes('::component{')) return true;

	return MARKDOWN_BLOCK_RE.test(text) || MARKDOWN_INLINE_RE.test(text);
}

export function getMarkdownFiles(data: DataTransfer | null | undefined) {
	if (!data) return [];

	const files = new Map<string, File>();

	for (const file of Array.from(data.files ?? [])) {
		if (isMarkdownFile(file)) files.set(getFileKey(file), file);
	}

	for (const item of Array.from(data.items ?? [])) {
		if (item.kind !== 'file') continue;

		const file = item.getAsFile();
		if (file && isMarkdownFile(file)) files.set(getFileKey(file), file);
	}

	return [...files.values()];
}

export function isMarkdownFile(file: File) {
	return MARKDOWN_MIME_TYPES.has(file.type.toLowerCase()) || MARKDOWN_FILE_RE.test(file.name);
}

export function downloadMarkdownFile(markdown: string) {
	const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');

	anchor.href = url;
	anchor.download = `notes-${new Date().toISOString().slice(0, 10)}.md`;
	document.body.append(anchor);
	anchor.click();
	window.setTimeout(() => {
		anchor.remove();
		URL.revokeObjectURL(url);
	}, 1000);
}

export function serializeNoteMarkdown(
	content: JSONContent,
	options: { assetPaths?: Map<string, string> } = {}
) {
	const markdown = renderBlock(content, {
		depth: 0,
		index: 0,
		assetPaths: options.assetPaths ?? new Map()
	}).trim();

	return markdown ? `${markdown}\n` : '';
}

function getFileKey(file: File) {
	return [file.name, file.type, file.size, file.lastModified].join(':');
}

function normalizeMarkdownContent(content: JSONContent[]) {
	return content.map(normalizeMarkdownNode);
}

function normalizeMarkdownNode(node: JSONContent): JSONContent {
	const content = node.content?.map(normalizeMarkdownNode);

	if (node.type === 'listItem' && content?.[0]?.type !== 'paragraph') {
		return {
			...node,
			content: [{ type: 'paragraph' }, ...(content ?? [])]
		};
	}

	return {
		...node,
		...(content ? { content } : {})
	};
}

type RenderContext = {
	depth: number;
	index: number;
	assetPaths: Map<string, string>;
};

type Mark = NonNullable<JSONContent['marks']>[number];

function renderBlock(node: JSONContent, context: RenderContext): string {
	switch (node.type) {
		case 'doc':
			return renderBlocks(node.content ?? [], context);
		case 'paragraph':
			return renderInlineChildren(node, context);
		case 'heading':
			return `${'#'.repeat(clampHeadingLevel(node.attrs?.level))} ${renderInlineChildren(node, context)}`;
		case 'blockquote':
			return prefixLines(renderBlocks(node.content ?? [], context), '> ');
		case 'bulletList':
			return renderList(node, context, 'bullet');
		case 'orderedList':
			return renderList(node, context, 'ordered');
		case 'listItem':
			return renderBlocks(node.content ?? [], context);
		case 'codeBlock':
			return renderCodeBlock(node);
		case 'mediaBlock':
			return renderMediaBlock(node, context);
		case 'componentEmbed':
			return renderComponentEmbed(node);
		case 'table':
			return renderTable(node, context);
		case 'horizontalRule':
			return '---';
		default:
			return renderInlineChildren(node, context) || renderBlocks(node.content ?? [], context);
	}
}

function renderBlocks(nodes: JSONContent[], context: RenderContext) {
	return nodes
		.map((node, index) => renderBlock(node, { ...context, index }))
		.filter((block) => block.trim())
		.join('\n\n');
}

function renderInlineChildren(node: JSONContent, context: RenderContext) {
	return (node.content ?? []).map((child) => renderInline(child, context)).join('');
}

function renderInline(node: JSONContent, context: RenderContext): string {
	if (node.type === 'text') {
		return applyMarks(escapeMarkdownText(node.text ?? ''), node.marks ?? []);
	}

	if (node.type === 'hardBreak') return '  \n';
	if (node.type === 'mediaBlock') return renderMediaBlock(node, context);

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
			case 'code':
				return `\`${value.replace(/`/g, '\\`')}\``;
			case 'link': {
				const href = String(mark.attrs?.href ?? '').trim();

				return href ? `[${value}](${href})` : value;
			}
			default:
				return value;
		}
	}, text);
}

function renderList(node: JSONContent, context: RenderContext, kind: 'bullet' | 'ordered') {
	return (node.content ?? [])
		.map((item, index) => {
			const marker = kind === 'ordered' ? `${index + 1}. ` : '- ';
			const rendered = renderBlock(item, { ...context, depth: context.depth + 1, index });
			const [firstLine = '', ...rest] = rendered.split('\n');
			const padding = ' '.repeat(marker.length);

			return `${marker}${firstLine}${rest.length ? `\n${rest.map((line) => `${padding}${line}`).join('\n')}` : ''}`;
		})
		.join('\n');
}

function renderCodeBlock(node: JSONContent) {
	const language = String(node.attrs?.language ?? '').trim();
	const code = getTextContent(node);
	const fence = code.includes('```') ? '````' : '```';

	return `${fence}${language}\n${code}\n${fence}`;
}

function renderMediaBlock(node: JSONContent, context: RenderContext) {
	const attrs = normalizeMediaBlockAttrs(node.attrs);
	const src = getExportMediaSrc(attrs.assetId, attrs.src, context.assetPaths);

	if (!src) return '';

	if (attrs.kind === 'image' && !attrs.caption && attrs.width === 100 && attrs.align === 'center') {
		const title = attrs.title ? ` "${escapeMarkdownTitle(attrs.title)}"` : '';

		return `![${escapeMarkdownLabel(attrs.alt)}](${src}${title})`;
	}

	const media =
		attrs.kind === 'video'
			? `<video ${renderHtmlAttributes({
					src,
					title: attrs.title,
					controls: attrs.controls,
					autoplay: attrs.autoplay,
					loop: attrs.loop,
					muted: attrs.muted,
					playsinline: true
				})}></video>`
			: `<img ${renderHtmlAttributes({
					src,
					alt: attrs.alt,
					title: attrs.title,
					loading: 'lazy',
					decoding: 'async'
				})}>`;
	const caption = attrs.caption
		? `\n<figcaption class="media-block-caption">${escapeHtml(attrs.caption)}</figcaption>`
		: '';

	return `<figure data-media-block data-media-kind="${attrs.kind}">\n${media}${caption}\n</figure>`;
}

function renderComponentEmbed(node: JSONContent) {
	const component = String(node.attrs?.component ?? '').trim();
	const props = JSON.stringify(
		node.attrs?.props && typeof node.attrs.props === 'object' && !Array.isArray(node.attrs.props)
			? node.attrs.props
			: {}
	);

	if (!component) return '';

	return `::component{component="${escapeMarkdownAttribute(component)}" props="${escapeMarkdownAttribute(props)}"}`;
}

function renderTable(node: JSONContent, context: RenderContext) {
	const rows = node.content ?? [];
	if (!rows.length) return '';

	const cells = rows.map((row) =>
		(row.content ?? []).map((cell) => renderInlineChildren(cell, context).replace(/\|/g, '\\|'))
	);
	const width = Math.max(...cells.map((row) => row.length));
	const normalized = cells.map((row) => [
		...row,
		...Array.from({ length: Math.max(0, width - row.length) }, () => '')
	]);
	const [head = [], ...body] = normalized;
	const divider = Array.from({ length: width }, () => '---');
	const renderRow = (row: string[]) => `| ${row.join(' | ')} |`;

	return [renderRow(head), renderRow(divider), ...body.map(renderRow)].join('\n');
}

function getExportMediaSrc(assetId: string, src: string, assetPaths: Map<string, string>) {
	if (assetId && assetPaths.has(assetId)) return assetPaths.get(assetId) ?? '';

	return src;
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

function clampHeadingLevel(value: unknown) {
	const level = Number(value);

	return Number.isFinite(level) ? Math.min(Math.max(Math.round(level), 1), 6) : 2;
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

function escapeMarkdownAttribute(value: string) {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function renderHtmlAttributes(attrs: Record<string, string | boolean>) {
	return Object.entries(attrs)
		.flatMap(([key, value]) => {
			if (value === false || value === '') return [];
			if (value === true) return [key];

			return [`${key}="${escapeHtml(value)}"`];
		})
		.join(' ');
}

function escapeHtml(value: unknown) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
