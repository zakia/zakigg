import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { NotePage } from '$lib/editor/document/model';
import {
	parseRepositoryMarkdown,
	repositoryPath,
	type ContentRepository,
	type RepositoryDocument
} from './repository';

export function createLocalContentRepository(root = resolve('content/crafts')): ContentRepository {
	return {
		async list() {
			await mkdir(root, { recursive: true });
			const names = (await readdir(root)).filter((name) => name.endsWith('.md')).sort();
			return Promise.all(names.map((name) => readDocument(resolve(root, name))));
		},
		async readBySlug(slug) {
			const documents = await this.list();
			return documents.find((document) => document.page.slug === slug) ?? null;
		},
		async save(page) {
			await mkdir(root, { recursive: true });
			const path = repositoryPath(page.id);
			const absolutePath = resolve(root, `${page.id}.md`);
			await writeFile(absolutePath, page.markdown, 'utf8');
			return toDocument(page, path);
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

function toDocument(page: NotePage, path: string): RepositoryDocument {
	return {
		page,
		path,
		sha: createHash('sha256').update(page.markdown).digest('hex')
	};
}
