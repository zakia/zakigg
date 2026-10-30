import { readStoredDocument, type Document } from '#lib/editor/Document.js';
import { stringify as stringifyYaml } from 'yaml';
import { getFirstMarkdownHeading } from '#lib/editor/document/markdown-ast.js';
import { DEFAULT_DOCUMENT_SLUG, normalizeDocumentSlug } from '#lib/editor/document/slug.js';
import { readFrontmatter } from '#lib/editor/document/frontmatter.js';
export { titleFromSlug } from '#lib/editor/document/slug.js';

export const DEFAULT_SLUG = DEFAULT_DOCUMENT_SLUG;
export type PageFrontmatter = {
	id?: string;
	title?: string;
	slug?: string;
	description?: string;
	tags?: string[];
	date?: string;
	published?: boolean;
	[key: string]: unknown;
};
/** A disposable craft projection of source, never a persisted document model. */
export type Page = Document & {
	title: string;
	slug: string;
	tags: string[];
	frontmatter: PageFrontmatter;
	createdAt: string;
	updatedAt: string;
};
export type StoredPage = Document;

export function createPage(frontmatter: PageFrontmatter = {}, body = ''): Page {
	const title = frontmatter.title || getFirstMarkdownHeading(body) || 'Untitled';
	const properties = {
		id: frontmatter.id || createPageId(),
		title,
		slug: normalizePageSlug(frontmatter.slug || title),
		tags: normalizePageTags(frontmatter.tags),
		date: frontmatter.date || new Date().toISOString().slice(0, 10),
		published: Object.hasOwn(frontmatter, 'draft')
			? isPublished(frontmatter)
			: (frontmatter.published ?? false),
		...frontmatter
	};
	const yaml = stringifyYaml(properties, { lineWidth: 0, nullStr: '' }).trimEnd();
	const text = body.trim();
	return readPage(`---\n${yaml}\n---${text ? `\n\n${text}\n` : '\n'}`);
}

export function readPage(markdown: string, previous?: Partial<Page> & Pick<Page, 'id'>): Page {
	const parsed = readFrontmatter(markdown);
	const values = parsed.values ?? {};
	const body = parsed.range ? markdown.slice(parsed.range.bodyFrom) : markdown;
	const fallbackTitle = parsed.error ? previous?.title : getFirstMarkdownHeading(body);
	const title = normalizePageTitle(Object.hasOwn(values, 'title') ? values.title : fallbackTitle);
	const id = validId(previous?.id) || validId(values.id) || createPageId();
	const slug = normalizePageSlug(text(values.slug) || previous?.slug || title);
	const tags = normalizePageTags(values.tags);
	const createdAt = date(values.date) || previous?.createdAt || new Date().toISOString();
	return {
		id,
		markdown,
		title,
		slug,
		tags,
		createdAt,
		updatedAt: previous?.updatedAt || createdAt,
		frontmatter: {
			...values,
			id: text(values.id),
			title: text(values.title),
			slug: text(values.slug),
			description: text(values.description),
			date: text(values.date),
			tags,
			published: isPublished(values)
		}
	};
}
export function createPageId() {
	return `page_${crypto.randomUUID()}`;
}
export function normalizePageTitle(value: unknown) {
	return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') || 'Untitled' : 'Untitled';
}
export function normalizePageSlug(value: unknown) {
	return normalizeDocumentSlug(text(value));
}
export function normalizePageTags(value: unknown) {
	const tags = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
	return [
		...new Set(
			tags
				.map((tag) => (typeof tag === 'string' ? tag.trim().replace(/^#+/, '').toLowerCase() : ''))
				.filter(Boolean)
		)
	].sort((a, b) => a.localeCompare(b));
}
export function parseStoredPage(value: unknown): Page | null {
	const stored = readStoredDocument(value);
	return stored ? readPage(stored.markdown, { id: stored.id }) : null;
}
export function toStoredPage(page: Document): StoredPage {
	return { id: page.id, markdown: page.markdown };
}
function validId(value: unknown) {
	return typeof value === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(value) ? value : '';
}
function text(value: unknown) {
	return typeof value === 'string' ? value : '';
}
function date(value: unknown) {
	if (typeof value !== 'string' || !value.trim()) return '';
	const stamp = Date.parse(value);
	return Number.isFinite(stamp) ? new Date(stamp).toISOString() : '';
}
/** Preserve existing draft-only files until publication is explicitly changed. */
export function isPublished(properties: Record<string, unknown>) {
	return typeof properties.published === 'boolean'
		? properties.published
		: properties.draft !== true;
}

export function getReferencedAssetIds(markdown: string) {
	const ids = new Set<string>();

	for (const match of markdown.matchAll(/local-asset:\/\/([^\s"')}>]+)/g)) {
		const id = match[1] ?? '';
		try {
			ids.add(decodeURIComponent(id));
		} catch {
			ids.add(id);
		}
	}

	for (const match of markdown.matchAll(/\/media\/(asset_[A-Za-z0-9_-]+)(?:\.[a-z0-9]{1,8})?/gi)) {
		ids.add(match[1] ?? '');
	}

	return [...ids].filter(Boolean);
}
