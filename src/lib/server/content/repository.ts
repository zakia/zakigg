import { dev } from '$app/environment';
import { parseMarkdownFrontmatter } from '$lib/editor/document/markdown';
import { createNotePage, type NotePage } from '$lib/editor/document/model';
import { createGithubContentRepository } from './repository.github';
import { createLocalContentRepository } from './repository.local';

export type RepositoryDocument = {
	page: NotePage;
	path: string;
	sha: string;
};

export type ContentRepository = {
	list(): Promise<RepositoryDocument[]>;
	readBySlug(slug: string): Promise<RepositoryDocument | null>;
	save(page: NotePage): Promise<RepositoryDocument>;
	delete(id: string): Promise<void>;
};

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

export function parseRepositoryMarkdown(markdown: string): NotePage {
	const parsed = parseMarkdownFrontmatter(markdown);
	const id = parsed.properties?.id;
	if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(id)) {
		throw new Error('Repository Markdown must contain a valid frontmatter id');
	}
	const page = createNotePage({ id, markdown });
	return page;
}
