import { Editor, type JSONContent } from '@tiptap/core';
import { craftComponentEmbeds } from '$lib/crafts/component-embeds';
import { crafts } from '$lib/crafts/registry';
import type { CraftDocument, CraftMeta } from '$lib/crafts/types';
import { getMediaKindForUrl } from './media';
import { createEditorExtensions } from './editor-extensions';
import { normalizeMarkdownDoc } from './markdown';
import { importNotePage, loadNotePageBySlug, saveNoteAsset } from './storage';
import { getFirstLevelOneHeadingText, normalizePageSlug, type NotePageV1 } from './types';

// Craft posts import in tiers:
// - document crafts (content.json) are already Tiptap JSON in the notes node
//   vocabulary — component embeds keep working because both systems share the
//   craftComponentEmbeds registry;
// - .svx crafts are parsed with the editor's markdown parser after light
//   cleanup: media references (including Svelte-imported local files) are
//   lifted out as placeholders and restored as mediaBlock nodes, with local
//   files copied into the notes asset store;
// - .svx crafts that still contain Svelte code after cleanup and fully
//   interactive component crafts are not documents and are skipped.
const documentModules = import.meta.glob<{ default: CraftDocument }>('$lib/crafts/*/content.json');
const markdownModules = import.meta.glob<string>('$lib/crafts/*/index.svx', {
	query: '?raw',
	import: 'default'
});
const assetModules = import.meta.glob<string>(
	'$lib/crafts/*/*.{mp4,m4v,mov,webm,webp,png,jpg,jpeg,gif,avif}',
	{ query: '?url', import: 'default' }
);

// Component crafts whose interactive core is registered as a notes embed —
// they import as a note hosting the live component.
const COMPONENT_CRAFT_EMBEDS: Record<string, string> = {
	'tic-tac-toe': 'tic-tac-toe.game',
	'rock-paper-scissors': 'rock-paper-scissors.game'
};

const SVELTE_SYNTAX_RE = /<script[\s>]|<[A-Z]/;
const SCRIPT_BLOCK_RE = /<script[^>]*>[\s\S]*?<\/script>/g;
const MEDIA_IMPORT_RE = /import\s+(\w+)\s+from\s+['"]\.\/([^'"]+)['"]/g;
const MEDIA_PLACEHOLDER_RE = /^%%craft-media-(\d+)%%$/;

type CraftMediaReference = {
	alt: string;
	// Either a remote/absolute URL, or the slug-relative file of a local asset.
	src?: string;
	localFile?: string;
};

export type CraftImportResult = {
	imported: NotePageV1[];
	skippedExisting: string[];
	skippedUnsupported: string[];
};

export async function importCraftsToNotes(): Promise<CraftImportResult> {
	const documentPaths = new Map(Object.entries(documentModules).map(byCraftSlug));
	const markdownPaths = new Map(Object.entries(markdownModules).map(byCraftSlug));
	const result: CraftImportResult = {
		imported: [],
		skippedExisting: [],
		skippedUnsupported: []
	};
	let markdownParser: Editor | null = null;

	try {
		for (const craft of crafts) {
			const loadDocument = documentPaths.get(craft.slug);
			const loadMarkdown = markdownPaths.get(craft.slug);
			const embedId = COMPONENT_CRAFT_EMBEDS[craft.slug];

			if (!loadDocument && !loadMarkdown && !embedId) continue;

			const slug = normalizePageSlug(craft.slug);

			if (await loadNotePageBySlug(slug)) {
				result.skippedExisting.push(craft.slug);
				continue;
			}

			let content: JSONContent | null = null;

			if (embedId) {
				content = createEmbedCraftContent(craft, embedId);
			} else if (loadDocument) {
				content = (await (loadDocument as () => Promise<{ default: CraftDocument }>)()).default
					.content;
			} else if (loadMarkdown) {
				const source = await (loadMarkdown as () => Promise<string>)();
				const prepared = prepareCraftMarkdown(source);

				if (SVELTE_SYNTAX_RE.test(prepared.markdown)) {
					result.skippedUnsupported.push(craft.slug);
					continue;
				}

				markdownParser ??= createMarkdownParser();
				const parsed = parseCraftMarkdown(markdownParser, prepared.markdown);

				content = parsed ? await restoreCraftMedia(parsed, prepared.media, craft.slug) : null;
			}

			if (!content) {
				result.skippedUnsupported.push(craft.slug);
				continue;
			}

			result.imported.push(await importCraftPage(craft, slug, content));
		}
	} finally {
		markdownParser?.destroy();
	}

	return result;
}

// An embed craft's note is its description plus the live component.
function createEmbedCraftContent(meta: CraftMeta, embedId: string): JSONContent | null {
	const node = craftComponentEmbeds.createNode(embedId);

	if (!node.ok) return null;

	return {
		type: 'doc',
		content: [
			...(meta.description
				? [{ type: 'paragraph', content: [{ type: 'text', text: meta.description }] }]
				: []),
			node.node
		]
	};
}

async function importCraftPage(meta: CraftMeta, slug: string, content: JSONContent) {
	return importNotePage({
		title: meta.title,
		tags: meta.tags,
		frontmatter: {
			title: meta.title,
			slug,
			description: meta.description,
			tags: meta.tags,
			date: meta.date,
			...(meta.draft ? { draft: true } : {})
		},
		content: withLeadingTitleHeading(content, meta.title),
		createdAt: meta.date,
		updatedAt: meta.date
	});
}

// Reduces an .svx source to plain markdown: pulls Svelte media imports out of
// the script block, lifts every media reference (markdown images, <video>
// tags) into a numbered placeholder paragraph, and strips presentational
// Svelte/HTML wrappers that carry no document content.
function prepareCraftMarkdown(source: string): { markdown: string; media: CraftMediaReference[] } {
	const media: CraftMediaReference[] = [];
	const imports = new Map<string, string>();

	for (const match of source.matchAll(MEDIA_IMPORT_RE)) {
		imports.set(match[1], match[2]);
	}

	const placeholder = (reference: CraftMediaReference) => {
		media.push(reference);

		return `\n\n%%craft-media-${media.length - 1}%%\n\n`;
	};

	const markdown = source
		.replace(SCRIPT_BLOCK_RE, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		// <video src={identifier} ...> / <video src="url" ...>
		.replace(/<video\s+src=\{(\w+)\}[^>]*>\s*<\/video>/g, (_, name: string) =>
			imports.has(name) ? placeholder({ alt: '', localFile: imports.get(name) }) : ''
		)
		.replace(/<video\s+src="([^"]+)"[^>]*>\s*<\/video>/g, (_, src: string) =>
			placeholder({ alt: '', src })
		)
		// ![alt]({identifier}) and ![alt](url), with optional {.class} suffix
		.replace(/!\[([^\]]*)\]\(\{(\w+)\}\)(\{[^}]*\})?/g, (_, alt: string, name: string) =>
			imports.has(name) ? placeholder({ alt, localFile: imports.get(name) }) : ''
		)
		.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)(\{[^}]*\})?/g, (_, alt: string, src: string) =>
			placeholder({ alt, src })
		)
		// <kbd> keys have no markdown equivalent; represent them as inline code
		// rather than raw HTML. As a standard tag, raw <kbd> would otherwise be
		// parsed via generateJSON — dragging a schema-filled metadata block into
		// the content (see normalizeMarkdownDoc).
		.replace(/<kbd[^>]*>([\s\S]*?)<\/kbd>/gi, (_, key: string) => {
			const label = key.trim();

			return label ? `\`${label}\`` : '';
		})
		// Presentational wrappers: keep span text, drop layout-only div lines.
		.replace(/<span[^>]*>([\s\S]*?)<\/span>/g, '$1')
		.replace(/^[ \t]*<\/?div[^>]*>[ \t]*$/gm, '')
		.trim();

	return { markdown: stripMdsvexHeadingAnchors(markdown), media };
}

// Replaces placeholder paragraphs with mediaBlock nodes. Local craft files
// are fetched and copied into the notes asset store so the imported note is
// self-contained; remote URLs are kept as-is.
async function restoreCraftMedia(
	doc: JSONContent,
	media: CraftMediaReference[],
	craftSlug: string
): Promise<JSONContent> {
	if (!media.length) return doc;

	const assetPaths = new Map(Object.entries(assetModules).map(byCraftFile));
	const content: JSONContent[] = [];

	for (const node of doc.content ?? []) {
		const index = getMediaPlaceholderIndex(node);

		if (index === null) {
			content.push(node);
			continue;
		}

		const reference = media[index];
		if (!reference) continue;

		const block = await createMediaBlockNode(reference, craftSlug, assetPaths);
		if (block) content.push(block);
	}

	return { ...doc, content };
}

function getMediaPlaceholderIndex(node: JSONContent) {
	if (node.type !== 'paragraph' || node.content?.length !== 1) return null;

	const text = node.content[0];
	if (text.type !== 'text') return null;

	const match = text.text?.trim().match(MEDIA_PLACEHOLDER_RE);

	return match ? Number(match[1]) : null;
}

async function createMediaBlockNode(
	reference: CraftMediaReference,
	craftSlug: string,
	assetPaths: Map<string, () => Promise<string>>
): Promise<JSONContent | null> {
	if (reference.src) {
		return {
			type: 'mediaBlock',
			attrs: {
				kind: getMediaKindForUrl(reference.src) ?? 'image',
				src: reference.src,
				alt: reference.alt
			}
		};
	}

	if (!reference.localFile) return null;

	const loadUrl = assetPaths.get(`${craftSlug}/${reference.localFile}`);
	if (!loadUrl) return null;

	try {
		const url = await loadUrl();
		const response = await fetch(url);
		if (!response.ok) return null;

		const blob = await response.blob();
		const fileName = reference.localFile.split('/').pop() ?? reference.localFile;
		const asset = await saveNoteAsset(new File([blob], fileName, { type: blob.type }));

		return {
			type: 'mediaBlock',
			attrs: {
				kind: getMediaKindForUrl(fileName) ?? 'image',
				src: `local-asset://${encodeURIComponent(asset.id)}`,
				assetId: asset.id,
				alt: reference.alt
			}
		};
	} catch (error) {
		console.error(`Could not import craft media ${craftSlug}/${reference.localFile}`, error);
		return null;
	}
}

// Notes lead with an H1 title; craft bodies rely on the page chrome for it.
function withLeadingTitleHeading(content: JSONContent, title: string): JSONContent {
	if (getFirstLevelOneHeadingText(content)) return content;

	return {
		...content,
		content: [
			{
				type: 'heading',
				attrs: { level: 1 },
				content: [{ type: 'text', text: title }]
			},
			...(content.content ?? [])
		]
	};
}

function createMarkdownParser() {
	return new Editor({
		element: document.createElement('div'),
		extensions: createEditorExtensions(craftComponentEmbeds),
		editable: false
	});
}

function parseCraftMarkdown(parser: Editor, markdown: string): JSONContent | null {
	const source = markdown.trim();

	if (!source) return null;

	const parsed = (
		parser as Editor & { markdown?: { parse: (value: string) => JSONContent } }
	).markdown?.parse(source);

	if (!parsed?.content?.length) return null;

	return normalizeMarkdownDoc(parsed);
}

// mdsvex heading id suffixes ("## Interactivity{#interactivity}") are not
// markdown; drop them rather than importing them as literal text.
function stripMdsvexHeadingAnchors(markdown: string) {
	return markdown.replace(/^(#{1,6}[^\n]*?)\s*\{#[A-Za-z0-9_-]+\}[ \t]*$/gm, '$1');
}

function byCraftSlug<T>([path, loader]: [string, T]): [string, T] {
	const segments = path.split('/');

	return [segments[segments.length - 2] ?? path, loader];
}

function byCraftFile<T>([path, loader]: [string, T]): [string, T] {
	const segments = path.split('/');

	return [segments.slice(-2).join('/'), loader];
}
