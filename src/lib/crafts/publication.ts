import type { JSONContent } from '@tiptap/core';
import { getContentText, getReferencedAssetIds, type NotePage } from '$lib/editor/document/model';
import { normalizePageBody } from '$lib/editor/document/content';
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

export function createPublicCraftList(
	registeredCrafts: Array<CraftMeta & { slug: string }>,
	publishedCrafts: PublishedCraftSummary[]
): CraftListItem[] {
	const publishedBySlug = new Map(publishedCrafts.map((craft) => [craft.slug, craft]));
	const visibleCrafts = [
		...registeredCrafts.filter((craft) => !craft.draft && !publishedBySlug.has(craft.slug)),
		...publishedCrafts
	].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

	return visibleCrafts.map((craft) => ({
		id: isPublishedCraftSummary(craft) ? craft.pageId : `static:${craft.slug}`,
		slug: craft.slug,
		title: craft.title,
		tags: craft.tags,
		date: craft.date,
		wordCount: craft.wordCount
	}));
}

function isPublishedCraftSummary(
	craft: (CraftMeta & { slug: string }) | PublishedCraftSummary
): craft is PublishedCraftSummary {
	return 'pageId' in craft && typeof craft.pageId === 'string';
}

export function countCraftWords(content: JSONContent, title = '') {
	const text = [title, getContentText(content)].filter(Boolean).join(' ').trim();
	return text ? text.split(/\s+/).length : 0;
}

export function createPublishedCraftSummary(page: NotePage): PublishedCraftSummary {
	const body = normalizePageBody(page.content, page.title, page.frontmatter?.description);
	const text = getContentText(body);
	const description = page.frontmatter?.description?.trim() || createExcerpt(text, page.title);

	return {
		pageId: page.id,
		slug: page.slug,
		title: page.title,
		description,
		tags: page.tags,
		date: page.frontmatter?.date?.trim() || page.createdAt.slice(0, 10),
		wordCount: countCraftWords(body, page.title),
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
		markdown: page.markdown,
		updatedAt: page.updatedAt
	};
}

export function getPublishedCraftAssetIds(page: NotePage) {
	return getReferencedAssetIds(page.content);
}

export function rewritePublishedAssetSources(document: CraftDocument, slug: string): CraftDocument {
	if (document.version === 2) {
		return {
			...document,
			markdown: document.markdown.replace(
				/local-asset:\/\/([^\s"')}>]+)/g,
				(_match, encodedId) => `/crafts/${encodeURIComponent(slug)}/assets/${encodedId}`
			)
		};
	}

	return {
		...document,
		content: rewriteValue(document.content, slug) as JSONContent
	};
}

function createExcerpt(text: string, title: string) {
	const withoutTitle = text.startsWith(title) ? text.slice(title.length).trim() : text;
	if (withoutTitle.length <= 180) return withoutTitle;

	return `${withoutTitle.slice(0, 177).trimEnd()}…`;
}

export function stripLeadingPageHeader(
	content: JSONContent,
	title: string,
	description = ''
): JSONContent {
	return normalizePageBody(content, title, description);
}

function rewriteValue(value: unknown, slug: string): unknown {
	if (typeof value === 'string' && value.startsWith('local-asset://')) {
		const id = decodeURIComponent(value.slice('local-asset://'.length));
		return `/crafts/${encodeURIComponent(slug)}/assets/${encodeURIComponent(id)}`;
	}
	if (Array.isArray(value)) return value.map((item) => rewriteValue(item, slug));
	if (!value || typeof value !== 'object') return value;

	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [key, rewriteValue(item, slug)])
	);
}
