import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createNotePage } from '$lib/editor/document/model';
import { parseRepositoryMarkdown, repositoryPath } from './repository';
import { createLocalContentRepository } from './repository.local';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('Git Markdown repository documents', () => {
	it('round-trips every identity and publication field through Markdown', () => {
		const original = createNotePage({
			id: 'page_test',
			properties: [
				{ key: 'title', value: 'Repository document' },
				{ key: 'slug', value: 'repository-document' },
				{ key: 'date', value: '2026-09-16' },
				{ key: 'tags', value: ['markdown', 'git'] },
				{ key: 'draft', value: true }
			],
			markdown: 'Canonical body.'
		});

		const parsed = parseRepositoryMarkdown(original.markdown);
		expect(parsed).toMatchObject({
			id: 'page_test',
			title: 'Repository document',
			slug: 'repository-document',
			tags: ['git', 'markdown'],
			frontmatter: { date: '2026-09-16', draft: true }
		});
		expect(parsed.markdown).toBe(original.markdown);
		expect(repositoryPath(parsed.id)).toBe('content/crafts/page_test.md');
	});

	it('rejects Markdown without a stable id', () => {
		expect(() => parseRepositoryMarkdown('---\ntitle: Missing id\n---\n\nBody\n')).toThrow(
			'frontmatter id'
		);
	});

	it('saves, lists, reads, and deletes complete Markdown files', async () => {
		const root = await mkdtemp(join(tmpdir(), 'zakigg-content-'));
		temporaryDirectories.push(root);
		const repository = createLocalContentRepository(root);
		const page = createNotePage({
			id: 'page_local',
			properties: [
				{ key: 'title', value: 'Local repository' },
				{ key: 'slug', value: 'local-repository' },
				{ key: 'date', value: '2026-09-16' },
				{ key: 'draft', value: false }
			],
			markdown: 'Stored in Git.'
		});

		await repository.save(page);
		expect((await repository.list()).map(({ page }) => page.id)).toEqual(['page_local']);
		expect((await repository.readBySlug('local-repository'))?.page.markdown).toBe(page.markdown);

		await repository.delete(page.id);
		expect(await repository.list()).toEqual([]);
	});
});
