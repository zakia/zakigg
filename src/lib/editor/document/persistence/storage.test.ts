import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openDBMock } = vi.hoisted(() => ({ openDBMock: vi.fn() }));

vi.mock('$app/environment', () => ({ browser: true }));
vi.mock('idb', () => ({ openDB: openDBMock }));

describe('notes database initialization', () => {
	beforeEach(() => {
		vi.resetModules();
		openDBMock.mockReset();
	});

	it('rejects with a recoverable error when an older tab blocks the upgrade', async () => {
		openDBMock.mockImplementation((_name, _version, options) => {
			options.blocked?.(5, 6, new Event('blocked'));
			return new Promise(() => undefined);
		});

		const { initializeNotesDb, NotesDatabaseBlockedError } = await import('./storage');

		await expect(initializeNotesDb()).rejects.toBeInstanceOf(NotesDatabaseBlockedError);
	});

	it('clears records and sync sidecars without creating deletion tombstones', async () => {
		const clearedStores: string[] = [];
		openDBMock.mockResolvedValue({
			transaction: (storeNames: string[]) => ({
				objectStore: (name: string) => ({
					clear: async () => {
						clearedStores.push(name);
					}
				}),
				done: Promise.resolve(),
				storeNames
			})
		});

		const { clearLocalNotesForCloudRestore } = await import('./storage');

		await clearLocalNotesForCloudRestore();
		expect(clearedStores).toEqual(['pages', 'assets', 'syncState', 'tombstones', 'syncMeta']);
	});
});
