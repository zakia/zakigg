import { error, redirect } from '@sveltejs/kit';
import { toolSlugs } from '$lib/tools/registry';
import { toPublishedCraftSummary } from '$lib/crafts/publication';
import {
	getPublishedCraftDocument,
	getPublishedCraftMetadata
} from '$lib/server/crafts/publication';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders, url }) => {
	if (toolSlugs.has(params.slug)) redirect(308, `/tools/${params.slug}`);

	if (url.searchParams.has('edit')) {
		setHeaders({ 'Cache-Control': 'private, no-store' });
		return { edit: true, published: null, document: null };
	}

	const published = await getPublishedCraftMetadata(params.slug);

	if (!published) error(404, 'Craft not found');

	setHeaders({
		'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
	});

	return {
		edit: false,
		published: toPublishedCraftSummary(published),
		document: loadPublishedDocument(published)
	};
};

async function loadPublishedDocument(
	published: NonNullable<Awaited<ReturnType<typeof getPublishedCraftMetadata>>>
) {
	try {
		return await getPublishedCraftDocument(published);
	} catch (cause) {
		console.error('Published craft document could not be loaded', {
			slug: published.slug,
			pageId: published.pageId,
			cause
		});
		throw cause;
	}
}
