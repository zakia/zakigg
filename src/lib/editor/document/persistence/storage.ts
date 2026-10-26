import { browser } from '$app/env';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'zaki.gg-notes';
const DB_VERSION = 8;
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

export class NotesDatabaseBlockedError extends Error {
	constructor() {
		super('Another tab is preventing the local crafts database from being upgraded.');
		this.name = 'NotesDatabaseBlockedError';
	}
}

export async function initializeNotesDb(): Promise<void> {
	if (!browser) return;
	await getDb();
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

export async function deleteNoteAsset(assetId: string): Promise<void> {
	if (!browser || !assetId) return;
	const db = await getDb();
	await db.delete(ASSETS_STORE_NAME, assetId);
}

export async function resolveNoteAssetObjectUrl(assetId: string) {
	const asset = await loadNoteAsset(assetId);
	return asset ? URL.createObjectURL(asset.blob) : `/media/${encodeURIComponent(assetId)}`;
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
			for (const legacyStore of [
				'documents',
				'syncState',
				'tombstones',
				'syncMeta',
				'pages',
				'recovery'
			]) {
				if (rawDb.objectStoreNames.contains(legacyStore)) rawDb.deleteObjectStore(legacyStore);
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
		},
		terminated() {
			dbPromise = null;
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

function createAssetId() {
	return `asset_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}
