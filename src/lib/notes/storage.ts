import { browser } from '$app/environment';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { DEFAULT_NOTE_ID, getNoteStorageKey, parseStoredNote, type NotesDocV1 } from './types';

const DB_NAME = 'zaki.gg-notes';
const DB_VERSION = 2;
const DOCUMENTS_STORE_NAME = 'documents';
const ASSETS_STORE_NAME = 'assets';

export type NotesAssetV1 = {
	id: string;
	blob: Blob;
	mediaType: string;
	name: string;
	size: number;
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

export async function loadDefaultNote(): Promise<NotesDocV1 | null> {
	return loadNote(DEFAULT_NOTE_ID);
}

export async function saveDefaultNote(note: NotesDocV1): Promise<void> {
	return saveNote(DEFAULT_NOTE_ID, note);
}

export async function clearDefaultNote(): Promise<void> {
	return clearNote(DEFAULT_NOTE_ID);
}

export async function loadNote(noteId: string): Promise<NotesDocV1 | null> {
	if (!browser) return null;

	const storageKey = getNoteStorageKey(noteId);
	const [indexedDbNote, localStorageNote] = await Promise.all([
		loadFromIndexedDb(storageKey).catch(() => null),
		Promise.resolve(loadFromLocalStorage(storageKey))
	]);

	return newestNote(indexedDbNote, localStorageNote);
}

export async function saveNote(noteId: string, note: NotesDocV1): Promise<void> {
	if (!browser) return;

	const storageKey = getNoteStorageKey(noteId);

	saveToLocalStorage(storageKey, note);

	const db = await getDb();
	await db.put(DOCUMENTS_STORE_NAME, note, storageKey);
}

export async function clearNote(noteId: string): Promise<void> {
	if (!browser) return;

	const storageKey = getNoteStorageKey(noteId);

	window.localStorage.removeItem(storageKey);

	const db = await getDb();
	await db.delete(DOCUMENTS_STORE_NAME, storageKey);
}

export async function saveNoteAsset(file: File): Promise<NotesAssetV1> {
	if (!browser) throw new Error('Asset storage is only available in the browser');

	const now = new Date().toISOString();
	const asset: NotesAssetV1 = {
		id: createAssetId(),
		blob: file,
		mediaType: file.type,
		name: file.name,
		size: file.size,
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

	return (await db.get(ASSETS_STORE_NAME, assetId)) ?? null;
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

async function loadFromIndexedDb(storageKey: string): Promise<NotesDocV1 | null> {
	const db = await getDb();
	return parseStoredNote(await db.get(DOCUMENTS_STORE_NAME, storageKey));
}

function loadFromLocalStorage(storageKey: string): NotesDocV1 | null {
	try {
		const value = window.localStorage.getItem(storageKey);
		if (!value) return null;
		return parseStoredNote(JSON.parse(value));
	} catch {
		return null;
	}
}

function saveToLocalStorage(storageKey: string, note: NotesDocV1) {
	try {
		window.localStorage.setItem(storageKey, JSON.stringify(note));
	} catch {
		// IndexedDB remains the primary store; localStorage is only a best-effort backup.
	}
}

function newestNote(a: NotesDocV1 | null, b: NotesDocV1 | null): NotesDocV1 | null {
	if (!a) return b;
	if (!b) return a;

	return Date.parse(a.updatedAt) >= Date.parse(b.updatedAt) ? a : b;
}

function getDb() {
	dbPromise ??= openDB<NotesDB>(DB_NAME, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(DOCUMENTS_STORE_NAME)) {
				const store = db.createObjectStore(DOCUMENTS_STORE_NAME);
				store.createIndex('by-updated-at', 'updatedAt');
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

function createAssetId() {
	return `asset_${crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}
