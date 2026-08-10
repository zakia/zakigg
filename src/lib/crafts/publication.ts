import type { JSONContent } from '@tiptap/core';
import { getContentText, getReferencedAssetIds, type NotePageV1 } from '$lib/notes/types';
import type { CraftDocument, CraftMeta } from './types';

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

export function createPublishedCraftSummary(page: NotePageV1): PublishedCraftSummary {
	const text = getContentText(page.content);
	const description = page.frontmatter?.description?.trim() || createExcerpt(text, page.title);

	return {
		pageId: page.id,
		slug: page.slug,
		title: page.title,
		description,
		tags: page.tags,
		date: page.frontmatter?.date?.trim() || page.createdAt.slice(0, 10),
		updatedAt: page.updatedAt,
		draft: false,
		fullBleed: false
	};
}

export function createPublishedCraftDocument(page: NotePageV1): CraftDocument {
	return {
		version: 1,
		editor: 'tiptap',
		content: stripLeadingTitle(page.content, page.title),
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

function stripLeadingTitle(content: JSONContent, title: string): JSONContent {
	if (content.type !== 'doc' || !content.content?.length) return content;

	const [first, ...rest] = content.content;
	if (first.type !== 'heading' || Number(first.attrs?.level) !== 1) return content;
	if (nodeText(first).trim().replace(/\s+/g, ' ') !== title) return content;

	return { ...content, content: rest.length ? rest : [{ type: 'paragraph' }] };
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
