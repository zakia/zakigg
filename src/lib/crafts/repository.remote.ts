import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { parseStoredPage, toStoredPage } from '$lib/editor/Page';
import { auth } from '$lib/server/auth';
import {
	getContentRepository,
	RepositoryConflict,
	parseRepositoryMarkdown
} from '$lib/server/content/repository';

const SafeIdSchema = v.pipe(
	v.string(),
	v.nonEmpty(),
	v.maxLength(180),
	v.regex(/^[A-Za-z0-9_-]+$/)
);
const SlugSchema = v.pipe(v.string(), v.nonEmpty(), v.maxLength(240));
const PageJsonSchema = v.object({
	pageJson: v.pipe(v.string(), v.nonEmpty(), v.maxLength(8_000_000)),
	expectedSha: v.nullable(v.pipe(v.string(), v.nonEmpty(), v.maxLength(128)))
});

export const listRepositoryCrafts = query(async () => {
	auth({ required: true });
	const repository = getContentRepository();
	const [documents, tags] = await Promise.all([repository.list(), repository.tags()]);
	return { documents: documents.map(({ page, sha }) => ({ page: toStoredPage(page), sha })), tags };
});

export const getRepositoryCraft = query(SlugSchema, async (slug) => {
	auth({ required: true });
	const repository = getContentRepository();
	const [document, tags] = await Promise.all([repository.readBySlug(slug), repository.tags()]);
	return document ? { page: toStoredPage(document.page), sha: document.sha, tags } : null;
});

export const saveRepositoryCraft = command(PageJsonSchema, async ({ pageJson, expectedSha }) => {
	auth({ required: true });
	assertSameOrigin();
	let input: unknown;
	try {
		input = JSON.parse(pageJson);
	} catch {
		throw error(400, 'Invalid Markdown document');
	}
	const page = parseStoredPage(input);
	if (!page) throw error(400, 'Invalid Markdown document');
	try {
		if (parseRepositoryMarkdown(page.markdown).id !== page.id)
			throw new Error('Document ID mismatch');
	} catch {
		throw error(400, 'Markdown must contain valid frontmatter and a matching document ID');
	}
	const repository = getContentRepository();
	const duplicate = (await repository.list()).find(
		(document) => document.page.slug === page.slug && document.page.id !== page.id
	);
	if (duplicate) throw error(409, `Another document already uses /crafts/${page.slug}`);
	let saved;
	try {
		saved = await repository.save(page, expectedSha);
	} catch (cause) {
		if (cause instanceof RepositoryConflict) throw error(409, cause.message);
		throw cause;
	}
	getRepositoryCraft(page.slug).set({
		page: toStoredPage(saved.page),
		sha: saved.sha,
		tags: saved.tags
	});
	return { sha: saved.sha, path: saved.path, tags: saved.tags };
});

export const deleteRepositoryCraft = command(SafeIdSchema, async (id) => {
	auth({ required: true });
	assertSameOrigin();
	await getContentRepository().delete(id);
});

function assertSameOrigin() {
	const { request, url } = getRequestEvent();
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) throw error(403, 'Invalid request origin');
}
