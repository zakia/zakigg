import {
	assignTagColors,
	readTagRegistry,
	writeTagRegistry,
	tagRegistryPath
} from '$lib/crafts/tags';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Page } from '$lib/editor/Page';
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
	return {
		async tags() {
			try {
				return readTagRegistry(await readFile(tagsPath, 'utf8'));
			} catch (cause) {
				if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return {};
				throw cause;
			}
		},
		async list() {
			await mkdir(root, { recursive: true });
			const names = (await readdir(root)).filter((name) => name.endsWith('.md')).sort();
			return Promise.all(names.map((name) => readDocument(resolve(root, name))));
		},
		async readBySlug(slug) {
			const documents = await this.list();
			return documents.find((document) => document.page.slug === slug) ?? null;
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
				const registry = await this.tags();
				const tags = assignTagColors(registry, page.tags);
				// Keep assignments if the document write fails; unused colors are valid registry entries.
				if (writeTagRegistry(tags) !== writeTagRegistry(registry)) {
					await writeFile(tagsPath, writeTagRegistry(tags), 'utf8');
				}
				await writeFile(absolutePath, page.markdown, {
					encoding: 'utf8',
					flag: current ? 'w' : 'wx'
				});
				return { ...toDocument(page, path), tags };
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
