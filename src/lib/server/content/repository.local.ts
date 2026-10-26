import {
	assignTagColors,
	readTagRegistry,
	writeTagRegistry,
	tagRegistryPath,
	type TagRegistry
} from '#lib/crafts/tags.js';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '#lib/editor/Page.js';
import {
	RepositoryConflict,
	parseRepositoryMarkdown,
	repositoryPath,
	type ContentRepository,
	type RepositoryDocument
} from './repository';

export function createLocalContentRepository(
	root = resolve('content/crafts'),
	tagsPath = resolve(tagRegistryPath)
): ContentRepository {
	let saves: Promise<unknown> = Promise.resolve();
	let documentsById = new Map<string, RepositoryDocument>();
	let documentsBySlug = new Map<string, RepositoryDocument>();
	let cachedTags: TagRegistry | null = null;
	let hydrated = false;
	let hydrationPromise: Promise<void> | null = null;

	async function readTagsFromDisk(): Promise<TagRegistry> {
		try {
			return readTagRegistry(await readFile(tagsPath, 'utf8'));
		} catch (cause) {
			if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return {};
			throw cause;
		}
	}

	async function hydrateFromDisk(): Promise<void> {
		await mkdir(root, { recursive: true });
		const [names, tags] = await Promise.all([readdir(root), readTagsFromDisk()]);
		const markdownNames = names.filter((name) => name.endsWith('.md')).sort();
		const docs = await Promise.all(markdownNames.map((name) => readDocument(resolve(root, name))));
		const nextById = new Map<string, RepositoryDocument>();
		const nextBySlug = new Map<string, RepositoryDocument>();
		for (const doc of docs) {
			nextById.set(doc.page.id, doc);
			nextBySlug.set(doc.page.slug, doc);
		}
		documentsById = nextById;
		documentsBySlug = nextBySlug;
		cachedTags = tags;
		hydrated = true;
	}

	async function ensureHydrated(): Promise<void> {
		if (hydrated) return;
		hydrationPromise ??= hydrateFromDisk().finally(() => {
			hydrationPromise = null;
		});
		await hydrationPromise;
	}

	return {
		async tags() {
			if (cachedTags) return cachedTags;
			cachedTags = await readTagsFromDisk();
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
				await mkdir(root, { recursive: true });
				const path = repositoryPath(page.id);
				const absolutePath = resolve(root, `${page.id}.md`);
				let current: RepositoryDocument | null = null;
				try {
					current = await readDocument(absolutePath);
				} catch (cause) {
					if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
				}
				if ((current?.sha ?? null) !== expectedSha) throw new RepositoryConflict();
				const registry = await readTagsFromDisk();
				const tags = assignTagColors(registry, page.tags);
				// Keep assignments if the document write fails; unused colors are valid registry entries.
				if (writeTagRegistry(tags) !== writeTagRegistry(registry)) {
					await writeFile(tagsPath, writeTagRegistry(tags), 'utf8');
				}
				await writeFile(absolutePath, page.markdown, {
					encoding: 'utf8',
					flag: current ? 'w' : 'wx'
				});
				const doc = toDocument(page, path);
				if (hydrated) {
					const previous = documentsById.get(page.id);
					if (previous && previous.page.slug !== page.slug) {
						documentsBySlug.delete(previous.page.slug);
					}
					documentsById.set(page.id, doc);
					documentsBySlug.set(page.slug, doc);
				}
				cachedTags = tags;
				return { ...doc, tags };
			});
			saves = saved.catch(() => {});
			return saved;
		},
		async delete(id) {
			try {
				await unlink(resolve(root, `${id}.md`));
			} catch (cause) {
				if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
			}
			if (hydrated) {
				const existing = documentsById.get(id);
				if (existing) {
					documentsById.delete(id);
					documentsBySlug.delete(existing.page.slug);
				}
			}
		}
	};
}

async function readDocument(absolutePath: string): Promise<RepositoryDocument> {
	const markdown = await readFile(absolutePath, 'utf8');
	const page = parseRepositoryMarkdown(markdown);
	return toDocument(page, repositoryPath(page.id));
}

function toDocument(page: Page, path: string): RepositoryDocument {
	return {
		page,
		path,
		sha: createHash('sha256').update(page.markdown).digest('hex')
	};
}
