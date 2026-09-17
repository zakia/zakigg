import { command, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { parseStoredPage, toStoredNotePage } from '$lib/editor/document/model';
import { auth } from '$lib/server/auth';
import { getContentRepository } from '$lib/server/content/repository';

const SafeIdSchema = v.pipe(
	v.string(),
	v.nonEmpty(),
	v.maxLength(180),
	v.regex(/^[A-Za-z0-9_-]+$/)
);
const SlugSchema = v.pipe(v.string(), v.nonEmpty(), v.maxLength(240));
const PageJsonSchema = v.object({
	pageJson: v.pipe(v.string(), v.nonEmpty(), v.maxLength(8_000_000))
});

export const listRepositoryCrafts = query(async () => {
	auth({ required: true });
	return (await getContentRepository().list()).map(({ page }) => toStoredNotePage(page));
});

export const getRepositoryCraft = query(SlugSchema, async (slug) => {
	auth({ required: true });
	const document = await getContentRepository().readBySlug(slug);
	return document ? toStoredNotePage(document.page) : null;
});

export const saveRepositoryCraft = command(PageJsonSchema, async ({ pageJson }) => {
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
	const repository = getContentRepository();
	const duplicate = (await repository.list()).find(
		(document) => document.page.slug === page.slug && document.page.id !== page.id
	);
	if (duplicate) throw error(409, `Another document already uses /crafts/${page.slug}`);
	const saved = await repository.save(page);
	listRepositoryCrafts().refresh();
	getRepositoryCraft(page.slug).set(toStoredNotePage(saved.page));
	return { sha: saved.sha, path: saved.path };
});

export const deleteRepositoryCraft = command(SafeIdSchema, async (id) => {
	auth({ required: true });
	assertSameOrigin();
	await getContentRepository().delete(id);
	listRepositoryCrafts().refresh();
});

function assertSameOrigin() {
	const { request, url } = getRequestEvent();
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) throw error(403, 'Invalid request origin');
}
