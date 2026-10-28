import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { WorkspaceDatabase } from './workspace-db';
import { emptyWorkspace, serializeWorkspace, WORKSPACE_KEY } from './workspace-storage';
import { CATEGORY_IDS } from './category-model';

describe('local workspace database', () => {
	it('migrates legacy data once, then preserves disabled, edited and removed starters across reload', async () => {
		const store = new WorkspaceDatabase('ledgerclean-migration-test');
		const legacy = {
			...serializeWorkspace(emptyWorkspace()),
			version: 4,
			ai: { enabled: true },
			rules: [{ keyword: 'MY SHOP', categoryId: CATEGORY_IDS.Business, source: 'manual' }]
		};
		delete (legacy as Partial<typeof legacy>).starterVersion;
		let raw: string | null = JSON.stringify(legacy);
		const storage = {
			getItem: () => raw,
			removeItem: (key: string) => {
				expect(key).toBe(WORKSPACE_KEY);
				raw = null;
			}
		};
		const loaded = await store.load(storage);
		expect(loaded.rules[0].keyword).toBe('MY SHOP');
		expect(loaded.rules.some((rule) => rule.starterId === 'cafes')).toBe(true);
		expect(raw).toBeNull();
		loaded.rules = loaded.rules
			.filter((rule) => rule.starterId !== 'starbucks')
			.map((rule) =>
				rule.starterId === 'cafes' ? { ...rule, enabled: false, keyword: 'espresso' } : rule
			);
		await store.save(loaded);
		expect(await store.load(storage)).toEqual(loaded);
		expect(await store.load(storage)).not.toHaveProperty('ai');
		await store.close();
	});
	it('preserves corrupt legacy data and never replaces it with a fresh workspace', async () => {
		const store = new WorkspaceDatabase('ledgerclean-corrupt-test');
		let removed = false;
		await expect(
			store.load({
				getItem: () => '{broken',
				removeItem: () => {
					removed = true;
				}
			})
		).rejects.toThrow();
		expect(removed).toBe(false);
		const loaded = await store.load({ getItem: () => null, removeItem: () => {} });
		expect(loaded.transactions).toEqual([]);
		await store.close();
	});
	it('saves rapid successive edits in order', async () => {
		const store = new WorkspaceDatabase('ledgerclean-ordered-test');
		const first = emptyWorkspace();
		const second = { ...first, rules: [] };
		const writes = [store.save(first), store.save(second)];
		await store.flush();
		expect((await store.load({ getItem: () => null, removeItem: () => {} })).rules).toEqual([]);
		await Promise.all(writes);
		await store.close();
	});
});
