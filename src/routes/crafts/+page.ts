import { crafts } from '$lib/crafts/registry';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ data }) => {
	const publishedBySlug = new Map(data.publishedCrafts.map((craft) => [craft.slug, craft]));
	const visibleCrafts = [
		...crafts.filter((craft) => !craft.draft && !publishedBySlug.has(craft.slug)),
		...data.publishedCrafts
	].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
	const tags = Array.from(new Set(visibleCrafts.flatMap((c) => c.tags))).sort();
	return { crafts: visibleCrafts, tags };
};
