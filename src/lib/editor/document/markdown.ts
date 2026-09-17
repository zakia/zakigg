import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ComponentEmbedRegistry } from '../components/registry';
import { normalizeMetadataProperties, type MetadataProperties } from './metadata';
import {
	metadataPropertiesToNotePageFrontmatter,
	type NotePageFrontmatter,
	type NotePage
} from './model';
import { parseMarkdownAst } from './markdown-ast';

const MARKDOWN_FILE_RE = /\.(md|markdown|mdown|mkdn)$/i;
const MARKDOWN_MIME_TYPES = new Set(['text/markdown', 'text/x-markdown']);
const MARKDOWN_BLOCK_RE =
	/^[ \t]{0,3}(?:#{1,6}\s+\S|[-+*]\s+\S|\d+[.)]\s+\S|>\s+\S|`{3,}|~{3,}|-{3,}\s*$|\*{3,}\s*$|_{3,}\s*$|\|.+\||<[A-Z][A-Za-z0-9]*)/m;
const MARKDOWN_INLINE_RE = /(?:!\[[^\]]*]\([^)]+\)|\[[^\]]+]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/;
const FRONTMATTER_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n(?:\r?\n)?|$)/;

export type NoteMarkdownFrontmatter = NotePageFrontmatter;

export type ParsedMarkdown = {
	markdown: string;
	frontmatter?: NoteMarkdownFrontmatter;
	properties?: MetadataProperties;
	hasFrontmatter: boolean;
};

export type ParsedFrontmatterSource = {
	frontmatter?: NoteMarkdownFrontmatter;
	properties?: MetadataProperties;
	error?: string;
};

export function parseEditorMarkdown(markdown: string, embeds?: ComponentEmbedRegistry) {
	const parsed = parseMarkdownFrontmatter(markdown);
	const tree = parseMarkdownAst(parsed.markdown) as MarkdownNode;
	if (embeds) validateComponents(tree, embeds);
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

export function serializeNotePageMarkdown(
	page: NotePage,
	options: { assetPaths?: Map<string, string> } = {}
) {
	return rewriteAssetSources(page.markdown, options.assetPaths ?? new Map());
}

export function getNotePageFrontmatter(page: NotePage): NoteMarkdownFrontmatter {
	return {
		id: page.id,
		title: page.title,
		...(page.frontmatter?.slug ? { slug: page.slug } : {}),
		...(page.frontmatter?.description ? { description: page.frontmatter.description } : {}),
		tags: page.tags,
		date: dateOnly(page.createdAt),
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

type MarkdownNode = {
	type: string;
	name?: string | null;
	attributes?: Array<{ type: string; name?: string; value?: string | null | { value?: string } }>;
	children?: MarkdownNode[];
};

function validateComponents(node: MarkdownNode, embeds: ComponentEmbedRegistry) {
	if (node.type === 'html')
		throw new Error('Raw HTML is not supported. Use an allowed component instead.');
	if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
		const name = node.name ?? '';
		if (!['br', 'Columns', 'Column', 'YoutubeEmbed'].includes(name)) {
			const result = embeds.parseProps(name, readComponentProps(name, node.attributes ?? []));
			if (!result.ok) throw new Error(result.message);
		}
	}
	for (const child of node.children ?? []) validateComponents(child, embeds);
}

function readComponentProps(name: string, attributes: NonNullable<MarkdownNode['attributes']>) {
	const props: Record<string, unknown> = {};
	for (const attribute of attributes) {
		if (attribute.type !== 'mdxJsxAttribute')
			throw new Error(`Spread attributes are not allowed on <${name}>.`);
		const key = attribute.name ?? '';
		if (!key || /^on[A-Z]/.test(key)) throw new Error(`Invalid prop on <${name}>.`);
		if (attribute.value == null) props[key] = true;
		else if (typeof attribute.value === 'string') props[key] = attribute.value;
		else {
			try {
				props[key] = JSON.parse(attribute.value.value ?? '');
			} catch {
				throw new Error(`Prop “${key}” on <${name}> must be a JSON literal.`);
			}
		}
	}
	return props;
}

function rewriteAssetSources(markdown: string, paths: Map<string, string>) {
	if (!paths.size) return markdown;
	return markdown.replace(/local-asset:\/\/([^\s"')}>]+)/g, (source, encodedId) => {
		let id = encodedId;
		try {
			id = decodeURIComponent(encodedId);
		} catch {
			/* use source value */
		}
		return paths.get(id) ?? source;
	});
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
