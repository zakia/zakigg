import { describe, expect, it } from 'vitest';
import { createPage, readPage } from '#lib/crafts/Page.js';
import { createContentRepository } from './repository';
import type { TextStore } from '../storage/types';

function memory() {
	const values = new Map<string, string>();
	const store: TextStore = {
		async get(key) {
			return values.get(key) ?? null;
		},
		async put(key, value) {
			values.set(key, value);
		},
		async list(prefix) {
			return [...values.keys()].filter((key) => key.startsWith(prefix)).sort();
		},
		async delete(key) {
			values.delete(key);
		}
	};
	return store;
}
describe('Craft policy through the text-store seam', () => {
	it('updates slug lookup and retains tag colors across reloads', async () => {
		const store = memory();
		const repo = createContentRepository(store);
		const original = createPage({ id: 'page_one', slug: 'before', tags: ['one'] }, 'Original');
		await repo.save(original);
		await repo.list();
		const next = readPage(original.markdown.replace('slug: before', 'slug: after'), original);
		const saved = await repo.save(next);
		expect(await repo.readBySlug('before')).toBeNull();
		expect((await repo.readBySlug('after'))?.page.markdown).toBe(next.markdown);
		const reopened = createContentRepository(store);
		expect((await reopened.readBySlug('after'))?.page.markdown).toBe(next.markdown);
		expect(await reopened.tags()).toEqual(saved.tags);
	});
	it('preserves bundled content edits and deletions across container restarts', async () => {
		const store = memory();
		const seed = createPage({ id: 'page_seed', published: true }, 'Bundled');
		const seedDocuments = [{ page: seed, path: 'content/crafts/page_seed.md', sha: 'seed' }];
		const repo = createContentRepository(store, { seedDocuments });
		expect(await repo.list()).toHaveLength(1);
		await repo.save(readPage(seed.markdown + '\nEdited', seed));
		expect(
			(await createContentRepository(store, { seedDocuments }).list())[0].page.markdown
		).toContain('Edited');
		await repo.delete(seed.id);
		expect(await createContentRepository(store, { seedDocuments }).list()).toEqual([]);
		await repo.save(seed);
		expect(await createContentRepository(store, { seedDocuments }).list()).toHaveLength(1);
	});
	it('preserves previously stored content and permits retry after a failed write', async () => {
		const store = memory();
		const repo = createContentRepository(store);
		const original = createPage({ id: 'page_retry' }, 'Original');
		await repo.save(original);
		await repo.list();
		const put = store.put;
		store.put = async () => {
			throw new Error('Storage unavailable');
		};
		const next = readPage(original.markdown + '\nNew', original);
		await expect(repo.save(next)).rejects.toThrow('Storage unavailable');
		expect((await repo.readBySlug(original.slug))?.page.markdown).toBe(original.markdown);
		store.put = put;
		await repo.save(next);
		expect((await repo.readBySlug(original.slug))?.page.markdown).toBe(next.markdown);
	});
});
