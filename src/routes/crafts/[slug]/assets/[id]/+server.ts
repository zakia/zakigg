import { error, type RequestHandler } from '@sveltejs/kit';
import { getPublishedCraftMetadata } from '$lib/server/crafts/publication';
import { readAssetBlob } from '$lib/server/notes-sync/firestore';

export const GET: RequestHandler = async ({ params }) => {
	const slug = params.slug ?? '';
	const id = params.id ?? '';
	const craft = await getPublishedCraftMetadata(slug);

	if (!craft || !craft.assetIds.includes(id)) throw error(404, 'Craft asset not found');

	const blob = await readAssetBlob(craft.ownerId, id);
	if (!blob) throw error(404, 'Craft asset not found');

	return new Response(new Uint8Array(blob.data), {
		headers: {
			'Content-Type': blob.contentType || 'application/octet-stream',
			'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
		}
	});
};
