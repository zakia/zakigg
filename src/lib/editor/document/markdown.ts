import type { ComponentEmbedRegistry } from '../components/registry';
import type { Document } from '../Document';
import { validateMarkdown } from './validation';
import { readFrontmatter } from './frontmatter';

const MARKDOWN_FILE_RE = /\.(md|markdown|mdown|mkdn)$/i;
const MARKDOWN_MIME_TYPES = new Set(['text/markdown', 'text/x-markdown']);
const MARKDOWN_BLOCK_RE =
	/^[ \t]{0,3}(?:#{1,6}\s+\S|[-+*]\s+\S|\d+[.)]\s+\S|>\s+\S|`{3,}|~{3,}|-{3,}\s*$|\*{3,}\s*$|_{3,}\s*$|\|.+\||<[A-Z][A-Za-z0-9]*)/m;
const MARKDOWN_INLINE_RE = /(?:!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/;

export type NoteMarkdownFrontmatter = Record<string, unknown>;

export type ParsedMarkdown = {
	markdown: string;
	frontmatter?: NoteMarkdownFrontmatter;
	properties?: Record<string, unknown>;
	hasFrontmatter: boolean;
};

export function parseEditorMarkdown(markdown: string, embeds?: ComponentEmbedRegistry) {
	const parsed = parseMarkdownFrontmatter(markdown);
	const error = validateMarkdown(markdown, embeds)[0];
	if (error) throw new Error(error.message);
	return parsed;
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

export function serializePageMarkdown(
	page: Pick<Document, 'markdown'>,
	options: { assetPaths?: Map<string, string> } = {}
) {
	return rewriteAssetSources(page.markdown, options.assetPaths ?? new Map());
}

// Only top-of-file frontmatter counts. Later `---` fences remain horizontal
// rules in the body.
export function parseMarkdownFrontmatter(markdown: string): ParsedMarkdown {
	const parsed = readFrontmatter(markdown);
	if (!parsed.range) return { markdown, hasFrontmatter: false };
	const properties = parsed.values ?? undefined;

	return {
		markdown: markdown.slice(parsed.range.bodyFrom),
		frontmatter: properties,
		properties,
		hasFrontmatter: true
	};
}

function rewriteAssetSources(markdown: string, paths: Map<string, string>) {
	if (!paths.size) return markdown;
	let next = markdown.replace(/local-asset:\/\/([^\s"')}>]+)/g, (source, encodedId) => {
		let id = encodedId;
		try {
			id = decodeURIComponent(encodedId);
		} catch {
			/* use source value */
		}
		return paths.get(id) ?? source;
	});
	next = next.replace(/\/media\/(asset_[A-Za-z0-9_-]+)(?:\.[a-z0-9]{1,8})?/gi, (source, id) => {
		return paths.get(id) ?? source;
	});
	return next;
}

function getFileKey(file: File) {
	return [file.name, file.type, file.size, file.lastModified].join(':');
}
