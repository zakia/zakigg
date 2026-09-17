import { error, redirect } from '@sveltejs/kit';
import { toolSlugs } from '$lib/tools/registry';
import { getStaticCraft, listStaticCraftSlugs } from '$lib/server/content/static';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = 'auto';

export const entries: EntryGenerator = () => listStaticCraftSlugs().map((slug) => ({ slug }));

export const load: PageServerLoad = async ({ params }) => {
	if (toolSlugs.has(params.slug)) redirect(308, `/tools/${params.slug}`);
	const craft = getStaticCraft(params.slug);
	if (!craft) error(404, 'Craft not found');
	return { meta: craft.summary, document: craft.document };
};
