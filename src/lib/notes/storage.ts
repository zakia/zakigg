import { browser } from '$app/environment';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { NOTES_STORAGE_KEY, parseStoredNote, type NotesDocV1 } from './types';

const DB_NAME = 'zaki.gg-notes';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

interface NotesDB extends DBSchema {
	documents: {
		key: string;
		value: NotesDocV1;
		indexes: {
			'by-updated-at': string;
		};
	};
}

let dbPromise: Promise<IDBPDatabase<NotesDB>> | null = null;

export async function loadDefaultNote(): Promise<NotesDocV1 | null> {
	if (!browser) return null;

	const [indexedDbNote, localStorageNote] = await Promise.all([
		loadFromIndexedDb().catch(() => null),
		Promise.resolve(loadFromLocalStorage())
	]);

	return newestNote(indexedDbNote, localStorageNote);
}

export async function saveDefaultNote(note: NotesDocV1): Promise<void> {
	if (!browser) return;

	saveToLocalStorage(note);

	const db = await getDb();
	await db.put(STORE_NAME, note, NOTES_STORAGE_KEY);
}

export async function clearDefaultNote(): Promise<void> {
	if (!browser) return;

	window.localStorage.removeItem(NOTES_STORAGE_KEY);

	const db = await getDb();
	await db.delete(STORE_NAME, NOTES_STORAGE_KEY);
}

async function loadFromIndexedDb(): Promise<NotesDocV1 | null> {
	const db = await getDb();
	return parseStoredNote(await db.get(STORE_NAME, NOTES_STORAGE_KEY));
}

function loadFromLocalStorage(): NotesDocV1 | null {
	try {
		const value = window.localStorage.getItem(NOTES_STORAGE_KEY);
		if (!value) return null;
		return parseStoredNote(JSON.parse(value));
	} catch {
		return null;
	}
}

function saveToLocalStorage(note: NotesDocV1) {
	try {
		window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(note));
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
			const store = db.createObjectStore(STORE_NAME);
			store.createIndex('by-updated-at', 'updatedAt');
		}
	});

	return dbPromise;
}
