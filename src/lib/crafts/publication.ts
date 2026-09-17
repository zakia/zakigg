import { getMarkdownText } from '$lib/editor/document/markdown-ast';
import { parseMarkdownFrontmatter } from '$lib/editor/document/markdown';
import type { NotePage } from '$lib/editor/document/model';
import type { CraftDocument, CraftListItem, CraftMeta } from './types';

export type PublishedCraftSummary = CraftMeta & {
	pageId: string;
	slug: string;
	updatedAt: string;
};

export function createPublicCraftList(crafts: PublishedCraftSummary[]): CraftListItem[] {
	return [...crafts]
		.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
		.map((craft) => ({
			id: craft.pageId,
			slug: craft.slug,
			title: craft.title,
			tags: craft.tags,
			date: craft.date,
			wordCount: craft.wordCount
		}));
}

export function countCraftWords(markdown: string, title = '') {
	const body = parseMarkdownFrontmatter(markdown).markdown;
	const text = [title, getMarkdownText(body)].filter(Boolean).join(' ').trim();
	return text ? text.split(/\s+/).length : 0;
}

export function createPublishedCraftSummary(page: NotePage): PublishedCraftSummary {
	const body = parseMarkdownFrontmatter(page.markdown).markdown;
	const text = getMarkdownText(body);
	return {
		pageId: page.id,
		slug: page.slug,
		title: page.title,
		description: page.frontmatter?.description?.trim() || createExcerpt(text, page.title),
		tags: page.tags,
		date: page.frontmatter?.date?.trim() || page.createdAt.slice(0, 10),
		wordCount: countCraftWords(page.markdown, page.title),
		updatedAt: page.updatedAt,
		draft: page.frontmatter?.draft === true,
		fullBleed: false
	};
}

export function createPublishedCraftDocument(page: NotePage): CraftDocument {
	return {
		version: 2,
		format: 'markdown',
		markdown: parseMarkdownFrontmatter(page.markdown).markdown,
		updatedAt: page.updatedAt
	};
}

export function rewritePublishedAssetSources(document: CraftDocument): CraftDocument {
	return {
		...document,
		markdown: document.markdown.replace(
			/local-asset:\/\/([^\s"')}>]+)/g,
			(_match, encodedId) => `/media/${encodedId}`
		)
	};
}

function createExcerpt(text: string, title: string) {
	const withoutTitle = text.startsWith(title) ? text.slice(title.length).trim() : text;
	return withoutTitle.length <= 180 ? withoutTitle : `${withoutTitle.slice(0, 177).trimEnd()}…`;
}
