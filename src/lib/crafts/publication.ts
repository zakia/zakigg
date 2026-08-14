import type { JSONContent } from '@tiptap/core';
import { getContentText, getReferencedAssetIds, type NotePageV1 } from '$lib/notes/types';
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

export function createPublishedCraftSummary(page: NotePageV1): PublishedCraftSummary {
	const body = stripLeadingPageHeader(page.content, page.title, page.frontmatter?.description);
	const text = getContentText(body);
	const description = page.frontmatter?.description?.trim() || createExcerpt(text, page.title);

	return {
		pageId: page.id,
		slug: page.slug,
		title: page.title,
		description,
		tags: page.tags,
		date: page.frontmatter?.date?.trim() || page.createdAt.slice(0, 10),
		wordCount: countCraftWords(page.content),
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
	page: Pick<NotePageV1, 'updatedAt'>,
	publication: Pick<PublishedCraftSummary, 'updatedAt'>
) {
	return Date.parse(page.updatedAt) > Date.parse(publication.updatedAt);
}

export function createPublishedCraftDocument(page: NotePageV1): CraftDocument {
	return {
		version: 1,
		editor: 'tiptap',
		content: stripLeadingPageHeader(page.content, page.title, page.frontmatter?.description),
		updatedAt: page.updatedAt
	};
}

export function getPublishedCraftAssetIds(page: NotePageV1) {
	return getReferencedAssetIds(page.content);
}

export function rewritePublishedAssetSources(document: CraftDocument, slug: string): CraftDocument {
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
	if (content.type !== 'doc' || !content.content?.length) return content;

	const children = [...content.content];
	const normalizedTitle = normalizeText(title);
	const normalizedDescription = normalizeText(description);
	const first = children[0];
	let removedTitle = false;

	if (
		first?.type === 'heading' &&
		Number(first.attrs?.level) === 1 &&
		normalizeText(nodeText(first)) === normalizedTitle
	) {
		children.shift();
		removedTitle = true;
	}

	const next = children[0];
	if (
		removedTitle &&
		normalizedDescription &&
		next?.type === 'heading' &&
		normalizeText(nodeText(next)) === normalizedDescription
	) {
		children.shift();
	}

	return { ...content, content: children.length ? children : [{ type: 'paragraph' }] };
}

function normalizeText(value: string) {
	return value.trim().replace(/\s+/g, ' ');
}

function nodeText(node: JSONContent): string {
	if (node.text) return node.text;

	return (node.content ?? []).map(nodeText).join('');
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
