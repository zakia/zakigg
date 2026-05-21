import { query, command, getRequestEvent } from '$app/server';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import * as v from 'valibot';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CraftMeta } from '$lib/crafts/types';

const CRAFTS_DIR = 'src/lib/crafts';
const SLUG_RE = /^[a-z0-9-]+$/i;

function assertDev() {
	if (!dev) error(403, 'Admin is only available in development');
}

async function readMetaFile(slug: string): Promise<CraftMeta | null> {
	const path = join(CRAFTS_DIR, slug, 'meta.ts');
	let source: string;
	try {
		source = await readFile(path, 'utf8');
	} catch {
		return null;
	}
	const match = source.match(/export const meta[^=]*=\s*(\{[\s\S]*?\})\s*;\s*$/m);
	if (!match) return null;
	// Evaluate the object literal safely by Function-wrapping (dev-only, trusted source).
	try {
		const obj = new Function(`return (${match[1]});`)();
		return obj as CraftMeta;
	} catch {
		return null;
	}
}

function s(value: string): string {
	// Prefer single quotes to match project style; escape embedded single quotes.
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function stringifyMeta(meta: CraftMeta): string {
	const entries: string[] = [];
	entries.push(`\ttitle: ${s(meta.title)}`);
	entries.push(`\tdescription: ${s(meta.description)}`);
	entries.push(`\ttags: [${meta.tags.map(s).join(', ')}]`);
	entries.push(`\tdate: ${s(meta.date)}`);
	if (meta.draft !== undefined) entries.push(`\tdraft: ${meta.draft}`);
	if (meta.fullBleed !== undefined) entries.push(`\tfullBleed: ${meta.fullBleed}`);
	return [
		`import type { CraftMeta } from '$lib/crafts/types';`,
		'',
		`export const meta: CraftMeta = {`,
		entries.join(',\n'),
		`};`,
		''
	].join('\n');
}

export type AdminCraft = CraftMeta & { slug: string };

export const getAdminCrafts = query<AdminCraft[]>(async () => {
	assertDev();
	const entries = await readdir(CRAFTS_DIR, { withFileTypes: true });
	const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
	const results: AdminCraft[] = [];
	for (const slug of slugs) {
		const meta = await readMetaFile(slug);
		if (meta) results.push({ ...meta, slug });
	}
	results.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
	return results;
});

const MetaSchema = v.object({
	title: v.pipe(v.string(), v.nonEmpty()),
	description: v.string(),
	tags: v.array(v.string()),
	date: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
	draft: v.optional(v.boolean()),
	fullBleed: v.optional(v.boolean())
});

export const updateMeta = command(
	v.object({
		slug: v.pipe(v.string(), v.regex(SLUG_RE)),
		meta: MetaSchema
	}),
	async ({ slug, meta }) => {
		assertDev();
		const path = join(CRAFTS_DIR, slug, 'meta.ts');
		const source = stringifyMeta(meta);
		await writeFile(path, source, 'utf8');
		await getAdminCrafts().refresh();
		return { ...meta, slug } as AdminCraft;
	}
);

export const renameTag = command(
	v.object({
		from: v.pipe(v.string(), v.nonEmpty()),
		to: v.pipe(v.string(), v.nonEmpty())
	}),
	async ({ from, to }) => {
		assertDev();
		const entries = await readdir(CRAFTS_DIR, { withFileTypes: true });
		const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
		let changed = 0;
		for (const slug of slugs) {
			const meta = await readMetaFile(slug);
			if (!meta) continue;
			if (!meta.tags.includes(from)) continue;
			const nextTags = Array.from(new Set(meta.tags.map((t) => (t === from ? to : t))));
			await writeFile(
				join(CRAFTS_DIR, slug, 'meta.ts'),
				stringifyMeta({ ...meta, tags: nextTags }),
				'utf8'
			);
			changed++;
		}
		await getAdminCrafts().refresh();
		return { changed };
	}
);

export const deleteTag = command(
	v.object({ tag: v.pipe(v.string(), v.nonEmpty()) }),
	async ({ tag }) => {
		assertDev();
		const entries = await readdir(CRAFTS_DIR, { withFileTypes: true });
		const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
		let changed = 0;
		for (const slug of slugs) {
			const meta = await readMetaFile(slug);
			if (!meta) continue;
			if (!meta.tags.includes(tag)) continue;
			const nextTags = meta.tags.filter((t) => t !== tag);
			await writeFile(
				join(CRAFTS_DIR, slug, 'meta.ts'),
				stringifyMeta({ ...meta, tags: nextTags }),
				'utf8'
			);
			changed++;
		}
		await getAdminCrafts().refresh();
		return { changed };
	}
);
