import { createHash } from 'node:crypto';
import {
	createPublishedCraftDocument,
	createPublishedCraftSummary,
	createPublicCraftList,
	rewritePublishedAssetSources,
	type PublishedCraftSummary
} from '#lib/crafts/publication.js';
import type { CraftDocument, CraftListItem } from '#lib/crafts/types.js';
import type { Page } from '#lib/editor/Page.js';
import {
	getContentRepository,
	parseRepositoryMarkdown,
	repositoryPath,
	type RepositoryDocument
} from './repository';

const markdownModules = import.meta.glob('/content/crafts/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const repositoryPages = Object.values(markdownModules).map((markdown) =>
	parseRepositoryMarkdown(markdown)
);

export const seedRepositoryDocuments: RepositoryDocument[] = repositoryPages.map((page) => ({
	page,
	path: repositoryPath(page.id),
	sha: createHash('sha256').update(page.markdown).digest('hex')
}));

export type CompiledCraft = {
	sha: string;
	page: Page;
	summary: PublishedCraftSummary;
	document: CraftDocument;
};

const compiledById = new Map<string, CompiledCraft>();

export function compileCraft(doc: RepositoryDocument): CompiledCraft {
	const cached = compiledById.get(doc.page.id);
	if (cached && cached.sha === doc.sha) return cached;

	const compiled: CompiledCraft = {
		sha: doc.sha,
		page: doc.page,
		summary: createPublishedCraftSummary(doc.page),
		document: rewritePublishedAssetSources(createPublishedCraftDocument(doc.page))
	};
	compiledById.set(doc.page.id, compiled);
	return compiled;
}

const seedPublished = seedRepositoryDocuments
	.filter((doc) => doc.page.frontmatter?.published === true)
	.map(compileCraft);

export function listStaticCrafts(): CraftListItem[] {
	return createPublicCraftList(seedPublished.map(({ summary }) => summary));
}

export function listStaticCraftSlugs() {
	return seedPublished.map(({ summary }) => summary.slug);
}

export function getStaticCraft(slug: string):
	| {
			page: Page;
			summary: PublishedCraftSummary;
			document: CraftDocument;
	  }
	| undefined {
	return seedPublished.find(({ summary }) => summary.slug === slug);
}

export async function listPublishedCrafts(): Promise<CraftListItem[]> {
	try {
		const documents = await getContentRepository().list();
		const summaries = documents
			.filter((doc) => doc.page.frontmatter?.published === true)
			.map((doc) => compileCraft(doc).summary);
		return createPublicCraftList(summaries);
	} catch {
		return listStaticCrafts();
	}
}

export async function getPublishedCraft(slug: string): Promise<
	| {
			page: Page;
			summary: PublishedCraftSummary;
			document: CraftDocument;
	  }
	| undefined
> {
	try {
		const doc = await getContentRepository().readBySlug(slug);
		if (!doc || doc.page.frontmatter?.published !== true) return undefined;
		return compileCraft(doc);
	} catch {
		return getStaticCraft(slug);
	}
}
