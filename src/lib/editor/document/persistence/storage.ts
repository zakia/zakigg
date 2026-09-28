import { browser } from '$app/environment';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
	DEFAULT_SLUG,
	createPage,
	readPage,
	createPageId,
	getReferencedAssetIds,
	normalizePageSlug,
	parseStoredPage,
	summarizePage,
	toStoredPage,
	type Page,
	type PageSummary,
	type StoredPage
} from '../../Page';
import { type MetadataProperties } from '../metadata';
import { updateFrontmatterValue } from '../../features/frontmatter/source';

const DB_NAME = 'zaki.gg-notes';
const DB_VERSION = 8;
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
	recovery: { key: string; value: StoredPage };
	pages: {
		key: string;
		value: StoredPage & { gitMarkdown?: string };
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
		const pending = migrateStoredPagesToMarkdownV3();
		initializedPromise = pending;
		void pending.catch(() => {
			if (initializedPromise === pending) initializedPromise = null;
		});
	}
	return initializedPromise;
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
		const raw = storedPage as Partial<Page> & { id?: unknown; markdown?: unknown };
		if (typeof raw.id !== 'string') continue;
		if (typeof raw.markdown !== 'string') {
			await pages.delete(raw.id);
			continue;
		}

		const page = readPage(raw.markdown, {
			...createPage({ id: raw.id, title: raw.title || 'Untitled' }),
			...raw
		} as Page);
		const slug = await getAvailablePageSlugInStore(pages, page.slug, page.id);
		await pages.put(toStoredPage({ ...page, slug }), page.id);
	}
	await tx.done;
}

export async function listPages(): Promise<PageSummary[]> {
	if (!browser) return [];
	const pages = await listFullPages();
	return pages.map(summarizePage).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function listFullPages(): Promise<Page[]> {
	if (!browser) return [];
	await initializeNotesDb();
	const db = await getDb();
	return (await db.getAll(PAGES_STORE_NAME))
		.map(parseStoredPage)
		.filter(isPage)
		.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function loadPageBySlug(slug: string): Promise<Page | null> {
	if (!browser) return null;
	await initializeNotesDb();
	const db = await getDb();
	const stored = await db.getFromIndex(PAGES_STORE_NAME, 'by-slug', normalizePageSlug(slug));
	const page = parseStoredPage(stored);
	if (page && page.markdown !== stored?.gitMarkdown) return page;
	const recovery = page
		? parseStoredPage(await db.get('recovery', page.id))
		: (await db.getAll('recovery'))
				.map(parseStoredPage)
				.find((entry) => entry?.slug === normalizePageSlug(slug));
	return recovery ?? page;
}

export async function loadPageById(id: string): Promise<Page | null> {
	if (!browser || !id) return null;
	await initializeNotesDb();
	const db = await getDb();
	return parseStoredPage(await db.get(PAGES_STORE_NAME, id));
}

export async function createPageRecord(
	properties: MetadataProperties = {},
	body = ''
): Promise<Page> {
	if (!browser) throw new Error('Notes are only available in the browser');
	await initializeNotesDb();
	const base = createPage(properties, body);
	const page = withCanonicalSlug(base, await getAvailablePageSlug(base.slug, base.id));
	await putPage(page);
	return page;
}

/** Keep a differing browser copy available before caching the repository baseline. */
export async function openRepositoryPage(page: Page): Promise<Page | null> {
	await initializeNotesDb();
	const db = await getDb();
	const tx = db.transaction(['pages', 'recovery'], 'readwrite');
	const stored = await tx.objectStore('pages').get(page.id);
	const current = parseStoredPage(stored);
	if (current && current.markdown !== page.markdown && current.markdown !== stored?.gitMarkdown) {
		await tx.objectStore('recovery').put(toStoredPage(current), page.id);
	}
	// Slugs are navigation metadata, not document identity. Repository IDs are authoritative.
	await tx.objectStore('pages').put({ ...toStoredPage(page), gitMarkdown: page.markdown }, page.id);
	const recovery = parseStoredPage(await tx.objectStore('recovery').get(page.id));
	await tx.done;
	return recovery && recovery.markdown !== page.markdown ? recovery : null;
}

/** New and changed browser documents, excluding unchanged repository caches. */
export async function listLocalPages(): Promise<PageSummary[]> {
	await initializeNotesDb();
	const db = await getDb();
	const pages = (await db.getAll('pages'))
		.filter((page) => page.markdown !== page.gitMarkdown)
		.map(parseStoredPage)
		.filter(isPage);
	const recovery = (await db.getAll('recovery')).map(parseStoredPage).filter(isPage);
	const local = new Map(recovery.map((page) => [page.id, page]));
	for (const page of pages) local.set(page.id, page);
	return [...local.values()].map(summarizePage);
}

export async function markRepositorySaved(page: Page) {
	const db = await getDb();
	const tx = db.transaction('pages', 'readwrite');
	const current = await tx.store.get(page.id);
	await tx.store.put({ ...(current ?? toStoredPage(page)), gitMarkdown: page.markdown }, page.id);
	await tx.done;
}

export async function clearRecovery(id: string) {
	const db = await getDb();
	await db.delete('recovery', id);
}

export async function importPage(input: Page): Promise<Page> {
	if (!browser) throw new Error('Notes are only available in the browser');
	await initializeNotesDb();
	const id = createPageId();
	const change = updateFrontmatterValue(input.markdown, 'id', id);
	if (!change) throw new Error('Imported Markdown must have valid frontmatter.');
	const markdown =
		input.markdown.slice(0, change.from) + change.insert + input.markdown.slice(change.to);
	const base = readPage(markdown, { ...input, id });
	const page = withCanonicalSlug(base, await getAvailablePageSlug(base.slug));
	await putPage(page);
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

export async function savePage(page: Page): Promise<Page> {
	if (!browser) throw new Error('Notes are only available in the browser');
	await initializeNotesDb();
	const next = { ...readPage(page.markdown, page), updatedAt: new Date().toISOString() };
	await putPage(next);
	await attachAssetsToPage(next.id, getReferencedAssetIds(next.markdown));
	return next;
}

export async function deletePage(pageId: string): Promise<void> {
	if (!browser || !pageId) return;
	await initializeNotesDb();
	const db = await getDb();
	await db.delete(PAGES_STORE_NAME, pageId);
	await db.delete('recovery', pageId);
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
	const [pages, assets] = await Promise.all([listFullPages(), listNoteAssets()]);
	const db = await getDb();
	const recovery = (await db.getAll('recovery')).map(parseStoredPage).filter(isPage);
	const referencedIds = new Set(
		[...pages, ...recovery].flatMap((page) => getReferencedAssetIds(page.markdown))
	);
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
	const baseSlug = normalizePageSlug(value || DEFAULT_SLUG);
	let slug = baseSlug;
	let suffix = 2;
	while (await pageSlugExists(slug, currentPageId)) {
		slug = `${baseSlug}-${suffix}`;
		suffix += 1;
	}
	return slug;
}

async function pageSlugExists(slug: string, currentPageId = '') {
	const db = await getDb();
	const page = await db.getFromIndex(PAGES_STORE_NAME, 'by-slug', slug);
	return Boolean(page && page.id !== currentPageId);
}

type PageStore = {
	index(name: 'by-slug'): { get(key: string): Promise<StoredPage | undefined> };
};

async function getAvailablePageSlugInStore(store: PageStore, value: unknown, currentPageId = '') {
	const baseSlug = normalizePageSlug(value || DEFAULT_SLUG);
	let slug = baseSlug;
	let suffix = 2;
	while (true) {
		const existing = await store.index('by-slug').get(slug);
		if (!existing || existing.id === currentPageId) return slug;
		slug = `${baseSlug}-${suffix}`;
		suffix += 1;
	}
}

function withCanonicalSlug(page: Page, slug: string) {
	if (page.slug === slug) return page;
	const change = updateFrontmatterValue(page.markdown, 'slug', slug);
	const markdown = change
		? `${page.markdown.slice(0, change.from)}${change.insert}${page.markdown.slice(change.to)}`
		: page.markdown;
	return readPage(markdown, { ...page, slug });
}

async function putPage(page: Page) {
	const db = await getDb();
	const tx = db.transaction('pages', 'readwrite');
	const current = await tx.store.get(page.id);
	await tx.store.put(
		{
			...toStoredPage(page),
			...(current?.gitMarkdown !== undefined ? { gitMarkdown: current.gitMarkdown } : {})
		},
		page.id
	);
	await tx.done;
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
		upgrade(db, _oldVersion, _newVersion, transaction) {
			if (!db.objectStoreNames.contains('recovery')) db.createObjectStore('recovery');
			const rawDb = db as unknown as IDBDatabase;
			for (const legacyStore of ['documents', 'syncState', 'tombstones', 'syncMeta']) {
				if (rawDb.objectStoreNames.contains(legacyStore)) rawDb.deleteObjectStore(legacyStore);
			}
			if (!db.objectStoreNames.contains(PAGES_STORE_NAME)) {
				const store = db.createObjectStore(PAGES_STORE_NAME);
				store.createIndex('by-slug', 'slug');
				store.createIndex('by-title', 'title');
				store.createIndex('by-updated-at', 'updatedAt');
				store.createIndex('by-tag', 'tags', { multiEntry: true });
			} else {
				const store = transaction.objectStore('pages');
				store.deleteIndex('by-slug');
				store.createIndex('by-slug', 'slug');
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

function isPage(page: Page | null): page is Page {
	return Boolean(page);
}

function isNoteAsset(asset: NotesAssetV1 | null): asset is NotesAssetV1 {
	return Boolean(asset);
}

function createAssetId() {
	return `asset_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}
