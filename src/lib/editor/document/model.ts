import type { JSONContent } from '@tiptap/core';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { getLocalAssetId } from './persistence/assets';
import {
	metadataEntriesToRecord,
	normalizeMetadataEntries,
	normalizeMetadataProperties,
	type MetadataEntry,
	type MetadataProperties
} from './metadata';
import { normalizePageBody } from './content';
import { DEFAULT_DOCUMENT_SLUG, normalizeDocumentSlug } from './slug';
import { editorContentToMarkdown, markdownBodyToEditorContent } from './markdown-ast';

export { titleFromSlug } from './slug';

export const NOTES_DOC_VERSION = 1;
export const NOTES_PAGE_VERSION = 2;
export const NOTES_EDITOR = 'markdown';
const LEGACY_NOTES_EDITOR = 'tiptap';
export const DEFAULT_NOTE_SLUG = DEFAULT_DOCUMENT_SLUG;
export const DEFAULT_NOTE_ID = 'page_default';
export const NOTES_STORAGE_KEY_PREFIX = 'zaki.gg:notes:v1';
export const NOTES_STORAGE_KEY = `${NOTES_STORAGE_KEY_PREFIX}:default`;

export const EMPTY_TIPTAP_DOC = {
	type: 'doc',
	content: [
		{
			type: 'paragraph'
		}
	]
} satisfies JSONContent;

export type NotesDocV1 = {
	version: typeof NOTES_DOC_VERSION;
	editor: typeof LEGACY_NOTES_EDITOR;
	content: JSONContent;
	updatedAt: string;
};

export type NotePageFrontmatter = {
	title?: string;
	slug?: string;
	description?: string;
	tags?: string[];
	date?: string;
	draft?: boolean;
};

export type NotePage = {
	version: typeof NOTES_PAGE_VERSION;
	editor: typeof NOTES_EDITOR;
	id: string;
	slug: string;
	title: string;
	tags: string[];
	// Canonical, ordered page metadata edited by the properties panel. `title`,
	// `slug`, `tags` and `frontmatter` are derived from this on save.
	properties: MetadataEntry[];
	frontmatter?: NotePageFrontmatter;
	// Durable source of truth. `content` is a derived visual-editor model and
	// is removed at every persistence and network boundary.
	markdown: string;
	content: JSONContent;
	createdAt: string;
	updatedAt: string;
};

export type StoredNotePage = Omit<NotePage, 'content'>;

export type NotePageSummary = Pick<
	NotePage,
	'id' | 'slug' | 'title' | 'tags' | 'createdAt' | 'updatedAt'
> & {
	// The document date: the verbatim metadata `date` when present (often a
	// timezone-less `yyyy-mm-dd`, which display code must not shift through
	// the local timezone), else the record's createdAt timestamp.
	date: string;
	assetCount: number;
	wordCount: number;
};

export type NotePageMetadataPatch = Partial<NotePageFrontmatter>;

export function createNotesDoc(
	content: JSONContent,
	updatedAt = new Date().toISOString()
): NotesDocV1 {
	return {
		version: NOTES_DOC_VERSION,
		editor: LEGACY_NOTES_EDITOR,
		content,
		updatedAt
	};
}

export function createNotePage(input: Partial<NotePage> = {}): NotePage {
	const now = new Date().toISOString();
	const id = input.id || createPageId();
	const parsedSource =
		!input.content && typeof input.markdown === 'string'
			? parseCanonicalMarkdownSource(input.markdown)
			: undefined;
	const sourceContent =
		input.content && isJSONContent(input.content)
			? stripLegacyMetadataBlocks(input.content)
			: (parsedSource?.content ?? createInitialNotePageContent());
	// Seed the ordered metadata from explicit properties, else from a
	// frontmatter/tags record (imports, legacy notes carry these instead).
	const properties = normalizeMetadataEntries(
		input.properties ??
			parsedSource?.properties ?? {
				...(input.frontmatter ?? {}),
				...(input.tags && input.tags.length ? { tags: input.tags } : {})
			}
	);
	const base: NotePage = {
		version: NOTES_PAGE_VERSION,
		editor: NOTES_EDITOR,
		id,
		slug: normalizePageSlug(input.slug || DEFAULT_NOTE_SLUG),
		title: normalizePageTitle(input.title || getFirstLevelOneHeadingText(sourceContent)),
		tags: normalizePageTags(input.tags),
		properties,
		markdown: '',
		content: sourceContent,
		createdAt: normalizeDate(input.createdAt) || now,
		updatedAt: normalizeDate(input.updatedAt) || now
	};
	const metadata = resolveNotePageMetadata(base, sourceContent);
	const content = normalizePageBody(
		sourceContent,
		metadata.title,
		metadata.frontmatter?.description
	);

	const page = {
		...base,
		slug: metadata.slug,
		title: metadata.title,
		tags: metadata.tags,
		...(metadata.frontmatter ? { frontmatter: metadata.frontmatter } : {}),
		content,
		createdAt: metadata.createdAt
	};
	const canonicalPage = {
		...page,
		properties: createCanonicalProperties(page)
	};

	return {
		...canonicalPage,
		markdown: createCanonicalMarkdownSource(canonicalPage)
	};
}

export function createDefaultNotePage(legacyNote?: NotesDocV1 | null): NotePage {
	const content = legacyNote?.content ?? createInitialNotePageContent();
	const updatedAt = legacyNote?.updatedAt ?? new Date().toISOString();

	return createNotePage({
		id: DEFAULT_NOTE_ID,
		slug: DEFAULT_NOTE_SLUG,
		title: getFirstLevelOneHeadingText(content) || 'Default',
		content,
		createdAt: updatedAt,
		updatedAt
	});
}

export function createPageId() {
	return `page_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

export function getNoteStorageKey(noteId = 'default') {
	return `${NOTES_STORAGE_KEY_PREFIX}:${noteId || 'default'}`;
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

export function parseStoredNote(value: unknown): NotesDocV1 | null {
	if (!value || typeof value !== 'object') return null;

	const note = value as Partial<NotesDocV1>;

	if (
		note.version !== NOTES_DOC_VERSION ||
		note.editor !== LEGACY_NOTES_EDITOR ||
		typeof note.updatedAt !== 'string' ||
		!isJSONContent(note.content)
	) {
		return null;
	}

	return {
		version: NOTES_DOC_VERSION,
		editor: LEGACY_NOTES_EDITOR,
		content: note.content,
		updatedAt: note.updatedAt
	};
}

export function parseStoredPage(value: unknown): NotePage | null {
	if (!value || typeof value !== 'object') return null;

	const page = value as {
		version?: number;
		editor?: string;
		id?: string;
		slug?: string;
		title?: string;
		tags?: string[];
		properties?: MetadataEntry[];
		frontmatter?: NotePageFrontmatter;
		markdown?: string;
		content?: JSONContent;
		createdAt?: string;
		updatedAt?: string;
	};

	if (!hasStoredPageEnvelope(page)) return null;

	if (
		page.version === NOTES_PAGE_VERSION &&
		page.editor === NOTES_EDITOR &&
		typeof page.markdown === 'string'
	) {
		try {
			const parsed = parseCanonicalMarkdownSource(page.markdown);
			return createNotePage({
				id: page.id,
				slug: page.slug,
				title: page.title,
				tags: page.tags,
				properties: parsed.properties,
				frontmatter: metadataPropertiesToNotePageFrontmatter(
					metadataEntriesToRecord(parsed.properties)
				),
				content: parsed.content,
				createdAt: page.createdAt,
				updatedAt: page.updatedAt
			});
		} catch {
			return null;
		}
	}

	if (page.version !== 1 || page.editor !== LEGACY_NOTES_EDITOR || !isJSONContent(page.content)) {
		return null;
	}

	const frontmatter = normalizeNotePageFrontmatter(page.frontmatter);
	const title = normalizePageTitle(page.title);
	// Migrate legacy records that stored metadata as a leading `metadataBlock`
	// node: lift its properties to page state and strip it from the content.
	// New records already carry `properties`; fall back to stored frontmatter/
	// tags when neither is present.
	const legacyEntries = extractLegacyMetadataEntries(page.content);
	const properties = Array.isArray(page.properties)
		? normalizeMetadataEntries(page.properties)
		: legacyEntries && legacyEntries.length
			? legacyEntries
			: normalizeMetadataEntries({
					...(frontmatter ?? {}),
					...(page.tags && page.tags.length ? { tags: normalizePageTags(page.tags) } : {})
				});

	return createNotePage({
		id: page.id,
		slug: normalizePageSlug(page.slug),
		title,
		tags: normalizePageTags(page.tags),
		properties,
		...(frontmatter ? { frontmatter } : {}),
		content: normalizePageBody(
			stripLegacyMetadataBlocks(page.content),
			title,
			frontmatter?.description
		),
		createdAt: page.createdAt,
		updatedAt: page.updatedAt
	});
}

export function toStoredNotePage(page: NotePage): StoredNotePage {
	return {
		version: page.version,
		editor: page.editor,
		id: page.id,
		slug: page.slug,
		title: page.title,
		tags: page.tags,
		properties: page.properties,
		...(page.frontmatter ? { frontmatter: page.frontmatter } : {}),
		markdown: page.markdown,
		createdAt: page.createdAt,
		updatedAt: page.updatedAt
	};
}

export function getReferencedAssetIds(content: JSONContent) {
	const ids = new Set<string>();

	visitContent(content, (node) => {
		if (node.type === 'mediaBlock') {
			const assetId = typeof node.attrs?.assetId === 'string' ? node.attrs.assetId.trim() : '';
			if (assetId) ids.add(assetId);
			return;
		}

		// Component embeds may reference stored assets anywhere in their
		// props (e.g. the image carousel's slides).
		if (node.type === 'componentEmbed') {
			collectLocalAssetIds(node.attrs?.props, ids);
		}
	});

	return [...ids];
}

function collectLocalAssetIds(value: unknown, ids: Set<string>) {
	if (typeof value === 'string') {
		const assetId = getLocalAssetId(value);
		if (assetId) ids.add(assetId);
		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) collectLocalAssetIds(item, ids);
		return;
	}

	if (value && typeof value === 'object') {
		for (const item of Object.values(value)) collectLocalAssetIds(item, ids);
	}
}

export function getContentText(content: JSONContent) {
	const parts: string[] = [];

	visitContent(content, (node) => {
		if (node.text) parts.push(node.text);
	});

	return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function getFirstLevelOneHeadingText(content: JSONContent) {
	let title = '';

	visitContent(content, (node) => {
		if (title || node.type !== 'heading' || Number(node.attrs?.level) !== 1) return;

		title = getNodeText(node);
	});

	return title.trim().replace(/\s+/g, ' ');
}

export function resolveNotePageMetadata(
	page: NotePage,
	_content: JSONContent,
	patch: NotePageMetadataPatch = {}
): Pick<NotePage, 'title' | 'slug' | 'tags' | 'createdAt'> & {
	frontmatter?: NotePageFrontmatter;
} {
	// Page-level properties and the page envelope own metadata. Body headings
	// are ordinary content and must never rename the document during a save.
	const propertiesFrontmatter = metadataPropertiesToNotePageFrontmatter(
		metadataEntriesToRecord(normalizeMetadataEntries(page.properties))
	);
	const frontmatter = normalizeNotePageFrontmatter({ ...propertiesFrontmatter, ...patch });
	const title = normalizePageTitle(frontmatter?.title || page.title);
	const slug = normalizePageSlug(frontmatter?.slug || title || page.slug);
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

const LEGACY_METADATA_BLOCK_NAME = 'metadataBlock';

// Legacy notes stored metadata as a leading `metadataBlock` node in the doc.
// Lift its properties out to page state (the first non-empty one wins).
function extractLegacyMetadataEntries(content: JSONContent): MetadataEntry[] | undefined {
	let entries: MetadataEntry[] | undefined;

	visitContent(content, (node) => {
		if ((entries && entries.length) || node.type !== LEGACY_METADATA_BLOCK_NAME) return;

		entries = normalizeMetadataEntries(node.attrs?.properties);
	});

	return entries;
}

// Remove any `metadataBlock` node from the document at every depth. The doc
// must not be left empty once the (formerly required) leading block is gone.
function stripLegacyMetadataBlocks(content: JSONContent): JSONContent {
	if (!Array.isArray(content.content)) return content;

	const filtered = content.content
		.filter((node) => node.type !== LEGACY_METADATA_BLOCK_NAME)
		.map(stripLegacyMetadataBlocks);

	if (content.type === 'doc' && filtered.length === 0) filtered.push({ type: 'paragraph' });

	return { ...content, content: filtered };
}

export function metadataPropertiesToNotePageFrontmatter(
	value: MetadataProperties
): NotePageFrontmatter | undefined {
	const properties = normalizeMetadataProperties(value);
	const frontmatter: NotePageFrontmatter = {};
	const title =
		typeof properties.title === 'string' ? properties.title.trim().replace(/\s+/g, ' ') : '';
	const slug = typeof properties.slug === 'string' ? normalizePageSlug(properties.slug) : '';
	const description =
		typeof properties.description === 'string'
			? properties.description.trim().replace(/\s+/g, ' ')
			: '';
	const date = typeof properties.date === 'string' ? properties.date.trim() : '';

	if (title) frontmatter.title = title;
	if (slug) frontmatter.slug = slug;
	if (description) frontmatter.description = description;
	if (hasOwn(properties, 'tags')) frontmatter.tags = normalizePageTags(properties.tags);
	if (date) frontmatter.date = date;
	if (hasOwn(properties, 'draft')) frontmatter.draft = properties.draft === true;

	return Object.keys(frontmatter).length ? frontmatter : undefined;
}

export function normalizeNotePageFrontmatter(value: unknown): NotePageFrontmatter | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return;

	const record = value as Partial<NotePageFrontmatter>;
	const frontmatter: NotePageFrontmatter = {};
	const title = typeof record.title === 'string' ? record.title.trim().replace(/\s+/g, ' ') : '';
	const slug = typeof record.slug === 'string' ? normalizePageSlug(record.slug) : '';
	const description =
		typeof record.description === 'string' ? record.description.trim().replace(/\s+/g, ' ') : '';
	const tags = hasOwn(record, 'tags') ? normalizePageTags(record.tags) : undefined;
	const date = typeof record.date === 'string' ? record.date.trim() : '';
	const draft = hasOwn(record, 'draft') ? record.draft === true : undefined;

	if (title) frontmatter.title = title;
	if (slug) frontmatter.slug = slug;
	if (description) frontmatter.description = description;
	if (tags) frontmatter.tags = tags;
	if (date) frontmatter.date = date;
	if (draft !== undefined) frontmatter.draft = draft;

	return Object.keys(frontmatter).length ? frontmatter : undefined;
}

export function summarizeNotePage(page: NotePage): NotePageSummary {
	const text = getContentText(page.content);
	const frontmatterDate = page.frontmatter?.date?.trim() ?? '';

	return {
		id: page.id,
		slug: page.slug,
		title: page.title,
		tags: page.tags,
		date: Number.isFinite(Date.parse(frontmatterDate)) ? frontmatterDate : page.createdAt,
		createdAt: page.createdAt,
		updatedAt: page.updatedAt,
		assetCount: getReferencedAssetIds(page.content).length,
		wordCount: text ? text.split(/\s+/).length : 0
	};
}

function createInitialNotePageContent(): JSONContent {
	return EMPTY_TIPTAP_DOC;
}

function parseCanonicalMarkdownSource(markdown: string) {
	const match = markdown.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
	const body = match ? markdown.slice(match[0].length) : markdown;
	let properties: MetadataEntry[] = [];

	if (match) {
		const parsed = parseYaml(match[1] ?? '');
		if (parsed && (typeof parsed !== 'object' || Array.isArray(parsed))) {
			throw new Error('Frontmatter must be a YAML object.');
		}
		properties = normalizeMetadataEntries(parsed ?? {});
	}

	return {
		properties,
		content: markdownBodyToEditorContent(body)
	};
}

function createCanonicalMarkdownSource(page: Omit<NotePage, 'markdown'>) {
	const yaml = stringifyYaml(metadataEntriesToRecord(page.properties), {
		lineWidth: 0,
		nullStr: ''
	}).trimEnd();
	const body = editorContentToMarkdown(page.content);

	return yaml ? `---\n${yaml}\n---\n\n${body}` : body;
}

function createCanonicalProperties(page: Omit<NotePage, 'markdown'>) {
	return normalizeMetadataEntries({
		...metadataEntriesToRecord(page.properties),
		title: page.title,
		...(page.frontmatter?.slug ? { slug: page.slug } : {}),
		...(page.frontmatter?.description ? { description: page.frontmatter.description } : {}),
		tags: page.tags,
		date: page.frontmatter?.date || page.createdAt.slice(0, 10),
		...(typeof page.frontmatter?.draft === 'boolean' ? { draft: page.frontmatter.draft } : {})
	});
}

function hasStoredPageEnvelope(page: {
	id?: unknown;
	slug?: unknown;
	title?: unknown;
	createdAt?: unknown;
	updatedAt?: unknown;
}) {
	return (
		typeof page.id === 'string' &&
		typeof page.slug === 'string' &&
		typeof page.title === 'string' &&
		typeof page.createdAt === 'string' &&
		typeof page.updatedAt === 'string'
	);
}

function normalizeTag(value: unknown) {
	return String(value ?? '')
		.toLowerCase()
		.trim()
		.replace(/^#+/, '')
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function normalizeDate(value: unknown) {
	if (typeof value !== 'string') return '';

	const time = Date.parse(value);

	return Number.isFinite(time) ? new Date(time).toISOString() : '';
}

function visitContent(node: JSONContent, visit: (node: JSONContent) => void) {
	visit(node);
	node.content?.forEach((child) => visitContent(child, visit));
}

function getNodeText(node: JSONContent): string {
	if (node.text) return node.text;

	return (node.content ?? []).map(getNodeText).join('');
}

function isJSONContent(value: unknown): value is JSONContent {
	return Boolean(
		value && typeof value === 'object' && typeof (value as JSONContent).type === 'string'
	);
}

function hasOwn(record: object, key: string) {
	return Object.prototype.hasOwnProperty.call(record, key);
}
