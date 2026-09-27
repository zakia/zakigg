import { stringify as stringifyYaml } from 'yaml';
import { getFirstMarkdownHeading, getMarkdownText } from './markdown-ast';
import {
	metadataEntriesToRecord,
	normalizeMetadataEntries,
	normalizeMetadataProperties,
	type MetadataEntry,
	type MetadataProperties
} from './metadata';
import { DEFAULT_DOCUMENT_SLUG, normalizeDocumentSlug } from './slug';
import { hasFrontmatterStart, readFrontmatter } from './frontmatter-source';

export { titleFromSlug } from './slug';

export const NOTES_PAGE_VERSION = 3;
export const DEFAULT_NOTE_SLUG = DEFAULT_DOCUMENT_SLUG;
export const DEFAULT_NOTE_ID = 'page_default';

export type NotePageFrontmatter = {
	id?: string;
	title?: string;
	slug?: string;
	description?: string;
	tags?: string[];
	date?: string;
	draft?: boolean;
};

export type NotePage = {
	version: typeof NOTES_PAGE_VERSION;
	format: 'markdown';
	id: string;
	slug: string;
	title: string;
	tags: string[];
	properties: MetadataEntry[];
	frontmatter?: NotePageFrontmatter;
	markdown: string;
	createdAt: string;
	updatedAt: string;
};

export type StoredNotePage = NotePage;

export type NotePageSummary = Pick<
	NotePage,
	'id' | 'slug' | 'title' | 'tags' | 'createdAt' | 'updatedAt'
> & { date: string; assetCount: number; wordCount: number };

export type NotePageMetadataPatch = Partial<NotePageFrontmatter>;

export function createNotePage(input: Partial<NotePage> = {}): NotePage {
	const now = new Date().toISOString();
	const parsed = parseCanonicalMarkdownSource(input.markdown ?? '');
	const parsedProperties = metadataEntriesToRecord(parsed.properties);
	const properties = normalizeMetadataEntries(
		parsed.hasFrontmatter && !parsed.error
			? parsed.properties
			: (input.properties ?? {
					...(input.frontmatter ?? {}),
					...(input.tags?.length ? { tags: input.tags } : {})
				})
	);
	const seed = {
		id: normalizePageId(input.id || parsedProperties.id) || createPageId(),
		slug: normalizePageSlug(
			input.slug ||
				parsedProperties.slug ||
				parsedProperties.title ||
				input.title ||
				DEFAULT_NOTE_SLUG
		),
		title: normalizePageTitle(
			parsed.hasFrontmatter && !parsed.error && hasOwn(parsedProperties, 'title')
				? parsedProperties.title
				: input.title || getFirstMarkdownHeading(parsed.body)
		),
		tags: normalizePageTags(input.tags),
		properties,
		createdAt: normalizeDate(input.createdAt) || now,
		updatedAt: normalizeDate(input.updatedAt) || now
	};
	const metadata = resolveNotePageMetadata(seed, parsed.hasFrontmatter ? {} : input.frontmatter);
	const canonicalProperties = createCanonicalProperties({ ...seed, ...metadata });
	const canonicalFrontmatter = metadataPropertiesToNotePageFrontmatter(
		metadataEntriesToRecord(canonicalProperties)
	);

	return {
		version: NOTES_PAGE_VERSION,
		format: 'markdown',
		...seed,
		...metadata,
		properties: canonicalProperties,
		...(canonicalFrontmatter ? { frontmatter: canonicalFrontmatter } : {}),
		markdown:
			parsed.hasFrontmatter || (input.version === NOTES_PAGE_VERSION && input.format === 'markdown')
				? (input.markdown ?? '')
				: createCanonicalMarkdownSource(canonicalProperties, parsed.body)
	};
}

export function createDefaultNotePage(): NotePage {
	return createNotePage({
		id: DEFAULT_NOTE_ID,
		slug: DEFAULT_NOTE_SLUG,
		title: 'Default',
		properties: [{ key: 'draft', value: true }]
	});
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

export function parseStoredPage(value: unknown): NotePage | null {
	if (!value || typeof value !== 'object') return null;
	const page = value as Partial<NotePage>;
	if (
		page.version !== NOTES_PAGE_VERSION ||
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
		return createNotePage(page);
	} catch {
		return null;
	}
}

export function toStoredNotePage(page: NotePage): StoredNotePage {
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

export function resolveNotePageMetadata(
	page: Pick<NotePage, 'title' | 'slug' | 'tags' | 'properties' | 'createdAt'>,
	patch: NotePageMetadataPatch = {}
): Pick<NotePage, 'title' | 'slug' | 'tags' | 'createdAt'> & { frontmatter?: NotePageFrontmatter } {
	const fromProperties = metadataPropertiesToNotePageFrontmatter(
		metadataEntriesToRecord(normalizeMetadataEntries(page.properties))
	);
	const frontmatter = normalizeNotePageFrontmatter({ ...fromProperties, ...patch });
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

export function metadataPropertiesToNotePageFrontmatter(
	value: MetadataProperties
): NotePageFrontmatter | undefined {
	const properties = normalizeMetadataProperties(value);
	const frontmatter: NotePageFrontmatter = {};
	if (typeof properties.id === 'string' && properties.id.trim())
		frontmatter.id = normalizePageId(properties.id);
	if (typeof properties.title === 'string' && properties.title.trim())
		frontmatter.title = normalizePageTitle(properties.title);
	if (typeof properties.slug === 'string' && properties.slug.trim())
		frontmatter.slug = normalizePageSlug(properties.slug);
	if (typeof properties.description === 'string' && properties.description.trim())
		frontmatter.description = properties.description.trim().replace(/\s+/g, ' ');
	if (hasOwn(properties, 'tags')) frontmatter.tags = normalizePageTags(properties.tags);
	if (typeof properties.date === 'string' && properties.date.trim())
		frontmatter.date = properties.date.trim();
	if (hasOwn(properties, 'draft')) frontmatter.draft = properties.draft === true;
	return Object.keys(frontmatter).length ? frontmatter : undefined;
}

export function normalizeNotePageFrontmatter(value: unknown): NotePageFrontmatter | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return;
	const record = value as Record<string, unknown>;
	const frontmatter: NotePageFrontmatter = {};
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
	if (hasOwn(record, 'draft')) frontmatter.draft = record.draft === true;
	return Object.keys(frontmatter).length ? frontmatter : undefined;
}

export function summarizeNotePage(page: NotePage): NotePageSummary {
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
		assetCount: getReferencedAssetIds(body).length,
		wordCount: text ? text.split(/\s+/).length : 0
	};
}

export function createCanonicalMarkdownSource(properties: MetadataEntry[], body: string) {
	const yaml = stringifyYaml(metadataEntriesToRecord(properties), {
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
	return {
		properties: parsed.values ? normalizeMetadataEntries(parsed.values) : ([] as MetadataEntry[]),
		body: parsed.range ? markdown.slice(parsed.range.to) : markdown,
		hasFrontmatter: Boolean(parsed.range || hasFrontmatterStart(markdown)),
		error: Boolean(parsed.error)
	};
}

function createCanonicalProperties(
	page: Pick<
		NotePage,
		'id' | 'properties' | 'title' | 'slug' | 'tags' | 'createdAt' | 'frontmatter'
	>
) {
	return normalizeMetadataEntries({
		...metadataEntriesToRecord(page.properties),
		id: page.id,
		title: page.title,
		...(page.frontmatter?.slug ? { slug: page.slug } : {}),
		...(page.frontmatter?.description ? { description: page.frontmatter.description } : {}),
		tags: page.tags,
		date: page.frontmatter?.date || page.createdAt.slice(0, 10),
		...(typeof page.frontmatter?.draft === 'boolean' ? { draft: page.frontmatter.draft } : {})
	});
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
