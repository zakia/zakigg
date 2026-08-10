import { listPublishedCrafts } from '$lib/server/crafts/publication';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({
		'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
	});

	return { publishedCrafts: await listPublishedCrafts() };
};
