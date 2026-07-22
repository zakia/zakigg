import { Editor, type JSONContent } from '@tiptap/core';
import { craftComponentEmbeds } from '$lib/crafts/component-embeds';
import { crafts } from '$lib/crafts/registry';
import type { CraftDocument, CraftMeta } from '$lib/crafts/types';
import { createEditorExtensions } from './editor-extensions';
import { normalizeMarkdownDoc } from './markdown';
import { importNotePage, loadNotePageBySlug } from './storage';
import { getFirstLevelOneHeadingText, normalizePageSlug, type NotePageV1 } from './types';

// Craft posts import in tiers:
// - document crafts (content.json) are already Tiptap JSON in the notes node
//   vocabulary — component embeds keep working because both systems share the
//   craftComponentEmbeds registry;
// - plain-markdown .svx crafts are parsed with the editor's markdown parser;
// - .svx crafts with Svelte code (script blocks / component tags) and fully
//   interactive component crafts are not documents and are skipped.
const documentModules = import.meta.glob<{ default: CraftDocument }>('$lib/crafts/*/content.json');
const markdownModules = import.meta.glob<string>('$lib/crafts/*/index.svx', {
	query: '?raw',
	import: 'default'
});

const SVELTE_SYNTAX_RE = /<script[\s>]|<[A-Z]/;

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

			if (!loadDocument && !loadMarkdown) continue;

			const slug = normalizePageSlug(craft.slug);

			if (await loadNotePageBySlug(slug)) {
				result.skippedExisting.push(craft.slug);
				continue;
			}

			let content: JSONContent | null = null;

			if (loadDocument) {
				content = (await (loadDocument as () => Promise<{ default: CraftDocument }>)()).default
					.content;
			} else if (loadMarkdown) {
				const markdown = await (loadMarkdown as () => Promise<string>)();

				if (SVELTE_SYNTAX_RE.test(markdown)) {
					result.skippedUnsupported.push(craft.slug);
					continue;
				}

				markdownParser ??= createMarkdownParser();
				content = parseCraftMarkdown(markdownParser, markdown);
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
	const source = stripMdsvexHeadingAnchors(markdown).trim();

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
