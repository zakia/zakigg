import { createHash } from 'node:crypto';
import { getAssetBucket } from '#lib/server/assets/gcs.js';
import defaultTagsJson from '#lib/crafts/tags.json?raw';
import {
	assignTagColors,
	readTagRegistry,
	writeTagRegistry,
	type TagRegistry
} from '#lib/crafts/tags.js';
import type { Page } from '#lib/editor/Page.js';
import {
	RepositoryConflict,
	parseRepositoryMarkdown,
	repositoryPath,
	type ContentRepository,
	type RepositoryDocument
} from './repository';

const CRAFTS_PREFIX = 'content/crafts/';
const TAGS_OBJECT_PATH = 'content/crafts/tags.json';
const DELETED_OBJECT_PATH = 'content/crafts/deleted.json';
const DEFAULT_REVALIDATE_MS = 5_000;

const bundledMarkdownModules = import.meta.glob('/content/crafts/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const defaultSeedDocuments: RepositoryDocument[] = Object.values(bundledMarkdownModules).map(
	(markdown) => {
		const page = parseRepositoryMarkdown(markdown);
		return toDocument(page, repositoryPath(page.id));
	}
);
const defaultSeedTags: TagRegistry = readTagRegistry(defaultTagsJson);

export type GcsStoredObject = {
	content: string;
	generation: string | number;
};

export type GcsObjectStore = {
	listMarkdownPaths(): Promise<string[]>;
	readObject(path: string): Promise<GcsStoredObject | null>;
	writeObject(
		path: string,
		content: string,
		contentType: string,
		ifGenerationMatch?: string | number
	): Promise<void>;
	deleteObject(path: string): Promise<void>;
};

export type GcsRepositoryOptions = {
	store?: GcsObjectStore;
	revalidateIntervalMs?: number;
	seedDocuments?: RepositoryDocument[];
	seedTags?: TagRegistry;
};

export function createBucketObjectStore(bucket = getAssetBucket()): GcsObjectStore {
	return {
		async listMarkdownPaths() {
			const [files] = await bucket.getFiles({ prefix: CRAFTS_PREFIX });
			return files
				.map((file) => file.name)
				.filter((name) => name.startsWith(CRAFTS_PREFIX) && name.endsWith('.md'))
				.sort();
		},
		async readObject(path) {
			const file = bucket.file(path);
			try {
				const [metadata] = await file.getMetadata();
				const [buffer] = await file.download();
				return {
					content: buffer.toString('utf8'),
					generation: metadata.generation ?? 0
				};
			} catch (cause) {
				if (isStatusCode(cause, 404)) return null;
				throw cause;
			}
		},
		async writeObject(path, content, contentType, ifGenerationMatch) {
			const file = bucket.file(path);
			await file.save(Buffer.from(content, 'utf8'), {
				contentType,
				resumable: false,
				...(ifGenerationMatch !== undefined ? { preconditionOpts: { ifGenerationMatch } } : {})
			});
		},
		async deleteObject(path) {
			const file = bucket.file(path);
			try {
				await file.delete();
			} catch (cause) {
				if (isStatusCode(cause, 404)) return;
				throw cause;
			}
		}
	};
}

export function createGcsContentRepository(options: GcsRepositoryOptions = {}): ContentRepository {
	const store = options.store ?? createBucketObjectStore();
	const revalidateIntervalMs = options.revalidateIntervalMs ?? DEFAULT_REVALIDATE_MS;
	const seedDocuments = options.seedDocuments ?? (options.store ? [] : defaultSeedDocuments);
	const seedDocumentsById = new Map(seedDocuments.map((doc) => [doc.page.id, doc]));
	const seedTags = options.seedTags ?? (options.store ? {} : defaultSeedTags);

	let documentsById = new Map<string, RepositoryDocument>();
	let documentsBySlug = new Map<string, RepositoryDocument>();
	let cachedTags: TagRegistry = {};
	let hydrated = false;
	let lastHydratedAt = 0;
	let hydrationPromise: Promise<void> | null = null;
	let saves: Promise<unknown> = Promise.resolve();

	function setInMemoryDocuments(documents: RepositoryDocument[], tags: TagRegistry) {
		const nextById = new Map<string, RepositoryDocument>();
		const nextBySlug = new Map<string, RepositoryDocument>();
		for (const doc of documents) {
			nextById.set(doc.page.id, doc);
			nextBySlug.set(doc.page.slug, doc);
		}
		documentsById = nextById;
		documentsBySlug = nextBySlug;
		cachedTags = tags;
		hydrated = true;
		lastHydratedAt = Date.now();
	}

	function upsertInMemoryDocument(doc: RepositoryDocument, tags: TagRegistry) {
		const previous = documentsById.get(doc.page.id);
		if (previous && previous.page.slug !== doc.page.slug) {
			documentsBySlug.delete(previous.page.slug);
		}
		documentsById.set(doc.page.id, doc);
		documentsBySlug.set(doc.page.slug, doc);
		cachedTags = tags;
		lastHydratedAt = Date.now();
	}

	function removeInMemoryDocument(id: string) {
		const existing = documentsById.get(id);
		if (existing) {
			documentsById.delete(id);
			documentsBySlug.delete(existing.page.slug);
		}
		lastHydratedAt = Date.now();
	}

	async function readDeletedIds(): Promise<Set<string>> {
		const object = await store.readObject(DELETED_OBJECT_PATH);
		if (!object) return new Set();
		try {
			const parsed = JSON.parse(object.content);
			return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []);
		} catch {
			return new Set();
		}
	}

	async function writeDeletedIds(deletedIds: Set<string>): Promise<void> {
		await store.writeObject(
			DELETED_OBJECT_PATH,
			`${JSON.stringify([...deletedIds].sort(), null, '\t')}\n`,
			'application/json; charset=utf-8'
		);
	}

	async function hydrateFromStore(): Promise<void> {
		const [paths, tagsObject, deletedIds] = await Promise.all([
			store.listMarkdownPaths(),
			store.readObject(TAGS_OBJECT_PATH),
			readDeletedIds()
		]);
		const loaded = await Promise.all(
			paths.map(async (path) => {
				const object = await store.readObject(path);
				if (!object) return null;
				const page = parseRepositoryMarkdown(object.content);
				return toDocument(page, path);
			})
		);
		const remoteDocs = loaded.filter((doc): doc is RepositoryDocument => doc !== null);
		const mergedById = new Map<string, RepositoryDocument>();
		for (const seedDoc of seedDocuments) {
			if (!deletedIds.has(seedDoc.page.id)) {
				mergedById.set(seedDoc.page.id, seedDoc);
			}
		}
		for (const remoteDoc of remoteDocs) {
			if (!deletedIds.has(remoteDoc.page.id)) {
				mergedById.set(remoteDoc.page.id, remoteDoc);
			}
		}
		const tags = {
			...seedTags,
			...(tagsObject ? readTagRegistry(tagsObject.content) : {})
		};
		setInMemoryDocuments([...mergedById.values()], tags);
	}

	async function ensureHydrated(): Promise<void> {
		if (!hydrated) {
			hydrationPromise ??= hydrateFromStore().finally(() => {
				hydrationPromise = null;
			});
			await hydrationPromise;
			return;
		}
		if (
			revalidateIntervalMs >= 0 &&
			Date.now() - lastHydratedAt > revalidateIntervalMs &&
			!hydrationPromise
		) {
			hydrationPromise = hydrateFromStore()
				.catch((cause) => {
					console.warn('Background GCS craft revalidation failed', cause);
				})
				.finally(() => {
					hydrationPromise = null;
				});
		}
	}

	async function readRemoteTags(): Promise<TagRegistry> {
		const object = await store.readObject(TAGS_OBJECT_PATH);
		return {
			...seedTags,
			...(object ? readTagRegistry(object.content) : {})
		};
	}

	return {
		async tags() {
			await ensureHydrated();
			return cachedTags;
		},
		async list() {
			await ensureHydrated();
			return [...documentsById.values()];
		},
		async readBySlug(slug) {
			await ensureHydrated();
			return documentsBySlug.get(slug) ?? null;
		},
		save(page, expectedSha) {
			const saved = saves.then(async () => {
				const path = repositoryPath(page.id);
				const [currentObject, currentTags, deletedIds] = await Promise.all([
					store.readObject(path),
					readRemoteTags(),
					readDeletedIds()
				]);
				const currentDoc = currentObject
					? toDocument(parseRepositoryMarkdown(currentObject.content), path)
					: !deletedIds.has(page.id)
						? (seedDocumentsById.get(page.id) ?? null)
						: null;

				if ((currentDoc?.sha ?? null) !== expectedSha) {
					throw new RepositoryConflict();
				}

				const tags = assignTagColors(currentTags, page.tags);
				try {
					await store.writeObject(
						path,
						page.markdown,
						'text/markdown; charset=utf-8',
						currentObject ? currentObject.generation : 0
					);
				} catch (cause) {
					if (isStatusCode(cause, 412)) {
						throw new RepositoryConflict();
					}
					throw cause;
				}

				if (deletedIds.has(page.id)) {
					deletedIds.delete(page.id);
					await writeDeletedIds(deletedIds);
				}

				if (writeTagRegistry(tags) !== writeTagRegistry(currentTags)) {
					await store.writeObject(
						TAGS_OBJECT_PATH,
						writeTagRegistry(tags),
						'application/json; charset=utf-8'
					);
				}

				const document = toDocument(page, path);
				if (hydrated) {
					upsertInMemoryDocument(document, tags);
				}
				return { ...document, tags };
			});
			saves = saved.catch(() => {});
			return saved;
		},
		async delete(id) {
			const path = repositoryPath(id);
			await store.deleteObject(path);
			if (seedDocumentsById.has(id)) {
				const deletedIds = await readDeletedIds();
				if (!deletedIds.has(id)) {
					deletedIds.add(id);
					await writeDeletedIds(deletedIds);
				}
			}
			if (hydrated) {
				removeInMemoryDocument(id);
			}
		}
	};
}

function toDocument(page: Page, path: string): RepositoryDocument {
	return {
		page,
		path,
		sha: createHash('sha256').update(page.markdown).digest('hex')
	};
}

function isStatusCode(cause: unknown, status: number): boolean {
	return (cause as { code?: number })?.code === status;
}
