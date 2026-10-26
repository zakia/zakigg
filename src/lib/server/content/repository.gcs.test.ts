import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createPage } from '#lib/editor/Page.js';
import {
	createGcsContentRepository,
	type GcsObjectStore,
	type GcsStoredObject
} from './repository.gcs';

function createMemoryGcsStore(
	initial: Record<string, string> = {},
	options: { failNextWriteWith412?: boolean } = {}
) {
	const objects = new Map<string, GcsStoredObject>();
	let nextGeneration = 1;

	for (const [path, content] of Object.entries(initial)) {
		objects.set(path, { content, generation: nextGeneration++ });
	}

	const store: GcsObjectStore = {
		listMarkdownPaths: vi.fn(async () =>
			[...objects.keys()].filter((path) => path.endsWith('.md')).sort()
		),
		readObject: vi.fn(async (path: string) => objects.get(path) ?? null),
		writeObject: vi.fn(
			async (
				path: string,
				content: string,
				_contentType: string,
				ifGenerationMatch?: string | number
			) => {
				if (options.failNextWriteWith412 && path.endsWith('.md')) {
					options.failNextWriteWith412 = false;
					const err = Object.assign(new Error('Precondition Failed'), { code: 412 });
					throw err;
				}
				const current = objects.get(path);
				if (ifGenerationMatch !== undefined) {
					const currentGen = current ? current.generation : 0;
					if (currentGen !== ifGenerationMatch) {
						const err = Object.assign(new Error('Precondition Failed'), { code: 412 });
						throw err;
					}
				}
				objects.set(path, { content, generation: nextGeneration++ });
			}
		),
		deleteObject: vi.fn(async (path: string) => {
			objects.delete(path);
		})
	};

	return { store, objects };
}

function sha256(content: string) {
	return createHash('sha256').update(content).digest('hex');
}

describe('In-memory KV + GCS content repository', () => {
	it('rejects stale content before overwriting any GCS objects', async () => {
		const newerPage = createPage({ id: 'page_stale', title: 'Newer' }, 'Newer body');
		const { store } = createMemoryGcsStore({
			[`content/crafts/${newerPage.id}.md`]: newerPage.markdown
		});
		const repo = createGcsContentRepository({ store });

		await expect(
			repo.save(createPage({ id: 'page_stale', title: 'Stale' }, 'Stale body'), 'old-sha')
		).rejects.toThrow('Git changed');
		expect(store.writeObject).not.toHaveBeenCalled();
	});

	it('converts concurrent GCS precondition failures (412) into RepositoryConflict', async () => {
		const page = createPage({ id: 'page_race', tags: ['new'] }, 'Body');
		const { store } = createMemoryGcsStore(
			{
				[`content/crafts/${page.id}.md`]: page.markdown
			},
			{ failNextWriteWith412: true }
		);
		const repo = createGcsContentRepository({ store });

		await expect(repo.save(page, sha256(page.markdown))).rejects.toThrow('Git changed');
	});

	it('persists the document and new tag assignments and serves subsequent reads from memory', async () => {
		const existingPage = createPage({ id: 'page_1', published: true, tags: ['existing'] }, 'Old');
		const { store, objects } = createMemoryGcsStore({
			[`content/crafts/${existingPage.id}.md`]: existingPage.markdown,
			'content/crafts/tags.json': JSON.stringify({ existing: 'blue', unused: 'violet' })
		});
		const repo = createGcsContentRepository({ store, revalidateIntervalMs: 60_000 });

		// Hydrate in-memory KV cache
		expect(await repo.list()).toHaveLength(1);
		const readsAfterHydrate = vi.mocked(store.readObject).mock.calls.length;

		// Subsequent reads come straight from RAM with zero GCS calls
		expect((await repo.readBySlug(existingPage.slug))?.page.id).toBe('page_1');
		expect(await repo.tags()).toEqual({ existing: 'blue', unused: 'violet' });
		expect(vi.mocked(store.readObject).mock.calls.length).toBe(readsAfterHydrate);

		// Save updated page with a new tag
		const updatedPage = createPage(
			{ id: 'page_1', slug: 'updated-slug', published: true, tags: ['existing', 'new'] },
			'Updated body'
		);
		const result = await repo.save(updatedPage, sha256(existingPage.markdown));

		expect(result.sha).toBe(sha256(updatedPage.markdown));
		expect(result.tags).toEqual({
			existing: 'blue',
			unused: 'violet',
			new: 'rose'
		});
		expect(objects.get(`content/crafts/${updatedPage.id}.md`)?.content).toBe(updatedPage.markdown);

		// In-memory KV index reflects the new slug immediately without another hydration
		const readsAfterSave = vi.mocked(store.readObject).mock.calls.length;
		expect(await repo.readBySlug(existingPage.slug)).toBeNull();
		expect((await repo.readBySlug('updated-slug'))?.page.markdown).toBe(updatedPage.markdown);
		expect(vi.mocked(store.readObject).mock.calls.length).toBe(readsAfterSave);
	});

	it('skips writing tags.json when all tags already have colors', async () => {
		const { store } = createMemoryGcsStore({
			'content/crafts/tags.json': JSON.stringify({ existing: 'blue' })
		});
		const repo = createGcsContentRepository({ store });
		const page = createPage({ id: 'page_new', tags: ['existing'] }, 'Body');

		await repo.save(page, null);
		expect(store.writeObject).toHaveBeenCalledTimes(1);
		expect(store.writeObject).toHaveBeenCalledWith(
			`content/crafts/${page.id}.md`,
			page.markdown,
			'text/markdown; charset=utf-8',
			0
		);
	});

	it('merges bundled seed documents with GCS edits and deletions across rehydrations', async () => {
		const seedOne = createPage({ id: 'seed_1', slug: 'seed-1', published: true }, 'Seed 1');
		const seedTwo = createPage({ id: 'seed_2', slug: 'seed-2', published: true }, 'Seed 2');
		const seedDocuments = [
			{ page: seedOne, path: 'content/crafts/seed_1.md', sha: sha256(seedOne.markdown) },
			{ page: seedTwo, path: 'content/crafts/seed_2.md', sha: sha256(seedTwo.markdown) }
		];
		const { store } = createMemoryGcsStore();
		const repo = createGcsContentRepository({
			store,
			seedDocuments,
			seedTags: { design: 'blue' }
		});

		expect((await repo.list()).map((doc) => doc.page.id)).toEqual(['seed_1', 'seed_2']);

		// Edit seed_1 in production for the first time
		const editedSeedOne = createPage(
			{ id: 'seed_1', slug: 'seed-1-edited', published: true, tags: ['design'] },
			'Edited seed 1'
		);
		await repo.save(editedSeedOne, sha256(seedOne.markdown));

		// Delete seed_2 in production
		await repo.delete('seed_2');

		// Simulate a fresh container boot reading from the same GCS store + seed bundle
		const rebootedRepo = createGcsContentRepository({
			store,
			seedDocuments,
			seedTags: { design: 'blue' }
		});
		const rebootedDocs = await rebootedRepo.list();
		expect(rebootedDocs.map((doc) => doc.page.id)).toEqual(['seed_1']);
		expect(rebootedDocs[0]?.page.slug).toBe('seed-1-edited');
		expect(rebootedDocs[0]?.page.markdown).toBe(editedSeedOne.markdown);
	});
});
