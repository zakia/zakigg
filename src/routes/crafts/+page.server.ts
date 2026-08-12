import { listPublishedCrafts } from '$lib/server/crafts/publication';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders, url }) => {
	if (url.searchParams.has('edit')) {
		setHeaders({ 'Cache-Control': 'private, no-store' });
		return { edit: true, publishedCrafts: [] };
	}

	setHeaders({
		'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
	});

	return { edit: false, publishedCrafts: await listPublishedCrafts() };
};
