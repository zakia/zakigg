import { browser } from '$app/environment';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
	DEFAULT_NOTE_SLUG,
	createDefaultNotePage,
	createNotePage,
	getNoteStorageKey,
	getReferencedAssetIds,
	normalizePageSlug,
	parseStoredNote,
	parseStoredPage,
	summarizeNotePage,
	type NotePageSummary,
	type NotePageV1,
	type NotesDocV1
} from './types';

const DB_NAME = 'zaki.gg-notes';
const DB_VERSION = 3;
const LEGACY_DOCUMENTS_STORE_NAME = 'documents';
const PAGES_STORE_NAME = 'pages';
const ASSETS_STORE_NAME = 'assets';

export type NotesAssetV1 = {
	id: string;
	blob: Blob;
	mediaType: string;
	name: string;
	size: number;
	pageIds?: string[];
	createdAt: string;
	updatedAt: string;
};

interface NotesDB extends DBSchema {
	documents: {
		key: string;
		value: NotesDocV1;
		indexes: {
			'by-updated-at': string;
		};
	};
	pages: {
		key: string;
		value: NotePageV1;
		indexes: {
			'by-slug': string;
			'by-title': string;
			'by-updated-at': string;
			'by-tag': string;
		};
	};
	assets: {
		key: string;
		value: NotesAssetV1;
		indexes: {
			'by-created-at': string;
			'by-updated-at': string;
		};
	};
}

let dbPromise: Promise<IDBPDatabase<NotesDB>> | null = null;
let initializedPromise: Promise<void> | null = null;

export async function initializeNotesDb(): Promise<void> {
	if (!browser) return;

	initializedPromise ??= ensureDefaultPage();

	return initializedPromise;
}

export async function listNotePages(): Promise<NotePageSummary[]> {
	if (!browser) return [];

	await initializeNotesDb();

	const db = await getDb();
	const pages = (await db.getAll(PAGES_STORE_NAME)).map(parseStoredPage).filter(isNotePage);

	return pages
		.map(summarizeNotePage)
		.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function listFullNotePages(): Promise<NotePageV1[]> {
	if (!browser) return [];

	await initializeNotesDb();

	const db = await getDb();
	const pages = (await db.getAll(PAGES_STORE_NAME)).map(parseStoredPage).filter(isNotePage);

	return pages.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function loadNotePageBySlug(slug: string): Promise<NotePageV1 | null> {
	if (!browser) return null;

	await initializeNotesDb();

	const db = await getDb();
	const page = await db.getFromIndex(PAGES_STORE_NAME, 'by-slug', normalizePageSlug(slug));

	return parseStoredPage(page);
}

export async function loadNotePageById(id: string): Promise<NotePageV1 | null> {
	if (!browser || !id) return null;

	await initializeNotesDb();

	const db = await getDb();

	return parseStoredPage(await db.get(PAGES_STORE_NAME, id));
}

export async function createNotePageRecord(input: Partial<NotePageV1> = {}): Promise<NotePageV1> {
	if (!browser) throw new Error('Notes are only available in the browser');

	await initializeNotesDb();

	const page = createNotePage({
		...input,
		slug: await getAvailablePageSlug(input.slug || input.title)
	});

	await putNotePage(page);

	return page;
}

export async function saveNotePage(page: NotePageV1): Promise<NotePageV1> {
	if (!browser) throw new Error('Notes are only available in the browser');

	await initializeNotesDb();

	const current = await loadNotePageById(page.id);
	const next = createNotePage({
		...current,
		...page,
		id: current?.id ?? page.id,
		createdAt: current?.createdAt ?? page.createdAt,
		slug: await getAvailablePageSlug(page.slug, page.id),
		updatedAt: new Date().toISOString()
	});

	await putNotePage(next);
	await attachAssetsToPage(next.id, getReferencedAssetIds(next.content));

	return next;
}

export async function updateNotePageMetadata(
	pageId: string,
	metadata: Pick<Partial<NotePageV1>, 'title' | 'slug' | 'tags'>
) {
	const page = await loadNotePageById(pageId);

	if (!page) throw new Error('Note page not found');

	return saveNotePage({
		...page,
		...metadata,
		content: page.content
	});
}

export async function duplicateNotePage(pageId: string) {
	const page = await loadNotePageById(pageId);

	if (!page) throw new Error('Note page not found');

	return createNotePageRecord({
		title: `${page.title} Copy`,
		slug: `${page.slug}-copy`,
		tags: page.tags,
		content: page.content
	});
}

export async function deleteNotePage(pageId: string): Promise<void> {
	if (!browser || !pageId) return;

	await initializeNotesDb();

	const db = await getDb();
	await db.delete(PAGES_STORE_NAME, pageId);
}

export async function saveNoteAsset(file: File, pageId?: string): Promise<NotesAssetV1> {
	if (!browser) throw new Error('Asset storage is only available in the browser');

	const now = new Date().toISOString();
	const asset: NotesAssetV1 = {
		id: createAssetId(),
		blob: file,
		mediaType: file.type,
		name: file.name,
		size: file.size,
		pageIds: pageId ? [pageId] : [],
		createdAt: now,
		updatedAt: now
	};
	const db = await getDb();

	await db.put(ASSETS_STORE_NAME, asset, asset.id);

	return asset;
}

export async function loadNoteAsset(assetId: string): Promise<NotesAssetV1 | null> {
	if (!browser || !assetId) return null;

	const db = await getDb();

	return normalizeStoredAsset(await db.get(ASSETS_STORE_NAME, assetId));
}

export async function listNoteAssets(): Promise<NotesAssetV1[]> {
	if (!browser) return [];

	const db = await getDb();

	return (await db.getAll(ASSETS_STORE_NAME))
		.map(normalizeStoredAsset)
		.filter(isNoteAsset)
		.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function listOrphanNoteAssets() {
	const [pages, assets] = await Promise.all([listFullNotePages(), listNoteAssets()]);
	const referencedIds = new Set(pages.flatMap((page) => getReferencedAssetIds(page.content)));

	return assets.filter((asset) => !referencedIds.has(asset.id));
}

export async function deleteOrphanNoteAssets() {
	const orphans = await listOrphanNoteAssets();

	await Promise.all(orphans.map((asset) => deleteNoteAsset(asset.id)));

	return orphans.length;
}

export async function deleteNoteAsset(assetId: string): Promise<void> {
	if (!browser || !assetId) return;

	const db = await getDb();
	await db.delete(ASSETS_STORE_NAME, assetId);
}

export async function resolveNoteAssetObjectUrl(assetId: string) {
	const asset = await loadNoteAsset(assetId);

	if (!asset) return null;

	return URL.createObjectURL(asset.blob);
}

export async function getAvailablePageSlug(value: unknown, currentPageId = '') {
	const baseSlug = normalizePageSlug(value || DEFAULT_NOTE_SLUG);
	let slug = baseSlug;
	let suffix = 2;

	while (await pageSlugExists(slug, currentPageId)) {
		slug = `${baseSlug}-${suffix}`;
		suffix += 1;
	}

	return slug;
}

async function ensureDefaultPage() {
	const db = await getDb();
	const pages = await db.getAllKeys(PAGES_STORE_NAME);

	if (pages.length) return;

	const legacyNote = newestNote(
		await loadLegacyDefaultNoteFromIndexedDb(),
		loadLegacyDefaultNoteFromLocalStorage()
	);

	await putNotePage(createDefaultNotePage(legacyNote));
}

async function loadLegacyDefaultNoteFromIndexedDb() {
	const db = await getDb();

	if (!db.objectStoreNames.contains(LEGACY_DOCUMENTS_STORE_NAME)) return null;

	return parseStoredNote(await db.get(LEGACY_DOCUMENTS_STORE_NAME, getNoteStorageKey('default')));
}

function loadLegacyDefaultNoteFromLocalStorage(): NotesDocV1 | null {
	try {
		const value = window.localStorage.getItem(getNoteStorageKey('default'));
		if (!value) return null;
		return parseStoredNote(JSON.parse(value));
	} catch {
		return null;
	}
}

async function pageSlugExists(slug: string, currentPageId = '') {
	const db = await getDb();
	const page = parseStoredPage(await db.getFromIndex(PAGES_STORE_NAME, 'by-slug', slug));

	return Boolean(page && page.id !== currentPageId);
}

async function putNotePage(page: NotePageV1) {
	const db = await getDb();
	await db.put(PAGES_STORE_NAME, page, page.id);
}

async function attachAssetsToPage(pageId: string, assetIds: string[]) {
	if (!assetIds.length) return;

	const db = await getDb();
	const tx = db.transaction(ASSETS_STORE_NAME, 'readwrite');

	await Promise.all(
		assetIds.map(async (assetId) => {
			const asset = normalizeStoredAsset(await tx.store.get(assetId));
			if (!asset) return;

			const pageIds = new Set(asset.pageIds ?? []);
			pageIds.add(pageId);

			await tx.store.put(
				{
					...asset,
					pageIds: [...pageIds],
					updatedAt: new Date().toISOString()
				},
				asset.id
			);
		})
	);

	await tx.done;
}

function getDb() {
	dbPromise ??= openDB<NotesDB>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(LEGACY_DOCUMENTS_STORE_NAME)) {
				const store = db.createObjectStore(LEGACY_DOCUMENTS_STORE_NAME);
				store.createIndex('by-updated-at', 'updatedAt');
			}

			if (!db.objectStoreNames.contains(PAGES_STORE_NAME)) {
				const store = db.createObjectStore(PAGES_STORE_NAME);
				store.createIndex('by-slug', 'slug', { unique: true });
				store.createIndex('by-title', 'title');
				store.createIndex('by-updated-at', 'updatedAt');
				store.createIndex('by-tag', 'tags', { multiEntry: true });
			}

			if (!db.objectStoreNames.contains(ASSETS_STORE_NAME)) {
				const store = db.createObjectStore(ASSETS_STORE_NAME);
				store.createIndex('by-created-at', 'createdAt');
				store.createIndex('by-updated-at', 'updatedAt');
			}
		}
	});

	return dbPromise;
}

function normalizeStoredAsset(value: unknown): NotesAssetV1 | null {
	if (!value || typeof value !== 'object') return null;

	const asset = value as Partial<NotesAssetV1>;

	if (
		typeof asset.id !== 'string' ||
		!(asset.blob instanceof Blob) ||
		typeof asset.mediaType !== 'string' ||
		typeof asset.name !== 'string' ||
		typeof asset.size !== 'number' ||
		typeof asset.createdAt !== 'string' ||
		typeof asset.updatedAt !== 'string'
	) {
		return null;
	}

	return {
		id: asset.id,
		blob: asset.blob,
		mediaType: asset.mediaType,
		name: asset.name,
		size: asset.size,
		pageIds: Array.isArray(asset.pageIds)
			? asset.pageIds.filter((pageId): pageId is string => typeof pageId === 'string')
			: [],
		createdAt: asset.createdAt,
		updatedAt: asset.updatedAt
	};
}

function newestNote(a: NotesDocV1 | null, b: NotesDocV1 | null): NotesDocV1 | null {
	if (!a) return b;
	if (!b) return a;

	return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
}

function isNotePage(page: NotePageV1 | null): page is NotePageV1 {
	return Boolean(page);
}

function isNoteAsset(asset: NotesAssetV1 | null): asset is NotesAssetV1 {
	return Boolean(asset);
}

function createAssetId() {
	return `asset_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}
