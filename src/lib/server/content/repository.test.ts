import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createPage, readPage } from '#lib/crafts/Page.js';
import { createContentRepository, parseRepositoryMarkdown, repositoryPath } from './repository';
import { createFileTextStore } from '../storage/files';
const createLocalContentRepository = (root: string, tagsPath: string) =>
	createContentRepository(createFileTextStore(), { prefix: root + '/', tagsKey: tagsPath });

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('Craft document repository', () => {
	it('round-trips every identity and publication field through Markdown', () => {
		const original = createPage(
			{
				id: 'page_test',

				title: 'Repository document',
				slug: 'repository-document',
				date: '2026-09-16',
				tags: ['markdown', 'git'],
				published: false
			},
			'Canonical body.'
		);

		const parsed = parseRepositoryMarkdown(original.markdown);
		expect(parsed).toMatchObject({
			id: 'page_test',
			title: 'Repository document',
			slug: 'repository-document',
			tags: ['git', 'markdown'],
			frontmatter: { date: '2026-09-16', published: false }
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
		const repository = createLocalContentRepository(root, join(root, 'tags.json'));
		const page = createPage(
			{
				id: 'page_local',

				title: 'Local repository',
				slug: 'local-repository',
				date: '2026-09-16',
				published: true
			},
			'Stored in Git.'
		);

		await repository.save(page);
		expect((await repository.list()).map(({ page }) => page.id)).toEqual(['page_local']);
		expect((await repository.readBySlug('local-repository'))?.page.markdown).toBe(page.markdown);

		await repository.delete(page.id);
		expect(await repository.list()).toEqual([]);
	});
});

it('lets the last explicit save replace the stored source', async () => {
	const root = await mkdtemp(join(tmpdir(), 'zakigg-save-'));
	temporaryDirectories.push(root);
	const repository = createLocalContentRepository(root, join(root, 'tags.json'));
	const original = createPage({ id: 'page_save' }, 'Original');
	await repository.save(original);
	const newer = readPage(original.markdown + 'Newer', original);
	await repository.save(newer);
	expect((await repository.readBySlug(newer.slug))?.page.markdown).toBe(newer.markdown);
	await repository.save(original);
	expect((await repository.readBySlug(original.slug))?.page.markdown).toBe(original.markdown);
});

it('persists new colors and retains them when tags and documents are removed', async () => {
	const root = await mkdtemp(join(tmpdir(), 'zakigg-tags-'));
	temporaryDirectories.push(root);
	const repository = createLocalContentRepository(root, join(root, 'tags.json'));
	const page = createPage({ id: 'page_tags', tags: ['one', 'two'] });
	const saved = await repository.save(page);
	expect(new Set(Object.values(saved.tags)).size).toBe(2);
	const withoutTags = readPage(page.markdown.replace(/tags:[\s\S]*?(?=\n\S)/, 'tags: []'), page);
	await repository.save(withoutTags);
	await repository.delete(page.id);
	expect(await repository.tags()).toEqual(saved.tags);
});

it('serializes local saves so concurrent new tags do not lose assignments', async () => {
	const root = await mkdtemp(join(tmpdir(), 'zakigg-tags-'));
	temporaryDirectories.push(root);
	const repository = createLocalContentRepository(root, join(root, 'tags.json'));
	await Promise.all([
		repository.save(createPage({ id: 'page_a', tags: ['a'] })),
		repository.save(createPage({ id: 'page_b', tags: ['b'] }))
	]);
	expect(await repository.tags()).toEqual({ a: 'blue', b: 'violet' });
});
