import type { JSONContent } from '@tiptap/core';
import {
	getMetadataBlockProperties,
	normalizeMetadataProperties,
	slugifyText,
	type MetadataProperties
} from './metadata-block';

export const NOTES_DOC_VERSION = 1;
export const NOTES_PAGE_VERSION = 1;
export const NOTES_EDITOR = 'tiptap';
export const DEFAULT_NOTE_SLUG = 'default';
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
	editor: typeof NOTES_EDITOR;
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

export type NotePageV1 = {
	version: typeof NOTES_PAGE_VERSION;
	editor: typeof NOTES_EDITOR;
	id: string;
	slug: string;
	title: string;
	tags: string[];
	frontmatter?: NotePageFrontmatter;
	content: JSONContent;
	createdAt: string;
	updatedAt: string;
};

export type NotePageSummary = Pick<
	NotePageV1,
	'id' | 'slug' | 'title' | 'tags' | 'createdAt' | 'updatedAt'
> & {
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
		editor: NOTES_EDITOR,
		content,
		updatedAt
	};
}

export function createNotePage(input: Partial<NotePageV1> = {}): NotePageV1 {
	const now = new Date().toISOString();
	const id = input.id || createPageId();
	const content =
		input.content && isJSONContent(input.content)
			? input.content
			: createInitialNotePageContent(input.title);
	const metadata = resolveNotePageMetadata(
		{
			version: NOTES_PAGE_VERSION,
			editor: NOTES_EDITOR,
			id,
			slug: normalizePageSlug(input.slug || DEFAULT_NOTE_SLUG),
			title: normalizePageTitle(input.title || getFirstLevelOneHeadingText(content)),
			tags: normalizePageTags(input.tags),
			frontmatter: normalizeNotePageFrontmatter(input.frontmatter),
			content,
			createdAt: normalizeDate(input.createdAt) || now,
			updatedAt: normalizeDate(input.updatedAt) || now
		},
		content
	);

	return {
		version: NOTES_PAGE_VERSION,
		editor: NOTES_EDITOR,
		id,
		slug: metadata.slug,
		title: metadata.title,
		tags: metadata.tags,
		...(metadata.frontmatter ? { frontmatter: metadata.frontmatter } : {}),
		content,
		createdAt: metadata.createdAt,
		updatedAt: normalizeDate(input.updatedAt) || now
	};
}

export function createDefaultNotePage(legacyNote?: NotesDocV1 | null): NotePageV1 {
	const content = legacyNote?.content ?? createInitialNotePageContent('Default');
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
	return slugifyText(value) || DEFAULT_NOTE_SLUG;
}

export function titleFromSlug(slug: string) {
	const title = normalizePageSlug(slug)
		.split('-')
		.filter(Boolean)
		.map((word) => word[0]?.toUpperCase() + word.slice(1))
		.join(' ');

	return title || 'Untitled';
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
		note.editor !== NOTES_EDITOR ||
		typeof note.updatedAt !== 'string' ||
		!isJSONContent(note.content)
	) {
		return null;
	}

	return {
		version: NOTES_DOC_VERSION,
		editor: NOTES_EDITOR,
		content: note.content,
		updatedAt: note.updatedAt
	};
}

export function parseStoredPage(value: unknown): NotePageV1 | null {
	if (!value || typeof value !== 'object') return null;

	const page = value as Partial<NotePageV1>;

	if (
		page.version !== NOTES_PAGE_VERSION ||
		page.editor !== NOTES_EDITOR ||
		typeof page.id !== 'string' ||
		typeof page.slug !== 'string' ||
		typeof page.title !== 'string' ||
		typeof page.createdAt !== 'string' ||
		typeof page.updatedAt !== 'string' ||
		!isJSONContent(page.content)
	) {
		return null;
	}

	const frontmatter = normalizeNotePageFrontmatter(page.frontmatter);

	return {
		version: NOTES_PAGE_VERSION,
		editor: NOTES_EDITOR,
		id: page.id,
		slug: normalizePageSlug(page.slug),
		title: normalizePageTitle(page.title),
		tags: normalizePageTags(page.tags),
		...(frontmatter ? { frontmatter } : {}),
		content: page.content,
		createdAt: page.createdAt,
		updatedAt: page.updatedAt
	};
}

export function getReferencedAssetIds(content: JSONContent) {
	const ids = new Set<string>();

	visitContent(content, (node) => {
		if (node.type !== 'mediaBlock') return;

		const assetId = typeof node.attrs?.assetId === 'string' ? node.attrs.assetId.trim() : '';
		if (assetId) ids.add(assetId);
	});

	return [...ids];
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
	page: NotePageV1,
	content: JSONContent,
	patch: NotePageMetadataPatch = {}
): Pick<NotePageV1, 'title' | 'slug' | 'tags' | 'createdAt'> & {
	frontmatter?: NotePageFrontmatter;
} {
	const metadataBlockFrontmatter = getNotePageMetadataBlockFrontmatter(content);
	const metadataBlockIsSource = metadataBlockFrontmatter.hasMetadataBlock;
	const frontmatter = normalizeNotePageFrontmatter({
		...(metadataBlockIsSource ? metadataBlockFrontmatter.frontmatter : page.frontmatter),
		...patch
	});
	const firstHeadingTitle = getFirstLevelOneHeadingText(content);
	const title = normalizePageTitle(frontmatter?.title || firstHeadingTitle || page.title);
	const slug = normalizePageSlug(frontmatter?.slug || title || page.slug);
	const createdAt = frontmatter?.date ? normalizeDate(frontmatter.date) : page.createdAt;
	const tags = metadataBlockIsSource ? (frontmatter?.tags ?? []) : (frontmatter?.tags ?? page.tags);

	return {
		title,
		slug,
		tags: normalizePageTags(tags),
		createdAt: createdAt || page.createdAt,
		...(frontmatter ? { frontmatter } : {})
	};
}

export function getNotePageMetadataBlockFrontmatter(content: JSONContent): {
	hasMetadataBlock: boolean;
	frontmatter?: NotePageFrontmatter;
} {
	const properties = getMetadataBlockProperties(content);

	return {
		hasMetadataBlock: Boolean(properties),
		frontmatter: properties ? metadataPropertiesToNotePageFrontmatter(properties) : undefined
	};
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

export function summarizeNotePage(page: NotePageV1): NotePageSummary {
	const text = getContentText(page.content);

	return {
		id: page.id,
		slug: page.slug,
		title: page.title,
		tags: page.tags,
		createdAt: page.createdAt,
		updatedAt: page.updatedAt,
		assetCount: getReferencedAssetIds(page.content).length,
		wordCount: text ? text.split(/\s+/).length : 0
	};
}

function createInitialNotePageContent(title: unknown): JSONContent {
	const normalizedTitle = typeof title === 'string' ? title.trim().replace(/\s+/g, ' ') : '';

	if (!normalizedTitle) return EMPTY_TIPTAP_DOC;

	return {
		type: 'doc',
		content: [
			{
				type: 'heading',
				attrs: { level: 1 },
				content: [{ type: 'text', text: normalizedTitle }]
			},
			{
				type: 'paragraph'
			}
		]
	};
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
