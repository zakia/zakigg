import { crafts } from '$lib/crafts/registry';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const visibleCrafts = crafts.filter((c) => !c.draft);
	const tags = Array.from(new Set(visibleCrafts.flatMap((c) => c.tags))).sort();
	return { crafts: visibleCrafts, tags };
};
