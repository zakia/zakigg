import { error } from '@sveltejs/kit';
import { crafts, craftSlugs, loadCraft } from '$lib/crafts/registry';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	if (!craftSlugs.has(params.slug)) {
		error(404, 'Craft not found');
	}
	const meta = crafts.find((c) => c.slug === params.slug)!;
	const craft = await loadCraft(params.slug);
	return { meta, craft };
};
