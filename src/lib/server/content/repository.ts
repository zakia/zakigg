import { createHash } from 'node:crypto';
import { readPage, type Page } from '#lib/crafts/Page.js';
import { readFrontmatter } from '#lib/editor/document/frontmatter.js';
import {
	assignTagColors,
	readTagRegistry,
	writeTagRegistry,
	type TagRegistry
} from '#lib/crafts/tags.js';
import type { TextStore } from '../storage/types';
import { getStorage } from '../storage';

export type RepositoryDocument = { page: Page; path: string; sha: string };
export type ContentRepository = {
	list(): Promise<RepositoryDocument[]>;
	tags(): Promise<TagRegistry>;
	readBySlug(slug: string): Promise<RepositoryDocument | null>;
	save(page: Page): Promise<RepositoryDocument & { tags: TagRegistry }>;
	delete(id: string): Promise<void>;
};
export type RepositoryOptions = {
	prefix?: string;
	tagsKey?: string;
	deletedKey?: string;
	seedDocuments?: RepositoryDocument[];
	seedTags?: TagRegistry;
	revalidateIntervalMs?: number;
};
let repository: ContentRepository | undefined;
export function getContentRepository() {
	return (repository ??= createContentRepository(getStorage().text, getStorage().content));
}
export function repositoryPath(id: string) {
	if (!/^[A-Za-z0-9_-]{1,180}$/.test(id)) throw new Error('Invalid document ID');
	return `content/crafts/${id}.md`;
}
export function parseRepositoryMarkdown(markdown: string, key?: string): Page {
	const parsed = readFrontmatter(markdown);
	const id = key ?? parsed.values?.id;
	if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(id))
		throw new Error('Repository Markdown must contain a valid frontmatter id or storage key');
	return readPage(markdown, { id });
}

/** Craft policy lives here once; text adapters only read and write values. */
export function createContentRepository(
	store: TextStore,
	options: RepositoryOptions = {}
): ContentRepository {
	const prefix = options.prefix ?? 'content/crafts/';
	const tagsKey = options.tagsKey ?? `${prefix}tags.json`;
	const deletedKey = options.deletedKey ?? `${prefix}deleted.json`;
	const seeds = options.seedDocuments ?? [];
	const seedTags = options.seedTags ?? {};
	let documents: RepositoryDocument[] | null = null;
	let tags: TagRegistry = {};
	let hydratedAt = 0;
	let hydration: Promise<void> | null = null;
	let writes = Promise.resolve<unknown>(undefined);
	const pathFor = (id: string) => {
		repositoryPath(id);
		return `${prefix}${id}.md`;
	};
	const document = (page: Page): RepositoryDocument => ({
		page,
		path: repositoryPath(page.id),
		sha: createHash('sha256').update(page.markdown).digest('hex')
	});
	async function readTags() {
		const raw = await store.get(tagsKey);
		return { ...seedTags, ...(raw ? readTagRegistry(raw) : {}) };
	}
	async function readDeleted(): Promise<string[]> {
		const raw = await store.get(deletedKey);
		if (!raw) return [];
		const value: unknown = JSON.parse(raw);
		return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
	}
	async function hydrate() {
		const [keys, currentTags, deleted] = await Promise.all([
			store.list(prefix),
			readTags(),
			readDeleted()
		]);
		const byId = new Map(seeds.map((doc) => [doc.page.id, doc]));
		const loaded = await Promise.all(
			keys
				.filter(
					(key) =>
						key.startsWith(prefix) && key.endsWith('.md') && !key.slice(prefix.length).includes('/')
				)
				.map(async (key) => {
					const source = await store.get(key);
					if (source === null) return null;
					const id = key.slice(prefix.length).replace(/\.md$/, '');
					return document(parseRepositoryMarkdown(source, id));
				})
		);
		for (const doc of loaded) if (doc) byId.set(doc.page.id, doc);

		documents = [...byId.values()].filter((doc) => !deleted.includes(doc.page.id));
		tags = currentTags;
		hydratedAt = Date.now();
	}
	async function ensure() {
		if (documents && Date.now() - hydratedAt <= (options.revalidateIntervalMs ?? 60_000)) return;
		hydration ??= hydrate().finally(() => {
			hydration = null;
		});
		await hydration;
	}
	function serialized<T>(operation: () => Promise<T>): Promise<T> {
		const result = writes.then(operation);
		writes = result.catch(() => {});
		return result;
	}
	return {
		async list() {
			await ensure();
			return [...documents!];
		},
		async tags() {
			await ensure();
			return { ...tags };
		},
		async readBySlug(slug) {
			await ensure();
			return documents!.find((doc) => doc.page.slug === slug) ?? null;
		},
		save(page) {
			return serialized(async () => {
				const currentTags = await readTags();
				const nextTags = assignTagColors(currentTags, page.tags);
				const deleted = await readDeleted();
				await store.put(pathFor(page.id), page.markdown);
				if (writeTagRegistry(nextTags) !== writeTagRegistry(currentTags))
					await store.put(tagsKey, writeTagRegistry(nextTags));
				if (deleted.includes(page.id))
					await store.put(deletedKey, JSON.stringify(deleted.filter((id) => id !== page.id)));
				const saved = document(readPage(page.markdown, { id: page.id }));
				if (documents) documents = [...documents.filter((doc) => doc.page.id !== page.id), saved];
				tags = nextTags;
				hydratedAt = Date.now();
				return { ...saved, tags: { ...tags } };
			});
		},
		delete(id) {
			return serialized(async () => {
				await store.delete(pathFor(id));
				if (seeds.some((doc) => doc.page.id === id))
					await store.put(deletedKey, JSON.stringify([...new Set([...(await readDeleted()), id])]));
				if (documents) documents = documents.filter((doc) => doc.page.id !== id);
			});
		}
	};
}
