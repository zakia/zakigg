import { browser } from '$app/environment';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { emitLocalMutation } from './sync/signals';
import {
	DEFAULT_NOTE_SLUG,
	NOTES_STORAGE_KEY_PREFIX,
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
const NOTES_INITIALIZED_FLAG_KEY = `${NOTES_STORAGE_KEY_PREFIX}:initialized`;
const DB_VERSION = 4;
const LEGACY_DOCUMENTS_STORE_NAME = 'documents';
const PAGES_STORE_NAME = 'pages';
const ASSETS_STORE_NAME = 'assets';
const SYNC_STATE_STORE_NAME = 'syncState';
const TOMBSTONES_STORE_NAME = 'tombstones';
const SYNC_META_STORE_NAME = 'syncMeta';
const SYNC_CHECKPOINT_KEY = 'checkpoint';

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

export type SyncKind = 'page' | 'asset';

// Sync bookkeeping lives in sidecar stores rather than on the records
// themselves: parseStoredPage/normalizeStoredAsset whitelist fields, so any
// extra fields written onto records would be stripped on the next round-trip.
export type SyncStateRow = {
	id: string;
	kind: SyncKind;
	dirty: boolean;
	mutationId: string;
	// The record's updatedAt at the moment the server last acknowledged it.
	lastSyncedAt?: string;
};

export type SyncTombstone = {
	id: string;
	kind: SyncKind;
	deletedAt: string;
	mutationId: string;
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
	syncState: {
		key: string;
		value: SyncStateRow;
	};
	tombstones: {
		key: string;
		value: SyncTombstone;
	};
	syncMeta: {
		key: string;
		value: { lastPulledAt: string };
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

	// createNotePage re-derives the slug from the title/content, so dedupe the
	// resolved slug afterwards rather than the input — otherwise two notes that
	// resolve to the same slug (e.g. two "Untitled" notes) collide on the
	// unique by-slug index.
	const base = createNotePage(input);
	const page: NotePageV1 = { ...base, slug: await getAvailablePageSlug(base.slug, base.id) };

	await putNotePage(page);

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

export async function importNotePage(input: Partial<NotePageV1>): Promise<NotePageV1> {
	if (!browser) throw new Error('Notes are only available in the browser');

	await initializeNotesDb();

	const base = createNotePage({ ...input, id: undefined });
	const page: NotePageV1 = { ...base, slug: await getAvailablePageSlug(base.slug) };

	await putNotePage(page);
	await attachAssetsToPage(page.id, getReferencedAssetIds(page.content));

	return page;
}

export async function importNoteAsset(asset: NotesAssetImport): Promise<void> {
	if (!browser || !asset.id) return;

	await initializeNotesDb();

	const db = await getDb();
	const existing = normalizeStoredAsset(await db.get(ASSETS_STORE_NAME, asset.id));
	const now = new Date().toISOString();
	const tx = db.transaction([ASSETS_STORE_NAME, SYNC_STATE_STORE_NAME], 'readwrite');

	await tx.objectStore(ASSETS_STORE_NAME).put(
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
	await markDirtyInTx(tx.objectStore(SYNC_STATE_STORE_NAME), asset.id, 'asset');
	await tx.done;

	emitLocalMutation();
}

export async function saveNotePage(page: NotePageV1): Promise<NotePageV1> {
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
	// Dedupe the slug createNotePage resolved (it re-derives from title/content),
	// excluding this page, so distinct notes never collide on the unique index.
	const next: NotePageV1 = { ...base, slug: await getAvailablePageSlug(base.slug, base.id) };

	await putNotePage(next);
	await attachAssetsToPage(next.id, getReferencedAssetIds(next.content));

	return next;
}

export async function deleteNotePage(pageId: string): Promise<void> {
	if (!browser || !pageId) return;

	await initializeNotesDb();

	const db = await getDb();
	const tx = db.transaction(
		[PAGES_STORE_NAME, SYNC_STATE_STORE_NAME, TOMBSTONES_STORE_NAME],
		'readwrite'
	);
	const existed = (await tx.objectStore(PAGES_STORE_NAME).getKey(pageId)) !== undefined;

	await tx.objectStore(PAGES_STORE_NAME).delete(pageId);
	await tx.objectStore(SYNC_STATE_STORE_NAME).delete(pageId);
	if (existed) {
		const deletedAt = new Date().toISOString();
		await tx
			.objectStore(TOMBSTONES_STORE_NAME)
			.put({ id: pageId, kind: 'page', deletedAt, mutationId: createMutationId() }, pageId);
	}
	await tx.done;

	if (existed) emitLocalMutation();
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
	const tx = db.transaction([ASSETS_STORE_NAME, SYNC_STATE_STORE_NAME], 'readwrite');

	await tx.objectStore(ASSETS_STORE_NAME).put(asset, asset.id);
	await markDirtyInTx(tx.objectStore(SYNC_STATE_STORE_NAME), asset.id, 'asset');
	await tx.done;

	emitLocalMutation();

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
	const tx = db.transaction(
		[ASSETS_STORE_NAME, SYNC_STATE_STORE_NAME, TOMBSTONES_STORE_NAME],
		'readwrite'
	);
	const existed = (await tx.objectStore(ASSETS_STORE_NAME).getKey(assetId)) !== undefined;

	await tx.objectStore(ASSETS_STORE_NAME).delete(assetId);
	await tx.objectStore(SYNC_STATE_STORE_NAME).delete(assetId);
	if (existed) {
		const deletedAt = new Date().toISOString();
		await tx
			.objectStore(TOMBSTONES_STORE_NAME)
			.put({ id: assetId, kind: 'asset', deletedAt, mutationId: createMutationId() }, assetId);
	}
	await tx.done;

	if (existed) emitLocalMutation();
}

export async function resolveNoteAssetObjectUrl(assetId: string) {
	const asset = await loadNoteAsset(assetId);

	if (!asset) return null;

	return URL.createObjectURL(asset.blob);
}

// --- Sync support -----------------------------------------------------------
// Remote-apply functions write records without marking them dirty and without
// bumping updatedAt, so pulled changes never re-push. Everything else here is
// the queue/checkpoint plumbing the sync engine consumes.

export async function applyRemotePage(page: NotePageV1, mutationId: string): Promise<void> {
	if (!browser) return;

	const db = await getDb();
	const tx = db.transaction(
		[PAGES_STORE_NAME, SYNC_STATE_STORE_NAME, TOMBSTONES_STORE_NAME],
		'readwrite'
	);

	await tx.objectStore(PAGES_STORE_NAME).put(page, page.id);
	await tx
		.objectStore(SYNC_STATE_STORE_NAME)
		.put(
			{ id: page.id, kind: 'page', dirty: false, mutationId, lastSyncedAt: page.updatedAt },
			page.id
		);
	await tx.objectStore(TOMBSTONES_STORE_NAME).delete(page.id);
	await tx.done;
}

export async function applyRemoteAssetMeta(
	asset: Omit<NotesAssetV1, 'blob'>,
	mutationId: string,
	blob?: Blob
): Promise<void> {
	if (!browser) return;

	const db = await getDb();
	const existing = normalizeStoredAsset(await db.get(ASSETS_STORE_NAME, asset.id));
	const nextBlob = blob ?? existing?.blob;

	// Without a blob (local or downloaded) there is nothing usable to store.
	if (!nextBlob) return;

	const tx = db.transaction(
		[ASSETS_STORE_NAME, SYNC_STATE_STORE_NAME, TOMBSTONES_STORE_NAME],
		'readwrite'
	);

	await tx.objectStore(ASSETS_STORE_NAME).put({ ...asset, blob: nextBlob }, asset.id);
	await tx
		.objectStore(SYNC_STATE_STORE_NAME)
		.put(
			{ id: asset.id, kind: 'asset', dirty: false, mutationId, lastSyncedAt: asset.updatedAt },
			asset.id
		);
	await tx.objectStore(TOMBSTONES_STORE_NAME).delete(asset.id);
	await tx.done;
}

export async function applyRemoteDelete(id: string, kind: SyncKind): Promise<void> {
	if (!browser) return;

	const recordStore = kind === 'page' ? PAGES_STORE_NAME : ASSETS_STORE_NAME;
	const db = await getDb();
	const tx = db.transaction(
		[recordStore, SYNC_STATE_STORE_NAME, TOMBSTONES_STORE_NAME],
		'readwrite'
	);

	await tx.objectStore(recordStore).delete(id);
	await tx.objectStore(SYNC_STATE_STORE_NAME).delete(id);
	await tx.objectStore(TOMBSTONES_STORE_NAME).delete(id);
	await tx.done;
}

export async function getDirtySyncRecords(): Promise<{
	pages: NotePageV1[];
	assets: NotesAssetV1[];
}> {
	if (!browser) return { pages: [], assets: [] };

	const db = await getDb();
	const rows = (await db.getAll(SYNC_STATE_STORE_NAME)).filter((row) => row.dirty);
	const pages: NotePageV1[] = [];
	const assets: NotesAssetV1[] = [];

	for (const row of rows) {
		if (row.kind === 'page') {
			const page = parseStoredPage(await db.get(PAGES_STORE_NAME, row.id));
			if (page) pages.push(page);
		} else {
			const asset = normalizeStoredAsset(await db.get(ASSETS_STORE_NAME, row.id));
			if (asset) assets.push(asset);
		}
	}

	return { pages, assets };
}

export async function listSyncTombstones(): Promise<SyncTombstone[]> {
	if (!browser) return [];

	const db = await getDb();

	return db.getAll(TOMBSTONES_STORE_NAME);
}

export async function hasPendingSyncWork(): Promise<boolean> {
	if (!browser) return false;

	const db = await getDb();
	const [states, tombstoneCount] = await Promise.all([
		db.getAll(SYNC_STATE_STORE_NAME),
		db.count(TOMBSTONES_STORE_NAME)
	]);

	return tombstoneCount > 0 || states.some((row) => row.dirty);
}

// Clears the dirty flag only if the record hasn't changed since it was pushed,
// so an edit made while a push was in flight is never lost.
export async function clearDirtyFlag(
	id: string,
	kind: SyncKind,
	pushedMutationId: string
): Promise<void> {
	if (!browser) return;

	const recordStore = kind === 'page' ? PAGES_STORE_NAME : ASSETS_STORE_NAME;
	const db = await getDb();
	const tx = db.transaction([recordStore, SYNC_STATE_STORE_NAME], 'readwrite');
	const record = (await tx.objectStore(recordStore).get(id)) as { updatedAt?: string } | undefined;
	const state = await tx.objectStore(SYNC_STATE_STORE_NAME).get(id);

	if (record?.updatedAt && state?.mutationId === pushedMutationId) {
		await tx
			.objectStore(SYNC_STATE_STORE_NAME)
			.put({ ...state, id, kind, dirty: false, lastSyncedAt: record.updatedAt }, id);
	}

	await tx.done;
}

export async function getSyncStateRow(id: string): Promise<SyncStateRow | null> {
	if (!browser) return null;

	const db = await getDb();

	return (await db.get(SYNC_STATE_STORE_NAME, id)) ?? null;
}

export async function getSyncTombstone(id: string): Promise<SyncTombstone | null> {
	if (!browser) return null;

	const db = await getDb();

	return (await db.get(TOMBSTONES_STORE_NAME, id)) ?? null;
}

// Queue a record for push without touching the record itself (used when pull
// application locally modifies a pulled record, e.g. slug dedupe).
export async function markRecordDirty(id: string, kind: SyncKind): Promise<void> {
	if (!browser) return;

	const db = await getDb();
	const tx = db.transaction(SYNC_STATE_STORE_NAME, 'readwrite');

	await markDirtyInTx(tx.store, id, kind);
	await tx.done;

	emitLocalMutation();
}

export async function removeSyncTombstone(id: string): Promise<void> {
	if (!browser) return;

	const db = await getDb();
	await db.delete(TOMBSTONES_STORE_NAME, id);
}

export async function getSyncCheckpoint(): Promise<string | null> {
	if (!browser) return null;

	const db = await getDb();
	const meta = await db.get(SYNC_META_STORE_NAME, SYNC_CHECKPOINT_KEY);

	return meta?.lastPulledAt ?? null;
}

export async function setSyncCheckpoint(lastPulledAt: string): Promise<void> {
	if (!browser) return;

	const db = await getDb();
	await db.put(SYNC_META_STORE_NAME, { lastPulledAt }, SYNC_CHECKPOINT_KEY);
}

// First sign-in on a device with pre-existing notes: queue everything so the
// initial sync behaves like a normal push.
export async function markAllRecordsDirty(): Promise<void> {
	if (!browser) return;

	const db = await getDb();
	const [pageIds, assetIds] = await Promise.all([
		db.getAllKeys(PAGES_STORE_NAME),
		db.getAllKeys(ASSETS_STORE_NAME)
	]);
	const tx = db.transaction(SYNC_STATE_STORE_NAME, 'readwrite');

	for (const id of pageIds) await markDirtyInTx(tx.store, id, 'page');
	for (const id of assetIds) await markDirtyInTx(tx.store, id, 'asset');

	await tx.done;
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

// One-shot: seeds the default page (migrating any legacy single note) only on
// first ever run. An empty pages store after that means the user deleted
// their pages — recreating the default here would resurrect deleted content.
async function ensureDefaultPage() {
	const db = await getDb();
	const pages = await db.getAllKeys(PAGES_STORE_NAME);

	if (pages.length || hasInitializedNotesFlag()) {
		setInitializedNotesFlag();
		return;
	}

	const legacyNote = newestNote(
		await loadLegacyDefaultNoteFromIndexedDb(),
		loadLegacyDefaultNoteFromLocalStorage()
	);

	await putNotePage(createDefaultNotePage(legacyNote));
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
		// Storage may be unavailable (private mode); worst case the default
		// page is recreated once the store is empty again.
	}
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
	const tx = db.transaction([PAGES_STORE_NAME, SYNC_STATE_STORE_NAME], 'readwrite');

	await tx.objectStore(PAGES_STORE_NAME).put(page, page.id);
	await markDirtyInTx(tx.objectStore(SYNC_STATE_STORE_NAME), page.id, 'page');
	await tx.done;

	emitLocalMutation();
}

type SyncStateWritableStore = {
	get(key: string): Promise<SyncStateRow | undefined>;
	put(value: SyncStateRow, key: string): Promise<unknown>;
};

async function markDirtyInTx(store: SyncStateWritableStore, id: string, kind: SyncKind) {
	const existing = await store.get(id);

	await store.put(
		{
			id,
			kind,
			dirty: true,
			mutationId: createMutationId(),
			lastSyncedAt: existing?.lastSyncedAt
		},
		id
	);
}

async function attachAssetsToPage(pageId: string, assetIds: string[]) {
	if (!assetIds.length) return;

	const db = await getDb();
	const tx = db.transaction([ASSETS_STORE_NAME, SYNC_STATE_STORE_NAME], 'readwrite');
	const assetsStore = tx.objectStore(ASSETS_STORE_NAME);
	const syncStore = tx.objectStore(SYNC_STATE_STORE_NAME);
	let mutated = false;

	await Promise.all(
		assetIds.map(async (assetId) => {
			const asset = normalizeStoredAsset(await assetsStore.get(assetId));
			if (!asset) return;

			const pageIds = new Set(asset.pageIds ?? []);
			if (pageIds.has(pageId)) return;
			pageIds.add(pageId);
			mutated = true;

			await assetsStore.put(
				{
					...asset,
					pageIds: [...pageIds],
					updatedAt: new Date().toISOString()
				},
				asset.id
			);
			await markDirtyInTx(syncStore, asset.id, 'asset');
		})
	);

	await tx.done;

	if (mutated) emitLocalMutation();
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

			if (!db.objectStoreNames.contains(SYNC_STATE_STORE_NAME)) {
				db.createObjectStore(SYNC_STATE_STORE_NAME);
			}

			if (!db.objectStoreNames.contains(TOMBSTONES_STORE_NAME)) {
				db.createObjectStore(TOMBSTONES_STORE_NAME);
			}

			if (!db.objectStoreNames.contains(SYNC_META_STORE_NAME)) {
				db.createObjectStore(SYNC_META_STORE_NAME);
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

function createMutationId() {
	return `mutation_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}
