import type { Editor, JSONContent } from '@tiptap/core';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ComponentEmbedRegistry } from '../components/registry';
import {
	metadataEntriesToRecord,
	normalizeMetadataProperties,
	type MetadataProperties
} from './metadata';
import {
	metadataPropertiesToNotePageFrontmatter,
	resolveNotePageMetadata,
	type NotePageFrontmatter,
	type NotePage
} from './model';
import { editorContentToMarkdown, markdownBodyToEditorContent } from './markdown-ast';

const MARKDOWN_FILE_RE = /\.(md|markdown|mdown|mkdn)$/i;
const MARKDOWN_MIME_TYPES = new Set(['text/markdown', 'text/x-markdown']);
const MARKDOWN_BLOCK_RE =
	/^[ \t]{0,3}(?:#{1,6}\s+\S|[-+*]\s+\S|\d+[.)]\s+\S|>\s+\S|`{3,}|~{3,}|-{3,}\s*$|\*{3,}\s*$|_{3,}\s*$|\|.+\||<[A-Z][A-Za-z0-9]*)/m;
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
	return editor ? editorContentToMarkdown(editor.getJSON()) : '';
}

// Frontmatter belongs to page state, so pasted metadata is returned to the
// caller while only the body is inserted into the visual editor.
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

	const content = markdownBodyToEditorContent(parsed.markdown).content ?? [];

	return {
		inserted: content.length > 0 && editor.chain().focus().insertContent(content).run(),
		frontmatter: parsed.frontmatter,
		properties: parsed.properties
	};
}

export function parseEditorMarkdown(markdown: string, embeds?: ComponentEmbedRegistry) {
	const parsed = parseMarkdownFrontmatter(markdown);
	const content = normalizeMarkdownDoc(markdownBodyToEditorContent(parsed.markdown));
	const issues = embeds?.validateDocument(content) ?? [];

	if (issues.length) {
		throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
	}

	return { ...parsed, content };
}

export function looksLikeMarkdown(value: string) {
	const parsed = parseMarkdownFrontmatter(value);
	const text = parsed.markdown.trim();

	if (parsed.hasFrontmatter) return true;
	if (!text) return false;

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
	anchor.download = `document-${new Date().toISOString().slice(0, 10)}.md`;
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
	return editorContentToMarkdown(content, options);
}

export function serializeNotePageMarkdown(
	page: NotePage,
	content: JSONContent = page.content,
	options: { assetPaths?: Map<string, string> } = {}
) {
	const frontmatter = {
		...metadataEntriesToRecord(page.properties),
		...getNotePageFrontmatter(page, content)
	};
	const yaml = serializeMetadataPropertiesYaml(frontmatter);
	const body = serializeNoteMarkdown(content, options);

	return yaml ? `---\n${yaml}\n---\n\n${body}` : body;
}

export function getNotePageFrontmatter(
	page: NotePage,
	content: JSONContent = page.content
): NoteMarkdownFrontmatter {
	const metadata = resolveNotePageMetadata(page, content);

	return {
		title: metadata.title,
		...(page.frontmatter?.slug ? { slug: metadata.slug } : {}),
		...(page.frontmatter?.description ? { description: page.frontmatter.description } : {}),
		tags: metadata.tags,
		date: dateOnly(metadata.createdAt),
		...(typeof page.frontmatter?.draft === 'boolean' ? { draft: page.frontmatter.draft } : {})
	};
}

// Only top-of-file frontmatter counts. Later `---` fences remain horizontal
// rules in the body.
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

export function serializeMetadataPropertiesYaml(properties: unknown) {
	const normalized = normalizeMetadataProperties(properties);
	if (!Object.keys(normalized).length) return '';

	const serializable = Object.fromEntries(
		Object.entries(normalized).map(([key, value]) => [
			key,
			Array.isArray(value) ? (value.length ? value : null) : value === '' ? null : value
		])
	);

	return stringifyYaml(serializable, { lineWidth: 0, nullStr: '' }).trimEnd();
}

export function normalizeMarkdownDoc(doc: JSONContent): JSONContent {
	return {
		...doc,
		content: (doc.content ?? []).map(normalizeMarkdownNode)
	};
}

function normalizeMarkdownNode(node: JSONContent): JSONContent {
	const content = node.content?.map(normalizeMarkdownNode);

	if (node.type === 'listItem' && content?.[0]?.type !== 'paragraph') {
		return { ...node, content: [{ type: 'paragraph' }, ...(content ?? [])] };
	}

	return { ...node, ...(content ? { content } : {}) };
}

function getFileKey(file: File) {
	return [file.name, file.type, file.size, file.lastModified].join(':');
}

function dateOnly(value: string) {
	const time = Date.parse(value);
	return Number.isFinite(time)
		? new Date(time).toISOString().slice(0, 10)
		: new Date().toISOString().slice(0, 10);
}
