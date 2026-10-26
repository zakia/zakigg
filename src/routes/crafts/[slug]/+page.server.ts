import { error, redirect } from '@sveltejs/kit';
import { toolSlugs } from '#lib/tools/registry.js';
import { getPublishedCraft } from '#lib/server/content/static.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	if (toolSlugs.has(params.slug)) redirect(308, `/tools/${params.slug}`);
	const craft = await getPublishedCraft(params.slug);
	if (!craft) {
		if (url.searchParams.has('edit')) {
			return { meta: null, document: null, page: null };
		}
		error(404, 'Craft not found');
	}
	return { meta: craft.summary, document: craft.document, page: craft.page };
};
