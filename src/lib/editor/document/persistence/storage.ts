import { browser } from '$app/environment';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
	DEFAULT_NOTE_SLUG,
	createDefaultNotePage,
	createNotePage,
	getReferencedAssetIds,
	normalizePageSlug,
	parseStoredPage,
	summarizeNotePage,
	toStoredNotePage,
	type NotePage,
	type NotePageSummary,
	type StoredNotePage
} from '../model';
import { normalizeMetadataEntries } from '../metadata';

const DB_NAME = 'zaki.gg-notes';
const NOTES_INITIALIZED_FLAG_KEY = 'zaki.gg:notes:markdown-v3:initialized';
const REPOSITORY_SNAPSHOT_SEEDED_FLAG_KEY = 'zaki.gg:notes:repository-snapshot-v1:seeded';
const DB_VERSION = 7;
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
	pages: {
		key: string;
		value: StoredNotePage;
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

export class NotesDatabaseBlockedError extends Error {
	constructor() {
		super('Another tab is preventing the local crafts database from being upgraded.');
		this.name = 'NotesDatabaseBlockedError';
	}
}

export async function initializeNotesDb(): Promise<void> {
	if (!browser) return;
	if (!initializedPromise) {
		const pending = initializeStoredPages();
		initializedPromise = pending;
		void pending.catch(() => {
			if (initializedPromise === pending) initializedPromise = null;
		});
	}
	return initializedPromise;
}

async function initializeStoredPages() {
	await migrateStoredPagesToMarkdownV3();
	await ensureDefaultPage();
}

// JSON-only legacy records are removed. Markdown is the only document model.
async function migrateStoredPagesToMarkdownV3() {
	const db = await getDb();
	const storedPages = (await db.getAll(PAGES_STORE_NAME)) as unknown[];
	const pending = storedPages.filter((page) => !parseStoredPage(page));
	if (!pending.length) return;

	const tx = db.transaction(PAGES_STORE_NAME, 'readwrite');
	const pages = tx.objectStore(PAGES_STORE_NAME);
	for (const storedPage of pending) {
		if (!storedPage || typeof storedPage !== 'object') continue;
		const raw = storedPage as Partial<NotePage> & { id?: unknown; markdown?: unknown };
		if (typeof raw.id !== 'string') continue;
		if (typeof raw.markdown !== 'string') {
			await pages.delete(raw.id);
			continue;
		}

		const page = createNotePage(raw);
		const slug = await getAvailablePageSlugInStore(pages, page.slug, page.id);
		await pages.put(toStoredNotePage({ ...page, slug }), page.id);
	}
	await tx.done;
}

export async function listNotePages(): Promise<NotePageSummary[]> {
	if (!browser) return [];
	const pages = await listFullNotePages();
	return pages
		.map(summarizeNotePage)
		.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function listFullNotePages(): Promise<NotePage[]> {
	if (!browser) return [];
	await initializeNotesDb();
	const db = await getDb();
	return (await db.getAll(PAGES_STORE_NAME))
		.map(parseStoredPage)
		.filter(isNotePage)
		.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function loadNotePageBySlug(slug: string): Promise<NotePage | null> {
	if (!browser) return null;
	await initializeNotesDb();
	const db = await getDb();
	return parseStoredPage(
		await db.getFromIndex(PAGES_STORE_NAME, 'by-slug', normalizePageSlug(slug))
	);
}

export async function loadNotePageById(id: string): Promise<NotePage | null> {
	if (!browser || !id) return null;
	await initializeNotesDb();
	const db = await getDb();
	return parseStoredPage(await db.get(PAGES_STORE_NAME, id));
}

export async function createNotePageRecord(input: Partial<NotePage> = {}): Promise<NotePage> {
	if (!browser) throw new Error('Notes are only available in the browser');
	await initializeNotesDb();
	const base = createNotePage(input);
	const page = withCanonicalSlug(base, await getAvailablePageSlug(base.slug, base.id));
	await putNotePage(page);
	return page;
}

export async function cacheRepositoryNotePage(page: NotePage): Promise<NotePage> {
	if (!browser) return page;
	await initializeNotesDb();
	const next = createNotePage(page);
	await putNotePage(next);
	return next;
}

export async function seedRepositoryNotePages(pages: NotePage[]): Promise<void> {
	if (!browser || !pages.length || !needsRepositorySnapshotSeed()) return;
	await initializeNotesDb();
	const db = await getDb();
	const tx = db.transaction(PAGES_STORE_NAME, 'readwrite');
	const store = tx.objectStore(PAGES_STORE_NAME);
	const existingIds = new Set(await store.getAllKeys());
	for (const page of pages) {
		if (existingIds.has(page.id)) continue;
		await store.put(toStoredNotePage(createNotePage(page)), page.id);
	}
	await tx.done;
	setInitializedNotesFlag();
	setRepositorySnapshotSeededFlag();
}

export function needsRepositorySnapshotSeed() {
	if (!browser) return false;
	try {
		return window.localStorage.getItem(REPOSITORY_SNAPSHOT_SEEDED_FLAG_KEY) !== 'true';
	} catch {
		return true;
	}
}

export async function replaceLocalNotePages(pages: NotePage[]): Promise<void> {
	if (!browser) return;
	await initializeNotesDb();
	const db = await getDb();
	const tx = db.transaction([PAGES_STORE_NAME, ASSETS_STORE_NAME], 'readwrite');
	await Promise.all([
		tx.objectStore(PAGES_STORE_NAME).clear(),
		tx.objectStore(ASSETS_STORE_NAME).clear()
	]);
	for (const page of pages) {
		await tx.objectStore(PAGES_STORE_NAME).put(toStoredNotePage(createNotePage(page)), page.id);
	}
	await tx.done;
	setInitializedNotesFlag();
	setRepositorySnapshotSeededFlag();
}

export async function importNotePage(input: Partial<NotePage>): Promise<NotePage> {
	if (!browser) throw new Error('Notes are only available in the browser');
	await initializeNotesDb();
	const base = createNotePage({ ...input, id: undefined });
	const page = withCanonicalSlug(base, await getAvailablePageSlug(base.slug));
	await putNotePage(page);
	await attachAssetsToPage(page.id, getReferencedAssetIds(page.markdown));
	return page;
}

export type NotesAssetImport = {
	id: string;
	blob: Blob;
	mediaType: string;
	name: string;
	size: number;
	createdAt?: string;
	updatedAt?: string;
};

export async function importNoteAsset(asset: NotesAssetImport): Promise<void> {
	if (!browser || !asset.id) return;
	await initializeNotesDb();
	const db = await getDb();
	const existing = normalizeStoredAsset(await db.get(ASSETS_STORE_NAME, asset.id));
	const now = new Date().toISOString();
	await db.put(
		ASSETS_STORE_NAME,
		{
			id: asset.id,
			blob: asset.blob,
			mediaType: asset.mediaType,
			name: asset.name,
			size: asset.size,
			pageIds: existing?.pageIds ?? [],
			createdAt: asset.createdAt ?? existing?.createdAt ?? now,
			updatedAt: asset.updatedAt ?? now
		},
		asset.id
	);
}

export async function saveNotePage(page: NotePage): Promise<NotePage> {
	if (!browser) throw new Error('Notes are only available in the browser');
	await initializeNotesDb();
	const current = await loadNotePageById(page.id);
	const base = createNotePage({
		...current,
		...page,
		id: current?.id ?? page.id,
		createdAt: page.createdAt ?? current?.createdAt,
		updatedAt: new Date().toISOString()
	});
	const next = withCanonicalSlug(base, await getAvailablePageSlug(base.slug, base.id));
	await putNotePage(next);
	await attachAssetsToPage(next.id, getReferencedAssetIds(next.markdown));
	return next;
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
	const referencedIds = new Set(pages.flatMap((page) => getReferencedAssetIds(page.markdown)));
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
	return asset ? URL.createObjectURL(asset.blob) : `/media/${encodeURIComponent(assetId)}`;
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
	if (pages.length || hasInitializedNotesFlag()) {
		setInitializedNotesFlag();
		return;
	}
	await putNotePage(createDefaultNotePage());
	setInitializedNotesFlag();
}

function hasInitializedNotesFlag() {
	try {
		return window.localStorage.getItem(NOTES_INITIALIZED_FLAG_KEY) === 'true';
	} catch {
		return false;
	}
}

function setInitializedNotesFlag() {
	try {
		window.localStorage.setItem(NOTES_INITIALIZED_FLAG_KEY, 'true');
	} catch {
		// Best effort only.
	}
}

function setRepositorySnapshotSeededFlag() {
	try {
		window.localStorage.setItem(REPOSITORY_SNAPSHOT_SEEDED_FLAG_KEY, 'true');
	} catch {
		// Best effort only.
	}
}

async function pageSlugExists(slug: string, currentPageId = '') {
	const db = await getDb();
	const page = await db.getFromIndex(PAGES_STORE_NAME, 'by-slug', slug);
	return Boolean(page && page.id !== currentPageId);
}

type PageStore = {
	index(name: 'by-slug'): { get(key: string): Promise<StoredNotePage | undefined> };
};

async function getAvailablePageSlugInStore(store: PageStore, value: unknown, currentPageId = '') {
	const baseSlug = normalizePageSlug(value || DEFAULT_NOTE_SLUG);
	let slug = baseSlug;
	let suffix = 2;
	while (true) {
		const existing = await store.index('by-slug').get(slug);
		if (!existing || existing.id === currentPageId) return slug;
		slug = `${baseSlug}-${suffix}`;
		suffix += 1;
	}
}

function withCanonicalSlug(page: NotePage, slug: string) {
	if (page.slug === slug) return page;
	const properties = normalizeMetadataEntries([
		...page.properties.filter((property) => property.key !== 'slug'),
		{ key: 'slug', value: slug }
	]);
	return createNotePage({
		...page,
		slug,
		properties,
		frontmatter: { ...page.frontmatter, slug }
	});
}

async function putNotePage(page: NotePage) {
	const db = await getDb();
	await db.put(PAGES_STORE_NAME, toStoredNotePage(page), page.id);
}

async function attachAssetsToPage(pageId: string, assetIds: string[]) {
	if (!assetIds.length) return;
	const db = await getDb();
	const tx = db.transaction(ASSETS_STORE_NAME, 'readwrite');
	for (const assetId of assetIds) {
		const asset = normalizeStoredAsset(await tx.store.get(assetId));
		if (!asset) continue;
		const pageIds = new Set(asset.pageIds ?? []);
		if (pageIds.has(pageId)) continue;
		pageIds.add(pageId);
		await tx.store.put(
			{ ...asset, pageIds: [...pageIds], updatedAt: new Date().toISOString() },
			asset.id
		);
	}
	await tx.done;
}

function getDb() {
	if (!dbPromise) dbPromise = openNotesDb();
	return dbPromise;
}

function openNotesDb() {
	let upgradeBlocked = false;
	let rejectBlocked!: (reason: NotesDatabaseBlockedError) => void;
	const blockedPromise = new Promise<never>((_, reject) => {
		rejectBlocked = reject;
	});
	const connectionPromise = openDB<NotesDB>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			const rawDb = db as unknown as IDBDatabase;
			for (const legacyStore of ['documents', 'syncState', 'tombstones', 'syncMeta']) {
				if (rawDb.objectStoreNames.contains(legacyStore)) rawDb.deleteObjectStore(legacyStore);
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
		},
		blocked() {
			upgradeBlocked = true;
			rejectBlocked(new NotesDatabaseBlockedError());
		},
		blocking(_currentVersion, _blockedVersion, event) {
			(event.target as IDBDatabase | null)?.close();
			dbPromise = null;
			initializedPromise = null;
		},
		terminated() {
			dbPromise = null;
			initializedPromise = null;
		}
	});
	const guardedPromise = Promise.race([connectionPromise, blockedPromise]);
	void connectionPromise
		.then((db) => {
			if (upgradeBlocked) db.close();
		})
		.catch(() => undefined);
	void guardedPromise.catch(() => {
		if (dbPromise === guardedPromise) dbPromise = null;
	});
	return guardedPromise;
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

function isNotePage(page: NotePage | null): page is NotePage {
	return Boolean(page);
}

function isNoteAsset(asset: NotesAssetV1 | null): asset is NotesAssetV1 {
	return Boolean(asset);
}

function createAssetId() {
	return `asset_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}
