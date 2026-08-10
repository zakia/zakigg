import { error } from '@sveltejs/kit';
import { craftSlugs } from '$lib/crafts/registry';
import {
	getPublishedCraftDocument,
	getPublishedCraftMetadata
} from '$lib/server/crafts/publication';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const published = await getPublishedCraftMetadata(params.slug);

	if (!published && !craftSlugs.has(params.slug)) error(404, 'Craft not found');

	if (!published) return { published: null, document: null };

	setHeaders({
		'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
	});

	const {
		ownerId: _owner,
		assetIds: _assets,
		bodyHash: _hash,
		bodyObject: _object,
		...meta
	} = published;

	return {
		published: meta,
		document: getPublishedCraftDocument(published)
	};
};
