import type { TagRegistry } from '$lib/crafts/tags';
import { dev } from '$app/environment';
import { readFrontmatter } from '$lib/editor/features/frontmatter/source';
import { readPage, type Page } from '$lib/editor/Page';
import { createGithubContentRepository } from './repository.github';
import { createLocalContentRepository } from './repository.local';

export type RepositoryDocument = {
	page: Page;
	path: string;
	sha: string;
};

export type ContentRepository = {
	list(): Promise<RepositoryDocument[]>;
	tags(): Promise<TagRegistry>;
	readBySlug(slug: string): Promise<RepositoryDocument | null>;
	save(page: Page, expectedSha: string | null): Promise<RepositoryDocument & { tags: TagRegistry }>;
	delete(id: string): Promise<void>;
};

export class RepositoryConflict extends Error {
	constructor() {
		super(
			'Git changed since this document was opened. Your browser backup is kept. Reload to review the latest version before saving.'
		);
	}
}

let repository: ContentRepository | null = null;

export function getContentRepository(): ContentRepository {
	if (repository) return repository;

	try {
		repository = createGithubContentRepository();
	} catch (cause) {
		if (!dev) throw cause;
		repository = createLocalContentRepository();
	}

	return repository;
}

export function repositoryPath(id: string) {
	if (!/^[A-Za-z0-9_-]{1,180}$/.test(id)) throw new Error('Invalid document ID');
	return `content/crafts/${id}.md`;
}

export function parseRepositoryMarkdown(markdown: string): Page {
	const parsed = readFrontmatter(markdown);
	if (parsed.error) throw new Error(parsed.error);
	const id = parsed.values?.id;
	if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(id)) {
		throw new Error('Repository Markdown must contain a valid frontmatter id');
	}
	const page = readPage(markdown);
	return page;
}
