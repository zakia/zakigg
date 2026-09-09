import { getMarkdownText } from '$lib/editor/document/markdown-ast';
import { parseMarkdownFrontmatter } from '$lib/editor/document/markdown';
import { getReferencedAssetIds, type NotePage } from '$lib/editor/document/model';
import type { CraftDocument, CraftListItem, CraftMeta } from './types';

export type PublishedCraftSummary = CraftMeta & {
	pageId: string;
	slug: string;
	updatedAt: string;
};

export type PublishedCraftMetadata = PublishedCraftSummary & {
	ownerId: string;
	assetIds: string[];
	bodyHash: string;
	bodyObject: string;
	publishedAt: string;
};

export function createPublicCraftList(publishedCrafts: PublishedCraftSummary[]): CraftListItem[] {
	return [...publishedCrafts]
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
	const description = page.frontmatter?.description?.trim() || createExcerpt(text, page.title);

	return {
		pageId: page.id,
		slug: page.slug,
		title: page.title,
		description,
		tags: page.tags,
		date: page.frontmatter?.date?.trim() || page.createdAt.slice(0, 10),
		wordCount: countCraftWords(page.markdown, page.title),
		updatedAt: page.updatedAt,
		draft: false,
		fullBleed: false
	};
}

export function toPublishedCraftSummary(record: PublishedCraftMetadata): PublishedCraftSummary {
	return {
		pageId: record.pageId,
		slug: record.slug,
		title: record.title,
		description: record.description,
		tags: record.tags,
		date: record.date,
		...(typeof record.wordCount === 'number' ? { wordCount: record.wordCount } : {}),
		updatedAt: record.updatedAt,
		draft: false,
		fullBleed: false
	};
}

export function isPublishedCraftOutdated(
	page: Pick<NotePage, 'updatedAt'>,
	publication: Pick<PublishedCraftSummary, 'updatedAt'>
) {
	return Date.parse(page.updatedAt) > Date.parse(publication.updatedAt);
}

export function createPublishedCraftDocument(page: NotePage): CraftDocument {
	return {
		version: 2,
		format: 'markdown',
		markdown: parseMarkdownFrontmatter(page.markdown).markdown,
		updatedAt: page.updatedAt
	};
}

export function getPublishedCraftAssetIds(page: NotePage) {
	return getReferencedAssetIds(page.markdown);
}

export function rewritePublishedAssetSources(document: CraftDocument, slug: string): CraftDocument {
	return {
		...document,
		markdown: document.markdown.replace(
			/local-asset:\/\/([^\s"')}>]+)/g,
			(_match, encodedId) => `/crafts/${encodeURIComponent(slug)}/assets/${encodedId}`
		)
	};
}

function createExcerpt(text: string, title: string) {
	const withoutTitle = text.startsWith(title) ? text.slice(title.length).trim() : text;
	if (withoutTitle.length <= 180) return withoutTitle;

	return `${withoutTitle.slice(0, 177).trimEnd()}…`;
}
