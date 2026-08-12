import { error } from '@sveltejs/kit';
import { craftSlugs } from '$lib/crafts/registry';
import { toPublishedCraftSummary } from '$lib/crafts/publication';
import {
	getPublishedCraftDocument,
	getPublishedCraftMetadata
} from '$lib/server/crafts/publication';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
	if (url.searchParams.has('edit')) {
		setHeaders({ 'Cache-Control': 'private, no-store' });
		return { edit: true, published: null, document: null };
	}

	const published = await getPublishedCraftMetadata(params.slug);

	if (!published && !craftSlugs.has(params.slug)) error(404, 'Craft not found');

	if (!published) return { edit: false, published: null, document: null };

	setHeaders({
		'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
	});

	return {
		edit: false,
		published: toPublishedCraftSummary(published),
		document: getPublishedCraftDocument(published)
	};
};
