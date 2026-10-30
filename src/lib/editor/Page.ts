import { stringify as stringifyYaml } from 'yaml';
import { getFirstMarkdownHeading, getMarkdownText } from './document/markdown-ast';
import { DEFAULT_DOCUMENT_SLUG, normalizeDocumentSlug } from './document/slug';
import { hasFrontmatterStart, readFrontmatter } from './features/frontmatter/source';

export { titleFromSlug } from './document/slug';

export const PAGE_VERSION = 3;
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

export type MetadataEntry = { key: string; value: unknown };
export type MetadataProperties = Record<string, unknown>;

/** Serializable snapshot. Metadata is normalized from Markdown when the page is saved. */
export type Page = {
	version: typeof PAGE_VERSION;
	format: 'markdown';
	id: string;
	slug: string;
	title: string;
	tags: string[];
	properties: MetadataEntry[];
	frontmatter?: PageFrontmatter;
	markdown: string;
	createdAt: string;
	updatedAt: string;
};

export type StoredPage = Page;

export type PageSummary = Pick<
	Page,
	'id' | 'slug' | 'title' | 'tags' | 'createdAt' | 'updatedAt'
> & { date: string; assetCount: number; wordCount: number; published: boolean };

export type PageMetadataPatch = Partial<PageFrontmatter>;

/** New documents get explicit frontmatter and a body. */
export function createPage(frontmatter: PageFrontmatter = {}, body = ''): Page {
	const title = frontmatter.title || getFirstMarkdownHeading(body) || 'Untitled';
	const id = frontmatter.id || createPageId();
	const slug = normalizePageSlug(frontmatter.slug || title);
	const tags = normalizePageTags(frontmatter.tags);
	const date = frontmatter.date || new Date().toISOString().slice(0, 10);
	const published = Object.hasOwn(frontmatter, 'draft')
		? isPublished(frontmatter)
		: (frontmatter.published ?? false);

	const resolved: PageFrontmatter = {
		id,
		title,
		slug,
		tags,
		date,
		published,
		...frontmatter
	};

	return readPage(createCanonicalMarkdownSource(resolved, body));
}

/** Reading/editing preserves source bytes, including incomplete YAML while typing. */
export function readPage(markdown: string, previous?: Page): Page {
	return hydratePage({ ...previous, version: PAGE_VERSION, format: 'markdown', markdown });
}

function hydratePage(input: Partial<Page>): Page {
	const now = new Date().toISOString();
	const parsed = parseCanonicalMarkdownSource(input.markdown ?? '');
	const values = parsed.frontmatter ?? (input.frontmatter as Record<string, unknown>) ?? {};

	const id = normalizePageId(input.id || values.id) || createPageId();
	const title = normalizePageTitle(
		parsed.hasFrontmatter && !parsed.error && hasOwn(values, 'title')
			? values.title
			: input.title || getFirstMarkdownHeading(parsed.body)
	);
	const slug = normalizePageSlug(
		input.slug || values.slug || values.title || input.title || DEFAULT_SLUG
	);
	const tags = normalizePageTags(values.tags ?? input.tags);
	const createdAt = normalizeDate(values.date) || normalizeDate(input.createdAt) || now;
	const updatedAt = normalizeDate(input.updatedAt) || now;

	const seed = { id, slug, title, tags, createdAt, updatedAt };
	const metadata = resolvePageMetadata(seed, parsed.hasFrontmatter ? {} : input.frontmatter);

	const canonicalFrontmatter: PageFrontmatter = {
		...values,
		id: seed.id,
		title: metadata.title,
		...(values.slug || input.frontmatter?.slug ? { slug: metadata.slug } : {}),
		...(values.description ? { description: String(values.description).trim().replace(/\s+/g, ' ') } : {}),
		tags: metadata.tags,
		date:
			typeof values.date === 'string' && values.date.trim()
				? values.date.trim()
				: metadata.createdAt.slice(0, 10),
		published: isPublished(values)
	};

	const properties = Object.entries(canonicalFrontmatter).map(([key, value]) => ({ key, value }));

	return {
		version: PAGE_VERSION,
		format: 'markdown',
		...seed,
		...metadata,
		properties,
		frontmatter: canonicalFrontmatter,
		markdown:
			parsed.hasFrontmatter || (input.version === PAGE_VERSION && input.format === 'markdown')
				? (input.markdown ?? '')
				: createCanonicalMarkdownSource(canonicalFrontmatter, parsed.body)
	};
}

export function createPageId() {
	return `page_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

export function normalizePageTitle(value: unknown) {
	const title = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
	return title || 'Untitled';
}

export function normalizePageSlug(value: unknown) {
	return normalizeDocumentSlug(value);
}

export function normalizePageTags(value: unknown) {
	const tags = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
	return [...new Set(tags.map(normalizeTag).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function parseStoredPage(value: unknown): Page | null {
	if (!value || typeof value !== 'object') return null;
	const page = value as Partial<Page>;
	if (
		page.version !== PAGE_VERSION ||
		page.format !== 'markdown' ||
		typeof page.id !== 'string' ||
		typeof page.slug !== 'string' ||
		typeof page.title !== 'string' ||
		typeof page.markdown !== 'string' ||
		typeof page.createdAt !== 'string' ||
		typeof page.updatedAt !== 'string'
	)
		return null;

	try {
		return hydratePage(page);
	} catch {
		return null;
	}
}

export function toStoredPage(page: Page): StoredPage {
	return structuredClone(page);
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

export function resolvePageMetadata(
	page: Pick<Page, 'title' | 'slug' | 'tags' | 'createdAt'> & { frontmatter?: PageFrontmatter },
	patch: PageMetadataPatch = {}
): Pick<Page, 'title' | 'slug' | 'tags' | 'createdAt'> & { frontmatter?: PageFrontmatter } {
	const frontmatter = normalizePageFrontmatter({ ...page.frontmatter, ...patch });
	const title = normalizePageTitle(frontmatter?.title || page.title);
	const slug = normalizePageSlug(frontmatter?.slug || page.slug || title);
	const createdAt = frontmatter?.date ? normalizeDate(frontmatter.date) : page.createdAt;
	const tags = normalizePageTags(frontmatter?.tags ?? page.tags);
	return {
		title,
		slug,
		tags,
		createdAt: createdAt || page.createdAt,
		...(frontmatter ? { frontmatter } : {})
	};
}

export function metadataPropertiesToPageFrontmatter(value: unknown): PageFrontmatter | undefined {
	return normalizePageFrontmatter(value);
}

export function normalizeMetadataProperties(value: unknown): MetadataProperties {
	if (!value || typeof value !== 'object') return {};
	if (Array.isArray(value)) {
		return Object.fromEntries(
			value.map((entry) => [entry?.key, entry?.value]).filter(([k]) => Boolean(k))
		);
	}
	return { ...(value as Record<string, unknown>) };
}

export function metadataEntriesToRecord(entries: MetadataEntry[]): MetadataProperties {
	return Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
}

export function normalizeMetadataEntries(value: unknown): MetadataEntry[] {
	if (!value || typeof value !== 'object') return [];
	if (Array.isArray(value)) {
		return value.filter((entry) => entry && typeof entry === 'object' && entry.key);
	}
	return Object.entries(value).map(([key, value]) => ({ key, value }));
}

export function normalizePageFrontmatter(value: unknown): PageFrontmatter | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return;
	const record = value as Record<string, unknown>;
	const frontmatter: PageFrontmatter = { ...record };
	if (typeof record.id === 'string' && record.id.trim())
		frontmatter.id = normalizePageId(record.id);
	if (typeof record.title === 'string' && record.title.trim())
		frontmatter.title = normalizePageTitle(record.title);
	if (typeof record.slug === 'string' && record.slug.trim())
		frontmatter.slug = normalizePageSlug(record.slug);
	if (typeof record.description === 'string' && record.description.trim())
		frontmatter.description = record.description.trim().replace(/\s+/g, ' ');
	if (hasOwn(record, 'tags')) frontmatter.tags = normalizePageTags(record.tags);
	if (typeof record.date === 'string' && record.date.trim()) frontmatter.date = record.date.trim();
	frontmatter.published = isPublished(record);
	return Object.keys(frontmatter).length ? frontmatter : undefined;
}

export function summarizePage(page: Page): PageSummary {
	const body = parseCanonicalMarkdownSource(page.markdown).body;
	const text = getMarkdownText(body);
	return {
		id: page.id,
		slug: page.slug,
		title: page.title,
		tags: page.tags,
		date: page.frontmatter?.date?.trim() || page.createdAt,
		createdAt: page.createdAt,
		updatedAt: page.updatedAt,
		published: page.frontmatter?.published === true,
		assetCount: getReferencedAssetIds(body).length,
		wordCount: text ? text.split(/\s+/).length : 0
	};
}

export function createCanonicalMarkdownSource(
	frontmatter: PageFrontmatter | MetadataEntry[],
	body: string
) {
	const record = Array.isArray(frontmatter) ? metadataEntriesToRecord(frontmatter) : frontmatter;
	const yaml = stringifyYaml(record, {
		lineWidth: 0,
		nullStr: ''
	}).trimEnd();
	const normalizedBody = body.trim();
	return yaml
		? `---\n${yaml}\n---${normalizedBody ? `\n\n${normalizedBody}\n` : '\n'}`
		: normalizedBody;
}

function parseCanonicalMarkdownSource(markdown: string) {
	const parsed = readFrontmatter(markdown);
	const values =
		parsed.values && typeof parsed.values === 'object' && !Array.isArray(parsed.values)
			? (parsed.values as Record<string, unknown>)
			: null;
	return {
		frontmatter: values,
		properties: values ? Object.entries(values).map(([key, value]) => ({ key, value })) : [],
		body: parsed.range ? markdown.slice(parsed.range.bodyFrom) : markdown,
		hasFrontmatter: Boolean(parsed.range || hasFrontmatterStart(markdown)),
		error: Boolean(parsed.error)
	};
}

function normalizePageId(value: unknown) {
	const id = typeof value === 'string' ? value.trim() : '';
	return /^[A-Za-z0-9_-]{1,180}$/.test(id) ? id : '';
}

function normalizeTag(value: unknown) {
	return typeof value === 'string' ? value.trim().replace(/^#+/, '').toLowerCase() : '';
}

function normalizeDate(value: unknown) {
	if (typeof value !== 'string' || !value.trim()) return '';
	const time = Date.parse(value);
	return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

function hasOwn(value: object, key: string) {
	return Object.prototype.hasOwnProperty.call(value, key);
}

/** Legacy draft files keep their visibility until the author changes the setting. */
export function isPublished(properties: Record<string, unknown> | undefined) {
	if (typeof properties?.published === 'boolean') return properties.published;
	return properties?.draft !== true;
}
