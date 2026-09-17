import {
	createPublishedCraftDocument,
	createPublishedCraftSummary,
	createPublicCraftList,
	rewritePublishedAssetSources
} from '$lib/crafts/publication';
import type { CraftDocument, CraftListItem } from '$lib/crafts/types';
import { parseRepositoryMarkdown } from './repository';

const markdownModules = import.meta.glob('/content/crafts/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const published = Object.values(markdownModules)
	.map((markdown) => parseRepositoryMarkdown(markdown))
	.filter((page) => page.frontmatter?.draft !== true)
	.map((page) => ({
		page,
		summary: createPublishedCraftSummary(page),
		document: rewritePublishedAssetSources(createPublishedCraftDocument(page))
	}));

export function listStaticCrafts(): CraftListItem[] {
	return createPublicCraftList(published.map(({ summary }) => summary));
}

export function listStaticCraftSlugs() {
	return published.map(({ page }) => page.slug);
}

export function getStaticCraft(slug: string):
	| {
			summary: (typeof published)[number]['summary'];
			document: CraftDocument;
	  }
	| undefined {
	return published.find(({ page }) => page.slug === slug);
}
