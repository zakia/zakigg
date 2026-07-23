import type { Editor, JSONContent } from '@tiptap/core';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { normalizeMediaBlockAttrs } from '$lib/editor/media-block/config';
import {
	METADATA_BLOCK_NODE_NAME,
	ensureLeadingMetadataBlock,
	normalizeMetadataProperties,
	type MetadataProperties
} from './metadata-block';
import {
	metadataPropertiesToNotePageFrontmatter,
	resolveNotePageMetadata,
	type NotePageFrontmatter,
	type NotePageV1
} from './types';

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
const FRONTMATTER_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export type NoteMarkdownFrontmatter = NotePageFrontmatter;

export type ParsedMarkdown = {
	markdown: string;
	frontmatter?: NoteMarkdownFrontmatter;
	properties?: MetadataProperties;
	hasFrontmatter: boolean;
};

export type InsertEditorMarkdownResult = {
	inserted: boolean;
	frontmatter?: NoteMarkdownFrontmatter;
	properties?: MetadataProperties;
};

export type ParsedFrontmatterSource = {
	frontmatter?: NoteMarkdownFrontmatter;
	properties?: MetadataProperties;
	error?: string;
};

export function getEditorMarkdown(editor?: Editor) {
	return editor ? (editor as MarkdownEditor).getMarkdown() : '';
}

// Frontmatter is never inserted as content — the document's leading metadata
// block is the single home for it, so the caller merges the returned
// `properties` into that block.
export function insertEditorMarkdown(
	editor: Editor | undefined,
	markdown: string
): InsertEditorMarkdownResult {
	if (!editor || !markdown.trim()) return { inserted: false };

	const parsed = parseMarkdownFrontmatter(markdown);

	if (!parsed.markdown.trim()) {
		return {
			inserted: parsed.hasFrontmatter,
			frontmatter: parsed.frontmatter,
			properties: parsed.properties
		};
	}

	const parsedContent = (editor as MarkdownEditor).markdown?.parse(parsed.markdown)?.content;

	if (!parsedContent?.length) {
		return {
			inserted: false,
			frontmatter: parsed.frontmatter,
			properties: parsed.properties
		};
	}

	return {
		inserted: editor.chain().focus().insertContent(normalizeMarkdownContent(parsedContent)).run(),
		frontmatter: parsed.frontmatter,
		properties: parsed.properties
	};
}

export function looksLikeMarkdown(value: string) {
	const parsed = parseMarkdownFrontmatter(value);
	const text = parsed.markdown.trim();

	if (parsed.hasFrontmatter) return true;
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

// The metadata block leads the document, so serializing in place yields
// standard top-of-file YAML frontmatter. Legacy content without a block gets
// one seeded from the page's resolved metadata first.
export function serializeNotePageMarkdown(
	page: NotePageV1,
	content: JSONContent = page.content,
	options: { assetPaths?: Map<string, string> } = {}
) {
	return serializeNoteMarkdown(
		ensureLeadingMetadataBlock(content, getNotePageFrontmatter(page, content)),
		options
	);
}

export function getNotePageFrontmatter(
	page: NotePageV1,
	content: JSONContent = page.content
): NoteMarkdownFrontmatter {
	const metadata = resolveNotePageMetadata(page, content);

	return {
		...(page.frontmatter?.title ? { title: metadata.title } : {}),
		...(page.frontmatter?.slug ? { slug: metadata.slug } : {}),
		...(page.frontmatter?.description ? { description: page.frontmatter.description } : {}),
		tags: metadata.tags,
		date: dateOnly(metadata.createdAt),
		...(typeof page.frontmatter?.draft === 'boolean' ? { draft: page.frontmatter.draft } : {})
	};
}

// Only top-of-file frontmatter counts — `---` fences after any content are
// ordinary horizontal rules, never YAML.
export function parseMarkdownFrontmatter(markdown: string): ParsedMarkdown {
	const topMatch = markdown.match(FRONTMATTER_RE);

	if (!topMatch) return { markdown, hasFrontmatter: false };

	const parsed = parseNoteFrontmatterYaml(topMatch[1] ?? '');

	return {
		markdown: markdown.slice(topMatch[0].length),
		frontmatter: parsed.frontmatter,
		properties: parsed.properties,
		hasFrontmatter: true
	};
}

function getFileKey(file: File) {
	return [file.name, file.type, file.size, file.lastModified].join(':');
}

export function parseNoteFrontmatterYaml(source: string): ParsedFrontmatterSource {
	try {
		const parsed = parseYaml(source);
		if (!parsed) return {};
		if (typeof parsed !== 'object' || Array.isArray(parsed)) {
			return { error: 'Frontmatter must be a YAML object.' };
		}

		const properties = normalizeMetadataProperties(parsed);
		const frontmatter = metadataPropertiesToNotePageFrontmatter(properties);

		return {
			frontmatter,
			properties: Object.keys(properties).length ? properties : undefined
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : 'Invalid YAML frontmatter.'
		};
	}
}

export function serializeMetadataPropertiesYaml(properties: MetadataProperties) {
	const normalized = normalizeMetadataProperties(properties);
	if (!Object.keys(normalized).length) return '';

	const serializable = Object.fromEntries(
		Object.entries(normalized).map(([key, value]) => [
			key,
			Array.isArray(value) ? (value.length ? value : null) : value === '' ? null : value
		])
	);

	return stringifyYaml(serializable, {
		lineWidth: 0,
		nullStr: ''
	}).trimEnd();
}

function dateOnly(value: string) {
	const time = Date.parse(value);

	return Number.isFinite(time)
		? new Date(time).toISOString().slice(0, 10)
		: new Date().toISOString().slice(0, 10);
}

// Fixes up parser output for the editor schema: list items must lead with a
// paragraph, and any metadata block is dropped — the schema's required
// leading block makes the parser synthesize one, which is a schema-fill
// artifact, never content. Shared by paste and the craft importer, which
// manage metadata separately from parsed markdown.
export function normalizeMarkdownDoc(doc: JSONContent): JSONContent {
	return {
		...doc,
		content: normalizeMarkdownContent(doc.content ?? [])
	};
}

// Strip metadata blocks at EVERY depth, not just the top level: parsing an
// inline HTML fragment (e.g. <kbd>) runs generateJSON, whose full-document
// parse synthesizes the required leading metadata block and splices it into the
// surrounding content — so the artifacts surface nested inside list items too.
function normalizeMarkdownContent(content: JSONContent[]) {
	return content
		.filter((node) => node.type !== METADATA_BLOCK_NODE_NAME)
		.map(normalizeMarkdownNode);
}

function normalizeMarkdownNode(node: JSONContent): JSONContent {
	const content = node.content ? normalizeMarkdownContent(node.content) : undefined;

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
		case METADATA_BLOCK_NODE_NAME:
			return renderMetadataBlock(node);
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
		const marks = node.marks ?? [];
		// Backslash escapes are literal inside code spans, so code-marked text
		// must not get markdown-escaped.
		const hasCodeMark = marks.some((mark) => mark.type === 'code');
		const text = node.text ?? '';

		return applyMarks(hasCodeMark ? text : escapeMarkdownText(text), marks);
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
			case 'code': {
				// Backticks inside a code span need a longer fence, not escaping.
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

function renderMetadataBlock(node: JSONContent) {
	const properties = normalizeMetadataProperties(node.attrs?.properties);
	const yaml = serializeMetadataPropertiesYaml(properties);

	return yaml ? `---\n${yaml}\n---` : '---\n---';
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
